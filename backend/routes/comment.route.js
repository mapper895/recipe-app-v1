import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { protect } from "../middleware/auth.middleware.js";
import {
  listComment,
  createComment,
  deleteComment,
} from "../controllers/comment.controller.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.mesage });
  next();
};

const listRules = [
  query("recipe").isMongoId().withMessage("recipe es requerido"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];
const createRules = [
  body("recipe").isMongoId().withMessage("recipe inválido"),
  body("text").trim().isLength({ min: 1 }).withMessage("Texto requerido"),
  body("parent").optional().isMongoId(),
];
const idRule = [param("id").isMongoId().withMessage("ID inválido")];

router.get("/", listRules, validate, listComment);
router.post("/", protect, createRules, validate, createComment);
router.delete("/:id", protect, idRule, validate, deleteComment);

export default router;
