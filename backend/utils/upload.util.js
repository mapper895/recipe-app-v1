import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Aseguramos el directorio
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || "";
    cb(null, `recipe-${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpg|jpg|png|webp/;
  const mimetypeOk = allowed.test(file.mimetype);
  const extOk = allowed.test(
    path.extname(file.originalname).toLocaleLowerCase()
  );
  if (mimetypeOk && extOk) return cb(null, true);
  cb(new Error("Formato de imagen no soportado"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

export default upload;
