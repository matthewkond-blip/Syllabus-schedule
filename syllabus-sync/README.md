# SyllabusSync

Upload a syllabus, let AI pull out the deadlines, review them, and push them to Google Calendar.

## Status

**Phase 1–4 complete:**
- Project scaffolding and the full UI.
- Real PDF/DOCX text extraction on the backend, including tables and weekly-schedule grids, not just paragraphs.
- Real AI event extraction via Google Gemini (free tier) — the frontend now uploads to the real backend and
  displays real extracted events, not mock data.

No Google Calendar integration yet — that's Phase 5.

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

**Get a free Gemini API key:** https://aistudio.google.com/apikey — paste it into `backend/.env` as
`GEMINI_API_KEY=...`. No billing required for the free tier.

## Trying the app

1. Start the backend (`npm run dev` in `backend/`) and the frontend (`npm run dev` in `frontend/`).
2. Open http://localhost:5173.
3. Drag a real PDF or DOCX syllabus onto the upload card (or click **Browse Files**).
4. The app reads your syllabus for real: extracts the text (tables included), sends it to Gemini, and
   displays the real course info and extracted events — any with a missing/ambiguous date are flagged
   "Needs Review" and can't be selected until corrected.
5. Try selecting/deselecting events, editing one (pencil icon), deleting one (trash icon), adding one
   manually (**Add Event**), and clicking **Add to Google Calendar** to see the (still-mocked — Phase 5)
   sync flow.

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

- Uses Google Gemini (`gemini-3.8-flash` by default, override with `GEMINI_MODEL`) via the `@google/genai`
  SDK, with structured output (`responseSchema`) so Gemini returns JSON matching the expected shape
  directly, rather than free-form text. (`gemini-2.5-flash` is no longer available to new API keys as
  of this writing — Google's API error pointed to `gemini-3.8-flash` as the replacement.)
- The response is still re-validated with the Zod schema in `backend/schemas/eventSchema.js` before
  anything downstream trusts it, per the build plan's "validate AI-generated data" rule.
- Follows the build plan's extraction rules: never invents a missing date or time, defaults to an
  all-day event rather than a fake midnight deadline, flags ambiguous/missing dates as "Needs Review",
  and includes a short source excerpt per event so you can verify it against the original text.
- Fails with a clear error (not a crash, not fabricated data) if `GEMINI_API_KEY` is missing or the
  API call fails.

## What's next

- Phase 5: real Google OAuth + Calendar event creation (currently mocked in the UI).

See `buildplan.md` for the full spec.
