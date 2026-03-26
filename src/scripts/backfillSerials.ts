import { prisma } from "@/lib/prisma";
import { generateInspectionSerial } from "@/lib/serial";

async function backfill() {
  const jobs = await prisma.inspectionJob.findMany({
    where: {
      inspectionSerialNumber: "",
    },
  });

  console.log(`Found ${jobs.length} jobs to backfill`);

  for (const job of jobs) {
    const serial = await generateInspectionSerial();

    await prisma.inspectionJob.update({
      where: { id: job.id },
      data: {
        inspectionSerialNumber: serial,
      },
    });

    console.log(`Updated job ${job.id} → ${serial}`);
  }

  console.log("Backfill complete");
}

backfill()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
