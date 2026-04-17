import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import path from "path";
import { renderHtmlToPdf } from "@/lib/inspection-documents";
import { buildReportValidation } from "@/lib/report-validation";
import {
  getReportDocumentTypeLabel,
  sanitizeReportDocumentType,
} from "@/lib/report-preferences";
import {
  getExportPolicyBlockReason,
  getReportExportStagePolicy,
  isExportStageAllowed,
} from "@/lib/report-export-policy";
import { getEvidenceCategoryLabel } from "@/lib/evidence-definition";
import { resolveDocumentBrandingContext } from "@/lib/document-branding-context";

// Helper functions (unchanged logic, extracted for reuse)
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function guessMimeFromPath(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function formatDateValue(value: string | Date | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-GB");
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveLotGrossWeight(lot: any): number {
  const lotGross = toFiniteNumber(lot.grossWeightKg) ?? toFiniteNumber(lot.grossWeight);
  if (lotGross !== null) return lotGross;
  if (lot.bags?.length > 0) {
    return lot.bags.reduce((sum: number, bag: any) => sum + (toFiniteNumber(bag.grossWeight) ?? 0), 0);
  }
  return 0;
}

function resolveLotNetWeight(lot: any): number {
  const lotNet = toFiniteNumber(lot.netWeightKg) ?? toFiniteNumber(lot.netWeight);
  if (lotNet !== null) return lotNet;
  if (lot.bags?.length > 0) {
    return lot.bags.reduce((sum: number, bag: any) => sum + (toFiniteNumber(bag.netWeight) ?? 0), 0);
  }
  return 0;
}

async function toDataUrl(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith("/")) {
      const absolutePath = path.join(process.cwd(), "public", imageUrl.replace(/^\/+/, ""));
      const data = await readFile(absolutePath);
      const mime = guessMimeFromPath(absolutePath);
      return `data:${mime};base64,${data.toString("base64")}`;
    }
    if (/^https?:\/\//i.test(imageUrl)) {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "image/png";
      const arrayBuffer = await response.arrayBuffer();
      return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
    }
  } catch {
    return null;
  }
  return null;
}

function buildSamplingAssayReportHtml(input: any) {
  const rowsHtml = input.rows.map((row: any) => `
    <tr>
      <td class="k">${escapeHtml(row.label)}</td>
      <td class="colon">:</td>
      <td class="v">${escapeHtml(row.value)}</td>
    </tr>
  `).join("");

  const sampleRowsHtml = input.sampleRows.map((row: any) => `
    <tr>
      <td class="k">${escapeHtml(row.label)}</td>
      <td class="colon">:</td>
      <td class="v">${escapeHtml(row.value)}</td>
    </tr>
  `).join("");

  const lotRegisterHtml = input.lotRegisterRows.map((row: any) => `
    <tr>
      <td>${escapeHtml(row.lotNumber)}</td>
      <td>${escapeHtml(row.bags)}</td>
      <td>${escapeHtml(row.netWeight)}</td>
      <td>${escapeHtml(row.sampleCode)}</td>
      <td>${escapeHtml(row.packets)}</td>
      <td>${escapeHtml(row.trials)}</td>
      <td>${escapeHtml(row.status)}</td>
    </tr>
  `).join("");

  const analysisHtml = input.analysisRows.map((row: any) => `
    <tr>
      <td>${escapeHtml(row.element)}</td>
      <td>${escapeHtml(row.average)}</td>
      <td>${escapeHtml(row.observations)}</td>
    </tr>
  `).join("");

  const operationHtml = input.operationNotes.map((line: any) => `<li>${escapeHtml(line)}</li>`).join("");
  const methodologyHtml = input.methodologyNotes.map((line: any) => `<li>${escapeHtml(line)}</li>`).join("");

  const visualsHtml = input.visuals
    .filter((section: any) => section.cards.length > 0)
    .map((section: any) => {
      const cards = section.cards
        .map((card: any) => `
          <div class="photo-card">
            <div class="photo-label">${escapeHtml(card.label)}</div>
            ${card.dataUrl ? `<img src="${card.dataUrl}" alt="${escapeHtml(card.label)}" />` : `<div class="missing">Image unavailable</div>`}
          </div>
        `).join("");
      return `<div class="lot-block"><h4>Lot ${escapeHtml(section.lotNumber)}</h4><div class="photo-grid">${cards}</div></div>`;
    }).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 14mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; line-height: 1.35; }
          .top { display: grid; grid-template-columns: 1fr 120px; align-items: start; gap: 12px; border-bottom: 1px solid #bdbdbd; padding-bottom: 8px; }
          .brand h1 { margin: 0; font-size: 32px; line-height: 1; font-weight: 700; color: #222; }
          .meta { margin-top: 6px; font-size: 10px; color: #333; white-space: pre-line; }
          .logo { width: 120px; height: 50px; border: 1px solid #d6d6d6; border-radius: 4px; object-fit: contain; }
          .title-row { margin-top: 12px; display: flex; justify-content: space-between; align-items: baseline; }
          .title { text-align: center; flex: 1; font-size: 14px; font-weight: 700; text-decoration: underline; }
          .date { width: 150px; text-align: right; font-size: 11px; font-weight: 700; }
          .refs { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px; }
          .ref-item { border: 1px solid #9f9f9f; padding: 4px 6px; }
          .lead { margin-top: 10px; text-align: justify; }
          .tbl { margin-top: 8px; width: 100%; border-collapse: collapse; }
          .tbl td { border: 1px solid #8d8d8d; padding: 4px 6px; vertical-align: top; }
          .tbl .k { width: 34%; font-weight: 600; }
          .tbl .colon { width: 2%; text-align: center; font-weight: 700; }
          .matrix { margin-top: 8px; width: 100%; border-collapse: collapse; font-size: 10px; }
          .matrix th, .matrix td { border: 1px solid #8d8d8d; padding: 4px 6px; text-align: left; }
          .matrix th { background: #f4f4f4; font-weight: 700; }
          .section { margin-top: 12px; }
          .section h3 { margin: 0 0 4px; font-size: 12px; font-weight: 700; text-decoration: underline; }
          ul { margin: 4px 0 0 16px; padding: 0; }
          li { margin: 1px 0; }
          .page-break { page-break-before: always; }
          .lot-block { margin-top: 8px; }
          .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .photo-card { border: 1px solid #8d8d8d; border-radius: 4px; padding: 4px; }
          .photo-label { font-size: 10px; font-weight: 700; margin-bottom: 4px; }
          .photo-card img { width: 100%; height: 130px; object-fit: contain; }
          .missing { height: 130px; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; color: #777; }
          .sign-block { margin-top: 14px; width: 100%; border-collapse: collapse; }
          .sign-block td { border: 1px solid #8d8d8d; padding: 6px; width: 50%; vertical-align: top; }
          .sig-line { margin-top: 30px; border-top: 1px solid #777; padding-top: 2px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="top">
          <div class="brand">
            <h1>${escapeHtml(input.brandName)}</h1>
            <div class="meta">${escapeHtml([input.brandAddress, input.brandContact, input.brandTaxId ? `Tax ID: ${input.brandTaxId}` : ""].filter(Boolean).join("\n"))}</div>
          </div>
          <div>${input.logoDataUrl ? `<img class="logo" src="${input.logoDataUrl}" alt="Logo"/>` : ""}</div>
        </div>
        <div class="title-row">
          <div class="title">${escapeHtml(input.reportTitle)}</div>
          <div class="date">Date: ${escapeHtml(input.generatedOnLabel)}</div>
        </div>
        <div class="refs">
          <div class="ref-item"><strong>Reference No:</strong> ${escapeHtml(input.referenceNo)}</div>
          <div class="ref-item"><strong>Certificate No:</strong> ${escapeHtml(input.certificateNo)}</div>
        </div>
        <p class="lead">${escapeHtml(input.introText)}</p>
        <table class="tbl"><tbody>${rowsHtml}</tbody></table>
        ${sampleRowsHtml ? `<div class="section"><h3>SAMPLING & PACKET CONTROL</h3><table class="tbl"><tbody>${sampleRowsHtml}</tbody></table></div>` : ""}
        ${lotRegisterHtml ? `<div class="section"><h3>LOT-WISE REGISTER</h3><table class="matrix"><thead><tr><th>Lot</th><th>Bags</th><th>Net Weight</th><th>Sample Code</th><th>Packets</th><th>Trials</th><th>Status</th></tr></thead><tbody>${lotRegisterHtml}</tbody></table></div>` : ""}
        ${analysisHtml ? `<div class="section"><h3>ASSAY SUMMARY</h3><table class="matrix"><thead><tr><th>Element</th><th>Average</th><th>Observations</th></tr></thead><tbody>${analysisHtml}</tbody></table></div>` : ""}
        <div class="section"><h3>SUPERVISION OF WEIGHMENT:</h3><ul>${operationHtml}</ul></div>
        <div class="section"><h3>WEIGHT CALCULATION METHODOLOGY</h3><ul>${methodologyHtml}</ul></div>
        <table class="sign-block">
          <tr>
            <td><strong>Prepared By</strong><div class="sig-line">Inspection Team</div></td>
            <td><strong>Authorized Signatory</strong><br/>For and on behalf of ${escapeHtml(input.brandName)}<div class="sig-line">${escapeHtml(input.authorizedSignatoryName || "Authorized Signatory")}</div>${input.authorizedSignatoryTitle ? `<div style="margin-top:2px;">${escapeHtml(input.authorizedSignatoryTitle)}</div>` : ""}</td>
          </tr>
        </table>
        ${input.homogeneousSample || visualsHtml ? `<div class="page-break"></div><h2 style="font-size: 13px; text-decoration: underline;">VISUAL EVIDENCE</h2>${input.homogeneousSample ? `<div class="lot-block"><h4>Homogeneous Sample</h4><div class="photo-grid"><div class="photo-card"><div class="photo-label">Primary Sample</div><img src="${input.homogeneousSample}" /></div></div></div>` : ""}${visualsHtml}` : ""}
      </body>
    </html>
  `;
}

async function performExport(req: NextRequest, params: {
  jobId?: string;
  snapshotId?: string;
  format?: string;
  documentType?: string;
  reportPreferences?: any;
}) {
  const currentUser = await getCurrentUserFromRequest(req);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  authorize(currentUser, "READ_ONLY");

  const { jobId, snapshotId, format = "pdf", documentType: rawDocType } = params;

  if (!jobId && !snapshotId) {
    return NextResponse.json({ error: "Validation Error", details: "jobId or snapshotId is required." }, { status: 400 });
  }

  let job: any;
  let snapshotDate: Date | null = null;

  if (snapshotId) {
    const snapshot = await prisma.reportSnapshot.findUnique({
      where: { id: snapshotId },
      include: { job: { select: { companyId: true } } }
    });
    if (!snapshot) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (snapshot.job.companyId !== currentUser.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    job = snapshot.data;
    // Snapshot data holds the job graph in 'job', 'lots', 'samples', 'rndJobs', etc.
    // The buildReportValidation and other helpers expect the same structure.
    snapshotDate = new Date(snapshot.createdAt);
  } else {
    // Normal live fetch
    const jobData = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      include: {
        lots: { include: { bags: true } },
        samples: { include: { media: true, sealLabel: true, events: true, packets: true }, orderBy: { createdAt: "desc" } },
        rndJobs: { where: { resultPrecedence: "ACTIVE", status: { in: ["APPROVED", "COMPLETED"] } }, orderBy: { reviewedAt: "desc" }, include: { readings: true } },
        experiments: { include: { trials: { include: { measurements: true } } } },
      },
    });
    if (!jobData) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (jobData.companyId !== currentUser.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    job = jobData;
  }

  const baseCompanyName = currentUser.profile?.companyName ?? "Inspection Control Tower";
  const { reportPreferences } = await resolveDocumentBrandingContext(prisma, {
    companyId: currentUser.companyId,
    fallbackCompanyName: baseCompanyName,
    requestReportPreferences: params.reportPreferences,
    documentKind: "report",
  });

  const documentType = sanitizeReportDocumentType(rawDocType ?? reportPreferences.defaultDocumentType);
  const documentTypeLabel = getReportDocumentTypeLabel(documentType);
  const reportTitle = `${documentTypeLabel.toUpperCase()} INSPECTION & ANALYSIS REPORT`;
  const brandName = reportPreferences.branding.companyName || baseCompanyName;
  const filePrefix = `${documentType}_Report_${job.job?.jobReferenceNumber || job.jobReferenceNumber}`;

  const reportValidation = buildReportValidation(job);
  const { metrics: { totalNetWeight, totalBags, averageComposition }, validation } = reportValidation;

  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = brandName;
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = [{ header: "Field", key: "f", width: 30 }, { header: "Value", key: "v", width: 45 }];
    sheet.addRow({ f: "Document Type", v: documentTypeLabel });
    sheet.addRow({ f: "Net Weight", v: `${totalNetWeight.toFixed(2)} kg` });
    sheet.addRow({ f: "Bags", v: totalBags });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=${filePrefix}.xlsx`,
      },
    });
  }

  const generatedOn = (snapshotDate ?? new Date()).toLocaleDateString("en-GB");
  const logoDataUrl = reportPreferences.branding.logoUrl ? await toDataUrl(reportPreferences.branding.logoUrl) : null;

  const trialRows = job.rndJobs?.length > 0 
    ? job.rndJobs.map((r: any) => `${r.rndJobNumber} -> ${r.readings?.slice(0, 5).map((m: any) => `${m.parameter}:${Number(m.value).toFixed(3)}`).join(", ")}`)
    : job.experiments?.flatMap((e: any) => e.trials.map((t: any) => `Trial ${t.trialNumber} -> ${t.measurements?.slice(0, 5).map((m: any) => `${m.element}:${Number(m.value).toFixed(3)}`).join(", ")}`)) || [];

  const html = buildSamplingAssayReportHtml({
    reportTitle,
    documentTypeLabel,
    generatedOnLabel: generatedOn,
    referenceNo: job.job?.jobReferenceNumber || job.jobReferenceNumber,
    certificateNo: `${brandName.toUpperCase().slice(0, 12)}/${job.job?.jobReferenceNumber || job.jobReferenceNumber}`,
    brandName,
    brandAddress: reportPreferences.branding.companyAddress,
    brandContact: reportPreferences.branding.companyContact,
    brandTaxId: reportPreferences.branding.taxId,
    logoDataUrl,
    introText: `We hereby certify that, on request of ${job.job?.clientName || job.clientName}, the consignment was inspected and verified.`,
    rows: [
      { label: "Client Name", value: job.job?.clientName || job.clientName },
      { label: "Commodity", value: job.job?.commodity || job.commodity },
      { label: "Total Quantity", value: `${totalNetWeight.toFixed(2)} KG` },
      { label: "Remarks", value: trialRows.join(" | ") || "N/A" },
    ],
    sampleRows: [],
    lotRegisterRows: job.lots?.map((l: any) => ({
      lotNumber: l.lotNumber,
      bags: String(l.totalBags || l.bagCount || 0),
      netWeight: `${Number(l.netWeightKg || l.netWeight || 0).toFixed(2)} KG`,
      sampleCode: l.sample?.sampleCode || l.sampleCode || "N/A",
      packets: String(l.sample?.packets?.length || 0),
      trials: String(trialRows.length),
      status: l.status || "N/A",
    })) || [],
    analysisRows: averageComposition.map((c: any) => ({ element: c.element, average: c.average.toFixed(4), observations: `${c.count} readings` })),
    operationNotes: [`Total lots: ${job.lots?.length || 0}. Total bags: ${totalBags}.`],
    methodologyNotes: ["Weight determined at lot level."],
    visuals: await Promise.all((job.lots || []).map(async (l: any) => ({
      lotNumber: l.lotNumber,
      cards: await Promise.all([
        l.bagPhotoUrl ? { label: "Bag", dataUrl: await toDataUrl(l.bagPhotoUrl) } : null,
        l.sealPhotoUrl ? { label: "Seal", dataUrl: await toDataUrl(l.sealPhotoUrl) } : null,
      ].filter(Boolean) as any),
    }))),
    homogeneousSample: null,
    authorizedSignatoryName: reportPreferences.branding.authorizedSignatoryName,
    authorizedSignatoryTitle: reportPreferences.branding.authorizedSignatoryTitle,
  });

  const pdfOutput = await renderHtmlToPdf(html);
  return new NextResponse(new Uint8Array(pdfOutput), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filePrefix}.pdf`,
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || undefined;
  const snapshotId = searchParams.get("snapshotId") || undefined;
  const format = searchParams.get("format") || "pdf";
  const documentType = searchParams.get("documentType") || undefined;
  
  return performExport(req, { jobId, snapshotId, format, documentType });
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  return performExport(req, {
    jobId: payload.jobId,
    snapshotId: payload.snapshotId,
    format: payload.format,
    documentType: payload.documentType,
    reportPreferences: payload.reportPreferences,
  });
}
