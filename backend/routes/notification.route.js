import express from "express";
import { param, query, validationResult } from "express-validator";
import { protect } from "../middleware/auth.middleware.js";
import {
  listMyNotifications,
  markAllRead,
  markOnRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.array() });
  next();
};

const listRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];
const idRule = [param("id").isMongoId().withMessage("ID inválido")];

router.get("/", protect, listRules, validate, listMyNotifications);
router.patch("/:id/read", protect, idRule, validate, markOnRead);
router.patch("/read-all", protect, markAllRead);

export default router;
