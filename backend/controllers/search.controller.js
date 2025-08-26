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

export const unifiedSearch = async (req, res) => {
  if (validate(req, res)) return;
  try {
    const q = (req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 12, 1),
      50
    );

    if (!q)
      return res.json({ q, user: null, recipes: [], total: 0, page, pages: 0 });

    // user por username (exacto o empieza)
    const exact = new RegExp(`^${q}$`, "i");
    const starts = new RegExp(`^${q}`, "i");
    const user =
      (await User.findOne({ username: exact })
        .select("_id username avatarUrl bio")
        .lean()) ||
      (await User.findOne({ username: starts })
        .select("_id username avatarUrl bio")
        .lean());

    // recetas por texto
    const filter = { isPublic: true, $text: { $search: q } };
    const [recipes, total] = await Promise.all([
      Recipe.find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .populate("author", "username avatarUrl")
        // .populate("categories", "name slug") // <-- activa si ya montaste Category
        .lean()
        .skip((page - 1) * limit)
        .limit(limit),
      Recipe.countDocuments({ isPublic: true, $text: { $search: q } }),
    ]);

    res.json({
      q,
      user: user || null,
      recipes,
      total,
      page,
      pages: Math.ceil(total / limit),
      matchType: user && exact.test(user.username) ? "exactUser" : "mixed",
    });
  } catch (e) {
    res.status(500).json({ message: "Error en búsqueda", error: e.message });
  }
};
