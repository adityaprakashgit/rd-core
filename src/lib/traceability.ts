import { randomInt } from "crypto";

import { prisma } from "@/lib/prisma";
import { getReportDocumentTypeLabel, type ReportBranding, type ReportDocumentType } from "@/lib/report-preferences";

export const SEAL_LENGTH = 16;
const WEIGHT_TOLERANCE = 0.01;

export type TraceabilityLotSelect = {
  id: string;
  jobId: string;
  lotNumber: string;
  sealNumber: string | null;
  sealAuto: boolean;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  bagPhotoUrl: string | null;
  samplingPhotoUrl: string | null;
  sealPhotoUrl: string | null;
};

export function isValidSealNumber(value: string): boolean {
  return /^\d{16}$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateSealCandidate(): string {
  let seal = "";
  for (let index = 0; index < SEAL_LENGTH; index += 1) {
    seal += randomInt(0, 10).toString();
  }
  return seal;
}

export async function generateUniqueSealNumber(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sealNumber = generateSealCandidate();
    if (!isValidSealNumber(sealNumber)) {
      continue;
    }

    const existing = await prisma.inspectionLot.findFirst({
      where: { sealNumber },
      select: { id: true },
    });

    if (!existing) {
      return sealNumber;
    }
  }

  throw new Error("Unable to generate a unique seal number.");
}

export function formatTraceabilityError(details: string) {
  return { error: "Validation Error", details };
}

export function hasRequiredTraceabilityPhotos(lot: Pick<TraceabilityLotSelect, "bagPhotoUrl" | "samplingPhotoUrl" | "sealPhotoUrl">): boolean {
  return Boolean(lot.bagPhotoUrl && lot.samplingPhotoUrl && lot.sealPhotoUrl);
}

export function assertWeightsAreBalanced(lot: Pick<TraceabilityLotSelect, "grossWeight" | "tareWeight" | "netWeight" | "lotNumber">): void {
  if (lot.grossWeight === null || lot.tareWeight === null || lot.netWeight === null) {
    throw new Error(`Lot ${lot.lotNumber}: Missing weights.`);
  }

  const expectedGross = Number(lot.netWeight) + Number(lot.tareWeight);
  const delta = Math.abs(Number(lot.grossWeight) - expectedGross);

  if (delta > WEIGHT_TOLERANCE) {
    throw new Error(`Lot ${lot.lotNumber}: Gross weight must equal net weight plus tare weight.`);
  }
}

export function assertSealIsValid(lot: Pick<TraceabilityLotSelect, "lotNumber" | "sealNumber">): void {
  if (!lot.sealNumber) {
    throw new Error(`Lot ${lot.lotNumber}: Missing seal number.`);
  }

  if (!isValidSealNumber(lot.sealNumber)) {
    throw new Error(`Lot ${lot.lotNumber}: Seal number must be exactly 16 digits.`);
  }
}

export function buildPackingListHtml(input: {
  documentType?: ReportDocumentType;
  branding?: ReportBranding;
  companyName: string;
  clientName: string;
  invoiceNumber: string;
  dateLabel: string;
  itemName?: string;
  commodity?: string;
  dispatchFrom?: string;
  billFrom?: string;
  billTo?: string;
  shipTo?: string;
  buyersOrder?: string;
  otherReference?: string;
  vehicleNo?: string;
  transporterName?: string;
  termsOfDelivery?: string;
  lots: Array<{
    lotNumber: string;
    sealNumber: string;
    grossWeight: number;
    tareWeight: number;
    netWeight: number;
  }>;
}) {
  const totalBags = input.lots.length;
  const totalGross = input.lots.reduce((sum, lot) => sum + lot.grossWeight, 0);
  const totalNet = input.lots.reduce((sum, lot) => sum + lot.netWeight, 0);
  const totalTare = input.lots.reduce((sum, lot) => sum + lot.tareWeight, 0);
  const goodsLabelSource = input.itemName ?? input.commodity;
  const goodsDescription = goodsLabelSource
    ? `${goodsLabelSource.toUpperCase()} / JUMBO BAG`
    : "NICKEL INTERMEDIATE PRODUCT / JUMBO BAG";

  const rows = input.lots
    .map(
      (lot, index) => `
        <tr>
          <td class="center">${escapeHtml(lot.lotNumber || `H-${index + 1}`)}</td>
          <td class="center">${escapeHtml(lot.sealNumber)}</td>
          <td>${escapeHtml(goodsDescription)}</td>
          <td class="right">${lot.grossWeight.toFixed(2)}</td>
          <td class="right">${lot.tareWeight.toFixed(2)}</td>
          <td class="right">${lot.netWeight.toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  const dispatchFrom = input.dispatchFrom ?? input.companyName;
  const billFrom = input.billFrom ?? input.companyName;
  const billTo = input.billTo ?? input.clientName;
  const shipTo = input.shipTo ?? input.clientName;
  const buyersOrder = input.buyersOrder ?? "-";
  const otherReference = input.otherReference ?? "-";
  const vehicleNo = input.vehicleNo ?? "-";
  const transporterName = input.transporterName ?? "-";
  const termsOfDelivery = input.termsOfDelivery ?? "-";
  const documentType = input.documentType ?? "EXPORT";
  const documentTypeLabel = getReportDocumentTypeLabel(documentType);
  const branding = input.branding;
  const brandName = branding?.companyName || input.companyName;
  const brandAddress = branding?.companyAddress || "";
  const brandContact = branding?.companyContact || "";
  const brandTaxId = branding?.taxId || "";
  const brandLogoUrl = branding?.logoUrl || "";
  const footerNote = branding?.footerNote || "";
  const companyMetaLine = [brandAddress, brandContact, brandTaxId ? `Tax ID: ${brandTaxId}` : ""]
    .filter(Boolean)
    .join(" | ");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 8mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            margin: 0;
            font-size: 9.5px;
            line-height: 1.3;
          }
          .page {
            border: 1px solid #111827;
            padding: 5px;
          }
          .title {
            text-align: center;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.02em;
            margin: 2px 0 6px;
          }
          .brand-header {
            border: 1px solid #111827;
            margin-bottom: 5px;
          }
          .brand-header td {
            border: 1px solid #111827;
            padding: 5px;
            vertical-align: top;
          }
          .brand-logo {
            width: 68px;
            height: 68px;
            object-fit: contain;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            display: block;
          }
          .brand-name {
            font-weight: 800;
            font-size: 14px;
            letter-spacing: 0.01em;
          }
          .brand-meta {
            font-size: 8.5px;
            margin-top: 3px;
            color: #374151;
            white-space: pre-wrap;
          }
          .doc-chip {
            display: inline-block;
            border: 1px solid #111827;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 8.5px;
            font-weight: 700;
            margin-top: 3px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .info td {
            border: 1px solid #111827;
            padding: 4px 5px;
            vertical-align: top;
          }
          .info .label {
            width: 30%;
            font-weight: 700;
            font-size: 8.5px;
            text-transform: uppercase;
          }
          .lots {
            margin-top: 5px;
          }
          .lots th,
          .lots td {
            border: 1px solid #111827;
            padding: 4px 5px;
          }
          .lots th {
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8.5px;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .totals {
            margin-top: 6px;
            font-weight: 700;
            font-size: 10px;
          }
          .totals div {
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <table class="brand-header">
            <tr>
              <td style="width:18%; text-align:center;">
                ${brandLogoUrl ? `<img class="brand-logo" src="${escapeHtml(brandLogoUrl)}" alt="Company logo" />` : ""}
              </td>
              <td style="width:56%;">
                <div class="brand-name">${escapeHtml(brandName)}</div>
                ${companyMetaLine ? `<div class="brand-meta">${escapeHtml(companyMetaLine)}</div>` : ""}
              </td>
              <td style="width:26%;">
                <div><strong>Document</strong>: ${escapeHtml(documentTypeLabel)} Packing List</div>
                <div><strong>Invoice No</strong>: ${escapeHtml(input.invoiceNumber)}</div>
                <div><strong>Date</strong>: ${escapeHtml(input.dateLabel)}</div>
                <div class="doc-chip">${escapeHtml(documentType)}</div>
              </td>
            </tr>
          </table>
          <div class="title">PACKING LIST</div>
          <table class="info">
            <tr>
              <td style="width:50%; padding:0;">
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td class="label">Dispatch From</td>
                    <td>${escapeHtml(dispatchFrom)}</td>
                  </tr>
                  <tr>
                    <td class="label">Bill From</td>
                    <td>${escapeHtml(billFrom)}</td>
                  </tr>
                  <tr>
                    <td class="label">Bill To</td>
                    <td>${escapeHtml(billTo)}</td>
                  </tr>
                  <tr>
                    <td class="label">Ship To</td>
                    <td>${escapeHtml(shipTo)}</td>
                  </tr>
                </table>
              </td>
              <td style="width:50%; padding:0;">
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td class="label">Invoice No</td>
                    <td>${escapeHtml(input.invoiceNumber)}</td>
                  </tr>
                  <tr>
                    <td class="label">Date</td>
                    <td>${escapeHtml(input.dateLabel)}</td>
                  </tr>
                  <tr>
                    <td class="label">Buyers Order No. &amp; Date</td>
                    <td>${escapeHtml(buyersOrder)}</td>
                  </tr>
                  <tr>
                    <td class="label">Other Reference(s)</td>
                    <td>${escapeHtml(otherReference)}</td>
                  </tr>
                  <tr>
                    <td class="label">Vehicle No</td>
                    <td>${escapeHtml(vehicleNo)}</td>
                  </tr>
                  <tr>
                    <td class="label">Transporter Name</td>
                    <td>${escapeHtml(transporterName)}</td>
                  </tr>
                  <tr>
                    <td class="label">Terms of Delivery</td>
                    <td>${escapeHtml(termsOfDelivery)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table class="lots">
            <thead>
              <tr>
                <th class="center" style="width: 9%;">Bag No.</th>
                <th class="center" style="width: 16%;">Marking / Seal No.</th>
                <th style="width: 38%;">Description of Goods / Kind of Pkgs</th>
                <th class="right" style="width: 12%;">Per Bag Gross WT</th>
                <th class="right" style="width: 12%;">Per Bag Tare WT</th>
                <th class="right" style="width: 13%;">Per Bag Net WT</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="totals">
            <div>TOTAL NO. OF BAGS : ${totalBags} JUMBO BAGS</div>
            <div>TOTAL GROSS WEIGHT (IN MT) : ${(totalGross / 1000).toFixed(3)} MT</div>
            <div>TOTAL NET WEIGHT (IN MT) : ${(totalNet / 1000).toFixed(4)} MT</div>
            <div style="font-weight:500;">(Tare total: ${(totalTare / 1000).toFixed(4)} MT)</div>
            ${footerNote ? `<div style="font-weight:500; margin-top:5px;">${escapeHtml(footerNote)}</div>` : ""}
          </div>
        </div>
      </body>
    </html>
  `;
}

export function buildStickerHtml(input: {
  companyName: string;
  lots: Array<{
    lotNumber: string;
    sealNumber: string;
    barcodeDataUrl: string;
  }>;
}) {
  const stickers = input.lots
    .map(
      (lot) => `
        <div class="sticker">
          <div class="title">LOT: ${escapeHtml(lot.lotNumber)}</div>
          <div class="seal">SEAL: ${escapeHtml(lot.sealNumber)}</div>
          <img class="barcode" src="${lot.barcodeDataUrl}" alt="Barcode ${escapeHtml(lot.sealNumber)}" />
        </div>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            color: #111827;
          }
          .sheet {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8mm;
          }
          .sticker {
            border: 1px solid #111827;
            border-radius: 8px;
            padding: 6mm 4mm;
            text-align: center;
            break-inside: avoid;
            min-height: 52mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4mm;
          }
          .title {
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 0.04em;
          }
          .seal {
            font-size: 11px;
            font-weight: 700;
          }
          .barcode {
            width: 100%;
            height: auto;
            max-height: 18mm;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div style="font-size: 12px; font-weight: 700; margin-bottom: 6mm;">${escapeHtml(input.companyName)}</div>
        <div class="sheet">
          ${stickers}
        </div>
      </body>
    </html>
  `;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
