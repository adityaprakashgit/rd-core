import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sampleId, count = 1 } = body;

    // Strict validation
    if (!sampleId) {
      return NextResponse.json(
        { error: "Validation Error", details: "sampleId is rigidly required to generate packets." },
        { status: 400 }
      );
    }
    
    if (typeof count !== "number" || count <= 0) {
      return NextResponse.json(
        { error: "Validation Error", details: "count must be a strict positive integer." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const sample = await tx.homogeneousSample.findUnique({ where: { id: sampleId } });
      if (!sample) {
        throw new Error("SAMPLE_NOT_FOUND");
      }

      // Calculate max packetNumber strictly natively via Prisma Ordering bounds
      const highestPacket = await tx.samplePacket.findFirst({
        where: { sampleId },
        orderBy: { packetNumber: "desc" }
      });

      let nextPacketNumber = highestPacket ? highestPacket.packetNumber + 1 : 1;

      // Construct mapped array limits efficiently without overlapping array allocations
      const packetsData = [];
      for (let i = 0; i < count; i++) {
        packetsData.push({
           sampleId,
           packetNumber: nextPacketNumber + i
        });
      }

      // Generate in mass natively avoiding looping inserts protecting connection strings
      await tx.samplePacket.createMany({
        data: packetsData
      });

      return { count: packetsData.length, startOffset: nextPacketNumber };
    });

    return NextResponse.json({ success: true, packetsCreated: result.count });
  } catch (error: any) {
    if (error.message === "SAMPLE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Not Found", details: "The parent Homogeneous Sample explicitly does not exist." },
        { status: 404 }
      );
    }

    // Check if error has a 'code' property, which might not be on a generic Error
    if ((error as any)?.code === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A critical concurrency overlap forced a mapping failure. Please attempt Generation again." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "System Error", details: error?.message || "Failed to seamlessly generate packets." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sampleId = searchParams.get("sampleId");

    if (!sampleId) {
      return NextResponse.json(
        { error: "Validation Error", details: "sampleId parameter strictly required." },
        { status: 400 }
      );
    }

    const packets = await prisma.samplePacket.findMany({
      where: { sampleId },
      orderBy: { packetNumber: "asc" }
    });

    return NextResponse.json(packets);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: "System Error", details: error.message || "Failed parsing packet queries." },
      { status: 500 }
    );
  }
}

