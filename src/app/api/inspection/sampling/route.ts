import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { evaluateSamplingWriteGate } from "@/lib/sampling-gate";
import { getCurrentUserFromRequest } from "@/lib/session";
import { recordEvidenceTelemetryEventInTx } from "@/lib/evidence-telemetry";

function pickSamplingPhotoUrl(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function jsonError(error: string, details: string, code: string, status: number) {
  return NextResponse.json({ error, details, code }, { status });
}

function isSamplingStageComplete(input: {
  beforePhotoUrl?: string | null;
  duringPhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
}) {
  return Boolean(input.beforePhotoUrl && input.duringPhotoUrl && input.afterPhotoUrl);
}

async function resolveSamplingWriteGate(lotId: string, userCompanyId: string | null | undefined) {
  const lot = await prisma.inspectionLot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      jobId: true,
      companyId: true,
      job: {
        select: {
          status: true,
        },
      },
      inspection: {
        select: {
          inspectionStatus: true,
          decisionStatus: true,
        },
      },
    },
  });

  const gate = evaluateSamplingWriteGate({
    lotExists: Boolean(lot),
    lotCompanyId: lot?.companyId,
    userCompanyId,
    jobStatus: lot?.job?.status,
    inspectionStatus: lot?.inspection?.inspectionStatus,
    decisionStatus: lot?.inspection?.decisionStatus,
  });

  return { lot, gate };
}

async function resolveSamplingWriteContext(lotId: string, userCompanyId: string | null | undefined) {
  const { lot, gate } = await resolveSamplingWriteGate(lotId, userCompanyId);
  if (gate) {
    return {
      lot: null,
      errorResponse: jsonError(gate.error, gate.details, gate.code, gate.status),
    } as const;
  }
  return { lot, errorResponse: null } as const;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", "AUTH_UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const { lotId, beforePhotoUrl, duringPhotoUrl, afterPhotoUrl } = body;

    if (!lotId) {
      return jsonError("Validation Error", "lotId is strictly required to record a sample.", "SAMPLING_LOT_ID_REQUIRED", 400);
    }

    const writeContext = await resolveSamplingWriteContext(lotId, currentUser.companyId);
    if (writeContext.errorResponse) {
      return writeContext.errorResponse;
    }
    const { lot } = writeContext;

    const existing = await prisma.sampling.findUnique({
      where: { lotId },
      select: { lotId: true },
    });

    if (existing) {
      return jsonError(
        "Conflict Action",
        "A sampling process has already been recorded for this lot. Resampling is not permitted.",
        "SAMPLING_ALREADY_EXISTS",
        409,
      );
    }

    const samplingPhotoUrl = pickSamplingPhotoUrl([duringPhotoUrl, afterPhotoUrl, beforePhotoUrl]);

    const sampling = await prisma.$transaction(async (tx) => {
      const created = await tx.sampling.create({
        data: {
          lotId,
          companyId: currentUser.companyId,
          beforePhotoUrl,
          duringPhotoUrl,
          afterPhotoUrl,
        },
      });

      await tx.inspectionLot.update({
        where: { id: lotId },
        data: {
          samplingPhotoUrl,
        },
      });

      if (isSamplingStageComplete(created)) {
        await recordEvidenceTelemetryEventInTx(tx, {
          event: "stage_complete",
          userId: currentUser.id,
          companyId: currentUser.companyId,
          jobId: lot?.jobId,
          lotId,
          stage: "sampling",
          route: "/api/inspection/sampling",
          source: "sampling.route",
        });
      }

      return created;
    });

    return NextResponse.json(sampling);
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : undefined;
    const message = err instanceof Error ? err.message : "Failed to create sampling record.";

    if (code === "P2002") {
      return jsonError(
        "Conflict Action",
        "A sampling constraint violation occurred. Resampling is not permitted.",
        "SAMPLING_ALREADY_EXISTS",
        409,
      );
    }

    return jsonError("System Error", message, "SAMPLING_CREATE_FAILED", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", "AUTH_UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return jsonError("Validation Error", "lotId is required.", "SAMPLING_LOT_ID_REQUIRED", 400);
    }

    const sampling = await prisma.sampling.findUnique({
      where: { lotId },
    });

    if (sampling) {
      const lot = await prisma.inspectionLot.findUnique({
        where: { id: sampling.lotId },
        select: { companyId: true },
      });

      if (!lot || lot.companyId !== currentUser.companyId) {
        return jsonError("Forbidden", "Cross-company access is not allowed.", "SAMPLING_CROSS_COMPANY_FORBIDDEN", 403);
      }
    }

    return NextResponse.json(sampling);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch sampling record.";
    return jsonError("System Error", message, "SAMPLING_FETCH_FAILED", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", "AUTH_UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const { lotId, beforePhotoUrl, duringPhotoUrl, afterPhotoUrl } = body;

    if (!lotId) {
      return jsonError("Validation Error", "lotId is strictly required to update a sample.", "SAMPLING_LOT_ID_REQUIRED", 400);
    }

    const writeContext = await resolveSamplingWriteContext(lotId, currentUser.companyId);
    if (writeContext.errorResponse) {
      return writeContext.errorResponse;
    }
    const { lot } = writeContext;

    const existing = await prisma.sampling.findUnique({
      where: { lotId },
      select: {
        lotId: true,
        beforePhotoUrl: true,
        duringPhotoUrl: true,
        afterPhotoUrl: true,
      },
    });

    if (!existing) {
      const sampling = await prisma.$transaction(async (tx) => {
        const created = await tx.sampling.create({
          data: {
            lotId,
            companyId: currentUser.companyId,
            beforePhotoUrl,
            duringPhotoUrl,
            afterPhotoUrl,
          },
        });

        await tx.inspectionLot.update({
          where: { id: lotId },
          data: {
            samplingPhotoUrl: pickSamplingPhotoUrl([duringPhotoUrl, afterPhotoUrl, beforePhotoUrl]),
          },
        });

        if (isSamplingStageComplete(created)) {
          await recordEvidenceTelemetryEventInTx(tx, {
            event: "stage_complete",
            userId: currentUser.id,
            companyId: currentUser.companyId,
            jobId: lot?.jobId,
            lotId,
            stage: "sampling",
            route: "/api/inspection/sampling",
            source: "sampling.route",
          });
        }

        return created;
      });

      return NextResponse.json(sampling);
    }

    const sampling = await prisma.$transaction(async (tx) => {
      const wasComplete = isSamplingStageComplete(existing);
      const updated = await tx.sampling.update({
        where: { lotId },
        data: {
          ...(beforePhotoUrl !== undefined ? { beforePhotoUrl } : {}),
          ...(duringPhotoUrl !== undefined ? { duringPhotoUrl } : {}),
          ...(afterPhotoUrl !== undefined ? { afterPhotoUrl } : {}),
        },
      });

      await tx.inspectionLot.update({
        where: { id: lotId },
        data: {
          samplingPhotoUrl: pickSamplingPhotoUrl([
            duringPhotoUrl !== undefined ? duringPhotoUrl : updated.duringPhotoUrl,
            afterPhotoUrl !== undefined ? afterPhotoUrl : updated.afterPhotoUrl,
            beforePhotoUrl !== undefined ? beforePhotoUrl : updated.beforePhotoUrl,
          ]),
        },
      });

      if (!wasComplete && isSamplingStageComplete(updated)) {
        await recordEvidenceTelemetryEventInTx(tx, {
          event: "stage_complete",
          userId: currentUser.id,
          companyId: currentUser.companyId,
          jobId: lot?.jobId,
          lotId,
          stage: "sampling",
          route: "/api/inspection/sampling",
          source: "sampling.route",
        });
      }

      return updated;
    });

    return NextResponse.json(sampling);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update sampling record.";
    return jsonError("System Error", message, "SAMPLING_UPDATE_FAILED", 500);
  }
}
