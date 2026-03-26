import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const logs = await prisma.auditLog.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(logs);
  } catch (err: any) {
    return NextResponse.json({ error: "System Error", details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, userId, action, from, to, notes } = await req.json();

    if (!jobId || !action || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const log = await prisma.auditLog.create({
      data: {
        jobId,
        userId,
        action,
        from,
        to,
        notes
      }
    });

    return NextResponse.json(log);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "System Error", details: error.message }, { status: 500 });
  }
}

