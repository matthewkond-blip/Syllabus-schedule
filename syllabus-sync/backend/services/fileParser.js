import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { AppError } from "../utils/AppError.js";
import { detectPdfTables } from "./pdfTableDetector.js";

const MIN_MEANINGFUL_CHARACTERS = 40;

function hasMeaningfulText(text) {
  const letters = text.replace(/[^a-zA-Z0-9]/g, "");
  return letters.length >= MIN_MEANINGFUL_CHARACTERS;
}

// Geometry-based table detection (especially the fill-rect fallback below)
// also picks up decorative boxes, hyperlink highlight rects, and paragraph
// text that merely happens to sit in a grid-ish layout. Those come through
// as sparse, mostly single-column "tables" — require at least 2 columns and
// a reasonable fraction of populated cells before treating it as real data.
function isWorthwhileTable(rows) {
  const colCount = Math.max(0, ...rows.map((row) => row.length));
  if (rows.length < 2 || colCount < 2) return false;

  let nonEmpty = 0;
  let total = 0;
  for (const row of rows) {
    for (const cell of row) {
      total += 1;
      if (cell.length > 0) nonEmpty += 1;
    }
  }
  return nonEmpty >= 2 && nonEmpty / total >= 0.2;
}

function tableToMarkdown(table) {
  if (!table || table.length === 0) return "";

  const rows = table.map((row) => row.map((cell) => (cell ?? "").replace(/\s+/g, " ").trim()));
  if (!isWorthwhileTable(rows)) return "";

  const colCount = Math.max(...rows.map((row) => row.length));

  const lines = rows.map((row) => {
    const padded = [...row, ...Array(colCount - row.length).fill("")];
    return `| ${padded.join(" | ")} |`;
  });

  const separator = `| ${Array(colCount).fill("---").join(" | ")} |`;
  lines.splice(1, 0, separator);

  return lines.join("\n");
}

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    // pdf.js's internal worker port can't service concurrent requests on the
    // same document, so these must run sequentially rather than via Promise.all.
    const textResult = await parser.getText();
    const tableResult = await parser.getTable();

    const pageCount = textResult.total;
    const sections = [];
    let tableCount = 0;

    for (const page of textResult.pages) {
      const pageText = page.text.trim();
      if (pageText) sections.push(pageText);

      let tablesOnPage = tableResult.pages.find((p) => p.num === page.num)?.tables || [];

      // pdf-parse's own detector misses tables whose borders are drawn as
      // thin filled rectangles (common in Word/Docs-exported PDFs) rather
      // than stroked lines. Fall back to the relaxed detector for any page
      // it came up empty on.
      if (tablesOnPage.length === 0) {
        try {
          tablesOnPage = await detectPdfTables(parser, page.num);
        } catch (err) {
          console.error("Fallback PDF table detection failed:", err?.message || err);
          tablesOnPage = [];
        }
      }

      for (const table of tablesOnPage) {
        const markdown = tableToMarkdown(table);
        if (markdown) {
          tableCount += 1;
          sections.push(`[TABLE]\n${markdown}\n[/TABLE]`);
        }
      }
    }

    return {
      text: sections.join("\n\n"),
      pageCount,
      tableCount,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err?.name === "PasswordException") {
      throw new AppError(422, "This PDF is password-protected. Please upload an unprotected file.");
    }
    console.error("PDF parse failed:", err?.message || err);
    throw new AppError(422, "We couldn't read that PDF. It may be corrupted or in an unsupported format.");
  } finally {
    await parser.destroy();
  }
}

const BLOCK_TAG_PATTERN = /<(p|h[1-6]|li)[^>]*>([\s\S]*?)<\/\1>|<table[^>]*>([\s\S]*?)<\/table>/gi;
const ROW_PATTERN = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_PATTERN = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(str) {
  return str.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X"
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    }
    const key = entity.toLowerCase();
    return key in HTML_ENTITIES ? HTML_ENTITIES[key] : match;
  });
}

function stripTags(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTableToRows(tableHtml) {
  const rows = [];
  let rowMatch;
  ROW_PATTERN.lastIndex = 0;
  while ((rowMatch = ROW_PATTERN.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1];
    const cells = [];
    let cellMatch;
    CELL_PATTERN.lastIndex = 0;
    while ((cellMatch = CELL_PATTERN.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function docxHtmlToStructuredText(html) {
  const sections = [];
  let tableCount = 0;
  let match;
  BLOCK_TAG_PATTERN.lastIndex = 0;

  while ((match = BLOCK_TAG_PATTERN.exec(html)) !== null) {
    const [, , blockContent, tableContent] = match;

    if (tableContent !== undefined) {
      const rows = htmlTableToRows(tableContent);
      const markdown = tableToMarkdown(rows);
      if (markdown) {
        tableCount += 1;
        sections.push(`[TABLE]\n${markdown}\n[/TABLE]`);
      }
      continue;
    }

    const text = stripTags(blockContent);
    if (text) sections.push(text);
  }

  return { text: sections.join("\n\n"), tableCount };
}

async function parseDocx(buffer) {
  let result;
  try {
    result = await mammoth.convertToHtml({ buffer });
  } catch {
    throw new AppError(422, "We couldn't read that DOCX file. It may be corrupted or in an unsupported format.");
  }

  const { text, tableCount } = docxHtmlToStructuredText(result.value);
  return { text, pageCount: null, tableCount };
}

export async function parseSyllabusFile(buffer, mimeType) {
  let result;

  if (mimeType === "application/pdf") {
    result = await parsePdf(buffer);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    result = await parseDocx(buffer);
  } else {
    throw new AppError(400, "Please upload a PDF or DOCX file.");
  }

  if (!hasMeaningfulText(result.text)) {
    throw new AppError(
      422,
      "We couldn't find any readable text in this file. It may be a scanned document without selectable text — scanned PDFs aren't supported yet."
    );
  }

  return result;
}
