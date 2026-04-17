#!/usr/bin/env node
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const args = { execute: false, companyId: null, jobId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--execute") {
      args.execute = true;
      continue;
    }
    if (token === "--companyId") {
      args.companyId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--jobId") {
      args.jobId = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return args;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && typeof value.toNumber === "function") {
    try {
      const parsed = value.toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function buildSnapshotData(job, nowIso) {
  const packetCount = job.samples.reduce((sum, sample) => sum + sample.packets.length, 0);
  const legacyTrialCount = job.experiments.reduce((sum, experiment) => sum + experiment.trials.length, 0);
  const trialCount = Math.max(legacyTrialCount, job.rndJobs.length);

  return JSON.parse(
    JSON.stringify({
      schemaVersion: "report_snapshot_v2",
      generatedAt: nowIso,
      summary: {
        lotCount: job.lots.length,
        sampleCount: job.samples.length,
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
      samples: job.samples.map((sample) => ({
        id: sample.id,
        sampleCode: sample.sampleCode,
        sampleStatus: sample.sampleStatus,
        sampleType: sample.sampleType,
        samplingMethod: sample.samplingMethod,
        samplingDate: sample.samplingDate,
        sampleQuantity: toNumber(sample.sampleQuantity),
        sampleUnit: sample.sampleUnit,
        containerType: sample.containerType,
        homogenizedAt: sample.homogenizedAt,
        readyForPacketingAt: sample.readyForPacketingAt,
        createdAt: sample.createdAt,
        updatedAt: sample.updatedAt,
        sealLabel: sample.sealLabel,
        media: sample.media,
        events: sample.events,
        packets: sample.packets.map((packet) => ({
          id: packet.id,
          packetCode: packet.packetCode,
          packetNo: packet.packetNo,
          packetStatus: packet.packetStatus,
          packetQuantity: toNumber(packet.packetQuantity),
          packetWeight: toNumber(packet.packetWeight),
          packetUnit: packet.packetUnit,
          packetType: packet.packetType,
          readyAt: packet.readyAt,
          createdAt: packet.createdAt,
          updatedAt: packet.updatedAt,
          sealLabel: packet.sealLabel,
          media: packet.media,
          allocation: packet.allocation,
        })),
      })),
      rndJobs: job.rndJobs.map((rndJob) => ({
        id: rndJob.id,
        rndJobNumber: rndJob.rndJobNumber,
        status: rndJob.status,
        resultPrecedence: rndJob.resultPrecedence,
        sampleId: rndJob.sampleId,
        packetId: rndJob.packetId,
        reviewedAt: rndJob.reviewedAt,
        completedAt: rndJob.completedAt,
        readings: rndJob.readings.map((reading) => ({
          id: reading.id,
          parameter: reading.parameter,
          value: toNumber(reading.value),
          unit: reading.unit,
          remarks: reading.remarks,
          createdAt: reading.createdAt,
        })),
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
    }),
  );
}

async function loadSnapshotSource(prisma, jobId) {
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
      samples: {
        orderBy: { createdAt: "desc" },
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
              packetWeight: true,
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
      rndJobs: {
        where: {
          resultPrecedence: "ACTIVE",
          status: { in: ["APPROVED", "COMPLETED"] },
        },
        orderBy: { reviewedAt: "desc" },
        select: {
          id: true,
          rndJobNumber: true,
          status: true,
          resultPrecedence: true,
          sampleId: true,
          packetId: true,
          reviewedAt: true,
          completedAt: true,
          readings: true,
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
    return null;
  }

  return job;
}

function groupEligibilityRows(rnds) {
  const groups = new Map();
  for (const rndJob of rnds) {
    const key = `${rndJob.companyId}:${rndJob.parentJobId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.jobs.push(rndJob);
    } else {
      groups.set(key, {
        companyId: rndJob.companyId,
        parentJobId: rndJob.parentJobId,
        jobs: [rndJob],
      });
    }
  }
  return [...groups.values()];
}

function printSummary(mode, companyId, rows) {
  console.log(
    `[repair-rnd-report-linkage] mode=${mode} companyId=${companyId ?? "all"} impacted=${rows.length}`,
  );
  if (rows.length > 0) {
    console.table(
      rows.map((row) => ({
        rndJobNumber: row.rndJobNumber,
        parentJobId: row.parentJobId,
        sampleIds: row.sampleIds.join(", "),
        snapshotId: row.snapshotId ?? "Missing",
        action: row.action,
      })),
    );
  }
}

async function run() {
  const { execute, companyId, jobId } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const where = {
      status: { in: ["APPROVED", "COMPLETED"] },
      ...(companyId ? { companyId } : {}),
      ...(jobId ? { id: jobId } : {}),
    };
    const jobs = await prisma.rndJob.findMany({
      where,
      select: {
        id: true,
        rndJobNumber: true,
        companyId: true,
        parentJobId: true,
        sampleId: true,
        status: true,
        reviewedAt: true,
        completedAt: true,
      },
      orderBy: [{ reviewedAt: "desc" }, { updatedAt: "desc" }],
    });

    const impacted = [];
    const groupedJobs = groupEligibilityRows(jobs);
    for (const group of groupedJobs) {
      const sampleIds = [...new Set(group.jobs.map((item) => item.sampleId))];
      const [activeVersions, snapshot] = await Promise.all([
        prisma.rndReportVersion.findMany({
          where: {
            companyId: group.companyId,
            parentJobId: group.parentJobId,
            sampleId: { in: sampleIds },
            precedence: "ACTIVE",
          },
          select: { id: true, sampleId: true, reportSnapshotId: true },
        }),
        prisma.reportSnapshot.findFirst({
          where: { jobId: group.parentJobId },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        }),
      ]);

      const activeSampleIds = new Set(activeVersions.map((version) => version.sampleId));
      const missingSampleIds = sampleIds.filter((sampleId) => !activeSampleIds.has(sampleId));

      if (missingSampleIds.length === 0) {
        continue;
      }

      impacted.push({
        rndJobId: group.jobs[0].id,
        rndJobNumber: group.jobs.map((item) => item.rndJobNumber).join(", "),
        companyId: group.companyId,
        parentJobId: group.parentJobId,
        sampleIds: missingSampleIds,
        snapshotId: snapshot?.id ?? null,
        action: snapshot
          ? (execute ? "link" : "would-link")
          : (execute ? "generate+link" : "would-generate+link"),
      });
    }

    printSummary(execute ? "execute" : "dry-run", companyId, impacted);

    if (!execute || impacted.length === 0) {
      return;
    }

    let repaired = 0;
    for (const row of impacted) {
      await prisma.$transaction(async (tx) => {
        let snapshotId = row.snapshotId;
        if (!snapshotId) {
          const snapshotSource = await loadSnapshotSource(tx, row.parentJobId);
          if (!snapshotSource) {
            console.log(
              `[repair-rnd-report-linkage] skipped ${row.parentJobId}/${row.sampleIds.join(",")}: parent job record missing.`,
            );
            return;
          }

          const snapshot = await tx.reportSnapshot.create({
            data: {
              jobId: row.parentJobId,
              data: buildSnapshotData(snapshotSource, new Date().toISOString()),
            },
          });
          snapshotId = snapshot.id;
        }

        await tx.rndReportVersion.createMany({
          data: row.sampleIds.map((sampleId) => ({
            companyId: row.companyId,
            parentJobId: row.parentJobId,
            sampleId,
            rndJobId: row.rndJobId,
            reportSnapshotId: snapshotId,
            precedence: "ACTIVE",
          })),
        });
        repaired += 1;
      });
    }

    console.log(
      `[repair-rnd-report-linkage] repaired ${repaired} lineage group(s) by ${impacted.some((row) => row.action === "generate+link") ? "generating/linking missing snapshots" : "linking existing snapshots"}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(
    "[repair-rnd-report-linkage] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
