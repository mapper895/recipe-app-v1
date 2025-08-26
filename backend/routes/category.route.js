import express from "express";
import { body, param, validationResult } from "express-validator";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.message });
  next();
};

const createRules = [
  body("name").trim().isLength({ min: 2 }).withMessage("Nombre requerido"),
  body("slug")
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("slug solo minúsculas, números y guiones"),
];
const idRule = [param("id").isMongoId().withMessage("ID inválido")];
const updateRules = [
  ...idRule,
  body("name").trim().isLength({ min: 2 }).withMessage("Nombre requerido"),
  body("slug")
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("slug solo minúsculas, números y guiones"),
];

router.get("/", listCategories);
router.post(
  "/",
  protect,
  requireRole(["admin"]),
  createRules,
  validate,
  createCategory
);
router.put(
  "/:id",
  protect,
  requireRole(["admin"]),
  updateRules,
  validate,
  updateCategory
);
router.delete(
  "/:id",
  protect,
  requireRole(["admin"]),
  idRule,
  validate,
  deleteCategory
);

export default router;
