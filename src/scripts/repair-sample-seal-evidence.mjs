#!/usr/bin/env node
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const args = { execute: false, companyId: null };
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
  }
  return args;
}

async function run() {
  const { execute, companyId } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const where = {
      sealNumber: { not: null },
      ...(companyId ? { companyId } : {}),
    };
    const lots = await prisma.inspectionLot.findMany({
      where,
      select: {
        id: true,
        lotNumber: true,
        companyId: true,
        sealNumber: true,
        sample: {
          select: {
            id: true,
            sampleCode: true,
            sealLabel: {
              select: {
                sealNo: true,
                sealedAt: true,
                sealStatus: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const impacted = lots
      .filter((lot) => lot.sample?.id)
      .filter((lot) => {
        const label = lot.sample?.sealLabel;
        const lotSeal = lot.sealNumber?.trim();
        if (!lotSeal) return false;
        if (!label) return true;
        if (!label.sealNo) return true;
        if (!label.sealedAt) return true;
        if (label.sealNo !== lotSeal) return true;
        return false;
      })
      .map((lot) => ({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        sampleId: lot.sample.id,
        sampleCode: lot.sample.sampleCode,
        sealNumber: lot.sealNumber,
        currentSealNo: lot.sample.sealLabel?.sealNo ?? null,
        currentSealedAt: lot.sample.sealLabel?.sealedAt ?? null,
      }));

    console.log(
      `[repair-sample-seal-evidence] mode=${execute ? "execute" : "dry-run"} companyId=${companyId ?? "all"} impacted=${impacted.length}`,
    );
    if (impacted.length > 0) {
      console.table(
        impacted.map((entry) => ({
          lotNumber: entry.lotNumber,
          sampleCode: entry.sampleCode ?? "Not Available",
          lotSeal: entry.sealNumber,
          sampleSeal: entry.currentSealNo ?? "Missing",
          sealedAt: entry.currentSealedAt ?? "Missing",
        })),
      );
    }

    if (!execute || impacted.length === 0) {
      return;
    }

    await prisma.$transaction(
      impacted.map((entry) =>
        prisma.sampleSealLabel.upsert({
          where: { sampleId: entry.sampleId },
          update: {
            sealNo: entry.sealNumber,
            sealedAt: entry.currentSealedAt ?? new Date(),
            sealStatus: "COMPLETED",
          },
          create: {
            sampleId: entry.sampleId,
            sealNo: entry.sealNumber,
            sealedAt: new Date(),
            sealStatus: "COMPLETED",
          },
        }),
      ),
    );

    console.log(`[repair-sample-seal-evidence] repaired ${impacted.length} sample seal labels.`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error("[repair-sample-seal-evidence] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
