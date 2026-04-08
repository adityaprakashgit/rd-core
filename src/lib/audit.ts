import type { Prisma } from "@prisma/client";

export async function recordAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    jobId: string;
    userId: string;
    entity: string;
    action: string;
    from?: string | null;
    to?: string | null;
    notes?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({
    data: {
      jobId: input.jobId,
      userId: input.userId,
      entity: input.entity,
      action: input.action,
      from: input.from,
      to: input.to,
      notes: input.notes,
      metadata: input.metadata,
    },
  });
}
