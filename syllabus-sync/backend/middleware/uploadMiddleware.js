import multer from "multer";
import { AppError } from "../utils/AppError.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MIME_TYPE_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

function fileFilter(req, file, cb) {
  // Some browsers/OSes (e.g. Windows without Office installed) send a .docx
  // as a generic binary type — fall back to the extension in that case. The
  // parser still rejects files whose contents don't match.
  if (GENERIC_MIME_TYPES.has(file.mimetype || "")) {
    const ext = file.originalname.toLowerCase().match(/\.[a-z]+$/)?.[0];
    if (MIME_TYPE_BY_EXTENSION[ext]) file.mimetype = MIME_TYPE_BY_EXTENSION[ext];
  }
  if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
    cb(new AppError(400, "Please upload a PDF or DOCX file."));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter,
});

export function uploadSyllabusFile(req, res, next) {
  upload.single("syllabus")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new AppError(400, "That file is larger than 10 MB. Please upload a smaller file."));
        return;
      }
      next(new AppError(400, "We couldn't process that upload. Please try again."));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    if (!req.file) {
      next(new AppError(400, "Please attach a syllabus file."));
      return;
    }
    next();
  });
}
