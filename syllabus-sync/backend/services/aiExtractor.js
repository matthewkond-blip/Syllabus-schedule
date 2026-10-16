import Groq from "groq-sdk";
import { z } from "zod";
import { SyllabusExtractionSchema } from "../schemas/eventSchema.js";
import { AppError } from "../utils/AppError.js";
import { chunkSyllabus, condenseSyllabus } from "./syllabusCondenser.js";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// Models that support Groq's strict json_schema mode (the output is guaranteed
// to match the schema). Any other model falls back to JSON-object mode with
// the schema described in the prompt; Zod still validates the result either way.
const STRICT_SCHEMA_MODELS = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "meta-models/muse-spark-open",
]);

// gpt-oss models "think" before answering; those reasoning tokens count
// against the free tier's tokens-per-minute budget, so keep it short.
const REASONING_MODELS_PREFIX = "openai/gpt-oss";

// --- Token budget ----------------------------------------------------------
//
// Groq's free tier allows 8K tokens per minute, and a single request is
// charged its input tokens PLUS its max_completion_tokens up front — so one
// request can never exceed the per-minute limit. Long syllabi are condensed
// and, if needed, split so each request fits. Raise GROQ_TPM_LIMIT if your
// Groq plan allows more.
const TPM_LIMIT = Number(process.env.GROQ_TPM_LIMIT) || 8000;
// ~100 output tokens per event (measured), so this fits ~20+ events per request.
const MAX_COMPLETION_TOKENS = 2500;
// Measured ~4.2 chars/token on a real syllabus; tables tokenize worse, so
// estimate conservatively.
const CHARS_PER_TOKEN = 3.5;

// If Groq says "rate limited, retry in N seconds", wait it out rather than
// failing — each long request uses most of the per-minute budget, so the
// next one routinely has to wait ~40-60s.
const MAX_AUTO_RETRY_WAIT_SECONDS = 65;
const MAX_RATE_LIMIT_RETRIES = 3;

let client = null;
function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new AppError(
      500,
      "The server isn't configured with a Groq API key yet. Add GROQ_API_KEY to backend/.env."
    );
  }
  // Explicit timeout so a stalled request fails with a clear error instead of
  // leaving the upload spinning indefinitely.
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0, timeout: 45_000 });
  return client;
}

// The Zod schema converts directly to the JSON Schema dialect Groq's strict
// mode expects (nullable fields as ["string","null"], every field required,
// additionalProperties: false), so there's a single source of truth.
const { $schema: _ignored, ...RESPONSE_JSON_SCHEMA } = z.toJSONSchema(SyllabusExtractionSchema);

const SYSTEM_PROMPT = `You are an assistant that extracts academic deadlines from a university course syllabus for a calendar app. The syllabus text was extracted from a PDF or DOCX file; tables are included as markdown blocks wrapped in [TABLE]...[/TABLE] — read these as carefully as the surrounding paragraphs, since weekly schedules and grading breakdowns are usually tables. Long syllabi are condensed before you see them: "[...]" marks where text without any dates or deadlines (e.g. policy sections) was removed.

Identify: the course code, course name, and academic term, plus every assignment deadline, quiz date, midterm exam, final exam (only if an explicit date is given), project deadline, presentation, and other dated course event.

Strict rules:
- Never invent a date. If a date isn't stated or can't be confidently resolved, set "date" to null and "needsReview" to true.
- Never invent a time. If no specific time is given, set "time" to null and "allDay" to true — do not default to midnight or any other time.
- Dates are ISO "YYYY-MM-DD"; times are 24-hour "HH:mm".
- Preserve the actual year mentioned in the syllabus (e.g. "Fall 2026" events happen in 2026, not the current year, unless the syllabus itself implies otherwise).
- If a date is ambiguous or vague (e.g. "during the final exam period", "TBD", "see registrar"), or depends on information not present in the text, set "needsReview" to true even if you set a best-guess date.
- Extract events from tables (weekly schedules, assessment/due-date tables, grading breakdowns) as well as from paragraphs — tables are often the most reliable source of exact dates.
- Do not produce duplicate events for the same deadline mentioned in both a paragraph and a table — merge them into one event, preferring the more specific/complete information.
- Classify each event's "type" as accurately as possible from: assignment, quiz, midterm, final, project, presentation, other.
- For each event, include a short verbatim "sourceExcerpt" (under 150 characters) from the syllabus text that supports it, so the user can verify it.
- Keep "description" to one short sentence, or null if there's nothing to add beyond the title.
- Do not include purely informational dates that are not deadlines or scheduled events the student needs to act on (e.g. "course starts", office hours, general policy text) unless they are graded assessments or exams.
- Respond with JSON only, matching the provided response schema exactly.`;

const PART_NOTE = (part, total) =>
  `\n\nThis syllabus was too long for one request and is being processed in ${total} parts; you are seeing part ${part}. Every part begins with the syllabus header for context. Extract only the events that appear in this part's text after the header (plus the course code/name/term).`;

function buildRequestPrompt() {
  if (STRICT_SCHEMA_MODELS.has(MODEL)) {
    return {
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "syllabus_extraction", strict: true, schema: RESPONSE_JSON_SCHEMA },
      },
      systemPrompt: SYSTEM_PROMPT,
    };
  }
  return {
    responseFormat: { type: "json_object" },
    systemPrompt: `${SYSTEM_PROMPT}\n\nThe JSON must match this JSON Schema:\n${JSON.stringify(RESPONSE_JSON_SCHEMA)}`,
  };
}

// How many characters of syllabus text fit in one request alongside the
// system prompt, schema, and reserved output tokens.
function maxSyllabusChars() {
  const { systemPrompt } = buildRequestPrompt();
  const overheadChars = systemPrompt.length + JSON.stringify(RESPONSE_JSON_SCHEMA).length + PART_NOTE(9, 9).length;
  const overheadTokens = Math.ceil(overheadChars / CHARS_PER_TOKEN) + 150;
  const inputTokens = (TPM_LIMIT - MAX_COMPLETION_TOKENS - overheadTokens) * 0.9;
  return Math.floor(inputTokens * CHARS_PER_TOKEN);
}

function retryAfterSeconds(err) {
  const header = err?.headers?.["retry-after"] ?? err?.headers?.get?.("retry-after");
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createCompletion(groq, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (err) {
      const wait = retryAfterSeconds(err);
      const canRetry =
        err?.status === 429 &&
        attempt < MAX_RATE_LIMIT_RETRIES &&
        wait !== null &&
        wait <= MAX_AUTO_RETRY_WAIT_SECONDS;
      if (!canRetry) throw err;
      console.warn(`Groq rate limit hit; retrying in ${wait}s.`);
      await sleep((wait + 1) * 1000);
    }
  }
}

function toAppError(err) {
  console.error("Groq extraction failed:", err?.status, err?.message || err);
  if (err?.status === 401) {
    return new AppError(500, "The Groq API key was rejected. Check GROQ_API_KEY in backend/.env.");
  }
  if (err?.status === 413) {
    return new AppError(413, "This syllabus is too long for the AI model's limits, even after trimming.");
  }
  if (err?.status === 429) {
    return new AppError(429, "Groq's free-tier rate limit was reached. Wait about a minute, then retry this syllabus.");
  }
  return new AppError(502, "We couldn't analyze this syllabus right now. Please try again in a moment.");
}

// Extracts events from one piece of text. If the model runs out of output
// tokens (too many events in one piece), the piece is halved and retried.
async function extractPart(groq, text, partNote, splitDepth = 0) {
  const { responseFormat, systemPrompt } = buildRequestPrompt();
  const params = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt + partNote },
      { role: "user", content: text },
    ],
    response_format: responseFormat,
    temperature: 0,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
  };
  if (MODEL.startsWith(REASONING_MODELS_PREFIX)) params.reasoning_effort = "low";

  let completion;
  try {
    completion = await createCompletion(groq, params);
  } catch (err) {
    // Strict mode reports a truncated (length-limited) answer as a 400.
    const truncated = err?.status === 400 && /max.*tokens|length/i.test(err?.message || "");
    if (!truncated) throw toAppError(err);
    completion = { choices: [{ finish_reason: "length" }] };
  }

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    if (splitDepth >= 2) {
      throw new AppError(502, "This syllabus has more events than the AI could return. Please try again.");
    }
    console.warn("Groq output hit the token limit; splitting this part in half.");
    const halves = chunkSyllabus(text, Math.ceil(text.length / 2) + 1600);
    const results = [];
    for (const half of halves) results.push(await extractPart(groq, half, partNote, splitDepth + 1));
    return mergeExtractions(results);
  }

  let rawParsed;
  try {
    rawParsed = JSON.parse(choice?.message?.content || "");
  } catch (err) {
    console.error("Groq returned non-JSON output:", err?.message || err);
    throw new AppError(502, "The AI couldn't extract structured events from this syllabus.");
  }

  const result = SyllabusExtractionSchema.safeParse(rawParsed);
  if (!result.success) {
    console.error("Groq output failed schema validation:", result.error.message);
    throw new AppError(502, "The AI's response didn't match the expected format. Please try again.");
  }
  return result.data;
}

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Combines results from several parts: first non-empty course info wins, and
// the same deadline seen in two parts (e.g. in a paragraph and a table that
// landed in different chunks) is kept once, preferring the more complete copy.
function mergeExtractions(results) {
  const pick = (field) => results.find((r) => r[field])?.[field] ?? null;
  const score = (e) => (e.date ? 4 : 0) + (e.time ? 2 : 0) + (e.needsReview ? 0 : 1);

  const byKey = new Map();
  for (const event of results.flatMap((r) => r.events)) {
    const key = `${normalize(event.title)}|${event.date ?? ""}`;
    const existing = byKey.get(key);
    if (!existing || score(event) > score(existing)) byKey.set(key, event);
  }

  // An undated "needs review" copy of something another part found a date
  // for is redundant.
  const datedTitles = new Set([...byKey.values()].filter((e) => e.date).map((e) => normalize(e.title)));
  const events = [...byKey.values()].filter((e) => e.date || !datedTitles.has(normalize(e.title)));

  return {
    courseCode: pick("courseCode"),
    courseName: pick("courseName"),
    semester: pick("semester"),
    events,
  };
}

export async function extractSyllabusEvents(syllabusText) {
  const groq = getClient();
  const maxChars = maxSyllabusChars();

  let text = syllabusText;
  if (text.length > maxChars) {
    text = condenseSyllabus(syllabusText);
    console.log(`Syllabus condensed from ${syllabusText.length} to ${text.length} chars (budget ${maxChars}).`);
  }

  if (text.length <= maxChars) return extractPart(groq, text, "");

  // Parts run one after another: each uses most of the per-minute token
  // budget, so running them in parallel would just trigger rate limits.
  const chunks = chunkSyllabus(text, maxChars);
  console.log(`Syllabus split into ${chunks.length} parts.`);
  const results = [];
  for (const [i, chunk] of chunks.entries()) {
    results.push(await extractPart(groq, chunk, PART_NOTE(i + 1, chunks.length)));
  }
  return mergeExtractions(results);
}
