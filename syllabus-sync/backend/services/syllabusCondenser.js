// Shrinks syllabus text to fit the AI model's token budget.
//
// Most of a long syllabus is policy boilerplate (academic integrity,
// accessibility, late penalties...) with no dates in it. condenseSyllabus()
// keeps the course header, every table and line that mentions a date or a
// deadline keyword (plus a little surrounding context), and drops the rest.
// If that's still too big, chunkSyllabus() splits it into pieces that each
// fit in one request.

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_PATTERNS = [
  new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "i"), // Oct 2, October 2nd
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}(?:\\s|$|,)`, "i"), // 2 Oct
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/, // 10/02, 02.10.2026
  /\b\d{4}-\d{2}-\d{2}\b/, // 2026-10-02
  /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i,
  /\bweek\s*\d{1,2}\b/i,
];

const KEYWORD_PATTERN =
  /\b(?:due|deadlines?|quiz(?:zes)?|exams?|examination|midterms?|final|assignments?|projects?|presentations?|labs?|tests?|essays?|proposals?|reports?|reading week|tba|tbd)\b/i;

// Lines kept around each date match — deadlines often wrap across lines
// ("Quiz 1 - (content covered" / "chapter 3, 4 & 5)" / "Due Date: Oct 02").
const DATE_CONTEXT_LINES = 2;
// The opening of a syllabus is where the course code, name and term live.
const HEADER_CHARS = 1500;
const OMITTED_MARKER = "[...]";

const hasDate = (text) => DATE_PATTERNS.some((re) => re.test(text));
const hasKeyword = (text) => KEYWORD_PATTERN.test(text);

// Splits text into ordered segments: whole [TABLE]...[/TABLE] blocks, and
// individual lines of everything else.
function segment(text) {
  const segments = [];
  const tableRe = /\[TABLE\][\s\S]*?\[\/TABLE\]/g;
  let last = 0;
  for (const match of text.matchAll(tableRe)) {
    for (const line of text.slice(last, match.index).split("\n")) {
      segments.push({ kind: "line", text: line });
    }
    segments.push({ kind: "table", text: match[0] });
    last = match.index + match[0].length;
  }
  for (const line of text.slice(last).split("\n")) segments.push({ kind: "line", text: line });
  return segments;
}

function splitHeader(text) {
  if (text.length <= HEADER_CHARS) return { header: text, body: "" };
  const cut = text.lastIndexOf("\n", HEADER_CHARS);
  const at = cut > 0 ? cut : HEADER_CHARS;
  return { header: text.slice(0, at), body: text.slice(at) };
}

export function condenseSyllabus(text) {
  const { header, body } = splitHeader(text);
  const segments = segment(body);
  const keep = new Array(segments.length).fill(false);

  segments.forEach((seg, i) => {
    if (!seg.text.trim()) return;
    if (seg.kind === "table") {
      keep[i] = hasDate(seg.text) || hasKeyword(seg.text);
      return;
    }
    if (hasDate(seg.text)) {
      for (let j = i - DATE_CONTEXT_LINES; j <= i + DATE_CONTEXT_LINES; j++) {
        if (segments[j]?.kind === "line") keep[j] = true;
      }
      keep[i] = true;
    } else if (hasKeyword(seg.text)) {
      keep[i] = true;
    }
  });

  const out = [header];
  let omitted = false;
  segments.forEach((seg, i) => {
    if (keep[i]) {
      out.push(seg.text);
      omitted = false;
    } else if (seg.text.trim() && !omitted) {
      out.push(OMITTED_MARKER);
      omitted = true;
    }
  });
  return out.join("\n");
}

// Breaks an oversized table into smaller tables, repeating its header row so
// each piece still makes sense on its own.
function splitTable(tableText, maxChars) {
  const rows = tableText.replace(/^\[TABLE\]\n?/, "").replace(/\n?\[\/TABLE\]$/, "").split("\n");
  const head = rows.slice(0, 2).join("\n");
  const pieces = [];
  let current = [];
  let size = head.length;
  for (const row of rows.slice(2)) {
    if (current.length > 0 && size + row.length + 1 > maxChars - 20) {
      pieces.push(`[TABLE]\n${head}\n${current.join("\n")}\n[/TABLE]`);
      current = [];
      size = head.length;
    }
    current.push(row);
    size += row.length + 1;
  }
  if (current.length > 0) pieces.push(`[TABLE]\n${head}\n${current.join("\n")}\n[/TABLE]`);
  return pieces;
}

// Packs text into chunks of at most maxChars, never splitting a table across
// chunks unless the table alone is too big. Every chunk starts with the
// syllabus header so the model always knows which course and term it's in.
export function chunkSyllabus(text, maxChars) {
  const { header, body } = splitHeader(text);
  const budget = Math.max(maxChars - header.length, 1000);

  const pieces = [];
  for (const seg of segment(body)) {
    if (seg.text.length <= budget) pieces.push(seg.text);
    else if (seg.kind === "table") pieces.push(...splitTable(seg.text, budget));
    else for (let i = 0; i < seg.text.length; i += budget) pieces.push(seg.text.slice(i, i + budget));
  }

  const chunks = [];
  let current = [];
  let size = 0;
  for (const piece of pieces) {
    if (current.length > 0 && size + piece.length + 1 > budget) {
      chunks.push(current.join("\n"));
      current = [];
      size = 0;
    }
    current.push(piece);
    size += piece.length + 1;
  }
  if (current.join("").trim()) chunks.push(current.join("\n"));

  return chunks.length > 0 ? chunks.map((c) => `${header}\n${c}`) : [header];
}
