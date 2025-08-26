import { validationResult } from "express-validator";
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

export const listMyNotifications = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const filter = { user: req.user._id };
    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error al listar notificaciones",
        error: error.message,
      });
  }
};

export const markOnRead = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { id } = req.params;
    const n = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    ).lean();

    if (!n)
      return res.status(404).json({ message: "Notificación no encontrada" });
    res.json({ notification: n });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al marcar notificación", error: error.message });
  }
};

export const markAllRead = async (_req, res) => {
  try {
    await Notification.updateMany(
      { user: res.req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al marcar todas", error: error.message });
  }
};
