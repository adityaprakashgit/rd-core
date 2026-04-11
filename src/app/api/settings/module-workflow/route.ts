import { NextRequest, NextResponse } from "next/server";

import {
  buildModuleWorkflowSettingsCreate,
  buildModuleWorkflowSettingsUpdate,
  getCanonicalImagePolicyCategoryKeys,
  toModuleWorkflowPolicy,
  validateImagePolicyCategoryBuckets,
  type ModuleWorkflowPolicy,
} from "@/lib/module-workflow-policy";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/rbac";
import { getCurrentUserFromRequest } from "@/lib/session";

function jsonError(error: string, details: string, status: number, code = "MODULE_WORKFLOW_ERROR") {
  return NextResponse.json({ error, details, code }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_MODULE_SETTINGS");

    const settings = await prisma.moduleWorkflowSettings.upsert({
      where: { companyId: currentUser.companyId },
      update: {},
      create: buildModuleWorkflowSettingsCreate(currentUser.companyId),
    });

    return NextResponse.json(toModuleWorkflowPolicy(settings));
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to load module settings.";
    return jsonError("System Error", message, 500, "MODULE_WORKFLOW_FETCH_FAILED");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("Unauthorized", "Current user could not be resolved.", 401);
    }

    authorize(currentUser, "MANAGE_MODULE_SETTINGS");

    const body = (await request.json()) as Partial<ModuleWorkflowPolicy>;
    const invalidPolicyEntries = validateImagePolicyCategoryBuckets(body);
    if (invalidPolicyEntries.length > 0) {
      const details = [
        "Use canonical category keys only in image policy buckets.",
        `Invalid entries: ${invalidPolicyEntries.map((entry) => `${entry.bucket}=${entry.value}`).join(", ")}`,
        `Allowed keys: ${getCanonicalImagePolicyCategoryKeys().join(", ")}`,
      ].join(" ");
      return jsonError("Validation Error", details, 422, "POLICY_CATEGORY_INVALID");
    }

    const settings = await prisma.moduleWorkflowSettings.upsert({
      where: { companyId: currentUser.companyId },
      update: buildModuleWorkflowSettingsUpdate(body),
      create: {
        ...buildModuleWorkflowSettingsCreate(currentUser.companyId),
        ...buildModuleWorkflowSettingsUpdate(body),
      },
    });

    return NextResponse.json(toModuleWorkflowPolicy(settings));
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError("Forbidden", error.message, 403);
    }
    const message = error instanceof Error ? error.message : "Failed to save module settings.";
    return jsonError("System Error", message, 500, "MODULE_WORKFLOW_SAVE_FAILED");
  }
}
