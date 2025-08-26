import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { protect } from "../middleware/auth.middleware.js";
import {
  createRecipe,
  deleteRecipe,
  getMySavedRecipes,
  getRecipeById,
  listRecipes,
  rateRecipe,
  toggleSaveRecipe,
  updateRecipe,
} from "../controllers/recipe.controller.js";
import upload from "../utils/upload.util.js";

const router = express.Router();

// Middleware generico para devolver 400 si hay errores de validacion
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Errores de validacion", errors: errors.array });
  }
  next();
};

/** ---------------------------
 *         Validaciones
 *  --------------------------*/
const createRules = [
  body("title")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Título demasiado corto"),
  body("description").optional().isString(),
  body("ingredients").optional().isArray(),
  body("steps").optional().isArray(),
  body("categories").optional().isArray(),
  body("isPublic").optional().isBoolean(),
];

const idRule = [param("id").isMongoId().withMessage("ID inválido")];

const updateRules = [
  ...idRule,
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage("Título demasiado corto"),
  body("description").optional().isString(),
  body("ingredients").optional().isArray(),
  body("steps").optional().isArray(),
  body("categories").optional().isArray(),
  body("isPublic").optional().isBoolean(),
];

const rateRules = [
  ...idRule,
  body("value")
    .isInt({ min: 1, max: 5 })
    .withMessage("Valor debe estar entre 1 y 5"),
];

const listRules = [
  query("category").optional().isString(),
  query("author").optional().isMongoId(),
  query("authorUsername").optional().isString(),
  query("savedBy").optional().isMongoId(),
  query("minRating").optional().isFloat({ min: 0, max: 5 }),
  query("sort").optional().isIn(["recent", "top", "popular"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  query("followingOnly").optional().isIn(["true", "false"]),
];

/** ---------------------------
 *             Rutas
 *  --------------------------*/

// Crear receta
router.post(
  "/",
  protect,
  upload.array("images", 5),
  createRules,
  validate,
  createRecipe
);
// Listar/buscar
router.get("/", listRules, validate, listRecipes);
// Detalle de cada receta
router.get("/:id", idRule, validate, getRecipeById);
//Actualizar receta (autor)
router.put(
  "/:id",
  protect,
  upload.array("images", 5),
  updateRules,
  validate,
  updateRecipe
);
// Eliminar receta (autor)
router.delete("/:id", protect, idRule, validate, deleteRecipe);
// Valorar receta
router.post("/:id/rate", protect, rateRules, validate, rateRecipe);
// Guardar/desguardar receta
router.post("/:id/save", protect, idRule, validate, toggleSaveRecipe);
// Mis guardados
router.get("/me/saved/list", protect, listRules, validate, getMySavedRecipes);

export default router;
