import mongoose from "mongoose";

const { Schema } = mongoose;

const RatingSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    value: { type: Number, min: 1, max: 5, required: true },
  },
  { _id: false }
);

const RecipeSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true, default: "" },
    ingredients: [{ type: String, trim: true, index: true }],
    steps: [{ type: String, trim: true }],
    images: [{ type: String }],
    categories: [{ type: Schema.Types.ObjectId, ref: "Category", index: true }],
    ratings: [RatingSchema],
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    savedBy: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indice de texto para busqueda por titulo/descripcion/ingredientes
RecipeSchema.index({ title: "text", description: "text", ingredients: "text" });

// Helper para recalcular promedio
RecipeSchema.methods.recomputeRating = function () {
  this.ratingCount = this.ratings.length;
  this.ratingAvg = this.ratingCount
    ? Number(
        (
          this.ratings.reduce((sum, r) => sum + r.value, 0) / this.ratingCount
        ).toFixed(2)
      )
    : 0;
};

const Recipe = mongoose.model("Recipe", RecipeSchema);
export default Recipe;
