import { NextRequest, NextResponse } from "next/server";

import {
  buildMasterSeedPayload,
  INSPECTION_RESPONSE_TYPE_OPTIONS,
  INSPECTION_SECTION_ORDER,
  isSupportedInspectionResponseType,
} from "@/lib/inspection-checklist";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function assertAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function buildItemKey(label: string) {
  return `custom_${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}_${Date.now().toString(36)}`;
}

async function ensureChecklistSeeded() {
  const defaults = buildMasterSeedPayload();
  for (const item of defaults) {
    await prisma.inspectionChecklistItemMaster.upsert({
      where: { itemKey: item.itemKey },
      create: item,
      update: {
        isRequired: item.isRequired,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    assertAdmin(currentUser.role);
    await ensureChecklistSeeded();

    const items = await prisma.inspectionChecklistItemMaster.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      items,
      sectionOptions: INSPECTION_SECTION_ORDER,
      responseTypeOptions: INSPECTION_RESPONSE_TYPE_OPTIONS,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", "Only admins can manage inspection questions.", 403);
    }

    const message = error instanceof Error ? error.message : "Failed to load inspection checklist settings.";
    return jsonError("System Error", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    assertAdmin(currentUser.role);

    const body = await request.json();
    const itemLabel = normalizeText(body?.itemLabel);
    const sectionName = normalizeText(body?.sectionName);
    const responseType = normalizeText(body?.responseType).toUpperCase();
    const isRequired = normalizeBoolean(body?.isRequired, true);
    const isActive = normalizeBoolean(body?.isActive, true);
    const displayOrder = normalizeNumber(body?.displayOrder, 999);

    if (!itemLabel || !sectionName || !responseType) {
      return jsonError("Validation Error", "itemLabel, sectionName, and responseType are required.", 400);
    }

    if (!INSPECTION_SECTION_ORDER.includes(sectionName as (typeof INSPECTION_SECTION_ORDER)[number])) {
      return jsonError("Validation Error", "Unsupported inspection section.", 400);
    }

    if (!isSupportedInspectionResponseType(responseType)) {
      return jsonError("Validation Error", "Unsupported response type.", 400);
    }

    const created = await prisma.inspectionChecklistItemMaster.create({
      data: {
        itemKey: buildItemKey(itemLabel),
        sectionName,
        itemLabel,
        responseType,
        isRequired,
        displayOrder,
        isActive,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", "Only admins can manage inspection questions.", 403);
    }

    const message = error instanceof Error ? error.message : "Failed to create inspection question.";
    return jsonError("System Error", message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    assertAdmin(currentUser.role);

    const body = await request.json();
    const id = normalizeText(body?.id);
    if (!id) {
      return jsonError("Validation Error", "id is required.", 400);
    }

    const updates: Record<string, unknown> = {};

    if (body?.itemLabel !== undefined) {
      const itemLabel = normalizeText(body.itemLabel);
      if (!itemLabel) {
        return jsonError("Validation Error", "itemLabel cannot be empty.", 400);
      }
      updates.itemLabel = itemLabel;
    }

    if (body?.sectionName !== undefined) {
      const sectionName = normalizeText(body.sectionName);
      if (!INSPECTION_SECTION_ORDER.includes(sectionName as (typeof INSPECTION_SECTION_ORDER)[number])) {
        return jsonError("Validation Error", "Unsupported inspection section.", 400);
      }
      updates.sectionName = sectionName;
    }

    if (body?.responseType !== undefined) {
      const responseType = normalizeText(body.responseType).toUpperCase();
      if (!isSupportedInspectionResponseType(responseType)) {
        return jsonError("Validation Error", "Unsupported response type.", 400);
      }
      updates.responseType = responseType;
    }

    if (body?.isRequired !== undefined) {
      updates.isRequired = normalizeBoolean(body.isRequired);
    }

    if (body?.isActive !== undefined) {
      updates.isActive = normalizeBoolean(body.isActive);
    }

    if (body?.displayOrder !== undefined) {
      updates.displayOrder = normalizeNumber(body.displayOrder, 999);
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("Validation Error", "No updates were provided.", 400);
    }

    const updated = await prisma.inspectionChecklistItemMaster.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", "Only admins can manage inspection questions.", 403);
    }

    const message = error instanceof Error ? error.message : "Failed to update inspection question.";
    return jsonError("System Error", message, 500);
  }
}
