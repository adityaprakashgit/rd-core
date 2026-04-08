import fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STUCK_HOURS = Number.parseInt(process.env.EVIDENCE_STUCK_HOURS ?? "", 10) || 24;
const LOOKBACK_HOURS = Number.parseInt(process.env.EVIDENCE_TELEMETRY_LOOKBACK_HOURS ?? "", 10) || 24;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toEventCounts(logs) {
  const counts = {
    upload_attempt: 0,
    upload_success: 0,
    upload_failed: 0,
    stage_complete: 0,
  };

  for (const log of logs) {
    const metadata = asObject(log.metadata);
    const eventName = typeof metadata.event === "string" ? metadata.event : "";
    if (Object.prototype.hasOwnProperty.call(counts, eventName)) {
      counts[eventName] += 1;
    }
  }

  return counts;
}

async function main() {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const stuckCutoff = new Date(now.getTime() - STUCK_HOURS * 60 * 60 * 1000);

  const [telemetryLogs, stuckJobs, stuckLots] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        entity: "EVIDENCE_FUNNEL",
        createdAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.inspectionJob.findMany({
      where: {
        status: {
          notIn: ["COMPLETED", "DISPATCHED"],
        },
        updatedAt: {
          lt: stuckCutoff,
        },
      },
      select: {
        id: true,
        companyId: true,
        jobReferenceNumber: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),
    prisma.inspectionLot.findMany({
      where: {
        status: {
          not: "COMPLETED",
        },
        updatedAt: {
          lt: stuckCutoff,
        },
      },
      select: {
        id: true,
        companyId: true,
        jobId: true,
        lotNumber: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),
  ]);

  const report = {
    generatedAt: now.toISOString(),
    window: {
      lookbackHours: LOOKBACK_HOURS,
      from: since.toISOString(),
      to: now.toISOString(),
    },
    events: toEventCounts(telemetryLogs),
    stuckThresholdHours: STUCK_HOURS,
    stuck: {
      jobsCount: stuckJobs.length,
      lotsCount: stuckLots.length,
      jobs: stuckJobs,
      lots: stuckLots,
    },
  };

  const reportDir = path.join(process.cwd(), "reports", "evidence-funnel");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `daily-${now.toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({ ok: true, reportFile, summary: report.events }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
