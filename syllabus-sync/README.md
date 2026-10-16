# SyllabusSync

Upload a syllabus, let AI pull out the deadlines, review them, and push them to Google Calendar.

## Status

**Phase 1–5 complete:**
- Project scaffolding and the full UI.
- Real PDF/DOCX text extraction on the backend, including tables and weekly-schedule grids, not just paragraphs.
- Real AI event extraction via Groq (free tier) — the frontend now uploads to the real backend and
  displays real extracted events, not mock data.

- **Multiple syllabi:** drop in one file per class (several at once is fine). Each becomes its own course
  card; uploads are processed one at a time to stay under Groq's free-tier token limit.
- **Google Calendar sync:** real OAuth 2.0 connection, calendar picker, and duplicate-safe event creation.

## Project structure

```
syllabus-sync/
  frontend/   React + Vite + Tailwind CSS + Lucide React
  backend/    Node.js + Express
```

## Getting started

### Frontend

```bash
cd syllabus-sync/frontend
npm install
npm run dev
```

Runs at http://localhost:5173.

### Backend

```bash
cd syllabus-sync/backend
cp .env.example .env    # then add your GEMINI_API_KEY (see below)
npm install
npm run dev
```

Runs at http://localhost:3001. Health check: `GET /api/health`.

**Get a free Groq API key:** https://console.groq.com/keys — paste it into `backend/.env` as
`GROQ_API_KEY=...`. No billing required for the free tier.

## Trying the app

1. Start the backend (`npm run dev` in `backend/`) and the frontend (`npm run dev` in `frontend/`).
2. Open http://localhost:5173.
3. Drag a real PDF or DOCX syllabus onto the upload card (or click **Browse Files**).
4. The app reads your syllabus for real: extracts the text (tables included), sends it to Groq, and
   displays the real course info and extracted events — any with a missing/ambiguous date are flagged
   "Needs Review" and can't be selected until corrected.
5. Drop in more syllabi — each class gets its own card, which you can collapse or remove (✕).
6. Select/edit/delete events, then click **Add to Google Calendar**. The first time, you'll be sent to
   Google to connect your account and returned to the app with your events intact.

Your extracted events are saved in the browser's localStorage, so a refresh (or the Google sign-in
redirect) doesn't lose them. Remove a course card to clear it.

## Google Calendar setup (one-time)

1. Go to https://console.cloud.google.com/ and create a project (e.g. "SyllabusSync").
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (a.k.a. "Google Auth Platform"):
   - User type: **External**. Fill in the app name and your email.
   - **Data access / Scopes:** add `.../auth/calendar.events` and `.../auth/calendar.calendarlist.readonly`.
   - **Audience / Test users:** add your own Google account. (While the app is in "Testing", only test
     users can sign in, and Google expires the refresh token after 7 days — just reconnect when asked.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
5. Copy the client ID and secret into `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
   ```
6. Restart the backend. The **Connect Google Calendar** button becomes active.

Your OAuth tokens are stored in `backend/tokens/google-token.json` (git-ignored) so you stay connected
across restarts. **Disconnect** in the header revokes the token and deletes that file.

## Calendar sync (`backend/services/googleCalendar.js`)

- Only two scopes: create/edit events, and read your calendar list (for the picker). Everything runs
  on the backend — the browser never sees credentials or tokens.
- Events without a time are created as all-day events. Timed quizzes/exams/presentations get a 1-hour
  block; timed deadlines (assignments, projects) are placed exactly at the due time. Times are
  interpreted in `DEFAULT_TIMEZONE` (America/Toronto by default).
- Event titles are prefixed with the course code (e.g. `CP386: Assignment 1 Due`), so events from
  several classes stay distinguishable in one calendar.
- **Duplicate prevention:** each Google event's ID is derived from the app's event ID, so syncing is
  an upsert — repeated clicks, retries, or re-syncing an edited event update the same Google event
  instead of creating a copy. The button is also disabled while a sync runs, and synced events are
  marked ✓ and deselected. (Syncing the same event to two *different* calendars creates one in each.)
- Partial failures are reported per event; an expired connection asks you to reconnect.

## Testing the syllabus text extraction in isolation (backend)

You can exercise the real PDF/DOCX parser directly, without the AI step or the frontend:

```bash
cd syllabus-sync/backend
npm install
npm run fixtures:generate   # (re)builds the synthetic test syllabus files
npm run test:parser         # runs the parser against them and checks the output
```

Or upload a real file to the running backend:

```bash
curl -F "syllabus=@/path/to/syllabus.pdf" http://localhost:3001/api/syllabus/upload
```

The parser (`backend/services/fileParser.js`):
- Uses `pdf-parse` v2's `getText()` + `getTable()` for PDFs — tables are detected from the PDF's
  vector grid lines and returned as clean markdown tables alongside the surrounding paragraph text.
- Also runs a fallback table detector (`backend/services/pdfTableDetector.js`) for any page
  `getTable()` comes up empty on. pdf-parse only recognizes borders drawn as *stroked* lines, but
  PDFs exported from Word/Google Docs — i.e. most real-world syllabi — draw gridlines as thin
  *filled* rectangles instead, which it misses entirely. Confirmed against a real Word-exported
  syllabus: without the fallback, `getTable()` found 0 of its 7 real tables (weekly schedule,
  grading breakdown, quiz/lab due dates); with it, all 7 came through correctly structured.
  Noisy false positives (decorative boxes, paragraph text that happens to sit in a grid) are
  filtered out by requiring at least 2 columns and a reasonable fraction of populated cells.
- Uses `mammoth`'s HTML conversion for DOCX (not `extractRawText`, which collapses table rows/columns
  together) — `<table>` elements are walked and rendered the same way, so weekly-schedule and
  grading-breakdown tables stay structured instead of being flattened into run-on text.
- Rejects unsupported file types, files over 10 MB, corrupted files, and scanned PDFs with no
  selectable text layer (OCR is out of scope for now, per the build plan).
- Files are parsed in memory and never written to disk.
- `backend/test-fixtures/real-syllabus-cp400v.pdf` is a real, Word-exported course syllabus used as
  a permanent regression test (`npm run test:parser`) for the fill-rect table detection above.

## AI event extraction (`backend/services/aiExtractor.js`)

- Uses Groq (`openai/gpt-oss-120b` by default, override with `GROQ_MODEL`) via the `groq-sdk` package,
  with strict structured output (`json_schema`) so the model's JSON is guaranteed to match the expected
  shape. The JSON Schema is generated from the Zod schema, so there's one definition to maintain.
  Models without strict-schema support fall back to JSON mode with the schema included in the prompt.
- **Free-tier limits:** Groq's free tier allows 8K tokens per minute, and every request is charged its
  input *plus* its reserved output up front — so one request can't exceed that, and an 8-page syllabus
  already uses ~7K. To handle long syllabi (`backend/services/syllabusCondenser.js`):
  1. **Trim:** if the text is over budget, policy boilerplate is dropped — the course header, every
     table, and every line mentioning a date or deadline keyword (with a little context) is kept.
     Tested: a ~25-page syllabus went from 71K to 13K characters with all 11 deadlines intact.
  2. **Split:** if it's still too big, it's sent in parts (each with the course header), and the events
     are merged and de-duplicated. If one part has too many events for the output limit, it's halved.
  3. **Wait:** if Groq says "retry in N seconds" (N ≤ 65), the backend waits and retries automatically,
     so a long syllabus or several in a row may take a minute or two rather than failing.
  Set `GROQ_TPM_LIMIT` in `backend/.env` if your plan allows more tokens per minute.
- The response is still re-validated with the Zod schema in `backend/schemas/eventSchema.js` before
  anything downstream trusts it, per the build plan's "validate AI-generated data" rule.
- Follows the build plan's extraction rules: never invents a missing date or time, defaults to an
  all-day event rather than a fake midnight deadline, flags ambiguous/missing dates as "Needs Review",
  and includes a short source excerpt per event so you can verify it against the original text.
- Fails with a clear error (not a crash, not fabricated data) if `GEMINI_API_KEY` is missing or the
  API call fails.

## What's next

- Phase 6: testing and cleanup across a wider range of real syllabi.

See `buildplan.md` for the full spec.
