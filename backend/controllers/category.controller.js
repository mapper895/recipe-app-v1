import { validationResult } from "express-validator";
import Category from "../models/category.model.js";

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.array() });
    return true;
  }
  return false;
};

export const listCategories = async (_req, res) => {
  try {
    const items = await Category.find().sort({ name: 1 }).lean();
    res.json({ items, total: items.length });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al listar categorias", error: error.message });
  }
};

export const createCategory = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { name, slug } = req.body;
    const exists = await Category.findOne({ $or: [{ name }, { slug }] }).lean();
    if (exists)
      return res.status(409).json({ message: "La categoria ya existe" });

    const cat = await Category.create({ name, slug });
    res.status(201).json({ category: cat });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al crear categoria", error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    const taken = await Category.findOne({
      _id: { $ne: id },
      $or: [{ name }, { slug }],
    }).lean();
    if (taken) return res.status(409).json({ message: "Categoria ya en uso" });

    const cat = await Category.findByIdAndUpdate(
      id,
      { name, slug },
      { new: true }
    );
    if (!cat)
      return res.status(404).json({ message: "Categoria no encontrada" });

    res.json({ category: cat });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar la categoria",
      error: error.message,
    });
  }
};

export const deleteCategory = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { id } = req.params;
    const cat = await Category.findById(id);
    if (!cat)
      return res.status(404).json({ message: "Categoria no encontrada" });

    await cat.deleteOne();
    res.json({ message: "Categoria eliminada" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al eliminar categoria", error: error.message });
  }
};
