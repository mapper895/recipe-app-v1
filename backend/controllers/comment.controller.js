import { validationResult } from "express-validator";
import Comment from "../models/commet.model.js";
import Recipe from "../models/recipe.model.js";
import Notification from "../models/notification.model.js";

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

export const listComment = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { recipe } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      50
    );

    const filter = { recipe, parent: null };
    const [items, total] = await Promise.all([
      Comment.find(filter)
        .sort({ createdAt: 1 })
        .populate("author", "username avatarUrl")
        .lean()
        .skip((page - 1) * limit),
      Comment.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al listar comentarios", error: error.message });
  }
};

export const createComment = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { recipe, text, parent = null } = req.body;

    const rec = await Recipe.findById(recipe).select("author");
    if (!rec) return res.status(404).json({ message: "Receta no encontrada" });

    const comment = await Comment.create({
      recipe,
      author: req.user._id,
      text,
      parent: parent || null,
    });

    if (String(rec.author) !== String(req.user._id)) {
      await Notification.create({
        user: rec.author,
        type: "comment",
        data: {
          recipeId: rec._id,
          commentId: comment._id,
          fromUserId: req.user._id,
        },
      });
    }
    const populated = await Comment.findById(comment._id)
      .populate("author", "username avatarUrl")
      .lean();

    res.status(201).json({ comment: populated });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al crear comentario", error: error.message });
  }
};

export const deleteComment = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id).select("author");
    if (!comment)
      return res.status(404).json({ message: "Comentario no encontrado" });

    const isOwner = comment.author.equals(req.user._id);
    const isAdmin = req.user?.role === "admin";
    if (!isOwner || !isAdmin)
      return res.status(403).json({ message: "No autorizado" });

    await comment.deleteOne();
    res.json({ message: "Comentario eliminado" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al eliminar comentario", error: error.message });
  }
};
