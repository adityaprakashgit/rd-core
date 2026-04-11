import { NextRequest, NextResponse } from "next/server";

import {
  getDefaultCompanyProfileSettings,
  sanitizeCompanyProfileSettings,
  type CompanyProfileSettings,
} from "@/lib/company-profile-settings";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function buildCreateInput(companyId: string, companyName?: string | null) {
  const defaults = getDefaultCompanyProfileSettings(companyName ?? "Inspection Control Tower");
  return {
    companyId,
    ...defaults,
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_MODULE_SETTINGS");

    const baseCompanyName = currentUser.profile?.companyName ?? "Inspection Control Tower";
    const settings = await prisma.companyProfileSettings.upsert({
      where: { companyId: currentUser.companyId },
      update: {},
      create: buildCreateInput(currentUser.companyId, baseCompanyName),
    });

    return NextResponse.json(
      sanitizeCompanyProfileSettings(settings as Partial<CompanyProfileSettings>, baseCompanyName),
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load company profile settings.";
    return jsonError("System Error", message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_MODULE_SETTINGS");

    const baseCompanyName = currentUser.profile?.companyName ?? "Inspection Control Tower";
    const body = (await request.json()) as Partial<CompanyProfileSettings>;
    const payload = sanitizeCompanyProfileSettings(body, baseCompanyName);

    const settings = await prisma.companyProfileSettings.upsert({
      where: { companyId: currentUser.companyId },
      update: payload,
      create: {
        companyId: currentUser.companyId,
        ...payload,
      },
    });

    return NextResponse.json(
      sanitizeCompanyProfileSettings(settings as Partial<CompanyProfileSettings>, baseCompanyName),
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save company profile settings.";
    return jsonError("System Error", message, 500);
  }
}
