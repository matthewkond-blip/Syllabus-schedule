import { z } from "zod";

export const EVENT_TYPES = [
  "assignment",
  "quiz",
  "midterm",
  "final",
  "project",
  "presentation",
  "other",
];

// Gemini's structured-output schema has no concept of an optional field
// (no .optional()) — fields the model may legitimately not know use
// .nullable() instead, matching the build plan's "return null for unknown
// dates or times" rule.
export const ExtractedEventSchema = z.object({
  title: z.string(),
  type: z.enum(EVENT_TYPES),
  date: z
    .string()
    .nullable()
    .describe("ISO date YYYY-MM-DD, or null if the date is missing or too ambiguous to resolve."),
  time: z
    .string()
    .nullable()
    .describe("24-hour HH:mm, or null if no specific time was stated."),
  allDay: z
    .boolean()
    .describe("true whenever time is null — never invent a midnight/default time."),
  description: z.string().nullable(),
  needsReview: z
    .boolean()
    .describe("true if the date is missing, ambiguous, or depends on information not in the text (e.g. 'see registrar')."),
  sourceExcerpt: z
    .string()
    .nullable()
    .describe("A short verbatim excerpt (<200 chars) from the syllabus text that supports this event."),
});

export const SyllabusExtractionSchema = z.object({
  courseCode: z.string().nullable(),
  courseName: z.string().nullable(),
  semester: z.string().nullable(),
  events: z.array(ExtractedEventSchema),
});
