import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import {
  COURSE_HEADER,
  DESCRIPTION_PARAGRAPHS,
  GRADING_TABLE,
  WEEKLY_SCHEDULE_TABLE,
} from "./sampleSyllabusContent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function drawTable(doc, rows, { x, colWidths, rowHeight = 22 }) {
  let y = doc.y;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  rows.forEach((row) => {
    let cellX = x;
    row.forEach((cell, colIndex) => {
      doc.rect(cellX, y, colWidths[colIndex], rowHeight).stroke();
      doc.fontSize(9).text(cell, cellX + 4, y + 6, {
        width: colWidths[colIndex] - 8,
        height: rowHeight - 8,
        ellipsis: true,
      });
      cellX += colWidths[colIndex];
    });
    y += rowHeight;
  });

  doc.y = y + 12;
  doc.x = x;
}

const outPath = path.join(__dirname, "sample-syllabus.pdf");
const doc = new PDFDocument({ margin: 50 });
doc.pipe(createWriteStream(outPath));

doc.fontSize(20).text(`${COURSE_HEADER.code} — ${COURSE_HEADER.title}`);
doc.fontSize(12).text(COURSE_HEADER.term);
doc.moveDown();

doc.fontSize(11);
DESCRIPTION_PARAGRAPHS.forEach((paragraph) => {
  doc.text(paragraph, { align: "left" });
  doc.moveDown(0.5);
});

doc.moveDown();
doc.fontSize(14).text("Grading Breakdown");
doc.moveDown(0.5);
drawTable(doc, GRADING_TABLE, { x: 50, colWidths: [250, 100] });

doc.moveDown();
doc.fontSize(14).text("Weekly Schedule");
doc.moveDown(0.5);
drawTable(doc, WEEKLY_SCHEDULE_TABLE, { x: 50, colWidths: [50, 70, 200, 150] });

doc.end();

doc.on("finish", () => {
  console.log(`Wrote ${outPath}`);
});
