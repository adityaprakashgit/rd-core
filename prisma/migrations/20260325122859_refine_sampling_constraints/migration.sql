-- CreateTable
CREATE TABLE "Sampling" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "beforePhotoUrl" TEXT,
    "duringPhotoUrl" TEXT,
    "afterPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sampling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomogeneousSample" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoUrl" TEXT,

    CONSTRAINT "HomogeneousSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamplePacket" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "packetNumber" INTEGER NOT NULL,

    CONSTRAINT "SamplePacket_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sampling" ADD CONSTRAINT "Sampling_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomogeneousSample" ADD CONSTRAINT "HomogeneousSample_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamplePacket" ADD CONSTRAINT "SamplePacket_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "HomogeneousSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
