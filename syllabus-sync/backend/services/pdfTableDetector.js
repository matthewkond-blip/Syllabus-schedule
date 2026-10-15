import { Line, LineStore, Point, Rectangle } from "pdf-parse";
import { OPS, Util } from "pdfjs-dist/legacy/build/pdf.mjs";

// pdf-parse's own getTable() only recognizes table borders drawn with a
// `stroke` paint op and an exact zero-width/zero-height bounding box. In
// practice, PDFs exported from Word/Google Docs (the most common way a real
// syllabus becomes a PDF) draw gridlines as thin *filled* rectangles instead
// (an eoFill path a fraction of a point tall/wide), so pdf-parse's detector
// finds zero tables on those files even though the borders are clearly
// visible. This module re-scans the same page geometry with those two
// restrictions relaxed, reusing pdf-parse's own exported line/table classes
// for the clustering logic.
const WIDE_THRESHOLD = 5;
const THIN_THRESHOLD = 2.5;
const PAINT_OPS = new Set([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

function classifyGeometry(mm) {
  if (mm[0] === Infinity) return null;
  const width = mm[2] - mm[0];
  const height = mm[3] - mm[1];
  if (width > WIDE_THRESHOLD && height > WIDE_THRESHOLD) return "rectangle";
  if (width > WIDE_THRESHOLD && height <= THIN_THRESHOLD) return "hline";
  if (height > WIDE_THRESHOLD && width <= THIN_THRESHOLD) return "vline";
  return null;
}

async function collectPageLines(page) {
  const lineStore = new LineStore();
  const viewport = page.getViewport({ scale: 1 });
  let transformMatrix = [1, 0, 0, 1, 0, 0];
  const transformStack = [];
  const opList = await page.getOperatorList();

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.constructPath) {
      const op = args?.[0] ?? 0;
      const mm = args?.[2] ?? [Infinity, Infinity, -Infinity, -Infinity];
      if (!PAINT_OPS.has(op)) continue;

      const kind = classifyGeometry(mm);
      if (kind === "rectangle") {
        const rect = new Rectangle(new Point(mm[0], mm[1]), mm[2] - mm[0], mm[3] - mm[1]);
        rect.transform(transformMatrix);
        rect.transform(viewport.transform);
        lineStore.addRectangle(rect);
      } else if (kind === "hline" || kind === "vline") {
        const from = new Point(mm[0], mm[1]);
        const to = new Point(mm[2], mm[3]);
        const line = new Line(from, to);
        line.transform(transformMatrix);
        line.transform(viewport.transform);
        lineStore.add(line);
      }
    } else if (fn === OPS.save) {
      transformStack.push(transformMatrix);
    } else if (fn === OPS.restore) {
      const restored = transformStack.pop();
      if (restored) transformMatrix = restored;
    } else if (fn === OPS.transform) {
      transformMatrix = Util.transform(transformMatrix, args);
    }
  }

  return lineStore;
}

async function fillTableText(page, tableDataArr) {
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false,
  });

  for (const textItem of textContent.items) {
    if (!("str" in textItem)) continue;
    const tx = Util.transform(Util.transform(viewport.transform, textItem.transform), [1, 0, 0, -1, 0, 0]);
    for (const tableData of tableDataArr) {
      const cell = tableData.findCell(tx[4], tx[5]);
      if (cell) {
        cell.text.push(textItem.str);
        if (textItem.hasEOL) cell.text.push("\n");
        break;
      }
    }
  }
}

/**
 * Detect tables on a single page using fill-rect-aware border detection.
 * Returns [] (rather than throwing) if the page has no detectable tables,
 * or if pdf-parse's internal document handle isn't reachable (e.g. a future
 * pdf-parse version renames its private `doc` field).
 */
export async function detectPdfTables(parser, pageNum) {
  const doc = parser.doc;
  if (!doc) return [];

  let page;
  try {
    page = await doc.getPage(pageNum);
    const lineStore = await collectPageLines(page);
    lineStore.normalize();
    const tableDataArr = lineStore.getTableData();
    await fillTableText(page, tableDataArr);
    return tableDataArr.map((t) => t.toArray());
  } finally {
    page?.cleanup();
  }
}
