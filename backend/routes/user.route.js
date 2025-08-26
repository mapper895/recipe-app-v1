// routes/user.route.js
import express from "express";
import rateLimit from "express-rate-limit";
import {
  followUser,
  getMe,
  loginUser,
  logoutUser,
  registerUser,
  unfollowUser,
  updateMe,
} from "../controllers/user.controller.js";
import { body, param, validationResult } from "express-validator";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Middleware genérico para devolver 400 si hay errores de validación
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Errores de validación",
      errors: errors.array(),
    });
  }
  next();
};

// Rate limit para endpoints sensibles (ajusta valores según tus necesidades)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Validaciones
const registerRules = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("El username debe tener entre 3 y 30 caracteres")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("El username solo puede contener letras, números y _"),
  body("email").normalizeEmail().isEmail().withMessage("Email inválido"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
];

const loginRules = [
  body("emailOrUsername").trim().notEmpty().withMessage("Requerido"),
  body("password").notEmpty().withMessage("Requerido"),
];

const updateRules = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("El username debe tener entre 3 y 30 caracteres")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("El username solo puede contener letras, números y _"),
  body("email")
    .optional()
    .normalizeEmail()
    .isEmail()
    .withMessage("Email inválido"),
  body("bio").optional().isLength({ max: 280 }).withMessage("Bio muy larga"),
  body("avatarUrl")
    .optional()
    .isURL()
    .withMessage("avatarUrl debe ser URL válida"),
  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
];

// Rutas
router.post("/register", authLimiter, registerRules, validate, registerUser);
router.post("/login", authLimiter, loginRules, validate, loginUser);

// Protege logout para asegurarte de que hay sesión activa
router.post("/logout", protect, logoutUser);

router.get("/me", protect, getMe);
router.patch("/me", protect, updateRules, validate, updateMe);

// Follow / Unfollow
router.post(
  "/:id/follow",
  protect,
  param("id").isMongoId().withMessage("ID inválido"),
  validate,
  followUser
);
router.post(
  "/:id/unfollow",
  protect,
  param("id").isMongoId().withMessage("ID inválido"),
  validate,
  unfollowUser
);

export default router;
