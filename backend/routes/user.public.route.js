// routes/user.public.route.js
import express from "express";
import { param, query, validationResult } from "express-validator";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { getUserPublicProfile } from "../controllers/user.public.controller.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.array() });
  next();
};

const rules = [
  param("username")
    .trim()
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("username inválido"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  query("sort").optional().isIn(["recent", "top", "popular"]),
];

// Perfil público + recetas del usuario
router.get("/:username", optionalAuth, rules, validate, getUserPublicProfile);

export default router;
