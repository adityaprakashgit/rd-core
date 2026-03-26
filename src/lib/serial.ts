import { prisma } from "@/lib/prisma";

export async function generateInspectionSerial() {
  const year = new Date().getFullYear();

  const record = await prisma.serialCounter.upsert({
    where: { year },
    update: { counter: { increment: 1 } },
    create: { year, counter: 1 },
  });

  const padded = String(record.counter).padStart(4, "0");

  return `INS-${year}-${padded}`;
}
