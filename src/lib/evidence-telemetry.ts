import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EvidenceTelemetryEvent =
  | "upload_attempt"
  | "upload_success"
  | "upload_failed"
  | "stage_complete";

type EvidenceTelemetrySink = "AUDIT_LOG" | "CONSOLE";

export type EvidenceTelemetryInput = {
  event: EvidenceTelemetryEvent;
  userId?: string | null;
  companyId?: string | null;
  jobId?: string | null;
  lotId?: string | null;
  inspectionId?: string | null;
  stage?: string | null;
  route?: string | null;
  source?: string | null;
  code?: string | null;
  details?: string | null;
  status?: number | null;
  category?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
};

type AuditWriter = {
  auditLog: {
    create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown>;
  };
};

function isTelemetryEnabled(raw = process.env.EVIDENCE_TELEMETRY_ENABLED): boolean {
  if (!raw) {
    return true;
  }
  return !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
}

function getTelemetrySink(raw = process.env.EVIDENCE_TELEMETRY_SINK): EvidenceTelemetrySink {
  const normalized = String(raw ?? "").trim().toUpperCase();
  if (normalized === "CONSOLE") {
    return "CONSOLE";
  }
  return "AUDIT_LOG";
}

async function resolveJobId(input: EvidenceTelemetryInput): Promise<string | null> {
  if (input.jobId) {
    return input.jobId;
  }

  if (input.lotId) {
    const lot = await prisma.inspectionLot.findUnique({
      where: { id: input.lotId },
      select: { jobId: true },
    });
    if (lot?.jobId) {
      return lot.jobId;
    }
  }

  if (input.inspectionId) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: input.inspectionId },
      select: { jobId: true },
    });
    if (inspection?.jobId) {
      return inspection.jobId;
    }
  }

  return null;
}

function buildMetadata(input: EvidenceTelemetryInput, resolvedJobId: string | null): Prisma.JsonObject {
  return {
    event: input.event,
    stage: input.stage ?? null,
    route: input.route ?? null,
    source: input.source ?? null,
    companyId: input.companyId ?? null,
    jobId: resolvedJobId,
    lotId: input.lotId ?? null,
    inspectionId: input.inspectionId ?? null,
    code: input.code ?? null,
    details: input.details ?? null,
    status: input.status ?? null,
    category: input.category ?? null,
    mimeType: input.mimeType ?? null,
    fileSizeBytes: input.fileSizeBytes ?? null,
    emittedAt: new Date().toISOString(),
  };
}

async function writeAuditTelemetry(
  writer: AuditWriter,
  input: EvidenceTelemetryInput,
  resolvedJobId: string | null,
): Promise<boolean> {
  if (!resolvedJobId || !input.userId) {
    return false;
  }

  await writer.auditLog.create({
    data: {
      jobId: resolvedJobId,
      userId: input.userId,
      entity: "EVIDENCE_FUNNEL",
      action: input.event.toUpperCase(),
      metadata: buildMetadata(input, resolvedJobId),
    },
  });

  return true;
}

function writeConsoleTelemetry(input: EvidenceTelemetryInput, resolvedJobId: string | null) {
  const metadata = buildMetadata(input, resolvedJobId);
  const payload = {
    channel: "evidence_funnel",
    ...metadata,
  };
  console.info(JSON.stringify(payload));
}

async function emitWithWriter(writer: AuditWriter, input: EvidenceTelemetryInput): Promise<void> {
  if (!isTelemetryEnabled()) {
    return;
  }

  const sink = getTelemetrySink();
  const resolvedJobId = await resolveJobId(input);

  if (sink === "AUDIT_LOG") {
    const written = await writeAuditTelemetry(writer, input, resolvedJobId);
    if (!written) {
      writeConsoleTelemetry(input, resolvedJobId);
    }
    return;
  }

  writeConsoleTelemetry(input, resolvedJobId);
}

export async function recordEvidenceTelemetryEvent(input: EvidenceTelemetryInput): Promise<void> {
  try {
    await emitWithWriter(prisma, input);
  } catch (error) {
    console.error("Failed to record evidence telemetry event", error);
  }
}

export async function recordEvidenceTelemetryEventInTx(
  tx: Prisma.TransactionClient,
  input: EvidenceTelemetryInput,
): Promise<void> {
  try {
    await emitWithWriter(tx, input);
  } catch (error) {
    console.error("Failed to record evidence telemetry event in transaction", error);
  }
}
