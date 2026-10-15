import { randomUUID } from "node:crypto";
import { Router } from "express";
import { uploadSyllabusFile } from "../middleware/uploadMiddleware.js";
import { parseSyllabusFile } from "../services/fileParser.js";
import { extractSyllabusEvents } from "../services/aiExtractor.js";

const router = Router();

const DEFAULT_REMINDER_MINUTES = {
  midterm: 1440,
  final: 1440,
  project: 1440,
};

function toFrontendEvent(event, courseCode) {
  return {
    id: randomUUID(),
    title: event.title,
    type: event.type,
    course: courseCode || "",
    date: event.date,
    time: event.time,
    allDay: event.allDay,
    description: event.description || "",
    reminderMinutes: DEFAULT_REMINDER_MINUTES[event.type] || 60,
    needsReview: event.needsReview,
    selected: !event.needsReview,
    sourceExcerpt: event.sourceExcerpt || "",
    synced: false,
  };
}

router.post("/upload", uploadSyllabusFile, async (req, res, next) => {
  try {
    const { buffer, mimetype, originalname } = req.file;
    const parsed = await parseSyllabusFile(buffer, mimetype);
    const extraction = await extractSyllabusEvents(parsed.text);

    res.json({
      fileName: originalname,
      fileType: mimetype === "application/pdf" ? "pdf" : "docx",
      course: {
        courseCode: extraction.courseCode || "",
        courseName: extraction.courseName || "",
        semester: extraction.semester || "",
      },
      events: extraction.events.map((event) => toFrontendEvent(event, extraction.courseCode)),
      meta: {
        pageCount: parsed.pageCount,
        tableCount: parsed.tableCount,
        characterCount: parsed.text.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
