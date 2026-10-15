import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import {
  COURSE_HEADER,
  DESCRIPTION_PARAGRAPHS,
  GRADING_TABLE,
  WEEKLY_SCHEDULE_TABLE,
} from "./sampleSyllabusContent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph(cell)],
              })
          ),
        })
    ),
  });
}

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          text: `${COURSE_HEADER.code} — ${COURSE_HEADER.title}`,
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({ text: COURSE_HEADER.term, heading: HeadingLevel.HEADING_2 }),
        ...DESCRIPTION_PARAGRAPHS.map((text) => new Paragraph(text)),
        new Paragraph({ text: "Grading Breakdown", heading: HeadingLevel.HEADING_2 }),
        buildTable(GRADING_TABLE),
        new Paragraph(""),
        new Paragraph({ text: "Weekly Schedule", heading: HeadingLevel.HEADING_2 }),
        buildTable(WEEKLY_SCHEDULE_TABLE),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const outPath = path.join(__dirname, "sample-syllabus.docx");
await writeFile(outPath, buffer);
console.log(`Wrote ${outPath}`);
