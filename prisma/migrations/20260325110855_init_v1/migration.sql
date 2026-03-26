-- CreateTable
CREATE TABLE "InspectionJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobReferenceNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "plantLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionLot" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "totalBags" INTEGER NOT NULL DEFAULT 1,
    "grossWeightKg" DECIMAL(65,30),
    "netWeightKg" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "lotId" TEXT,
    "category" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RDExperiment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RDExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RDTrial" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "lotId" TEXT,
    "trialNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "grossWeightKg" DECIMAL(65,30),
    "netWeightKg" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RDTrial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RDMeasurement" (
    "id" TEXT NOT NULL,
    "trialId" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RDMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionJob_jobReferenceNumber_key" ON "InspectionJob"("jobReferenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionLot_jobId_lotNumber_key" ON "InspectionLot"("jobId", "lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RDMeasurement_trialId_element_key" ON "RDMeasurement"("trialId", "element");

-- AddForeignKey
ALTER TABLE "InspectionLot" ADD CONSTRAINT "InspectionLot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RDExperiment" ADD CONSTRAINT "RDExperiment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RDTrial" ADD CONSTRAINT "RDTrial_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "RDExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RDTrial" ADD CONSTRAINT "RDTrial_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RDMeasurement" ADD CONSTRAINT "RDMeasurement_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "RDTrial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
