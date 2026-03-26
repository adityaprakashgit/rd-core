import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { assertSealIsValid, assertWeightsAreBalanced, hasRequiredTraceabilityPhotos } from "@/lib/traceability";

function isMissingAuditTableError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "MUTATE_SAMPLING");

    const { jobId, action } = await req.json();

    if (!jobId || !action) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and action (SUBMIT, APPROVE, REJECT) are required." },
        { status: 400 }
      );
    }

    const job = await prisma.inspectionJob.findUnique({ where: { id: jobId }, select: { id: true, status: true, companyId: true } });
    if (!job) {
      return NextResponse.json({ error: "Not Found", details: "Job not found." }, { status: 404 });
    }

    if (job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    let nextStatus = job.status;

    switch (action) {
      case "SUBMIT":
        nextStatus = "QA";
        break;
      case "APPROVE":
        {
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
          });

          if (lots.length === 0) {
            return NextResponse.json(
              { error: "Validation Error", details: "At least one lot is required before LOCK." },
              { status: 422 }
            );
          }

          for (const lot of lots) {
            assertSealIsValid({ lotNumber: lot.lotNumber, sealNumber: lot.sealNumber });
            assertWeightsAreBalanced({
              lotNumber: lot.lotNumber,
              grossWeight: lot.grossWeight,
              tareWeight: lot.tareWeight,
              netWeight: lot.netWeight,
            });

            if (!hasRequiredTraceabilityPhotos(lot)) {
              return NextResponse.json(
                {
                  error: "Validation Error",
                  details: `Lot ${lot.lotNumber}: bag photo, sampling photo, and seal photo are required before LOCK or DISPATCH.`,
                },
                { status: 422 }
              );
            }
          }
        }
        nextStatus = "LOCKED";
        break;
      case "REJECT":
        nextStatus = "IN_PROGRESS";
        break;
      default:
        return NextResponse.json({ error: "Invalid Action", details: "Action must be SUBMIT, APPROVE, or REJECT." }, { status: 400 });
    }

    const updatedJob = await prisma.inspectionJob.update({
      where: { id: jobId },
      data: { status: nextStatus }
    });

    try {
      await prisma.auditLog.create({
        data: {
          jobId,
          userId: currentUser.id,
          entity: "JOB",
          action: "STATUS_CHANGE",
          from: job.status,
          to: nextStatus,
          notes: `Action: ${action}`,
          metadata: {
            action,
            status: nextStatus,
          }
        }
      });
    } catch (auditErr: unknown) {
      if (!isMissingAuditTableError(auditErr)) {
        throw auditErr;
      }
    }

    return NextResponse.json(updatedJob);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err as Error;
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }

}
