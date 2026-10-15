import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSyllabusFile } from "../services/fileParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYNTHETIC_SNIPPETS = [
  "Assignment 1 is due October 20, 2026",
  "midterm exam will be held in class on October 28, 2026",
  "Final Project",
  "35%", // grading table: Final Exam weight
  "Memory Management", // weekly schedule row
  "Final Project Due", // weekly schedule deliverable cell
];

const REAL_SYLLABUS_SNIPPETS = [
  "Quiz 1", // weekly-schedule table, correctly associated with its week row
  "Due Date: Oct 02 at 11:59 PM", // same table, same row
  "Midterm Exam I", // grading breakdown table
  "Oct 23 at 11:59 PM", // quiz due-dates table
  "Dec 10 at 11:59 PM", // final project due date, labs table
];

let failures = 0;

async function runCase(label, filePath, mimeType, { minTables = 2, expectedSnippets = SYNTHETIC_SNIPPETS } = {}) {
  console.log(`\n=== ${label} ===`);
  const buffer = await readFile(filePath);
  const result = await parseSyllabusFile(buffer, mimeType);

  console.log(`characters: ${result.text.length}`);
  console.log(`pageCount: ${result.pageCount}`);
  console.log(`tableCount: ${result.tableCount}`);

  if (result.tableCount < minTables) {
    console.error(`FAIL: expected at least ${minTables} tables detected, got ${result.tableCount}`);
    failures += 1;
  }

  for (const snippet of expectedSnippets) {
    if (result.text.includes(snippet)) {
      console.log(`  OK   found: "${snippet}"`);
    } else {
      console.error(`  FAIL missing: "${snippet}"`);
      failures += 1;
    }
  }

  console.log("\n--- extracted text preview (first 1200 chars) ---");
  console.log(result.text.slice(0, 1200));
  console.log("--- end preview ---\n");

  return result;
}

async function runErrorCase(label, buffer, mimeType, expectedStatus) {
  console.log(`\n=== ${label} ===`);
  try {
    await parseSyllabusFile(buffer, mimeType);
    console.error(`FAIL: expected an error to be thrown`);
    failures += 1;
  } catch (err) {
    if (err.status === expectedStatus) {
      console.log(`  OK   threw status ${err.status}: ${err.publicMessage}`);
    } else {
      console.error(`  FAIL wrong status. expected ${expectedStatus}, got ${err.status}: ${err.message}`);
      failures += 1;
    }
  }
}

await runCase(
  "DOCX — synthetic syllabus",
  path.join(__dirname, "sample-syllabus.docx"),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
);

await runCase(
  "PDF — synthetic syllabus",
  path.join(__dirname, "sample-syllabus.pdf"),
  "application/pdf"
);

await runCase(
  "PDF — real syllabus (CP400V, Word-exported with fill-rect table borders)",
  path.join(__dirname, "real-syllabus-cp400v.pdf"),
  "application/pdf",
  { minTables: 5, expectedSnippets: REAL_SYLLABUS_SNIPPETS }
);

await runErrorCase(
  "PDF — corrupted/invalid bytes",
  Buffer.from("this is not a real pdf file"),
  "application/pdf",
  422
);

await runErrorCase(
  "DOCX — corrupted/invalid bytes",
  Buffer.from("this is not a real docx file"),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  422
);

await runErrorCase(
  "Unsupported mime type",
  Buffer.from("hello"),
  "text/plain",
  400
);

await runErrorCase(
  "PDF — scanned document with no text layer",
  await readFile(path.join(__dirname, "scanned-no-text.pdf")),
  "application/pdf",
  422
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
