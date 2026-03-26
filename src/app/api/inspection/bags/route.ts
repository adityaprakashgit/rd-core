import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
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
      const lot = await tx.inspectionLot.findUnique({ where: { id: lotId } });
      if (!lot) {
        throw new Error("LOT_NOT_FOUND");
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
          grossWeight: bag.grossWeight !== undefined ? Number(bag.grossWeight) : null,
          netWeight: bag.netWeight !== undefined ? Number(bag.netWeight) : null,
        };
        nextBagNumber++;
        return bagData;
      });

      // 4. Batch insert
      await tx.inspectionBag.createMany({
        data: dataToInsert,
      });

      return { count: dataToInsert.length };
    });

    return NextResponse.json({ success: true, insertedCount: result.count });
  } catch (error: any) {
    if (error.message === "LOT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Not Found", details: "The specified Lot does not exist." },
        { status: 404 }
      );
    }

    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A data conflict occurred preventing proper sequential capture. Please retry." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "System Error", details: error?.message || "Failed to process bag capture." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId parameter is strictly required." },
        { status: 400 }
      );
    }

    const bags = await prisma.inspectionBag.findMany({
      where: { lotId },
      orderBy: { bagNumber: "asc" },
    });

    return NextResponse.json(bags);
  } catch (error: any) {
    return NextResponse.json(
      { error: "System Error", details: error?.message || "Failed to retrieve lot bags." },
      { status: 500 }
    );
  }
}
