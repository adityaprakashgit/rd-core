import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const prisma = new PrismaClient();

const companyId = "test";
const actorUserId = "user1";
const imageBase = "https://picsum.photos/seed";

const urls = {
  bagWithLot: `${imageBase}/bag-with-lot/1200/900`,
  materialVisible: `${imageBase}/material-visible/1200/900`,
  samplingBefore: `${imageBase}/sampling-before/1200/900`,
  samplingDuring: `${imageBase}/sampling-during/1200/900`,
  samplingAfter: `${imageBase}/sampling-after/1200/900`,
  sealedBag: `${imageBase}/sealed-bag/1200/900`,
  bagCondition: `${imageBase}/bag-condition/1200/900`,
  homogeneous: `${imageBase}/homogeneous/1200/900`,
};

async function resetOperationalData() {
  await prisma.$transaction([
    prisma.rDMeasurement.deleteMany(),
    prisma.rDTrial.deleteMany(),
    prisma.rDExperiment.deleteMany(),
    prisma.samplePacket.deleteMany(),
    prisma.homogeneousSample.deleteMany(),
    prisma.reportSnapshot.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.mediaFile.deleteMany(),
    prisma.sampling.deleteMany(),
    prisma.inspectionBag.deleteMany(),
    prisma.inspectionLot.deleteMany(),
    prisma.inspectionJob.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.clientMaster.deleteMany(),
    prisma.transporterMaster.deleteMany(),
    prisma.itemMaster.deleteMany(),
    prisma.rDStepMaster.deleteMany(),
    prisma.rDChemicalMaster.deleteMany(),
    prisma.rDAssetMaster.deleteMany(),
    prisma.rDUnitMaster.deleteMany(),
    prisma.rDTemplateMaster.deleteMany(),
  ]);
}

async function seedSingleDemoRecord() {
  const now = new Date();

  const job = await prisma.inspectionJob.create({
    data: {
      id: "demo-job-1",
      companyId,
      inspectionSerialNumber: "INSP-DEMO-0001",
      jobReferenceNumber: "demo-job-ref-0001",
      clientName: "Acme Metals",
      commodity: "Copper Concentrate",
      plantLocation: "Warehouse Bay 3",
      status: "RND_RUNNING",
      createdByUserId: actorUserId,
      assignedToId: actorUserId,
      assignedById: actorUserId,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });

  const lot = await prisma.inspectionLot.create({
    data: {
      id: "demo-lot-1",
      jobId: job.id,
      companyId,
      lotNumber: "LOT-001",
      materialName: "Copper Concentrate Lot A",
      materialCategory: "Copper Concentrate",
      quantityMode: "SINGLE_PIECE",
      bagCount: 1,
      pieceCount: 1,
      totalBags: 1,
      grossWeight: 50,
      tareWeight: 2,
      netWeight: 48,
      weightUnit: "kg",
      remarks: "Single clean demo lot for the lab queue.",
      bagPhotoUrl: urls.bagWithLot,
      samplingPhotoUrl: urls.samplingDuring,
      sealPhotoUrl: urls.sealedBag,
      sealNumber: "1234567890123456",
      sealAuto: false,
      status: "READY_FOR_NEXT_STAGE",
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.inspectionBag.create({
    data: {
      id: "demo-bag-1",
      lotId: lot.id,
      bagNumber: 1,
      grossWeight: 50,
      netWeight: 48,
      createdAt: now,
    },
  });

  await prisma.sampling.create({
    data: {
      id: "demo-sampling-1",
      lotId: lot.id,
      companyId,
      beforePhotoUrl: urls.samplingBefore,
      duringPhotoUrl: urls.samplingDuring,
      afterPhotoUrl: urls.samplingAfter,
      status: "COMPLETED",
      createdAt: now,
    },
  });

  await prisma.mediaFile.createMany({
    data: [
      {
        id: "demo-media-1",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "BAG_WITH_LOT_NO",
        storageKey: urls.bagWithLot,
        fileName: "bag-with-lot.jpg",
        createdAt: now,
      },
      {
        id: "demo-media-2",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "MATERIAL_VISIBLE",
        storageKey: urls.materialVisible,
        fileName: "material-visible.jpg",
        createdAt: now,
      },
      {
        id: "demo-media-3",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "SAMPLING_IN_PROGRESS",
        storageKey: urls.samplingDuring,
        fileName: "sampling-during.jpg",
        createdAt: now,
      },
      {
        id: "demo-media-4",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "SEALED_BAG",
        storageKey: urls.sealedBag,
        fileName: "sealed-bag.jpg",
        createdAt: now,
      },
      {
        id: "demo-media-5",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "BAG_CONDITION",
        storageKey: urls.bagCondition,
        fileName: "bag-condition.jpg",
        createdAt: now,
      },
      {
        id: "demo-media-6",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "BEFORE",
        storageKey: urls.samplingBefore,
        fileName: "sampling-before.jpg",
        createdAt: now,
      },
      {
        id: "demo-media-7",
        companyId,
        jobId: job.id,
        lotId: lot.id,
        category: "AFTER",
        storageKey: urls.samplingAfter,
        fileName: "sampling-after.jpg",
        createdAt: now,
      },
    ],
  });

  const sample = await prisma.homogeneousSample.create({
    data: {
      id: "demo-sample-1",
      jobId: job.id,
      photoUrl: urls.homogeneous,
      createdAt: now,
    },
  });

  await prisma.samplePacket.create({
    data: {
      id: "demo-packet-1",
      sampleId: sample.id,
      packetNumber: 1,
    },
  });

  const experiment = await prisma.rDExperiment.create({
    data: {
      id: "demo-experiment-1",
      jobId: job.id,
      title: "Demo Lab Analytics",
      hypothesis: "Single seeded experiment for local workspace validation.",
      status: "ACTIVE",
      createdAt: now,
    },
  });

  const trial = await prisma.rDTrial.create({
    data: {
      id: "demo-trial-1",
      experimentId: experiment.id,
      lotId: lot.id,
      trialNumber: 1,
      notes: "Seeded trial",
      grossWeightKg: 50,
      netWeightKg: 48,
      createdAt: now,
    },
  });

  await prisma.rDMeasurement.create({
    data: {
      id: "demo-measurement-1",
      trialId: trial.id,
      element: "CU",
      value: 24.75,
      createdAt: now,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: "demo-audit-1",
        jobId: job.id,
        userId: actorUserId,
        entity: "JOB",
        action: "JOB_CREATED",
        to: "RND_RUNNING",
        notes: "Seeded demo job",
        createdAt: now,
      },
      {
        id: "demo-audit-2",
        jobId: job.id,
        userId: actorUserId,
        entity: "LOT",
        action: "LOT_CREATED",
        to: "READY_FOR_NEXT_STAGE",
        notes: "Seeded demo lot",
        createdAt: now,
      },
    ],
  });

  console.log(JSON.stringify({ jobId: job.id, lotId: lot.id, sampleId: sample.id, experimentId: experiment.id }, null, 2));
}

try {
  await resetOperationalData();
  await seedSingleDemoRecord();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
