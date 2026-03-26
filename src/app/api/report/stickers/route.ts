import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import bwipjs from "bwip-js";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { buildStickerHtml, renderHtmlToPdf } from "@/lib/traceability";

export const runtime = "nodejs";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

async function logAuditSafe(jobId: string, userId: string) {
  try {
    await prisma.auditLog.create({
      data: {
        jobId,
        userId,
        entity: "REPORT",
        action: "STICKER_GENERATED",
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return;
    }
    throw error;
  }
}

async function barcodeToDataUrl(sealNumber: string): Promise<string> {
  const buffer = await bwipjs.toBuffer({
    bcid: "code128",
    text: sealNumber,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const body: unknown = await request.json();
    const payload = typeof body === "object" && body !== null ? (body as { jobId?: unknown }) : {};
    const jobId = typeof payload.jobId === "string" && payload.jobId.trim().length > 0 ? payload.jobId.trim() : null;

    if (!jobId) {
      return jsonError("Validation Error", "jobId is required.", 400);
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: {
        companyId: true,
        jobReferenceNumber: true,
      },
    });

    if (!job) {
      return jsonError("Not Found", "Job not found.", 404);
    }

    if (job.companyId !== currentUser.companyId) {
      return jsonError("Forbidden", "Cross-company access is not allowed.", 403);
    }

    const lots = await prisma.inspectionLot.findMany({
      where: { jobId, companyId: currentUser.companyId },
      select: {
        lotNumber: true,
        sealNumber: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (lots.length === 0) {
      return jsonError("Validation Error", "No lots found for sticker generation.", 422);
    }

    const lotsWithBarcode = [];
    for (const lot of lots) {
      if (!lot.sealNumber) {
        return jsonError("Validation Error", `Lot ${lot.lotNumber}: Missing seal number.`, 422);
      }

      if (!/^\d{16}$/.test(lot.sealNumber)) {
        return jsonError("Validation Error", `Lot ${lot.lotNumber}: Seal number must be exactly 16 digits.`, 422);
      }

      lotsWithBarcode.push({
        lotNumber: lot.lotNumber,
        sealNumber: lot.sealNumber,
        barcodeDataUrl: await barcodeToDataUrl(lot.sealNumber),
      });
    }

    const html = buildStickerHtml({
      companyName: currentUser.profile?.companyName ?? "Inspection Control Tower",
      lots: lotsWithBarcode,
    });

    const pdf = await renderHtmlToPdf(html);
    await logAuditSafe(jobId, currentUser.id);

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=Stickers_${job.jobReferenceNumber}.pdf`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to generate stickers.";
    return jsonError("System Error", message, 500);
  }
}
