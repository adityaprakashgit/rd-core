import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { assertSealIsValid, assertWeightsAreBalanced, hasRequiredTraceabilityPhotos } from "@/lib/traceability";
import { deriveSampleStatus, getSampleReadiness, mapSampleMediaByType } from "@/lib/sample-management";
import type { SampleRecord } from "@/types/inspection";

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
              id: true,
              lotNumber: true,
              sealNumber: true,
              sealAuto: true,
              grossWeight: true,
              tareWeight: true,
              netWeight: true,
              bagPhotoUrl: true,
              samplingPhotoUrl: true,
              sealPhotoUrl: true,
              sample: {
                include: {
                  media: true,
                  sealLabel: true,
                  events: true,
                },
              },
            },
          });

          if (lots.length === 0) {
            return NextResponse.json(
              { error: "Validation Error", details: "At least one lot is required before LOCK." },
              { status: 422 }
            );
          }

          for (const lot of lots) {
            const sample = lot.sample as SampleRecord | null;
            if (sample) {
              const readiness = getSampleReadiness(sample);
              if (deriveSampleStatus(sample) !== "READY_FOR_PACKETING" || !readiness.isReady) {
                return NextResponse.json(
                  {
                    error: "Validation Error",
                    details: `Lot ${lot.lotNumber}: sample is not ready for packeting. ${readiness.missing.join(", ")}`,
                  },
                  { status: 422 }
                );
              }

              const mediaMap = mapSampleMediaByType(sample.media);
              await prisma.inspectionLot.update({
                where: { id: lot.id },
                data: {
                  bagPhotoUrl: mediaMap.SAMPLE_CONTAINER?.fileUrl ?? mediaMap.SAMPLE_CONDITION?.fileUrl ?? lot.bagPhotoUrl,
                  samplingPhotoUrl:
                    mediaMap.SAMPLING_IN_PROGRESS?.fileUrl ??
                    mediaMap.SEALED_SAMPLE?.fileUrl ??
                    mediaMap.SAMPLE_CONTAINER?.fileUrl ??
                    lot.samplingPhotoUrl,
                  sealPhotoUrl: mediaMap.SEALED_SAMPLE?.fileUrl ?? lot.sealPhotoUrl,
                  ...(sample.sealLabel?.sealNo ? { sealNumber: sample.sealLabel.sealNo } : {}),
                },
              });
              continue;
            }

            try {
              assertSealIsValid({ lotNumber: lot.lotNumber, sealNumber: lot.sealNumber });
              assertWeightsAreBalanced({
                lotNumber: lot.lotNumber,
                grossWeight: lot.grossWeight,
                tareWeight: lot.tareWeight,
                netWeight: lot.netWeight,
              });
            } catch (validationError) {
              const details = validationError instanceof Error ? validationError.message : "Lot validation failed.";
              return NextResponse.json({ error: "Validation Error", details }, { status: 422 });
            }

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
