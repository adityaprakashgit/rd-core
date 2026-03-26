import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "MUTATE_RND");

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
      const sample = await tx.homogeneousSample.findUnique({
        where: { id: sampleId },
        select: {
          id: true,
          job: {
            select: {
              companyId: true,
            },
          },
        },
      });
      if (!sample) {
        throw new Error("SAMPLE_NOT_FOUND");
      }
      if (sample.job.companyId !== currentUser.companyId) {
        throw new Error("FORBIDDEN");
      }

      // Calculate max packetNumber strictly natively via Prisma Ordering bounds
      const highestPacket = await tx.samplePacket.findFirst({
        where: { sampleId },
        orderBy: { packetNumber: "desc" }
      });

      const nextPacketNumber = highestPacket ? highestPacket.packetNumber + 1 : 1;

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
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to seamlessly generate packets.";

    if (message === "SAMPLE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Not Found", details: "The parent Homogeneous Sample explicitly does not exist." },
        { status: 404 }
      );
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    // Check if error has a Prisma code property.
    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code) === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "A critical concurrency overlap forced a mapping failure. Please attempt Generation again." },
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

    authorize(currentUser, "READ_ONLY");

    const { searchParams } = new URL(req.url);
    const sampleId = searchParams.get("sampleId");

    if (!sampleId) {
      return NextResponse.json(
        { error: "Validation Error", details: "sampleId parameter strictly required." },
        { status: 400 }
      );
    }

    const sample = await prisma.homogeneousSample.findUnique({
      where: { id: sampleId },
      select: {
        job: {
          select: {
            companyId: true,
          },
        },
      },
    });

    if (!sample) {
      return NextResponse.json(
        { error: "Not Found", details: "Homogeneous sample not found." },
        { status: 404 }
      );
    }

    if (sample.job.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    const packets = await prisma.samplePacket.findMany({
      where: { sampleId },
      orderBy: { packetNumber: "asc" }
    });

    return NextResponse.json(packets);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err as Error;
    return NextResponse.json(
      { error: "System Error", details: error.message || "Failed parsing packet queries." },
      { status: 500 }
    );
  }
}
