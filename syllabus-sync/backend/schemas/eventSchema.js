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

// This schema is converted to JSON Schema for Groq's strict structured-output
// mode, which has no concept of an optional field (every property must be
// required) — fields the model may legitimately not know use .nullable(),
// matching the build plan's "return null for unknown dates or times" rule.
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

// What the frontend sends when syncing. Unlike extraction output, a date is
// mandatory here — "Needs Review" events must never reach Google Calendar.
export const SyncEventSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().trim().min(1).max(300),
    type: z.enum(EVENT_TYPES),
    course: z.string().max(100).optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
      .nullable()
      .optional(),
    allDay: z.boolean(),
    description: z.string().max(5000).nullable().optional(),
    sourceExcerpt: z.string().max(1000).nullable().optional(),
    reminderMinutes: z.number().int().min(0).max(40320).optional().default(0),
  })
  .refine((e) => e.allDay || e.time, { message: "Timed events need a time", path: ["time"] });

export const SyncRequestSchema = z.object({
  calendarId: z.string().min(1).default("primary"),
  timeZone: z.string().min(1).optional(),
  events: z.array(SyncEventSchema).min(1).max(250),
});

export const SyllabusExtractionSchema = z.object({
  courseCode: z.string().nullable(),
  courseName: z.string().nullable(),
  semester: z.string().nullable(),
  events: z.array(ExtractedEventSchema),
});
