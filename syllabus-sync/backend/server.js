import "dotenv/config";
import express from "express";
import cors from "cors";

import { errorHandler } from "./middleware/errorHandler.js";
import syllabusRoutes from "./routes/syllabusRoutes.js";

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/syllabus", syllabusRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`SyllabusSync backend listening on http://localhost:${PORT}`);
});
