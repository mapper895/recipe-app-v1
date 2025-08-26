import express from "express";
import { query, validationResult } from "express-validator";
import { unifiedSearch } from "../controllers/search.controller.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.array() });
  next();
};

router.get(
  "/",
  [
    query("q").trim().isLength({ min: 1 }).withMessage("q requerido"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  unifiedSearch
);

export default router;
