import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

function pickSamplingPhotoUrl(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const body = await req.json();
    const { lotId, beforePhotoUrl, duringPhotoUrl, afterPhotoUrl } = body;

    if (!lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is strictly required to record a sample." },
        { status: 400 }
      );
    }

    const lot = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
      select: { id: true, jobId: true, companyId: true },
    });

    if (!lot) {
      return NextResponse.json(
        { error: "Not Found", details: "The specified Lot does not exist in the system." },
        { status: 404 }
      );
    }

    if (lot.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    // --- STATUS GUARD ---
    const job = await prisma.inspectionJob.findUnique({
      where: { id: lot.jobId },
      select: { status: true, companyId: true }
    });

    if (job?.status === "LOCKED") {
      return NextResponse.json(
        { error: "Access Forbidden", details: "This job is LOCKED for audit integrity. No modifications allowed." },
        { status: 403 }
      );
    }
    // ---------------------

    const existing = await prisma.sampling.findUnique({
      where: { lotId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Conflict Action", details: "A sampling process has already been recorded for this lot. Resampling is not permitted." },
        { status: 409 }
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

      return created;
    });

    return NextResponse.json(sampling);
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : undefined;
    const message = err instanceof Error ? err.message : "Failed to create sampling record.";

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    if (code === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A sampling constraint violation occurred. Resampling is not permitted." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "System Error", details: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is required." },
        { status: 400 }
      );
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
        return NextResponse.json(
          { error: "Forbidden", details: "Cross-company access is not allowed." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(sampling);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch sampling record.";
    return NextResponse.json(
      { error: "System Error", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const body = await req.json();
    const { lotId, beforePhotoUrl, duringPhotoUrl, afterPhotoUrl } = body;

    if (!lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is strictly required to update a sample." },
        { status: 400 }
      );
    }

    const existing = await prisma.sampling.findUnique({
      where: { lotId },
      select: { lotId: true, companyId: true },
    });

    const lot = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
      select: { companyId: true },
    });

    if (!lot || lot.companyId !== currentUser.companyId || existing?.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

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

        return created;
      });

      return NextResponse.json(sampling);
    }

    const sampling = await prisma.$transaction(async (tx) => {
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

      return updated;
    });

    return NextResponse.json(sampling);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update sampling record.";
    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "System Error", details: message },
      { status: 500 }
    );
  }
}
