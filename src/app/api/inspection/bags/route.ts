import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { toNumeric } from "@/lib/traceability";

async function syncLotWeights(tx: Prisma.TransactionClient, lotId: string) {
  const bags = await tx.inspectionBag.findMany({
    where: { lotId },
    select: { grossWeight: true, netWeight: true },
  });

  const hasMissingWeight = bags.some((bag) => bag.grossWeight === null || bag.netWeight === null);
  if (hasMissingWeight || bags.length === 0) {
    await tx.inspectionLot.update({
      where: { id: lotId },
      data: {
        grossWeight: null,
        tareWeight: null,
        netWeight: null,
      },
    });
    return;
  }

  const grossWeight = bags.reduce((sum, bag) => sum + Number(bag.grossWeight ?? 0), 0);
  const netWeight = bags.reduce((sum, bag) => sum + Number(bag.netWeight ?? 0), 0);

  await tx.inspectionLot.update({
    where: { id: lotId },
    data: {
      grossWeight,
      netWeight,
      tareWeight: grossWeight - netWeight,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const body = await req.json();
    const { lotId, bags } = body;

    if (!lotId || !Array.isArray(bags) || bags.length === 0) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId and a non-empty array of bags are required." },
        { status: 400 }
      );
    }

    // Wrap in a transaction to enforce sequencing safely
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify Lot exists
      const lot = await tx.inspectionLot.findUnique({ where: { id: lotId }, select: { id: true, jobId: true, companyId: true } });
      if (!lot) {
        throw new Error("LOT_NOT_FOUND");
      }

      if (lot.companyId !== currentUser.companyId) {
        throw new Error("FORBIDDEN");
      }

      // --- STATUS GUARD ---
      const job = await tx.inspectionJob.findUnique({
        where: { id: lot.jobId },
        select: { status: true }
      });

      if (job?.status === "LOCKED") {
        throw new Error("JOB_LOCKED");
      }
      // ---------------------

      // 2. Determine highest existing bag number for this lot
      const existingBags = await tx.inspectionBag.findMany({
        where: { lotId },
        orderBy: { bagNumber: "desc" },
        take: 1,
      });

      let nextBagNumber = existingBags.length > 0 ? existingBags[0].bagNumber + 1 : 1;

      // 3. Prepare data for batch insert
      const dataToInsert = bags.map((bag) => {
        const bagData = {
          lotId,
          bagNumber: nextBagNumber,
          grossWeight: toNumeric(bag.grossWeight),
          netWeight: toNumeric(bag.netWeight),
        };
        nextBagNumber++;
        return bagData;
      });

      // 4. Batch insert
      await tx.inspectionBag.createMany({
        data: dataToInsert,
      });

      await syncLotWeights(tx, lotId);

      return { count: dataToInsert.length };
    });

    return NextResponse.json({ success: true, insertedCount: result.count });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process bag capture.";
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : undefined;

    if (message === "LOT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Not Found", details: "The specified Lot does not exist." },
        { status: 404 }
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    if (message === "JOB_LOCKED") {
      return NextResponse.json(
        { error: "Forbidden", details: "This job is LOCKED. No bag changes are allowed." },
        { status: 403 }
      );
    }

    if (code === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A data conflict occurred preventing proper sequential capture. Please retry." },
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
        { error: "Validation Error", details: "lotId parameter is strictly required." },
        { status: 400 }
      );
    }

    const lot = await prisma.inspectionLot.findUnique({
      where: { id: lotId },
      select: { companyId: true },
    });

    if (!lot || lot.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    const bags = await prisma.inspectionBag.findMany({
      where: { lotId },
      orderBy: { bagNumber: "asc" },
    });

    return NextResponse.json(bags);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve lot bags.";
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
    const { bagId, grossWeight, netWeight } = body;

    if (!bagId) {
      return NextResponse.json(
        { error: "Validation Error", details: "bagId is required." },
        { status: 400 }
      );
    }

    const bagOwner = await prisma.inspectionBag.findUnique({
      where: { id: bagId },
      select: { lot: { select: { companyId: true } } },
    });

    if (!bagOwner || bagOwner.lot.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    const bag = await prisma.$transaction(async (tx) => {
      const updatedBag = await tx.inspectionBag.update({
        where: { id: bagId },
        data: {
          ...(grossWeight !== undefined ? { grossWeight: toNumeric(grossWeight) } : {}),
          ...(netWeight !== undefined ? { netWeight: toNumeric(netWeight) } : {}),
        },
      });

      await syncLotWeights(tx, updatedBag.lotId);
      return updatedBag;
    });

    return NextResponse.json(bag);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update bag weights.";
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : undefined;

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    if (message === "JOB_LOCKED") {
      return NextResponse.json(
        { error: "Forbidden", details: "This job is LOCKED. No bag changes are allowed." },
        { status: 403 }
      );
    }

    if (code === "P2025") {
      return NextResponse.json(
        { error: "Not Found", details: "The specified bag does not exist." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "System Error", details: message },
      { status: 500 }
    );
  }
}
