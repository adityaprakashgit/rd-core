import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, base64, fileName, lotId, jobId, companyId } = body;

    // Strict validation
    if (!category || !base64 || !fileName) {
      return NextResponse.json(
        { error: "Validation Error", details: "category, base64, and fileName are strictly required." },
        { status: 400 }
      );
    }

    if (!["BEFORE", "DURING", "AFTER", "HOMOGENEOUS"].includes(category)) {
      return NextResponse.json(
        { error: "Validation Error", details: "Category must be strictly BEFORE, DURING, AFTER, or HOMOGENEOUS." },
        { status: 400 }
      );
    }

    if (category !== "HOMOGENEOUS" && !lotId) {
      return NextResponse.json(
        { error: "Validation Error", details: "lotId is strictly required for lot-level categories." },
        { status: 400 }
      );
    }

    // Isolate base64 pure data string (strip data:image/jpeg;base64, if exists)
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

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
      
      const media = await tx.mediaFile.create({
        data: {
          companyId: companyId || "test-company",
          jobId: jobId || null,
          lotId: lotId,
          category,
          storageKey: publicUrl,
          fileName: secureFileName
        }
      });

      // Map strictly to the defined columns natively
      let updateData = {};
      if (category === "BEFORE") updateData = { beforePhotoUrl: publicUrl };
      else if (category === "DURING") updateData = { duringPhotoUrl: publicUrl };
      else if (category === "AFTER") updateData = { afterPhotoUrl: publicUrl };

      if (category !== "HOMOGENEOUS") {
        await tx.sampling.update({
          where: { lotId },
          data: updateData
        });
      }

      return media;
    });

    return NextResponse.json({ success: true, url: publicUrl, media: result });

  } catch (err: unknown) {
    const error = err as Error; // Cast as Error for property access, assuming it's an Error or similar object
    // Check for Prisma-specific error code if it exists on the error object
    if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === "P2025") {
      return NextResponse.json(
        { error: "Not Found", details: "Target Sampling constraint failed. Make sure a native sample process exists before attaching photos." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "System Error", details: error.message || "Failed to seamlessly process media file stream." },
      { status: 500 }
    );
  }
}
