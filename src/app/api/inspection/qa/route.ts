import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { jobId, action } = await req.json();

    if (!jobId || !action) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and action (SUBMIT, APPROVE, REJECT) are required." },
        { status: 400 }
      );
    }

    const job = await prisma.inspectionJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Not Found", details: "Job not found." }, { status: 404 });
    }

    let nextStatus = job.status;

    switch (action) {
      case "SUBMIT":
        nextStatus = "QA";
        break;
      case "APPROVE":
        nextStatus = "LOCKED";
        break;
      case "REJECT":
        nextStatus = "IN_PROGRESS";
        break;
      default:
        return NextResponse.json({ error: "Invalid Action", details: "Action must be SUBMIT, APPROVE, or REJECT." }, { status: 400 });
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
      const updated = await tx.inspectionJob.update({
        where: { id: jobId },
        data: { status: nextStatus }
      });

      await tx.auditLog.create({
        data: {
          jobId,
          userId: "SYSTEM", // In a real app, this would be the logged-in user ID
          action: "STATUS_CHANGE",
          from: job.status,
          to: nextStatus,
          notes: `Action: ${action}`
        }
      });

      return updated;
    });

    return NextResponse.json(updatedJob);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }

}

