import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "MUTATE_RND");

    const body = await req.json();
    const { trialId, element, value } = body;

    // Strict validation
    if (!trialId || !element || value === undefined) {
      return NextResponse.json(
        { error: "Validation Error", details: "trialId, element, and value are strictly mapped." },
        { status: 400 }
      );
    }
    // --- STATUS GUARD ---
    const trial = await prisma.rDTrial.findUnique({
      where: { id: trialId },
      include: { experiment: { select: { jobId: true } } }
    });

    if (!trial) {
      return NextResponse.json({ error: "Not Found", details: "Trial not found." }, { status: 404 });
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: trial.experiment.jobId },
      select: { status: true, companyId: true }
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: "Forbidden", details: "Cross-company access is not allowed." },
        { status: 403 }
      );
    }

    if (job?.status === "LOCKED") {
      return NextResponse.json(
        { error: "Access Forbidden", details: "This job is LOCKED for audit integrity. No modifications allowed." },
        { status: 403 }
      );
    }
    // ---------------------

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
       return NextResponse.json(
         { error: "Validation Error", details: "Measurement values must strictly evaluate analytically as numbers." },
         { status: 400 }
       );
    }

    const measurement = await prisma.rDMeasurement.create({
       data: {
          trialId,
          element: element.toUpperCase().trim(),
          value: numValue
       }
    });

    return NextResponse.json({ success: true, measurement });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }

    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code) === "P2002") {
      return NextResponse.json(
        { error: "Conflict Action", details: "Data Consistency blocked insertion: This Element uniquely exists within the target Trial constraints." },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed natively generating isolated metric measurements.";

    return NextResponse.json(
      { error: "System Error", details: message },
      { status: 500 }
    );
  }
}
