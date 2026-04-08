import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";
import { getImageDimensions } from "@/lib/image-dimensions";
import {
  recordEvidenceTelemetryEvent,
  recordEvidenceTelemetryEventInTx,
} from "@/lib/evidence-telemetry";
import { getMediaStorageProvider } from "@/lib/storage/media-storage";

const MEDIA_CATEGORIES = [
  "BEFORE",
  "DURING",
  "AFTER",
  "BAG",
  "SEAL",
  "BAG_WITH_LOT_NO",
  "MATERIAL_VISIBLE",
  "SAMPLING_IN_PROGRESS",
  "SEALED_BAG",
  "SEAL_CLOSEUP",
  "BAG_CONDITION",
  "DAMAGE_PHOTO",
  "HOMOGENEOUS",
  "LOT_OVERVIEW",
  "BAG_CLOSEUP",
  "LABEL_CLOSEUP",
  "INSPECTION_IN_PROGRESS",
  "CONTAMINATION_PHOTO",
] as const;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_UPLOAD_FILE_SIZE_BYTES = Number.parseInt(process.env.MEDIA_UPLOAD_MAX_BYTES ?? "", 10) || 10 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_WIDTH = Number.parseInt(process.env.MEDIA_UPLOAD_MAX_WIDTH ?? "", 10) || 6000;
const MAX_UPLOAD_IMAGE_HEIGHT = Number.parseInt(process.env.MEDIA_UPLOAD_MAX_HEIGHT ?? "", 10) || 6000;

function jsonError(error: string, details: string, code: string, status: number) {
  return NextResponse.json({ error, details, code }, { status });
}

function normalizeCategory(input: string): string {
  const value = input.toUpperCase().trim();
  switch (value) {
    case "LOT_BAG":
    case "BAG":
      return "BAG_WITH_LOT_NO";
    case "LOT_SEAL":
    case "SEAL":
      return "SEALED_BAG";
    case "DURING":
      return "SAMPLING_IN_PROGRESS";
    default:
      return value;
  }
}

function getLegacyMirrorCategory(category: string): string {
  switch (category) {
    case "BAG_WITH_LOT_NO":
      return "BAG";
    case "SEALED_BAG":
      return "SEAL";
    case "SAMPLING_IN_PROGRESS":
      return "DURING";
    default:
      return category;
  }
}

function getAuditAction(category: string, isRetake: boolean) {
  if (category === "SAMPLING_IN_PROGRESS" || category === "BEFORE" || category === "AFTER") {
    return isRetake ? "IMAGE_RETAKEN" : "SAMPLING_PHOTO_ADDED";
  }

  if (category === "SEALED_BAG" || category === "SEAL_CLOSEUP") {
    return isRetake ? "IMAGE_RETAKEN" : "SEAL_PHOTO_ADDED";
  }

  if (category === "BAG_CONDITION") {
    return isRetake ? "IMAGE_RETAKEN" : "BAG_CONDITION_ADDED";
  }

  return isRetake ? "IMAGE_RETAKEN" : "IMAGE_UPLOADED";
}

function isSamplingEvidenceComplete(record: {
  beforePhotoUrl?: string | null;
  duringPhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
}) {
  return Boolean(record.beforePhotoUrl && record.duringPhotoUrl && record.afterPhotoUrl);
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", "AUTH_UNAUTHORIZED", 401);
    }

    const contentType = req.headers.get("content-type") ?? "";
    let category = "";
    let fileName = "";
    let mimeType = "";
    let lotId: string | null = null;
    let jobId: string | null = null;
    let inspectionId: string | null = null;
    let inspectionIssueId: string | null = null;
    let buffer: Buffer | null = null;
    let uploadAttemptRecorded = false;

    const recordUploadAttempt = async () => {
      if (uploadAttemptRecorded) {
        return;
      }
      uploadAttemptRecorded = true;
      await recordEvidenceTelemetryEvent({
        event: "upload_attempt",
        userId: currentUser.id,
        companyId: currentUser.companyId,
        jobId,
        lotId,
        inspectionId,
        route: "/api/media/upload",
        source: "media.upload",
        category: category || null,
        mimeType: mimeType || null,
        fileSizeBytes: buffer?.length ?? null,
      });
    };

    const failWithTelemetry = async (error: string, details: string, code: string, status: number) => {
      await recordUploadAttempt();
      await recordEvidenceTelemetryEvent({
        event: "upload_failed",
        userId: currentUser.id,
        companyId: currentUser.companyId,
        jobId,
        lotId,
        inspectionId,
        route: "/api/media/upload",
        source: "media.upload",
        category: category || null,
        mimeType: mimeType || null,
        fileSizeBytes: buffer?.length ?? null,
        code,
        details,
        status,
      });
      return jsonError(error, details, code, status);
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      category = normalizeCategory(String(form.get("category") ?? ""));
      fileName = String(form.get("fileName") ?? "");
      lotId = String(form.get("lotId") ?? "").trim() || null;
      jobId = String(form.get("jobId") ?? "").trim() || null;
      inspectionId = String(form.get("inspectionId") ?? "").trim() || null;
      inspectionIssueId = String(form.get("inspectionIssueId") ?? "").trim() || null;

      if (!(file instanceof File)) {
        return failWithTelemetry("Validation Error", "file is required for multipart uploads.", "MEDIA_FILE_REQUIRED", 400);
      }

      fileName = fileName || file.name;
      mimeType = file.type;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      category = normalizeCategory(String(body?.category ?? ""));
      const base64 = String(body?.base64 ?? "");
      fileName = String(body?.fileName ?? body?.filename ?? "");
      mimeType = String(body?.mimeType ?? "");
      lotId = String(body?.lotId ?? "").trim() || null;
      jobId = String(body?.jobId ?? "").trim() || null;
      inspectionId = String(body?.inspectionId ?? "").trim() || null;
      inspectionIssueId = String(body?.inspectionIssueId ?? "").trim() || null;

      if (!base64) {
        return failWithTelemetry("Validation Error", "base64 is required for JSON uploads.", "MEDIA_BASE64_REQUIRED", 400);
      }

      const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    }

    await recordUploadAttempt();

    if (!category || !fileName || !buffer || buffer.length === 0) {
      return failWithTelemetry("Validation Error", "category and file payload are required.", "MEDIA_PAYLOAD_REQUIRED", 400);
    }

    if (!MEDIA_CATEGORIES.includes(category as (typeof MEDIA_CATEGORIES)[number])) {
      return failWithTelemetry("Validation Error", "Unsupported media category.", "MEDIA_CATEGORY_UNSUPPORTED", 400);
    }

    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return failWithTelemetry(
        "Validation Error",
        "Only jpeg, png, and webp image uploads are supported for intake evidence.",
        "MEDIA_UNSUPPORTED_MIME",
        400,
      );
    }

    if (buffer.length > MAX_UPLOAD_FILE_SIZE_BYTES) {
      return failWithTelemetry(
        "Validation Error",
        `File size exceeds the ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes upload limit.`,
        "MEDIA_FILE_TOO_LARGE",
        413,
      );
    }

    const dimensions = getImageDimensions(buffer, mimeType);
    if (!dimensions) {
      return failWithTelemetry(
        "Validation Error",
        "Unable to read image dimensions. Upload a valid jpeg, png, or webp file.",
        "MEDIA_DIMENSIONS_UNREADABLE",
        400,
      );
    }

    if (dimensions.width > MAX_UPLOAD_IMAGE_WIDTH || dimensions.height > MAX_UPLOAD_IMAGE_HEIGHT) {
      return failWithTelemetry(
        "Validation Error",
        `Image dimensions exceed limits. Max allowed is ${MAX_UPLOAD_IMAGE_WIDTH}x${MAX_UPLOAD_IMAGE_HEIGHT}px.`,
        "MEDIA_DIMENSIONS_EXCEEDED",
        400,
      );
    }

    if (category !== "HOMOGENEOUS" && !lotId) {
      return failWithTelemetry("Validation Error", "lotId is required for lot-level media.", "MEDIA_LOT_ID_REQUIRED", 400);
    }

    const storage = getMediaStorageProvider();
    const storedMedia = await storage.write({
      fileName,
      buffer,
    });
    const publicUrl = storedMedia.storageKey;

    const result = await prisma.$transaction(async (tx) => {
      let jobRef = jobId;
      const inspectionRef = inspectionId;
      if (lotId) {
        const lot = await tx.inspectionLot.findUnique({
          where: { id: lotId },
          select: { id: true, jobId: true, companyId: true },
        });

        if (!lot || lot.companyId !== currentUser.companyId) {
          throw new Error("FORBIDDEN");
        }

        jobRef = lot.jobId;
      }

      if (inspectionRef) {
        const inspection = await tx.inspection.findUnique({
          where: { id: inspectionRef },
          select: { id: true, jobId: true, lotId: true },
        });

        if (!inspection) {
          throw new Error("INSPECTION_NOT_FOUND");
        }

        if (lotId && inspection.lotId !== lotId) {
          throw new Error("FORBIDDEN");
        }

        jobRef = inspection.jobId;
      }

      if (jobRef) {
        const job = await tx.inspectionJob.findUnique({
          where: { id: jobRef },
          select: { companyId: true },
        });

        if (!job || job.companyId !== currentUser.companyId) {
          throw new Error("FORBIDDEN");
        }
      }

      const existingForCategory = lotId
        ? await tx.mediaFile.findFirst({
            where: {
              lotId,
              category: {
                in: [category, getLegacyMirrorCategory(category)],
              },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          })
        : null;

      const media = await tx.mediaFile.create({
        data: {
          companyId: currentUser.companyId,
          category,
          storageKey: publicUrl,
          fileName: storedMedia.fileName,
          ...(jobRef ? { job: { connect: { id: jobRef } } } : {}),
          ...(lotId ? { lot: { connect: { id: lotId } } } : {}),
          ...(inspectionRef ? { inspection: { connect: { id: inspectionRef } } } : {}),
          ...(inspectionIssueId ? { inspectionIssue: { connect: { id: inspectionIssueId } } } : {}),
        },
      });

      if (lotId) {
        if (category === "BAG_WITH_LOT_NO") {
          await tx.inspectionLot.update({
            where: { id: lotId },
            data: { bagPhotoUrl: publicUrl },
          });
        }

        if (category === "SEALED_BAG") {
          await tx.inspectionLot.update({
            where: { id: lotId },
            data: { sealPhotoUrl: publicUrl },
          });
        }

        if (["SAMPLING_IN_PROGRESS", "BEFORE", "AFTER"].includes(category)) {
          const existingSampling = await tx.sampling.findUnique({
            where: { lotId },
            select: {
              beforePhotoUrl: true,
              duringPhotoUrl: true,
              afterPhotoUrl: true,
            },
          });
          const wasSamplingComplete = isSamplingEvidenceComplete(existingSampling ?? {});
          const updateData =
            category === "BEFORE"
              ? { beforePhotoUrl: publicUrl }
              : category === "AFTER"
                ? { afterPhotoUrl: publicUrl }
                : { duringPhotoUrl: publicUrl };

          const upsertedSampling = await tx.sampling.upsert({
            where: { lotId },
            create: {
              lotId,
              companyId: currentUser.companyId,
              ...updateData,
            },
            update: updateData,
          });
          const isSamplingNowComplete = isSamplingEvidenceComplete(upsertedSampling);

          await tx.inspectionLot.update({
            where: { id: lotId },
            data: { samplingPhotoUrl: publicUrl },
          });

          if (!wasSamplingComplete && isSamplingNowComplete) {
            await recordEvidenceTelemetryEventInTx(tx, {
              event: "stage_complete",
              userId: currentUser.id,
              companyId: currentUser.companyId,
              jobId: jobRef,
              lotId,
              inspectionId: inspectionRef,
              route: "/api/media/upload",
              source: "media.upload",
              stage: "sampling",
            });
          }
        }
      }

      if (jobRef) {
        await recordAuditLog(tx, {
          jobId: jobRef,
          userId: currentUser.id,
          entity: "LOT_MEDIA",
          action: getAuditAction(category, Boolean(existingForCategory)),
          metadata: {
            lotId,
            category,
            url: publicUrl,
          },
        });
      }

      return { media, jobRef };
    });

    await recordEvidenceTelemetryEvent({
      event: "upload_success",
      userId: currentUser.id,
      companyId: currentUser.companyId,
      jobId: result.jobRef,
      lotId,
      inspectionId,
      route: "/api/media/upload",
      source: "media.upload",
      category,
      mimeType,
      fileSizeBytes: buffer.length,
      status: 200,
    });

    return NextResponse.json({ success: true, url: publicUrl, media: result.media });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error("Failed to process media upload.");
    if (error.message === "FORBIDDEN") {
      await recordEvidenceTelemetryEvent({
        event: "upload_failed",
        route: "/api/media/upload",
        source: "media.upload",
        code: "MEDIA_CROSS_COMPANY_FORBIDDEN",
        details: "Cross-company access is not allowed.",
        status: 403,
      });
      return jsonError("Forbidden", "Cross-company access is not allowed.", "MEDIA_CROSS_COMPANY_FORBIDDEN", 403);
    }
    if (error.message === "INSPECTION_NOT_FOUND") {
      await recordEvidenceTelemetryEvent({
        event: "upload_failed",
        route: "/api/media/upload",
        source: "media.upload",
        code: "MEDIA_INSPECTION_NOT_FOUND",
        details: "Inspection record not found for media upload.",
        status: 404,
      });
      return jsonError("Not Found", "Inspection record not found for media upload.", "MEDIA_INSPECTION_NOT_FOUND", 404);
    }

    await recordEvidenceTelemetryEvent({
      event: "upload_failed",
      route: "/api/media/upload",
      source: "media.upload",
      code: "MEDIA_UPLOAD_FAILED",
      details: error.message || "Failed to process media upload.",
      status: 500,
    });
    return jsonError("System Error", error.message || "Failed to process media upload.", "MEDIA_UPLOAD_FAILED", 500);
  }
}
