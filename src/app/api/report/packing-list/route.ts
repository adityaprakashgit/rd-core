import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { buildPackingListHtml, renderHtmlToPdf } from "@/lib/traceability";
import { sanitizeReportDocumentType, sanitizeReportPreferences } from "@/lib/report-preferences";
import {
  getExportPolicyBlockReason,
  getReportExportStagePolicy,
  isExportStageAllowed,
} from "@/lib/report-export-policy";
import { buildPackingPolicyBlockedEscalation, enqueueWorkflowEscalationSafe } from "@/lib/workflow-escalation";

export const runtime = "nodejs";
const WEIGHT_TOLERANCE = 0.01;

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function resolveLotWeights(lot: {
  lotNumber: string;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  grossWeightKg?: unknown;
  netWeightKg?: unknown;
  bags: Array<{ grossWeight: number | null; netWeight: number | null }>;
}) {
  const grossLegacy = toNumeric(lot.grossWeight);
  const tareLegacy = toNumeric(lot.tareWeight);
  const netLegacy = toNumeric(lot.netWeight);
  const grossKg = toNumeric(lot.grossWeightKg);
  const netKg = toNumeric(lot.netWeightKg);

  const hasBagRows = lot.bags.length > 0;
  const bagGross = hasBagRows ? lot.bags.reduce((sum, bag) => sum + Number(bag.grossWeight ?? 0), 0) : null;
  const bagNet = hasBagRows ? lot.bags.reduce((sum, bag) => sum + Number(bag.netWeight ?? 0), 0) : null;

  const grossWeight = grossLegacy ?? grossKg ?? bagGross ?? netLegacy ?? netKg;
  const netWeight = netLegacy ?? netKg ?? bagNet ?? grossLegacy ?? grossKg;
  const tareWeight = tareLegacy ?? (
    grossWeight !== null && netWeight !== null
      ? Number((grossWeight - netWeight).toFixed(2))
      : null
  );

  if (grossWeight === null || netWeight === null || tareWeight === null) {
    throw new Error(`Lot ${lot.lotNumber}: Missing weights.`);
  }

  const delta = Math.abs(grossWeight - (netWeight + tareWeight));
  if (delta > WEIGHT_TOLERANCE) {
    throw new Error(`Lot ${lot.lotNumber}: Gross weight must equal net weight plus tare weight.`);
  }

  return { grossWeight, tareWeight, netWeight };
}

function hasRequiredDispatchEvidence(lot: {
  bagPhotoUrl: string | null;
  samplingPhotoUrl: string | null;
  sealPhotoUrl: string | null;
  sampling: Array<{
    beforePhotoUrl: string | null;
    duringPhotoUrl: string | null;
    afterPhotoUrl: string | null;
  }>;
  mediaFiles: Array<{
    category: string;
  }>;
}) {
  const categories = new Set(lot.mediaFiles.map((entry) => entry.category));

  const hasBagEvidence =
    Boolean(lot.bagPhotoUrl) ||
    categories.has("BAG_WITH_LOT_NO") ||
    categories.has("BAG") ||
    categories.has("BAG_CLOSEUP") ||
    categories.has("MATERIAL_VISIBLE");

  const samplingRecord = lot.sampling[0];
  const hasSamplingEvidence =
    Boolean(lot.samplingPhotoUrl) ||
    Boolean(samplingRecord?.duringPhotoUrl || samplingRecord?.beforePhotoUrl || samplingRecord?.afterPhotoUrl) ||
    categories.has("SAMPLING_IN_PROGRESS") ||
    categories.has("DURING") ||
    categories.has("BEFORE") ||
    categories.has("AFTER");

  const hasSealEvidence =
    Boolean(lot.sealPhotoUrl) ||
    categories.has("SEALED_BAG") ||
    categories.has("SEAL") ||
    categories.has("SEAL_CLOSEUP");

  return {
    hasBagEvidence,
    hasSamplingEvidence,
    hasSealEvidence,
  };
}

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
          invoiceNumber?: unknown;
          lrNumber?: unknown;
          transporterId?: unknown;
          ewayBillDetails?: unknown;
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
    const invoiceNumberInput = typeof payload.invoiceNumber === "string" ? payload.invoiceNumber.trim() : "";
    if (!invoiceNumberInput) {
      return jsonError("Validation Error", "invoiceNumber is required for every packing list.", 400);
    }

    if (!vehicleNoInput) {
      return jsonError("Validation Error", "vehicleNo is required for every packing list.", 400);
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: {
        companyId: true,
        status: true,
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

    const exportPolicy = getReportExportStagePolicy();
    if (!isExportStageAllowed(exportPolicy, job.status)) {
      const blocked = getExportPolicyBlockReason(exportPolicy);
      await enqueueWorkflowEscalationSafe({
        ...buildPackingPolicyBlockedEscalation({
          companyId: currentUser.companyId,
          raisedByUserId: currentUser.id,
          jobId,
          jobStatus: job.status,
          policyCode: blocked.code,
          policyDetails: blocked.details,
        }),
      });
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

    const lots = await prisma.inspectionLot.findMany({
      where: { jobId, companyId: currentUser.companyId },
      select: {
        lotNumber: true,
        sealNumber: true,
        grossWeight: true,
        grossWeightKg: true,
        tareWeight: true,
        netWeight: true,
        netWeightKg: true,
        bagPhotoUrl: true,
        samplingPhotoUrl: true,
        sealPhotoUrl: true,
        sampling: {
          select: {
            beforePhotoUrl: true,
            duringPhotoUrl: true,
            afterPhotoUrl: true,
          },
        },
        mediaFiles: {
          select: {
            category: true,
          },
        },
        bags: {
          select: {
            grossWeight: true,
            netWeight: true,
          },
        },
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

      let grossWeight = 0;
      let tareWeight = 0;
      let netWeight = 0;
      try {
        const resolved = resolveLotWeights(lot);
        grossWeight = resolved.grossWeight;
        tareWeight = resolved.tareWeight;
        netWeight = resolved.netWeight;
      } catch (error: unknown) {
        return jsonError("Validation Error", error instanceof Error ? error.message : `Lot ${lot.lotNumber}: Missing weights.`, 422);
      }

      const evidenceState = hasRequiredDispatchEvidence(lot);
      if (!evidenceState.hasBagEvidence || !evidenceState.hasSamplingEvidence || !evidenceState.hasSealEvidence) {
        const missing: string[] = [];
        if (!evidenceState.hasBagEvidence) {
          missing.push("bag photo");
        }
        if (!evidenceState.hasSamplingEvidence) {
          missing.push("sampling photo");
        }
        if (!evidenceState.hasSealEvidence) {
          missing.push("seal photo");
        }
        return jsonError(
          "Validation Error",
          `Lot ${lot.lotNumber}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required before dispatch.`,
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
      invoiceNumber: invoiceNumberInput,
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
      lrNumber: typeof payload.lrNumber === "string" && payload.lrNumber.trim().length > 0
        ? payload.lrNumber.trim()
        : typeof payload.buyersOrder === "string" && payload.buyersOrder.trim().length > 0
          ? payload.buyersOrder.trim()
          : undefined,
      ewayBillDetails: typeof payload.ewayBillDetails === "string" && payload.ewayBillDetails.trim().length > 0
        ? payload.ewayBillDetails.trim()
        : typeof payload.otherReference === "string" && payload.otherReference.trim().length > 0
          ? payload.otherReference.trim()
          : undefined,
      transporterId: typeof payload.transporterId === "string" && payload.transporterId.trim().length > 0
        ? payload.transporterId.trim()
        : undefined,
      vehicleNo: vehicleNoInput,
      transporterName: typeof payload.transporterName === "string" && payload.transporterName.trim().length > 0
        ? payload.transporterName.trim()
        : undefined,
      termsOfDelivery: typeof payload.termsOfDelivery === "string" && payload.termsOfDelivery.trim().length > 0
        ? payload.termsOfDelivery.trim()
        : undefined,
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
