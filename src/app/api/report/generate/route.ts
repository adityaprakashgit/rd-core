import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { authorize, AuthorizationError } from "@/lib/rbac";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    const jobScope = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!jobScope) {
      return NextResponse.json(
        { error: "Not Found", details: "Job not found." },
        { status: 404 }
      );
    }

    if (jobScope.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    // 1. Fetch current-module graph only (no legacy homogeneous sample relations).
    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        companyId: true,
        jobReferenceNumber: true,
        inspectionSerialNumber: true,
        clientName: true,
        commodity: true,
        plantLocation: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lots: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            lotNumber: true,
            quantityMode: true,
            totalBags: true,
            grossWeight: true,
            tareWeight: true,
            netWeight: true,
            grossWeightKg: true,
            netWeightKg: true,
            sealNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            bags: {
              orderBy: { bagNumber: "asc" },
              select: {
                id: true,
                bagNumber: true,
                grossWeight: true,
                netWeight: true,
              },
            },
            sample: {
              select: {
                id: true,
                sampleCode: true,
                sampleStatus: true,
                sampleType: true,
                samplingMethod: true,
                samplingDate: true,
                sampleQuantity: true,
                sampleUnit: true,
                containerType: true,
                homogenizedAt: true,
                readyForPacketingAt: true,
                createdAt: true,
                updatedAt: true,
                sealLabel: true,
                media: true,
                events: true,
                packets: {
                  orderBy: { packetNo: "asc" },
                  select: {
                    id: true,
                    packetCode: true,
                    packetNo: true,
                    packetStatus: true,
                    packetQuantity: true,
                    packetUnit: true,
                    packetType: true,
                    readyAt: true,
                    createdAt: true,
                    updatedAt: true,
                    sealLabel: true,
                    media: true,
                    allocation: true,
                  },
                },
              },
            },
          },
        },
        experiments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            trials: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                lotId: true,
                packetId: true,
                trialNumber: true,
                notes: true,
                grossWeightKg: true,
                netWeightKg: true,
                createdAt: true,
                measurements: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Not Found", details: "Job not found." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const packetCount = job.lots.reduce((sum, lot) => sum + (lot.sample?.packets.length ?? 0), 0);
    const trialCount = job.experiments.reduce((sum, experiment) => sum + experiment.trials.length, 0);

    // 2. Aggregate into a strict current-module snapshot structure.
    const snapshotData = JSON.parse(
      JSON.stringify({
        schemaVersion: "report_snapshot_v2",
        generatedAt: nowIso,
        summary: {
          lotCount: job.lots.length,
          sampleCount: job.lots.filter((lot) => Boolean(lot.sample)).length,
          packetCount,
          trialCount,
        },
        job: {
          id: job.id,
          companyId: job.companyId,
          jobReferenceNumber: job.jobReferenceNumber,
          inspectionSerialNumber: job.inspectionSerialNumber,
          clientName: job.clientName,
          commodity: job.commodity,
          plantLocation: job.plantLocation,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
        lots: job.lots.map((lot) => ({
          id: lot.id,
          lotNumber: lot.lotNumber,
          quantityMode: lot.quantityMode,
          totalBags: lot.totalBags,
          grossWeight: toNumber(lot.grossWeight),
          tareWeight: toNumber(lot.tareWeight),
          netWeight: toNumber(lot.netWeight),
          grossWeightKg: toNumber(lot.grossWeightKg),
          netWeightKg: toNumber(lot.netWeightKg),
          sealNumber: lot.sealNumber,
          status: lot.status,
          createdAt: lot.createdAt,
          updatedAt: lot.updatedAt,
          bags: lot.bags.map((bag) => ({
            id: bag.id,
            bagNumber: bag.bagNumber,
            grossWeight: toNumber(bag.grossWeight),
            netWeight: toNumber(bag.netWeight),
          })),
          sample: lot.sample
            ? {
                id: lot.sample.id,
                sampleCode: lot.sample.sampleCode,
                sampleStatus: lot.sample.sampleStatus,
                sampleType: lot.sample.sampleType,
                samplingMethod: lot.sample.samplingMethod,
                samplingDate: lot.sample.samplingDate,
                sampleQuantity: toNumber(lot.sample.sampleQuantity),
                sampleUnit: lot.sample.sampleUnit,
                containerType: lot.sample.containerType,
                homogenizedAt: lot.sample.homogenizedAt,
                readyForPacketingAt: lot.sample.readyForPacketingAt,
                createdAt: lot.sample.createdAt,
                updatedAt: lot.sample.updatedAt,
                sealLabel: lot.sample.sealLabel,
                media: lot.sample.media,
                events: lot.sample.events,
                packets: lot.sample.packets.map((packet) => ({
                  id: packet.id,
                  packetCode: packet.packetCode,
                  packetNo: packet.packetNo,
                  packetStatus: packet.packetStatus,
                  packetQuantity: toNumber(packet.packetQuantity),
                  packetUnit: packet.packetUnit,
                  packetType: packet.packetType,
                  readyAt: packet.readyAt,
                  createdAt: packet.createdAt,
                  updatedAt: packet.updatedAt,
                  sealLabel: packet.sealLabel,
                  media: packet.media,
                  allocation: packet.allocation,
                })),
              }
            : null,
        })),
        experiments: job.experiments.map((experiment) => ({
          id: experiment.id,
          title: experiment.title,
          status: experiment.status,
          createdAt: experiment.createdAt,
          trials: experiment.trials.map((trial) => ({
            id: trial.id,
            lotId: trial.lotId,
            packetId: trial.packetId,
            trialNumber: trial.trialNumber,
            notes: trial.notes,
            grossWeightKg: toNumber(trial.grossWeightKg),
            netWeightKg: toNumber(trial.netWeightKg),
            createdAt: trial.createdAt,
            measurements: trial.measurements.map((measurement) => ({
              id: measurement.id,
              element: measurement.element,
              value: toNumber(measurement.value),
              createdAt: measurement.createdAt,
            })),
          })),
        })),
      })
    ) as Prisma.InputJsonValue;

    // 3. Save snapshot (Immutable)
    const snapshot = await prisma.reportSnapshot.create({
      data: {
        jobId,
        data: snapshotData,
      },
    });

    return NextResponse.json(snapshot);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized", details: "Current user could not be resolved." }, { status: 401 });
    }

    authorize(currentUser, "READ_ONLY");

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      select: { companyId: true },
    });

    if (!job || job.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: "Forbidden", details: "Cross-company access is not allowed." }, { status: 403 });
    }

    const snapshots = await prisma.reportSnapshot.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(snapshots);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }

    const error = err instanceof Error ? err : new Error("Unknown error");
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }
}
