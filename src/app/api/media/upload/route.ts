import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const SAMPLING_CATEGORIES = ["BEFORE", "DURING", "AFTER"] as const;
const LOT_CATEGORIES = ["BAG", "SEAL"] as const;

function normalizeCategory(input: string): string {
  const value = input.toUpperCase().trim();
  if (value === "LOT_BAG") {
    return "BAG";
  }
  if (value === "LOT_SEAL") {
    return "SEAL";
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let category = "";
    let fileName = "";
    let lotId: string | null = null;
    let jobId: string | null = null;
    let buffer: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      category = normalizeCategory(String(form.get("category") ?? ""));
      fileName = String(form.get("fileName") ?? "");
      lotId = String(form.get("lotId") ?? "").trim() || null;
      jobId = String(form.get("jobId") ?? "").trim() || null;

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Validation Error", details: "file is required for multipart uploads." },
          { status: 400 }
        );
      }

      if (!fileName) {
        fileName = file.name;
      }

      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      category = normalizeCategory(String(body?.category ?? ""));
      const base64 = String(body?.base64 ?? "");
      fileName = String(body?.fileName ?? body?.filename ?? "");
      lotId = String(body?.lotId ?? "").trim() || null;
      jobId = String(body?.jobId ?? "").trim() || null;

      if (!base64) {
        return NextResponse.json(
          { error: "Validation Error", details: "base64 is required for JSON uploads." },
          { status: 400 }
        );
      }

      // Isolate base64 pure data string (strip data:image/jpeg;base64, if exists)
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    }

    // Strict validation
    if (!category || !fileName || !buffer || buffer.length === 0) {
      return NextResponse.json(
        { error: "Validation Error", details: "category and file payload are required." },
        { status: 400 }
      );
    }

    if (![...SAMPLING_CATEGORIES, ...LOT_CATEGORIES, "HOMOGENEOUS"].includes(category)) {
      return NextResponse.json(
        { error: "Validation Error", details: "Category must be BEFORE, DURING, AFTER, BAG, SEAL, or HOMOGENEOUS." },
        { status: 400 }
      );
    }

    if (category !== "HOMOGENEOUS" && !lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is strictly required for lot-level categories." },
        { status: 400 }
      );
    }

    // Secure naming mapped locally
    const fileId = crypto.randomUUID();
    const secureFileName = `${fileId}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    
    // Explicit server paths using cwd to assure no arbitrary overwrites
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, secureFileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${secureFileName}`;

    // Orchestrate mapping inside a generic transaction protecting data skew
    const result = await prisma.$transaction(async (tx) => {
      if (jobId) {
        const job = await tx.inspectionJob.findUnique({
          where: { id: jobId },
          select: { companyId: true },
        });

        if (!job || job.companyId !== currentUser.companyId) {
          throw new Error("FORBIDDEN");
        }
      }

      if (lotId) {
        const lot = await tx.inspectionLot.findUnique({
          where: { id: lotId },
          select: { companyId: true },
        });

        if (!lot || lot.companyId !== currentUser.companyId) {
          throw new Error("FORBIDDEN");
        }
      }
      
      const media = await tx.mediaFile.create({
        data: {
          companyId: currentUser.companyId,
          jobId: jobId || null,
          lotId: lotId,
          category,
          storageKey: publicUrl,
          fileName: secureFileName
        }
      });

      // Map strictly to the defined columns natively
      if (category === "HOMOGENEOUS") {
        return media;
      }

      if (SAMPLING_CATEGORIES.includes(category as typeof SAMPLING_CATEGORIES[number])) {
        if (!lotId) {
          throw new Error("VALIDATION_LOT_ID");
        }
        const updateData =
          category === "BEFORE"
            ? { beforePhotoUrl: publicUrl }
            : category === "DURING"
              ? { duringPhotoUrl: publicUrl }
              : { afterPhotoUrl: publicUrl };

        await tx.sampling.upsert({
          where: { lotId },
          create: {
            lotId,
            companyId: currentUser.companyId,
            ...updateData,
          },
          update: updateData,
        });

        await tx.inspectionLot.update({
          where: { id: lotId },
          data: { samplingPhotoUrl: publicUrl },
        });
      }

      if (category === "BAG" || category === "SEAL") {
        if (!lotId) {
          throw new Error("VALIDATION_LOT_ID");
        }
        const lotUpdate =
          category === "BAG"
            ? { bagPhotoUrl: publicUrl }
            : { sealPhotoUrl: publicUrl };

        await tx.inspectionLot.update({
          where: { id: lotId },
          data: lotUpdate,
        });
      }

      return media;
    });

    return NextResponse.json({ success: true, url: publicUrl, media: result });

  } catch (err: unknown) {
    // Check for Prisma-specific error code if it exists on the error object
    if (typeof err === "object" && err !== null && "code" in err && String((err as { code?: unknown }).code) === "P2025") {
      return NextResponse.json(
        { error: "Not Found", details: "Target Sampling constraint failed. Make sure a native sample process exists before attaching photos." },
        { status: 404 }
      );
    }
    const error = err instanceof Error ? err : new Error("Failed to seamlessly process media file stream.");
    if (error.message === "VALIDATION_LOT_ID") {
      return NextResponse.json({ error: "Validation Error", details: "lotId is required for this category." }, { status: 400 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "System Error", details: error.message || "Failed to seamlessly process media file stream." },
      { status: 500 }
    );
  }
}
