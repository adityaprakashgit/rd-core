import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function syncSampleSealTraceability(
  tx: PrismaLike,
  input: {
    sampleId: string;
    sealNumber?: string | null;
    sealedAt?: Date;
  },
) {
  const sealNo = input.sealNumber?.trim();
  if (!sealNo) {
    return false;
  }

  const sample = await tx.sample.findUnique({
    where: { id: input.sampleId },
    select: {
      id: true,
      sealLabel: {
        select: {
          sealNo: true,
          sealedAt: true,
        },
      },
    },
  });

  if (!sample) {
    return false;
  }

  if (sample.sealLabel?.sealNo === sealNo && sample.sealLabel?.sealedAt) {
    return false;
  }

  await tx.sampleSealLabel.upsert({
    where: { sampleId: sample.id },
    update: {
      sealNo,
      sealedAt: sample.sealLabel?.sealedAt ?? input.sealedAt ?? new Date(),
      sealStatus: "COMPLETED",
    },
    create: {
      sampleId: sample.id,
      sealNo,
      sealedAt: input.sealedAt ?? new Date(),
      sealStatus: "COMPLETED",
    },
  });

  return true;
}
