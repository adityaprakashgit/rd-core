#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const out = {
    jobIds: [],
    mode: "repair",
    execute: false,
    dryRun: true,
    confirmToken: "",
    backupPath: "",
  };

  for (const arg of argv) {
    if (arg === "--execute") {
      out.execute = true;
      out.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      out.dryRun = true;
      out.execute = false;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length).trim().toLowerCase();
      if (value === "repair" || value === "destructive") {
        out.mode = value;
      }
      continue;
    }
    if (arg.startsWith("--jobIds=")) {
      const value = arg.slice("--jobIds=".length);
      out.jobIds.push(
        ...value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (arg.startsWith("--jobId=")) {
      const value = arg.slice("--jobId=".length).trim();
      if (value) out.jobIds.push(value);
      continue;
    }
    if (arg.startsWith("--confirm-token=")) {
      out.confirmToken = arg.slice("--confirm-token=".length).trim();
      continue;
    }
    if (arg.startsWith("--backup-path=")) {
      out.backupPath = arg.slice("--backup-path=".length).trim();
    }
  }

  out.jobIds = Array.from(new Set(out.jobIds));
  return out;
}

function expectedConfirmToken(jobIds) {
  const base = [...jobIds].sort().join(",");
  return createHash("sha256").update(base).digest("hex").slice(0, 12);
}

async function fetchSnapshot(jobIds) {
  const jobs = await prisma.inspectionJob.findMany({
    where: { id: { in: jobIds } },
    select: {
      id: true,
      companyId: true,
      inspectionSerialNumber: true,
      jobReferenceNumber: true,
      status: true,
      createdAt: true,
    },
  });
  const resolvedJobIds = jobs.map((job) => job.id);

  const [lots, inspections, samples, packets, mediaFiles, audits, escalations, rndJobs, reportSnapshots] = await Promise.all([
    prisma.inspectionLot.findMany({
      where: { jobId: { in: resolvedJobIds } },
      select: {
        id: true,
        jobId: true,
        lotNumber: true,
        status: true,
        sealNumber: true,
        bagPhotoUrl: true,
        createdAt: true,
      },
    }),
    prisma.inspection.findMany({
      where: { jobId: { in: resolvedJobIds } },
      select: { id: true, jobId: true, lotId: true, inspectionStatus: true, decisionStatus: true },
    }),
    prisma.sample.findMany({
      where: { jobId: { in: resolvedJobIds } },
      select: {
        id: true,
        jobId: true,
        lotId: true,
        sampleCode: true,
        sealLabel: {
          select: {
            id: true,
            sealNo: true,
            sealStatus: true,
            sealedAt: true,
          },
        },
      },
    }),
    prisma.packet.findMany({
      where: { jobId: { in: resolvedJobIds } },
      select: { id: true, jobId: true, lotId: true, sampleId: true, packetCode: true, packetStatus: true },
    }),
    prisma.mediaFile.findMany({
      where: {
        OR: [
          { jobId: { in: resolvedJobIds } },
          { lot: { jobId: { in: resolvedJobIds } } },
          { inspection: { jobId: { in: resolvedJobIds } } },
        ],
      },
      select: { id: true, jobId: true, lotId: true, inspectionId: true, category: true, storageKey: true },
    }),
    prisma.auditLog.count({ where: { jobId: { in: resolvedJobIds } } }),
    prisma.workflowEscalation.count({ where: { jobId: { in: resolvedJobIds } } }),
    prisma.rndJob.count({ where: { sourceJobId: { in: resolvedJobIds } } }),
    prisma.reportSnapshot.count({ where: { jobId: { in: resolvedJobIds } } }),
  ]);

  const inconsistentSealRows = lots
    .filter((lot) => Boolean(lot.sealNumber))
    .map((lot) => {
      const sample = samples.find((entry) => entry.lotId === lot.id) ?? null;
      const isInconsistent = Boolean(sample && !sample.sealLabel?.sealNo);
      return {
        jobId: lot.jobId,
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        sealNumber: lot.sealNumber,
        sampleId: sample?.id ?? null,
        sampleCode: sample?.sampleCode ?? null,
        inconsistent: isInconsistent,
      };
    })
    .filter((row) => row.inconsistent);

  return {
    jobs,
    resolvedJobIds,
    counts: {
      jobs: jobs.length,
      lots: lots.length,
      inspections: inspections.length,
      samples: samples.length,
      packets: packets.length,
      mediaFiles: mediaFiles.length,
      auditLogs: audits,
      workflowEscalations: escalations,
      rndJobs,
      reportSnapshots,
      inconsistentSeals: inconsistentSealRows.length,
    },
    rows: {
      lots,
      inspections,
      samples,
      packets,
      mediaFiles,
      inconsistentSealRows,
    },
  };
}

async function writeBackup(snapshot, explicitPath) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath =
    explicitPath && explicitPath.length > 0
      ? explicitPath
      : path.join(process.cwd(), "tmp", `workflow-cleanup-backup-${timestamp}.json`);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, JSON.stringify(snapshot, null, 2), "utf8");
  return backupPath;
}

async function runRepair(resolvedJobIds) {
  const lots = await prisma.inspectionLot.findMany({
    where: { jobId: { in: resolvedJobIds }, sealNumber: { not: null } },
    select: { id: true, lotNumber: true, jobId: true, sealNumber: true },
  });
  const samples = await prisma.sample.findMany({
    where: { jobId: { in: resolvedJobIds } },
    select: { id: true, lotId: true, sealLabel: { select: { sealNo: true, sealedAt: true } } },
  });

  const candidates = lots
    .map((lot) => {
      const sample = samples.find((entry) => entry.lotId === lot.id);
      if (!sample) return null;
      if (sample.sealLabel?.sealNo) return null;
      return {
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        sampleId: sample.id,
        sealNumber: lot.sealNumber,
        sealedAt: sample.sealLabel?.sealedAt ?? new Date(),
      };
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    return { repaired: 0, candidates: [] };
  }

  await prisma.$transaction(
    candidates.map((entry) =>
      prisma.sampleSealLabel.upsert({
        where: { sampleId: entry.sampleId },
        update: {
          sealNo: entry.sealNumber,
          sealedAt: entry.sealedAt,
          sealStatus: "COMPLETED",
        },
        create: {
          sampleId: entry.sampleId,
          sealNo: entry.sealNumber,
          sealedAt: entry.sealedAt,
          sealStatus: "COMPLETED",
        },
      }),
    ),
  );

  return { repaired: candidates.length, candidates };
}

async function runDestructiveDelete(resolvedJobIds) {
  const deleted = await prisma.inspectionJob.deleteMany({
    where: { id: { in: resolvedJobIds } },
  });
  return { deletedJobs: deleted.count };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.jobIds.length === 0) {
    throw new Error("Provide explicit target IDs via --jobIds=<job1,job2> (or repeated --jobId=).");
  }
  const mode = args.mode;
  const snapshot = await fetchSnapshot(args.jobIds);
  const token = expectedConfirmToken(snapshot.resolvedJobIds);
  const backupPath = await writeBackup(snapshot, args.backupPath);

  const report = {
    mode,
    dryRun: args.dryRun,
    execute: args.execute,
    targetRequestedJobIds: args.jobIds,
    targetResolvedJobIds: snapshot.resolvedJobIds,
    expectedConfirmToken: token,
    backupPath,
    counts: snapshot.counts,
  };

  if (args.dryRun || !args.execute) {
    console.log(JSON.stringify({ ...report, note: "Dry-run only. Re-run with --execute and --confirm-token=<token>." }, null, 2));
    return;
  }

  if (!args.confirmToken || args.confirmToken !== token) {
    throw new Error(
      `Confirmation token mismatch. Expected --confirm-token=${token} for resolved targets.`,
    );
  }

  const result =
    mode === "destructive"
      ? await runDestructiveDelete(snapshot.resolvedJobIds)
      : await runRepair(snapshot.resolvedJobIds);

  console.log(JSON.stringify({ ...report, result }, null, 2));
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
