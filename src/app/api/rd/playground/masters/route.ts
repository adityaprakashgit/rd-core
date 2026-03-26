import { NextRequest, NextResponse } from "next/server";

import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  createMasterRecord,
  listMasterRecords,
  MasterType,
  removeMasterRecord,
  updateMasterRecord,
} from "@/lib/playground-masters-store";

const validTypes: MasterType[] = ["STEP", "CHEMICAL", "ASSET", "UNIT", "TEMPLATE"];

function parseType(raw: string | null): MasterType | null {
  if (!raw) return null;
  const normalized = raw.toUpperCase() as MasterType;
  return validTypes.includes(normalized) ? normalized : null;
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }
    authorize(currentUser, "MUTATE_RND");

    const type = parseType(req.nextUrl.searchParams.get("type"));
    if (!type) {
      return NextResponse.json({ error: "Validation Error", details: "Valid master type is required." }, { status: 400 });
    }

    const records = await listMasterRecords(type, currentUser.companyId);
    return NextResponse.json(records);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to list master records.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }
    authorize(currentUser, "MUTATE_RND");

    const body = await req.json();
    const type = parseType(typeof body?.type === "string" ? body.type : null);
    const data = body?.data;

    if (!type || typeof data !== "object" || data === null) {
      return NextResponse.json({ error: "Validation Error", details: "type and data are required." }, { status: 400 });
    }

    const created = await createMasterRecord(type, data as Record<string, unknown>, currentUser.companyId);
    return NextResponse.json(created);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to create master record.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }
    authorize(currentUser, "MUTATE_RND");

    const body = await req.json();
    const type = parseType(typeof body?.type === "string" ? body.type : null);
    const id = typeof body?.id === "string" ? body.id : "";
    const data = body?.data;

    if (!type || !id || typeof data !== "object" || data === null) {
      return NextResponse.json({ error: "Validation Error", details: "type, id, and data are required." }, { status: 400 });
    }

    const updated = await updateMasterRecord(type, id, data as Record<string, unknown>, currentUser.companyId);
    if (!updated) {
      return NextResponse.json({ error: "Not Found", details: "Record not found." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to update master record.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }
    authorize(currentUser, "MUTATE_RND");

    const body = await req.json();
    const type = parseType(typeof body?.type === "string" ? body.type : null);
    const id = typeof body?.id === "string" ? body.id : "";

    if (!type || !id) {
      return NextResponse.json({ error: "Validation Error", details: "type and id are required." }, { status: 400 });
    }

    const removed = await removeMasterRecord(type, id, currentUser.companyId);
    if (!removed) {
      return NextResponse.json({ error: "Not Found", details: "Record not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete master record.";
    return NextResponse.json({ error: "System Error", details: message }, { status: 500 });
  }
}
