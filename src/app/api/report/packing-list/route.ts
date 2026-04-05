import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { buildPackingListHtml, renderHtmlToPdf } from "@/lib/traceability";
import { sanitizeReportDocumentType, sanitizeReportPreferences } from "@/lib/report-preferences";

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
        action: "PACKING_LIST_GENERATED",
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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "READ_ONLY");

    const body: unknown = await request.json();
    const payload = typeof body === "object" && body !== null
      ? (body as {
          jobId?: unknown;
          dispatchFrom?: unknown;
          billFrom?: unknown;
          billTo?: unknown;
          shipTo?: unknown;
          buyersOrder?: unknown;
          otherReference?: unknown;
          vehicleNo?: unknown;
          transporterName?: unknown;
          termsOfDelivery?: unknown;
          itemName?: unknown;
          documentType?: unknown;
          reportPreferences?: unknown;
        })
      : {};
    const jobId = typeof payload.jobId === "string" && payload.jobId.trim().length > 0 ? payload.jobId.trim() : null;

    if (!jobId) {
      return jsonError("Validation Error", "jobId is required.", 400);
    }

    const vehicleNoInput = typeof payload.vehicleNo === "string" ? payload.vehicleNo.trim() : "";
    if (!vehicleNoInput) {
      return jsonError("Validation Error", "vehicleNo is required for every packing list.", 400);
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: {
        companyId: true,
        clientName: true,
        commodity: true,
        plantLocation: true,
        jobReferenceNumber: true,
        createdAt: true,
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
        grossWeight: true,
        tareWeight: true,
        netWeight: true,
        bagPhotoUrl: true,
        samplingPhotoUrl: true,
        sealPhotoUrl: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (lots.length === 0) {
      return jsonError("Validation Error", "No lots found for packing list generation.", 422);
    }

    const normalizedLots = [];
    for (const lot of lots) {
      if (!lot.sealNumber) {
        return jsonError("Validation Error", `Lot ${lot.lotNumber}: Missing seal number.`, 422);
      }

      if (!/^\d{16}$/.test(lot.sealNumber)) {
        return jsonError("Validation Error", `Lot ${lot.lotNumber}: Seal number must be exactly 16 digits.`, 422);
      }

      if (lot.grossWeight === null || lot.tareWeight === null || lot.netWeight === null) {
        return jsonError("Validation Error", `Lot ${lot.lotNumber}: Missing weights.`, 422);
      }

      const grossWeight = Number(lot.grossWeight);
      const tareWeight = Number(lot.tareWeight);
      const netWeight = Number(lot.netWeight);
      if (Math.abs(grossWeight - (netWeight + tareWeight)) > 0.01) {
        return jsonError("Validation Error", `Lot ${lot.lotNumber}: Gross weight must equal net weight plus tare weight.`, 422);
      }

      if (!lot.bagPhotoUrl || !lot.samplingPhotoUrl || !lot.sealPhotoUrl) {
        return jsonError(
          "Validation Error",
          `Lot ${lot.lotNumber}: Bag photo, sampling photo, and seal photo are required before dispatch.`,
          422
        );
      }

      normalizedLots.push({
        lotNumber: lot.lotNumber,
        sealNumber: lot.sealNumber,
        grossWeight,
        tareWeight,
        netWeight,
      });
    }

    const baseCompanyName = currentUser.profile?.companyName ?? "Inspection Control Tower";
    const reportPreferences = sanitizeReportPreferences(payload.reportPreferences, baseCompanyName);
    const documentType = sanitizeReportDocumentType(payload.documentType ?? reportPreferences.defaultDocumentType);

    const html = buildPackingListHtml({
      companyName: baseCompanyName,
      documentType,
      branding: reportPreferences.branding,
      clientName: job.clientName,
      commodity: job.commodity,
      itemName: typeof payload.itemName === "string" && payload.itemName.trim().length > 0
        ? payload.itemName.trim()
        : undefined,
      invoiceNumber: job.jobReferenceNumber,
      dateLabel: job.createdAt.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      }),
      dispatchFrom: typeof payload.dispatchFrom === "string" && payload.dispatchFrom.trim().length > 0
        ? payload.dispatchFrom.trim()
        : currentUser.profile?.companyName ?? "Inspection Control Tower",
      billFrom: typeof payload.billFrom === "string" && payload.billFrom.trim().length > 0
        ? payload.billFrom.trim()
        : currentUser.profile?.companyName ?? "Inspection Control Tower",
      billTo: typeof payload.billTo === "string" && payload.billTo.trim().length > 0
        ? payload.billTo.trim()
        : job.clientName,
      shipTo: typeof payload.shipTo === "string" && payload.shipTo.trim().length > 0
        ? payload.shipTo.trim()
        : job.plantLocation ?? job.clientName,
      buyersOrder: typeof payload.buyersOrder === "string" && payload.buyersOrder.trim().length > 0
        ? payload.buyersOrder.trim()
        : undefined,
      otherReference: typeof payload.otherReference === "string" && payload.otherReference.trim().length > 0
        ? payload.otherReference.trim()
        : undefined,
      vehicleNo: vehicleNoInput,
      transporterName: typeof payload.transporterName === "string" && payload.transporterName.trim().length > 0
        ? payload.transporterName.trim()
        : undefined,
      termsOfDelivery: typeof payload.termsOfDelivery === "string" && payload.termsOfDelivery.trim().length > 0
        ? payload.termsOfDelivery.trim()
        : "As per dispatch workflow",
      lots: normalizedLots,
    });

    const pdf = await renderHtmlToPdf(html);
    await logAuditSafe(jobId, currentUser.id);

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${documentType}_Packing_List_${job.jobReferenceNumber}.pdf`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Failed to generate packing list.";
    return jsonError("System Error", message, 500);
  }
}
