import { validationResult } from "express-validator";
import User from "../models/user.model.js";
import Recipe from "../models/recipe.model.js";

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

/**
 * GET /api/users/:username
 * Query: page, limit, sort=recent|top|popular
 */
export const getUserPublicProfile = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const { username } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 12, 1),
      50
    );
    const sort = req.query.sort || "recent";

    // 1) Usuario por username
    const user = await User.findOne({ username })
      .select("_id username avatarUrl bio followers following createdAt")
      .lean();

    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    // 2) Cálculos rápidos
    const followersCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;
    const isMe = req.user ? String(req.user._id) === String(user._id) : false;
    const isFollowing = req.user
      ? (user.followers || []).some((u) => String(u) === String(req.user._id))
      : false;

    // 3) Recetas públicas del usuario
    const filter = { author: user._id, isPublic: true };

    if (sort === "popular") {
      // por cantidad de guardados
      const pipeline = [
        { $match: filter },
        {
          $addFields: { savedCount: { $size: { $ifNull: ["$savedBy", []] } } },
        },
        { $sort: { savedCount: -1, ratingAvg: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ];
      const [items, total] = await Promise.all([
        Recipe.aggregate(pipeline),
        Recipe.countDocuments(filter),
      ]);
      return res.json({
        user: {
          _id: user._id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          followersCount,
          followingCount,
          isFollowing,
          isMe,
          joinedAt: user.createdAt,
        },
        recipes: items, // aquí vienen sin populate (aggregate)
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    }

    let cursor = Recipe.find(filter)
      .populate("author", "username avatarUrl")
      // .populate("categories", "name slug") // actívalo si ya tienes Category
      .lean();

    if (sort === "top")
      cursor = cursor.sort({ ratingAvg: -1, ratingCount: -1, createdAt: -1 });
    else cursor = cursor.sort({ createdAt: -1 }); // recent

    const [items, total] = await Promise.all([
      cursor.skip((page - 1) * limit).limit(limit),
      Recipe.countDocuments(filter),
    ]);

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount,
        followingCount,
        isFollowing,
        isMe,
        joinedAt: user.createdAt,
      },
      recipes: items,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener perfil público",
      error: error.message,
    });
  }
};
