import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "scanned-no-text.pdf");

// Simulates a scanned syllabus: a page with only vector drawing, no text layer.
const doc = new PDFDocument({ margin: 50 });
doc.pipe(createWriteStream(outPath));
doc.rect(50, 50, 400, 600).stroke();
doc.end();

doc.on("finish", () => console.log(`Wrote ${outPath}`));
