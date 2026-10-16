import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { AppError } from "../utils/AppError.js";

// calendar.events lets us create/update events; calendarlist.readonly lets us
// show the user which calendars they can pick. Nothing broader is requested.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

const TOKEN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tokens");
const TOKEN_PATH = path.join(TOKEN_DIR, "google-token.json");

// Event types that are scheduled sittings rather than point-in-time deadlines
// get a one-hour block; deadlines are zero-length so they sit at the due time.
const TIMED_EVENT_DURATION_MINUTES = {
  quiz: 60,
  midterm: 60,
  final: 60,
  presentation: 60,
};

export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "America/Toronto";

let oauthClient = null;

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new AppError(
      500,
      "Google Calendar isn't configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to backend/.env."
    );
  }
  if (!oauthClient) {
    oauthClient = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    // googleapis refreshes access tokens on its own; persist whatever it gets
    // back so a restart doesn't force the user to reconnect. Google only sends
    // a refresh_token on first consent, so merge rather than overwrite.
    oauthClient.on("tokens", (tokens) => {
      saveTokens({ ...oauthClient.credentials, ...tokens }).catch((err) =>
        console.error("Failed to persist refreshed Google tokens:", err.message)
      );
    });
  }
  return oauthClient;
}

async function saveTokens(tokens) {
  await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(tokens), { mode: 0o600 });
}

let tokensLoaded = false;
async function loadTokens() {
  const client = getOAuthClient();
  if (tokensLoaded) return client.credentials?.refresh_token ? client : null;
  tokensLoaded = true;
  try {
    const tokens = JSON.parse(await readFile(TOKEN_PATH, "utf8"));
    client.setCredentials(tokens);
    return tokens.refresh_token ? client : null;
  } catch {
    return null;
  }
}

async function clearTokens() {
  if (oauthClient) oauthClient.setCredentials({});
  await rm(TOKEN_PATH, { force: true });
}

// --- OAuth flow ------------------------------------------------------------

// Single-user app: the CSRF state only needs to live in memory for the few
// minutes between redirecting to Google and Google redirecting back.
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

export function getAuthUrl() {
  const client = getOAuthClient();
  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, Date.now() + STATE_TTL_MS);

  return client.generateAuthUrl({
    access_type: "offline",
    // Force the consent screen so Google always returns a refresh_token, even
    // if this account approved the app before.
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function handleAuthCallback(code, state) {
  const expiresAt = pendingStates.get(state);
  pendingStates.delete(state);
  if (!expiresAt || expiresAt < Date.now()) {
    throw new AppError(400, "That Google sign-in link expired. Please try connecting again.");
  }

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  tokensLoaded = true;
  await saveTokens(tokens);
}

export async function isConnected() {
  try {
    return Boolean(await loadTokens());
  } catch {
    return false;
  }
}

export async function disconnect() {
  const client = await loadTokens().catch(() => null);
  if (client) {
    try {
      await client.revokeCredentials();
    } catch (err) {
      // Already revoked or expired — removing the local token is what matters.
      console.error("Google token revoke failed:", err.message);
    }
  }
  await clearTokens();
}

// --- Calendar API ----------------------------------------------------------

function isAuthError(err) {
  const status = err?.response?.status ?? err?.code;
  const reason = err?.response?.data?.error;
  return status === 401 || reason === "invalid_grant";
}

async function getCalendarApi() {
  const client = await loadTokens();
  if (!client) {
    throw new AppError(401, "Google Calendar isn't connected. Please connect your Google account.");
  }
  return google.calendar({ version: "v3", auth: client });
}

async function handleAuthFailure(err) {
  if (isAuthError(err)) {
    await clearTokens();
    throw new AppError(401, "Your Google Calendar connection expired. Please reconnect your Google account.");
  }
}

export async function listWritableCalendars() {
  const calendar = await getCalendarApi();
  try {
    const { data } = await calendar.calendarList.list({ minAccessRole: "writer" });
    return (data.items || [])
      .map((c) => ({
        id: c.id,
        name: c.summaryOverride || c.summary,
        primary: Boolean(c.primary),
        timeZone: c.timeZone || null,
      }))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
  } catch (err) {
    await handleAuthFailure(err);
    console.error("Failed to list Google calendars:", err.message);
    throw new AppError(502, "We couldn't load your Google calendars. Please try again.");
  }
}

// Google lets clients choose event IDs (base32hex: 0-9, a-v). Deriving the ID
// from the app's own event ID makes every sync an idempotent upsert: a repeat
// click, a retried request, or a re-sync after editing hits the same Google
// event instead of creating a duplicate.
export function googleEventIdFor(clientEventId) {
  return "ss" + createHash("sha256").update(`syllabussync:${clientEventId}`).digest("hex").slice(0, 40);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Timed events are sent as wall-clock times plus a timeZone, so the arithmetic
// here is done on a naive local datetime (via UTC math) — never on the
// server's own time zone.
function addMinutesLocal(dateStr, timeStr, minutes) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi + minutes)).toISOString().slice(0, 19);
}

function buildEventBody(event, timeZone) {
  const summary =
    event.course && !event.title.toLowerCase().includes(event.course.toLowerCase())
      ? `${event.course}: ${event.title}`
      : event.title;

  const descriptionParts = [];
  if (event.description) descriptionParts.push(event.description);
  if (event.sourceExcerpt) descriptionParts.push(`From the syllabus: "${event.sourceExcerpt}"`);
  descriptionParts.push("Added by SyllabusSync");

  let start;
  let end;
  if (event.allDay || !event.time) {
    start = { date: event.date };
    end = { date: addDays(event.date, 1) };
  } else {
    const duration = TIMED_EVENT_DURATION_MINUTES[event.type] || 0;
    start = { dateTime: addMinutesLocal(event.date, event.time, 0), timeZone };
    end = { dateTime: addMinutesLocal(event.date, event.time, duration), timeZone };
  }

  return {
    summary,
    description: descriptionParts.join("\n\n"),
    start,
    end,
    reminders: {
      useDefault: false,
      overrides: event.reminderMinutes > 0 ? [{ method: "popup", minutes: event.reminderMinutes }] : [],
    },
  };
}

async function upsertEvent(calendar, calendarId, event, timeZone) {
  const eventId = googleEventIdFor(event.id);
  const requestBody = buildEventBody(event, timeZone);

  try {
    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: { ...requestBody, id: eventId },
    });
    return { googleEventId: data.id, htmlLink: data.htmlLink, updated: false };
  } catch (err) {
    if (err?.response?.status !== 409) throw err;
  }

  // 409 = an event with this ID already exists (or existed and was deleted —
  // Google keeps deleted IDs reserved). Overwrite it, restoring it if needed.
  const { data } = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: { ...requestBody, status: "confirmed" },
  });
  return { googleEventId: data.id, htmlLink: data.htmlLink, updated: true };
}

export async function syncEvents({ calendarId, timeZone, events }) {
  const calendar = await getCalendarApi();
  const results = [];

  // Sequential on purpose: a semester's worth of events is small, and it keeps
  // us well clear of Calendar API per-user rate limits.
  for (const event of events) {
    try {
      const created = await upsertEvent(calendar, calendarId, event, timeZone);
      results.push({ id: event.id, success: true, ...created });
    } catch (err) {
      await handleAuthFailure(err);
      console.error(`Failed to sync event "${event.title}":`, err.message);
      results.push({
        id: event.id,
        success: false,
        error: err?.response?.data?.error?.message || "Google Calendar rejected this event.",
      });
    }
  }

  return results;
}
