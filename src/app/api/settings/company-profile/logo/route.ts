import { NextRequest, NextResponse } from "next/server";

import { getMediaStorageProvider } from "@/lib/storage/media-storage";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_LOGO_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_MODULE_SETTINGS");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("Validation Error", "Logo file is required.", 400);
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonError("Validation Error", "Only JPG, PNG, and WEBP logos are supported.", 400);
    }
    if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
      return jsonError("Validation Error", "Logo size exceeds 5MB.", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getMediaStorageProvider();
    const storedMedia = await storage.write({
      fileName: file.name || "company-logo.png",
      buffer,
    });

    return NextResponse.json({
      logoUrl: storedMedia.storageKey,
      fileName: storedMedia.fileName,
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to upload company logo.";
    return jsonError("System Error", message, 500);
  }
}
