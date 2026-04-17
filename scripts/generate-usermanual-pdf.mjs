import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { jsPDF } from "jspdf";

const outputPath = path.join(process.cwd(), "public", "usermanual.pdf");

const palette = {
  ink: [15, 23, 42],
  blue: [29, 78, 216],
  sky: [248, 250, 252],
  line: [148, 163, 184],
  text: [30, 41, 59],
  muted: [71, 85, 105],
};

const sections = {
  workflow: [
    "1. Job Creation: confirm Job Number, client, material, and scope.",
    "2. Lot: create or open the Lot Number tied to the job.",
    "3. Images: capture every required photo from the device camera.",
    "4. Final Pass: mark Pass, Hold, or Reject; Hold/Reject blocks movement until reviewed.",
    "5. Lab Testing: record test results and keep evidence linked to the lot.",
    "6. Report: generate or view the report PDF for the current job.",
    "7. Packing List: download, share, print, or view the packing list PDF.",
  ],
  evidence: [
    "Bag photo with visible LOT no",
    "Material in bag",
    "During Sampling Photo",
    "Sample Completion",
    "Seal on bag",
    "Bag condition",
    "Whole Job bag palletized and packed",
  ],
  captureRules: [
    "Scan Seal first. Use Capture Seal Photo if scanning fails.",
    "Manual seal entry is fallback only.",
    "Do not skip missing photos; the step stays incomplete until evidence is uploaded.",
    "Use Job Number and Lot Number in every handoff.",
    "Check weight, seal, and photo evidence before closing the lot.",
    "Keep the current step visible and finish one task before moving to the next.",
  ],
  documentActions: [
    "View PDF",
    "Download Report PDF",
    "Download Packing List PDF",
    "Share PDF",
    "Print PDF",
    "Use the latest generated file for operational handoff.",
  ],
};

function addTitle(doc) {
  const x = 10;
  const y = 10;
  const width = 190;
  const height = 28;

  doc.setFillColor(...palette.ink);
  doc.roundedRect(x, y, width, height, 3, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RECYCOS OPERATIONS", x + 6, y + 7);

  doc.setFontSize(20);
  doc.text("User Manual", x + 6, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const subtitle =
    "Use this one-page guide to move a job from creation through final pass, testing, report, and packing list without losing traceability, evidence, or seal control.";
  const subtitleLines = doc.splitTextToSize(subtitle, 108);
  doc.text(subtitleLines, x + 110, y + 8);
}

function addCallout(doc) {
  const x = 10;
  const y = 42;
  const width = 190;
  const height = 16;

  doc.setFillColor(...palette.sky);
  doc.setDrawColor(...palette.line);
  doc.roundedRect(x, y, width, height, 3, 3, "FD");

  doc.setTextColor(...palette.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRIMARY RULE", x + 6, y + 5);

  doc.setTextColor(...palette.text);
  doc.setFontSize(10);
  const body =
    "Finish the current stage before moving forward. Hold and Reject block progression until the job is reviewed and resolved.";
  doc.text(doc.splitTextToSize(body, 146), x + 6, y + 11);
}

function drawCard(doc, x, y, width, height, title) {
  doc.setDrawColor(...palette.line);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 3, 3, "FD");
  doc.setTextColor(...palette.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), x + 4, y + 5);
}

function addList(doc, items, x, y, width, lineHeight = 4.4, fontSize = 8.2) {
  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);

  let cursorY = y;
  for (const item of items) {
    const lines = doc.splitTextToSize(item, width);
    doc.text(lines, x, cursorY);
    cursorY += lines.length * lineHeight;
  }

  return cursorY;
}

function addWorkflowCard(doc) {
  const x = 10;
  const y = 62;
  const width = 96;
  const height = 53;
  drawCard(doc, x, y, width, height, "Workflow");
  addList(doc, sections.workflow, x + 4, y + 9, width - 8, 3.6, 7.5);
}

function addQuickRulesCard(doc) {
  const x = 10;
  const y = 118;
  const width = 96;
  const height = 61;
  drawCard(doc, x, y, width, height, "Quick Rules");
  addList(doc, sections.captureRules.slice(0, 5), x + 4, y + 9, width - 8, 3.9, 7.6);
}

function addEvidenceCard(doc) {
  const x = 108;
  const y = 62;
  const width = 92;
  const height = 53;
  drawCard(doc, x, y, width, height, "Required Evidence");

  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const leftColumn = sections.evidence.slice(0, 4);
  const rightColumn = sections.evidence.slice(4);

  let cursorY = y + 10;
  leftColumn.forEach((item, index) => {
    doc.text(`• ${item}`, x + 4, cursorY + index * 8);
  });
  rightColumn.forEach((item, index) => {
    doc.text(`• ${item}`, x + 46, cursorY + index * 8);
  });
}

function addActionsCard(doc) {
  const x = 108;
  const y = 118;
  const width = 92;
  const height = 61;
  drawCard(doc, x, y, width, height, "Document Actions");

  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  sections.documentActions.slice(0, 5).forEach((item, index) => {
    doc.text(`• ${item}`, x + 4, y + 10 + index * 7.3);
  });

  doc.setDrawColor(...palette.blue);
  doc.setFillColor(...palette.sky);
  doc.roundedRect(x + 4, y + 43, width - 8, 12, 2, 2, "FD");
  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text("Before you finish:", x + 6, y + 47);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.text("Confirm the current step, seal number, required photos, and final pass decision.", x + 6, y + 51);
}

function addFooter(doc) {
  const x = 10;
  const y = 183;
  const width = 190;
  doc.setDrawColor(...palette.line);
  doc.line(x, y, x + width, y);

  doc.setTextColor(...palette.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    "Missing evidence should stay visible as a blocker. Use Job Number and Lot Number in every handoff.",
    x,
    y + 5,
  );

  const tags = ["Job Number", "Lot Number", "Current Step", "Missing Photos"];
  let tagX = 126;
  tags.forEach((tag) => {
    const tagWidth = doc.getTextWidth(tag) + 6;
    doc.setDrawColor(...palette.blue);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(tagX, y + 1, tagWidth, 6, 3, 3, "FD");
    doc.setTextColor(...palette.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.text(tag, tagX + 3, y + 5.5);
    tagX += tagWidth + 2;
  });
}

const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
doc.setProperties({
  title: "User Manual",
  subject: "One-page operational user manual",
  author: "Codex",
  keywords: "user manual, inspection workflow, pdf",
  creator: "rd-core",
});

addTitle(doc);
addCallout(doc);
addWorkflowCard(doc);
addEvidenceCard(doc);
addQuickRulesCard(doc);
addActionsCard(doc);
addFooter(doc);

const pdfBytes = doc.output("arraybuffer");
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(pdfBytes));

console.log(`Wrote ${outputPath}`);
