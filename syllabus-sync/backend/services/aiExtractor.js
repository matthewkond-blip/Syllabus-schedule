import { GoogleGenAI, Type } from "@google/genai";
import { SyllabusExtractionSchema, EVENT_TYPES } from "../schemas/eventSchema.js";
import { AppError } from "../utils/AppError.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError(
      500,
      "The server isn't configured with a Gemini API key yet. Add GEMINI_API_KEY to backend/.env."
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Gemini's structured-output schema is an OpenAPI-style subset (Type enum +
// `nullable`), not a plain Zod/JSON Schema — so this mirrors eventSchema.js
// by hand. The Zod schema is still used below to validate the actual
// response before anything downstream trusts it.
const EVENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    type: { type: Type.STRING, enum: EVENT_TYPES },
    date: {
      type: Type.STRING,
      nullable: true,
      description: "ISO date YYYY-MM-DD, or null if the date is missing or too ambiguous to resolve.",
    },
    time: {
      type: Type.STRING,
      nullable: true,
      description: "24-hour HH:mm, or null if no specific time was stated.",
    },
    allDay: {
      type: Type.BOOLEAN,
      description: "true whenever time is null — never invent a midnight/default time.",
    },
    description: { type: Type.STRING, nullable: true },
    needsReview: {
      type: Type.BOOLEAN,
      description: "true if the date is missing, ambiguous, or depends on information not in the text.",
    },
    sourceExcerpt: {
      type: Type.STRING,
      nullable: true,
      description: "A short verbatim excerpt (<200 chars) from the syllabus text that supports this event.",
    },
  },
  required: ["title", "type", "date", "time", "allDay", "description", "needsReview", "sourceExcerpt"],
  propertyOrdering: ["title", "type", "date", "time", "allDay", "description", "needsReview", "sourceExcerpt"],
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    courseCode: { type: Type.STRING, nullable: true },
    courseName: { type: Type.STRING, nullable: true },
    semester: { type: Type.STRING, nullable: true },
    events: { type: Type.ARRAY, items: EVENT_RESPONSE_SCHEMA },
  },
  required: ["courseCode", "courseName", "semester", "events"],
  propertyOrdering: ["courseCode", "courseName", "semester", "events"],
};

const SYSTEM_PROMPT = `You are an assistant that extracts academic deadlines from a university course syllabus for a calendar app. The syllabus text was extracted from a PDF or DOCX file; tables are included as markdown blocks wrapped in [TABLE]...[/TABLE] — read these as carefully as the surrounding paragraphs, since weekly schedules and grading breakdowns are usually tables.

Identify: the course code, course name, and academic term, plus every assignment deadline, quiz date, midterm exam, final exam (only if an explicit date is given), project deadline, presentation, and other dated course event.

Strict rules:
- Never invent a date. If a date isn't stated or can't be confidently resolved, set "date" to null and "needsReview" to true.
- Never invent a time. If no specific time is given, set "time" to null and "allDay" to true — do not default to midnight or any other time.
- Preserve the actual year mentioned in the syllabus (e.g. "Fall 2026" events happen in 2026, not the current year, unless the syllabus itself implies otherwise).
- If a date is ambiguous or vague (e.g. "during the final exam period", "TBD", "see registrar"), or depends on information not present in the text, set "needsReview" to true even if you set a best-guess date.
- Extract events from tables (weekly schedules, assessment/due-date tables, grading breakdowns) as well as from paragraphs — tables are often the most reliable source of exact dates.
- Do not produce duplicate events for the same deadline mentioned in both a paragraph and a table — merge them into one event, preferring the more specific/complete information.
- Classify each event's "type" as accurately as possible from: assignment, quiz, midterm, final, project, presentation, other.
- For each event, include a short verbatim "sourceExcerpt" (under 200 characters) from the syllabus text that supports it, so the user can verify it.
- Do not include purely informational dates that are not deadlines or scheduled events the student needs to act on (e.g. "course starts", office hours, general policy text) unless they are graded assessments or exams.
- Respond with JSON only, matching the provided response schema exactly.`;

export async function extractSyllabusEvents(syllabusText) {
  const ai = getClient();

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: syllabusText,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
  } catch (err) {
    console.error("Gemini extraction failed:", err?.message || err);
    throw new AppError(502, "We couldn't analyze this syllabus right now. Please try again in a moment.");
  }

  let rawParsed;
  try {
    rawParsed = JSON.parse(response.text);
  } catch (err) {
    console.error("Gemini returned non-JSON output:", err?.message || err);
    throw new AppError(502, "The AI couldn't extract structured events from this syllabus.");
  }

  const result = SyllabusExtractionSchema.safeParse(rawParsed);
  if (!result.success) {
    console.error("Gemini output failed schema validation:", result.error.message);
    throw new AppError(502, "The AI's response didn't match the expected format. Please try again.");
  }

  return result.data;
}
