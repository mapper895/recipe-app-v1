import { validationResult } from "express-validator";
import Recipe from "../models/recipe.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

// Util comun para respiestas 400 en validaciones
const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res
      .status(400)
      .json({ message: "Errores de validación", errors: errors.array() });
    return true;
  }
  return false;
};

// Crear receta
export const createRecipe = async (req, res) => {
  if (handleValidation(req, res)) return;

  try {
    const author = req.user._id;
    const {
      title,
      description = "",
      ingredients = [],
      steps = [],
      categories = [],
      isPublic = true,
    } = req.body;

    const images =
      (req.files &&
        req.files.map(
          (f) => f.path || f.location || `/uploads/${f.filename}`
        )) ||
      [];

    const recipe = await Recipe.create({
      author,
      title,
      description,
      ingredients,
      steps,
      categories,
      images,
      isPublic,
    });

    return res.status(201).json({ recipe });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al crear la receta", error: error.message });
  }
};

// Obtener una receta
export const getRecipeById = async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id)
      .populate("author", "username avatarUrl")
      .populate("categories", "name slug")
      .lean();

    if (!recipe)
      return res.status(404).json({ message: "Receta no encontrada" });
    return res.json({ recipe });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al obtener receta", error: error.message });
  }
};

// Listar / buscar recetas
export const listRecipes = async (req, res) => {
  try {
    const {
      category,
      author,
      authorUsername,
      savedBy,
      minRating,
      sort = "recent",
      page = 1,
      limit = 12,
      followingOnly,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

    const filter = { isPublic: true };

    if (minRating) filter.ratingAvg = { $gte: Number(minRating) };

    if (category) {
      const ids = String(category)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (ids.length) filter.categories = { $in: ids };
    }

    if (savedBy) filter.savedBy = savedBy;

    if (author) {
      filter.author = author;
    } else if (authorUsername) {
      const u = await User.findOne({ username: authorUsername })
        .select("_id")
        .lean();
      if (!u) {
        return res.json({ items: [], total: 0, page: pageNum, pages: 0 });
      }
      filter.author = u._id;
    }

    // followingOnly: requiere usuario autenticado (usa protect en la ruta si lo quieres estricto)
    if (String(followingOnly) === "true") {
      const me = req.user;
      if (!me) {
        return res
          .status(401)
          .json({ message: "No autorizado para followingOnly" });
      }
      // Filtrar solo recetas de autores que sigo
      filter.author = { $in: me.following || [] };
    }

    // POPULAR usa aggregate para ordenar por cantidad de guardados
    if (sort === "popular") {
      const pipeline = [
        { $match: filter },
        {
          $addFields: { savedCount: { $size: { $ifNull: ["$savedBy", []] } } },
        },
        { $sort: { savedCount: -1, ratingAvg: -1, createdAt: -1 } },
        { $skip: (pageNum - 1) * perPage },
        { $limit: perPage },
      ];
      const [items, total] = await Promise.all([
        Recipe.aggregate(pipeline),
        Recipe.countDocuments(filter),
      ]);
      return res.json({
        items,
        total,
        page: pageNum,
        pages: Math.ceil(total / perPage),
      });
    }

    // TOP y RECENT con find()
    let cursor = Recipe.find(filter)
      .populate("author", "username avatarUrl")
      .populate("categories", "name slug")
      .lean();

    if (sort === "top") {
      cursor = cursor.sort({ ratingAvg: -1, ratingCount: -1, createdAt: -1 });
    } else {
      cursor = cursor.sort({ createdAt: -1 });
    }

    const [items, total] = await Promise.all([
      cursor.skip((pageNum - 1) * perPage).limit(perPage),
      Recipe.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page: pageNum,
      pages: Math.ceil(total / perPage),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al listar recetas", error: error.message });
  }
};

// Actualizar receta (solo autor)
export const updateRecipe = async (req, res) => {
  if (handleValidation(req, res)) return;

  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);
    if (!recipe)
      return res.status(404).json({ message: "Receta no encontrada" });

    if (String(recipe.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const allowed = [
      "title",
      "description",
      "ingredients",
      "steps",
      "categories",
      "isPublic",
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) recipe[k] = req.body[k];
    });

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(
        (f) => f.path || f.location || `/uploads/${f.filename}`
      );
      recipe.images = [...(recipe.images || []), ...newImages];
    }

    await recipe.save();
    return res.json({ recipe });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al actualizar receta", error: error.message });
  }
};

// Eliminar receta (solo autor)
export const deleteRecipe = async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);

    if (!recipe)
      return res.status(404).json({ message: "Receta no encontrada" });

    if (String(recipe.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    await Recipe.deleteOne({ _id: id });
    return res.json({ message: "Receta eliminada" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al eliminar la receta", error: error.message });
  }
};

// Valorar receta (crear/actaulizar valoracion del usuario)
export const rateRecipe = async (req, res) => {
  if (handleValidation(req, res)) return;

  try {
    const { id } = req.params;
    const { value } = req.body;

    const recipe = await Recipe.findById(id);
    if (!recipe)
      return res.status(404).json({ message: "Receta no encontrada" });

    const idx = recipe.ratings.findIndex(
      (r) => String(r.user) === String(req.user._id)
    );
    const isFirstRating = idx < 0;

    if (idx >= 0) {
      recipe.ratings[idx].value = value;
    } else {
      recipe.ratings.push({ user: req.user._id, value });
    }

    recipe.recomputeRating();
    await recipe.save();

    if (isFirstRating && String(recipe.author) !== String(req.user._id)) {
      await Notification.create({
        user: recipe.author,
        type: "rating",
        data: { recipeId: recipe._id, fromUserId: req.user._id, value },
      });
    }

    return res.json({
      ratingAvg: recipe.ratingAvg,
      ratingCount: recipe.ratingCount,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al valorar receta", error: error.message });
  }
};

// Guardar / desguardar receta + sincronizar con User.savedRecipes
export const toggleSaveRecipe = async (req, res) => {
  if (handleValidation(req, res)) return;

  try {
    const { id } = req.params;
    const uid = req.user._id;

    const recipe = await Recipe.findById(id);
    if (!recipe)
      return res.status(404).json({ message: "Receta no encontrada" });

    const already = recipe.savedBy.some((u) => String(u) === String(uid));

    if (already) {
      recipe.savedBy = recipe.savedBy.filter((u) => String(u) !== String(uid));
      await Promise.all([
        recipe.save(),
        User.updateOne({ _id: uid }, { $pull: { savedRecipes: id } }),
      ]);
    } else {
      recipe.savedBy.push(uid);
      await Promise.all([
        recipe.save(),
        User.updateOne({ _id: uid }, { $addToSet: { savedRecipes: id } }),
      ]);
    }

    return res.json({ saved: !already, savedCount: recipe.savedBy.length });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al guardar la receta", error: error.message });
  }
};

// Recetas guardadas del usuario autenticado
export const getMySavedRecipes = async (req, res) => {
  if (handleValidation(req, res)) return;

  try {
    const { page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

    const filter = { savedBy: req.user._id, isPublic: true };

    const [items, total] = await Promise.all([
      Recipe.find(filter)
        .populate("author", "username avatarUrl")
        .populate("categories", "name slug")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * perPage)
        .limit(perPage)
        .lean(),
      Recipe.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page: pageNum,
      pages: Math.ceil(total / perPage),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error al obtener guardados", error: error.message });
  }
};
