import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import path from "path";
import { renderHtmlToPdf } from "@/lib/traceability";
import { buildReportValidation } from "@/lib/report-validation";
import {
  getReportDocumentTypeLabel,
  sanitizeReportDocumentType,
  sanitizeReportPreferences,
} from "@/lib/report-preferences";
import {
  getExportPolicyBlockReason,
  getReportExportStagePolicy,
  isExportStageAllowed,
} from "@/lib/report-export-policy";
import { getEvidenceCategoryLabel } from "@/lib/evidence-definition";

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
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-GB");
}

async function toDataUrl(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith("/")) {
      const absolutePath = path.join(process.cwd(), "public", imageUrl.replace(/^\/+/, ""));
      const data = await readFile(absolutePath);
      const mime = guessMimeFromPath(absolutePath);
      if (!mime.startsWith("image/")) {
        return null;
      }
      return `data:${mime};base64,${data.toString("base64")}`;
    }

    if (/^https?:\/\//i.test(imageUrl)) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const contentType = response.headers.get("content-type") ?? "image/png";
      if (!contentType.startsWith("image/")) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
    }
  } catch {
    return null;
  }
  return null;
}

function buildSamplingAssayReportHtml(input: {
  reportTitle: string;
  documentTypeLabel: string;
  generatedOnLabel: string;
  referenceNo: string;
  certificateNo: string;
  brandName: string;
  brandAddress: string;
  brandContact: string;
  brandTaxId: string;
  logoDataUrl: string | null;
  introText: string;
  rows: Array<{ label: string; value: string }>;
  sampleRows: Array<{ label: string; value: string }>;
  lotRegisterRows: Array<{
    lotNumber: string;
    bags: string;
    netWeight: string;
    sampleCode: string;
    packets: string;
    trials: string;
    status: string;
  }>;
  analysisRows: Array<{ element: string; average: string; observations: string }>;
  operationNotes: string[];
  methodologyNotes: string[];
  visuals: Array<{
    lotNumber: string;
    cards: Array<{ label: string; dataUrl: string | null }>;
  }>;
  homogeneousSample: string | null;
  footerNote: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
}) {
  const rowsHtml = input.rows
    .map(
      (row) => `
      <tr>
        <td class="k">${escapeHtml(row.label)}</td>
        <td class="colon">:</td>
        <td class="v">${escapeHtml(row.value)}</td>
      </tr>
    `
    )
    .join("");

  const sampleRowsHtml = input.sampleRows
    .map(
      (row) => `
      <tr>
        <td class="k">${escapeHtml(row.label)}</td>
        <td class="colon">:</td>
        <td class="v">${escapeHtml(row.value)}</td>
      </tr>
    `
    )
    .join("");

  const lotRegisterHtml = input.lotRegisterRows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.lotNumber)}</td>
        <td>${escapeHtml(row.bags)}</td>
        <td>${escapeHtml(row.netWeight)}</td>
        <td>${escapeHtml(row.sampleCode)}</td>
        <td>${escapeHtml(row.packets)}</td>
        <td>${escapeHtml(row.trials)}</td>
        <td>${escapeHtml(row.status)}</td>
      </tr>
    `
    )
    .join("");

  const analysisHtml = input.analysisRows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.element)}</td>
        <td>${escapeHtml(row.average)}</td>
        <td>${escapeHtml(row.observations)}</td>
      </tr>
    `
    )
    .join("");

  const operationHtml = input.operationNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const methodologyHtml = input.methodologyNotes.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  const visualsHtml = input.visuals
    .filter((section) => section.cards.length > 0)
    .map((section) => {
      const cards = section.cards
        .map(
          (card) => `
          <div class="photo-card">
            <div class="photo-label">${escapeHtml(card.label)}</div>
            ${
              card.dataUrl
                ? `<img src="${card.dataUrl}" alt="${escapeHtml(card.label)}" />`
                : `<div class="missing">Image unavailable</div>`
            }
          </div>
        `
        )
        .join("");
      return `
        <div class="lot-block">
          <h4>Lot ${escapeHtml(section.lotNumber)}</h4>
          <div class="photo-grid">${cards}</div>
        </div>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 14mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.35; }
          .top { display: grid; grid-template-columns: 1fr 120px; align-items: start; gap: 12px; border-bottom: 1px solid #bdbdbd; padding-bottom: 8px; }
          .brand h1 { margin: 0; font-size: 44px; line-height: 1; font-weight: 700; color: #222; letter-spacing: 0.5px; }
          .meta { margin-top: 6px; font-size: 11px; color: #333; white-space: pre-line; }
          .logo { width: 120px; height: 58px; border: 1px solid #d6d6d6; border-radius: 4px; object-fit: contain; }
          .title-row { margin-top: 12px; display: flex; justify-content: space-between; align-items: baseline; }
          .title { text-align: center; flex: 1; font-size: 16px; font-weight: 700; text-decoration: underline; letter-spacing: 0.2px; }
          .date { width: 190px; text-align: right; font-size: 12px; font-weight: 700; }
          .refs { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; }
          .ref-item { border: 1px solid #9f9f9f; padding: 5px 8px; }
          .lead { margin-top: 12px; text-align: justify; }
          .tbl { margin-top: 10px; width: 100%; border-collapse: collapse; font-size: 12px; }
          .tbl td { border: 1px solid #8d8d8d; padding: 6px 8px; vertical-align: top; }
          .tbl .k { width: 34%; font-weight: 600; }
          .tbl .colon { width: 2%; text-align: center; font-weight: 700; }
          .tbl .v { width: 64%; }
          .matrix { margin-top: 8px; width: 100%; border-collapse: collapse; font-size: 11px; }
          .matrix th, .matrix td { border: 1px solid #8d8d8d; padding: 6px 7px; text-align: left; vertical-align: top; }
          .matrix th { background: #f4f4f4; font-weight: 700; }
          .section { margin-top: 16px; }
          .section h3 { margin: 0 0 6px; font-size: 13px; font-weight: 700; text-decoration: underline; }
          .section p { margin: 0 0 6px; }
          ul { margin: 4px 0 0 18px; padding: 0; }
          li { margin: 2px 0; }
          .page-break { page-break-before: always; }
          .sampling-title { margin: 0 0 8px; font-size: 14px; font-weight: 700; text-decoration: underline; }
          .lot-block { margin-top: 10px; }
          .lot-block h4 { margin: 0 0 5px; font-size: 12px; }
          .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .photo-card { border: 1px solid #8d8d8d; border-radius: 4px; padding: 6px; min-height: 170px; }
          .photo-label { font-size: 11px; font-weight: 700; margin-bottom: 5px; }
          .photo-card img { width: 100%; height: 140px; object-fit: contain; border: 1px solid #ddd; }
          .missing { height: 140px; display: flex; align-items: center; justify-content: center; border: 1px dashed #c8c8c8; color: #777; font-size: 11px; }
          .footer { margin-top: 16px; font-size: 11px; color: #444; font-style: italic; }
          .sign-block { margin-top: 14px; width: 100%; border-collapse: collapse; font-size: 11px; }
          .sign-block td { border: 1px solid #8d8d8d; padding: 8px; width: 50%; vertical-align: top; }
          .sig-line { margin-top: 36px; border-top: 1px solid #777; padding-top: 3px; font-weight: 700; }
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

        <table class="tbl">
          <tbody>${rowsHtml}</tbody>
        </table>

        ${
          sampleRowsHtml
            ? `
          <div class="section">
            <h3>SAMPLING & PACKET CONTROL</h3>
            <table class="tbl">
              <tbody>${sampleRowsHtml}</tbody>
            </table>
          </div>
        `
            : ""
        }

        ${
          lotRegisterHtml
            ? `
          <div class="section">
            <h3>LOT-WISE REGISTER</h3>
            <table class="matrix">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Bags</th>
                  <th>Net Weight</th>
                  <th>Sample Code</th>
                  <th>Packets</th>
                  <th>Trials</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${lotRegisterHtml}</tbody>
            </table>
          </div>
        `
            : ""
        }

        ${
          analysisHtml
            ? `
          <div class="section">
            <h3>ASSAY SUMMARY</h3>
            <table class="matrix">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Average</th>
                  <th>Observations</th>
                </tr>
              </thead>
              <tbody>${analysisHtml}</tbody>
            </table>
          </div>
        `
            : ""
        }

        <div class="section">
          <h3>SUPERVISION OF WEIGHMENT:</h3>
          <p>Our surveyors attended the specified location to inspect and supervise the consignment weighment. Details below:</p>
          <ul>${operationHtml}</ul>
        </div>

        <div class="section">
          <h3>WEIGHT CALCULATION METHODOLOGY</h3>
          <ul>${methodologyHtml}</ul>
        </div>

        <div class="section">
          <h3>DECLARATION</h3>
          <p>
            This report is issued as a formal communication for ${escapeHtml(
              input.documentTypeLabel
            )} documentation and internal/external compliance use. Findings are based on records and visual evidence available at the time of inspection and sampling.
          </p>
        </div>

        <table class="sign-block">
          <tr>
            <td>
              <strong>Prepared By</strong>
              <div class="sig-line">Inspection Team</div>
            </td>
            <td>
              <strong>Authorized Signatory</strong><br/>
              For and on behalf of ${escapeHtml(input.brandName)}
              <div class="sig-line">${escapeHtml(input.authorizedSignatoryName || "Authorized Signatory")}</div>
              ${
                input.authorizedSignatoryTitle
                  ? `<div style="margin-top:2px;">${escapeHtml(input.authorizedSignatoryTitle)}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>

        ${input.footerNote ? `<div class="footer">${escapeHtml(input.footerNote)}</div>` : ""}

        ${
          input.homogeneousSample || visualsHtml
            ? `
          <div class="page-break"></div>
          <h2 class="sampling-title">SAMPLING REPORT - VISUAL EVIDENCE (${escapeHtml(input.documentTypeLabel)})</h2>
          ${
            input.homogeneousSample
              ? `
            <div class="lot-block">
              <h4>Homogeneous Sample</h4>
              <div class="photo-grid">
                <div class="photo-card">
                  <div class="photo-label">Primary Homogeneous Sample</div>
                  <img src="${input.homogeneousSample}" alt="Homogeneous Sample"/>
                </div>
              </div>
            </div>
          `
              : ""
          }
          ${visualsHtml}
        `
            : ""
        }
      </body>
    </html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const payload: unknown = await req.json();
    const body = typeof payload === "object" && payload !== null
      ? (payload as {
          jobId?: unknown;
          format?: unknown;
          documentType?: unknown;
          reportPreferences?: unknown;
        })
      : {};
    const jobId = typeof body.jobId === "string" && body.jobId.trim().length > 0 ? body.jobId.trim() : "";
    const format = typeof body.format === "string" ? body.format.trim() : "";

    if (!jobId || !format) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and format ('pdf' or 'excel') are required." },
        { status: 400 }
      );
    }

    const jobScope = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!jobScope) {
      return NextResponse.json({ error: "Not Found", details: "Job not found." }, { status: 404 });
    }

    if (jobScope.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      include: {
        lots: {
          include: {
            bags: true,
            sample: {
              include: {
                media: true,
                sealLabel: true,
                events: true,
                packets: true,
              },
            },
          },
        },
        experiments: {
          include: {
            trials: {
              include: {
                measurements: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Not Found", details: "Job not found." }, { status: 404 });
    }

    const baseCompanyName = currentUser.profile?.companyName ?? "Inspection Control Tower";
    const reportPreferences = sanitizeReportPreferences(body.reportPreferences, baseCompanyName);
    const documentType = sanitizeReportDocumentType(body.documentType ?? reportPreferences.defaultDocumentType);
    const documentTypeLabel = getReportDocumentTypeLabel(documentType);
    const reportTitle = `${documentTypeLabel.toUpperCase()} INSPECTION & ANALYSIS REPORT`;
    const brandName = reportPreferences.branding.companyName || baseCompanyName;
    const brandingMeta = [
      reportPreferences.branding.companyAddress,
      reportPreferences.branding.companyContact,
      reportPreferences.branding.taxId ? `Tax ID: ${reportPreferences.branding.taxId}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    const filePrefix = `${documentType}_Report_${job.jobReferenceNumber}`;

    const reportValidation = buildReportValidation(job);
    const {
      metrics: { totalNetWeight, totalBags, averageComposition },
      validation,
    } = reportValidation;

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validation Error",
          details: validation.errors.join(" "),
          code: "REPORT_VALIDATION_FAILED",
          validation,
        },
        { status: 422 },
      );
    }

    const exportPolicy = getReportExportStagePolicy();
    if (!isExportStageAllowed(exportPolicy, job.status)) {
      const blocked = getExportPolicyBlockReason(exportPolicy);
      return NextResponse.json(
        {
          error: "Export Policy Blocked",
          details: blocked.details,
          code: blocked.code,
          policy: exportPolicy,
          jobStatus: job.status,
        },
        { status: 422 },
      );
    }

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = brandName;
      workbook.created = new Date();

      const controlSheet = workbook.addWorksheet("Document Control");
      controlSheet.columns = [
        { header: "Field", key: "field", width: 30 },
        { header: "Value", key: "value", width: 45 },
      ];
      controlSheet.addRow({ field: "Document Type", value: documentTypeLabel });
      controlSheet.addRow({ field: "Report Title", value: reportTitle });
      controlSheet.addRow({ field: "Company", value: brandName });
      if (brandingMeta) {
        controlSheet.addRow({ field: "Branding", value: brandingMeta });
      }
      if (reportPreferences.branding.footerNote) {
        controlSheet.addRow({ field: "Footer Note", value: reportPreferences.branding.footerNote });
      }
      
      // 1. ANALYSIS SUMMARY SHEET
      const analysisSheet = workbook.addWorksheet("Analysis Summary");
      analysisSheet.columns = [
        { header: "Metric", key: "metric", width: 25 },
        { header: "Value", key: "value", width: 30 },
      ];
      analysisSheet.addRow({ metric: "Client Name", value: job.clientName });
      analysisSheet.addRow({ metric: "Reference #", value: job.jobReferenceNumber });
      analysisSheet.addRow({ metric: "Total Bags", value: totalBags });
      analysisSheet.addRow({ metric: "Total Net Weight", value: `${totalNetWeight.toFixed(2)} kg` });
      analysisSheet.addRow({}); // spacer
      analysisSheet.addRow({ metric: "AVERAGE COMPOSITION" });
      averageComposition.forEach(comp => {
        analysisSheet.addRow({ metric: comp.element, value: comp.average.toFixed(4) });
      });

      // 2. LOT REGISTRY SHEET
      const lotSheet = workbook.addWorksheet("Lot Registry");
      lotSheet.columns = [
        { header: "Lot #", key: "lotNumber", width: 15 },
        { header: "Bags", key: "bags", width: 10 },
        { header: "Gross Weight (kg)", key: "gross", width: 20 },
        { header: "Net Weight (kg)", key: "net", width: 20 },
      ];
      job.lots.forEach(lot => {
        const netSum = lot.bags.reduce((acc, b) => acc + (b.netWeight || 0), 0);
        lotSheet.addRow({
          lotNumber: lot.lotNumber,
          bags: lot.bags.length,
          gross: Number(lot.grossWeightKg) || 0,
          net: netSum,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=${filePrefix}.xlsx`,
        },
      });
    }

    if (format === "pdf") {
      const generatedOn = new Date().toLocaleDateString("en-GB");
      const logoDataUrl = reportPreferences.branding.logoUrl
        ? await toDataUrl(reportPreferences.branding.logoUrl)
        : null;

      const trialRows = job.experiments.flatMap((experiment) =>
        experiment.trials.map((trial) => {
          const lot = job.lots.find((entry) => entry.id === trial.lotId);
          const keyValues = trial.measurements
            .slice(0, 5)
            .map((measurement) => `${measurement.element}:${Number(measurement.value).toFixed(3)}`)
            .join(", ");
          return `Trial ${trial.trialNumber} (${lot?.lotNumber ?? "N/A"}) -> ${keyValues || "No measurements"}`;
        })
      );

      const allTrials = job.experiments.flatMap((experiment) => experiment.trials);
      const sampleRecords = job.lots
        .map((lot) => ({ lot, sample: lot.sample }))
        .filter(
          (
            entry,
          ): entry is typeof entry & {
            sample: NonNullable<typeof entry.sample>;
          } => Boolean(entry.sample)
        );
      const managedPacketCount = sampleRecords.reduce((sum, entry) => sum + (entry.sample.packets?.length ?? 0), 0);
      const sampleCodes = sampleRecords.map((entry) => entry.sample.sampleCode).filter(Boolean);
      const samplingMethods = Array.from(
        new Set(sampleRecords.map((entry) => entry.sample.samplingMethod?.trim()).filter(Boolean))
      );
      const sampleDates = sampleRecords
        .map((entry) => entry.sample.samplingDate)
        .filter((value) => value != null);

      const operationNotes = [
        `Total lots reviewed: ${job.lots.length}. Total recorded bags: ${totalBags}.`,
        `All lots were verified against sealed identity and weight records for ${documentTypeLabel.toLowerCase()} dispatch.`,
        sampleRecords.length > 0
          ? `Managed samples finalized: ${sampleRecords.length}. Packetized units recorded: ${managedPacketCount}.`
          : "Managed sample records are pending completion.",
        trialRows.length > 0 ? `Sampling instances recorded: ${trialRows.length}.` : "Sampling instances are pending entry.",
      ];

      const methodologyNotes = [
        "Net weight is determined by subtracting tare weight from gross weight at lot level.",
        "Lot-wise totals are consolidated with bag-level logs and sampling evidence.",
        averageComposition.length > 0
          ? `Average composition computed for ${averageComposition.length} element(s).`
          : "No analytical composition entries available for this job.",
      ];

      const rows = [
        { label: "Job Reference No.", value: job.jobReferenceNumber },
        { label: "Inspection Serial No.", value: job.inspectionSerialNumber },
        { label: "Certificate No.", value: `${brandName.toUpperCase().slice(0, 12)}/${job.jobReferenceNumber}` },
        { label: "Document Type", value: documentTypeLabel },
        { label: "Client Name", value: job.clientName },
        { label: "Place Of Work", value: job.plantLocation || "N/A" },
        { label: "Location Details", value: job.plantLocation || "N/A" },
        { label: "Commodity", value: job.commodity },
        { label: "Job Status", value: job.status },
        { label: "Total Lots", value: String(job.lots.length) },
        { label: "Total Quantity as per Weighment at plant", value: `${totalNetWeight.toFixed(2)} KG` },
        { label: "Material Stowed in", value: `${totalBags} bag(s) / lot-wise sealed consignments` },
        { label: "General appearance of the cargo", value: "Material condition appears as per sampling visuals and inspection notes." },
        { label: "Remarks", value: trialRows.length > 0 ? trialRows.join(" | ") : "No additional remarks." },
      ];

      const sampleRows = [
        { label: "Managed Sample Records", value: String(sampleRecords.length) },
        { label: "Sample Codes", value: sampleCodes.length > 0 ? sampleCodes.join(", ") : "N/A" },
        { label: "Sampling Method", value: samplingMethods.length > 0 ? samplingMethods.join(", ") : "N/A" },
        {
          label: "Sampling Date",
          value:
            sampleDates.length > 0
              ? sampleDates.map((value) => formatDateValue(value)).join(", ")
              : "N/A",
        },
        { label: "Ready Packets", value: String(managedPacketCount) },
        { label: "Trials Recorded", value: String(allTrials.length) },
      ];

      const lotRegisterRows = job.lots.map((lot) => {
        const sample = lot.sample;
        const lotTrials = allTrials.filter((trial) => trial.lotId === lot.id);
        const lotNetWeight =
          typeof lot.netWeightKg === "number"
            ? lot.netWeightKg
            : typeof lot.netWeight === "number"
              ? lot.netWeight
              : lot.bags.reduce((sum, bag) => sum + (bag.netWeight || 0), 0);
        const lotStatus = sample?.sampleStatus
          ? sample.sampleStatus.replace(/_/g, " ")
          : "PENDING";

        return {
          lotNumber: lot.lotNumber,
          bags: String(lot.totalBags || lot.bags.length || 0),
          netWeight: `${Number(lotNetWeight || 0).toFixed(2)} KG`,
          sampleCode: sample?.sampleCode ?? "N/A",
          packets: String(sample?.packets?.length ?? 0),
          trials: String(lotTrials.length),
          status: lotStatus,
        };
      });

      const analysisRows =
        averageComposition.length > 0
          ? averageComposition.map((composition) => ({
              element: composition.element,
              average: composition.average.toFixed(4),
              observations: `${composition.count} reading(s)`,
            }))
          : [{ element: "N/A", average: "N/A", observations: "No analytical measurements recorded." }];

      const managedHomogeneousMedia = job.lots
        .flatMap((lot) => lot.sample?.media ?? [])
        .find((media) => media.mediaType === "HOMOGENIZED_SAMPLE" && media.fileUrl);
      const homogeneousSample = managedHomogeneousMedia?.fileUrl
        ? await toDataUrl(managedHomogeneousMedia.fileUrl)
        : null;

      const visuals = await Promise.all(
        job.lots.map(async (lot) => {
          const cards = await Promise.all(
            [
              lot.bagPhotoUrl ? { label: getEvidenceCategoryLabel("BAG"), url: lot.bagPhotoUrl } : null,
              lot.samplingPhotoUrl ? { label: getEvidenceCategoryLabel("SAMPLING_IN_PROGRESS"), url: lot.samplingPhotoUrl } : null,
              lot.sealPhotoUrl ? { label: getEvidenceCategoryLabel("SEAL"), url: lot.sealPhotoUrl } : null,
            ]
              .filter((item): item is { label: string; url: string } => Boolean(item))
              .map(async (item) => ({ label: item.label, dataUrl: await toDataUrl(item.url) }))
          );
          return { lotNumber: lot.lotNumber, cards };
        })
      );

      const html = buildSamplingAssayReportHtml({
        reportTitle,
        documentTypeLabel,
        generatedOnLabel: generatedOn,
        referenceNo: job.jobReferenceNumber,
        certificateNo: `${brandName.toUpperCase().slice(0, 12)}/${job.jobReferenceNumber}`,
        brandName,
        brandAddress: reportPreferences.branding.companyAddress,
        brandContact: reportPreferences.branding.companyContact,
        brandTaxId: reportPreferences.branding.taxId,
        logoDataUrl,
        introText: `We hereby certify that, on request of ${job.clientName}, the consignment was inspected for weighment supervision, sampling, and assay verification. The findings for ${documentTypeLabel.toLowerCase()} workflow are detailed below.`,
        rows,
        sampleRows,
        lotRegisterRows,
        analysisRows,
        operationNotes,
        methodologyNotes,
        visuals,
        homogeneousSample,
        footerNote: reportPreferences.branding.footerNote,
        authorizedSignatoryName: reportPreferences.branding.authorizedSignatoryName,
        authorizedSignatoryTitle: reportPreferences.branding.authorizedSignatoryTitle,
      });

      const pdfOutput = await renderHtmlToPdf(html);
      const pdfBytes = new Uint8Array(pdfOutput);
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${filePrefix}.pdf`,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid Format", details: "Supported formats: pdf, excel", code: "REPORT_EXPORT_FORMAT_INVALID" },
      { status: 400 },
    );

  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message, code: "REPORT_EXPORT_FORBIDDEN" }, { status: 403 });
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json(
      { error: "System Error", details: error.message, code: "REPORT_EXPORT_FAILED" },
      { status: 500 }
    );
  }
}
