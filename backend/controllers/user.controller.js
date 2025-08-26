import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { ENV_VARS } from "../config/envVars.js";

// Firmar y setear cookie
const setTokenCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, ENV_VARS.JWT_SECRET, {
    expiresIn: ENV_VARS.JWT_EXPIRES_IN || "7d",
  });

  const isProd = ENV_VARS.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  });
  return token;
};

// Registrar Usuario
export const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { username, email, password } = req.body;
  try {
    const exists = await User.findOne({
      $or: [{ email }, { username }],
    }).lean();
    if (exists)
      return res
        .status(409)
        .json({ message: "Usuario o email ya registrados" });

    const user = await User.create({ username, email, password });
    setTokenCookie(res, user._id);
    return res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al registrar", error: error.message });
  }
};

// Inicio de sesión
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { emailOrUsername, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    }).select("+password");

    if (!user)
      return res.status(400).json({ message: "Credenciales inválidas" });

    const match = await user.matchPassword(password);
    if (!match)
      return res.status(400).json({ message: "Credenciales inválidas" });

    setTokenCookie(res, user._id);
    return res.json({ user: user.toJSON() });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al iniciar sesión", error: error.message });
  }
};

// Cerrar sesión
export const logoutUser = async (_req, res) => {
  const isProd = ENV_VARS.NODE_ENV === "production";
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  return res.json({ message: "Sesión cerrada" });
};

// Obtener info del usuario autenticado
export const getMe = async (req, res) => {
  return res.json({ user: req.user.toJSON ? req.user.toJSON() : req.user });
};

// Actualizar perfil
export const updateMe = async (req, res) => {
  try {
    // Campos permitidos (NO role)
    const updatable = ["username", "bio", "avatarUrl", "email", "password"];
    const payload = {};

    updatable.forEach((k) => {
      if (req.body[k] !== undefined && req.body[k] !== null)
        payload[k] = req.body[k];
    });

    // Verifica unicidad si cambian email/username
    if (payload.username) {
      const taken = await User.findOne({
        username: payload.username,
        _id: { $ne: req.user._id },
      }).lean();
      if (taken)
        return res.status(409).json({ message: "Nombre de usuario ya en uso" });
    }
    if (payload.email) {
      const taken = await User.findOne({
        email: payload.email,
        _id: { $ne: req.user._id },
      }).lean();
      if (taken) return res.status(409).json({ message: "Email ya en uso" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    // (Opcional) exigir currentPassword si cambia contraseña
    if (payload.password && req.body.currentPassword) {
      const ok = await user.matchPassword(req.body.currentPassword);
      if (!ok)
        return res
          .status(400)
          .json({ message: "Contraseña actual incorrecta" });
    }

    Object.assign(user, payload);
    await user.save();

    return res.json({ user: user.toJSON() });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al actualizar perfil", error: error.message });
  }
};

// Seguir usuario
export const followUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === String(req.user._id))
      return res.status(400).json({ message: "No puedes seguirte a ti mismo" });

    const target = await User.findById(targetId);
    if (!target)
      return res.status(404).json({ message: "Usuario objetivo no existe" });

    // Operaciones atómicas para evitar duplicados
    const [meRes, targetRes] = await Promise.all([
      User.updateOne(
        { _id: req.user._id },
        { $addToSet: { following: target._id } }
      ),
      User.updateOne(
        { _id: target._id },
        { $addToSet: { followers: req.user._id } }
      ),
    ]);

    const actuallyFollowed =
      meRes.modifiedCount > 0 || targetRes.modifiedCount > 0;

    if (actuallyFollowed && String(target._id) !== String(req.user._id)) {
      {
        await Notification.create({
          user: target._id,
          type: "follow",
          data: { fromUserId: req.user._id },
        });
      }
    }

    return res.json({ message: "Ahora sigues a este usuario" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al seguir usuario", error: error.message });
  }
};

// Dejar de seguir
export const unfollowUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const target = await User.findById(targetId);
    if (!target)
      return res.status(404).json({ message: "Usuario objetivo no existe" });

    await User.updateOne(
      { _id: req.user._id },
      { $pull: { following: target._id } }
    );
    await User.updateOne(
      { _id: target._id },
      { $pull: { followers: req.user._id } }
    );

    return res.json({ message: "Has dejado de seguir a este usuario" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al dejar de seguir", error: error.message });
  }
};
