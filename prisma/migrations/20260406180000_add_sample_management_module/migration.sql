CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "sampleStatus" TEXT NOT NULL DEFAULT 'CREATED',
    "sampleType" TEXT,
    "samplingMethod" TEXT,
    "samplingDate" TIMESTAMP(3),
    "sampleQuantity" DOUBLE PRECISION,
    "sampleUnit" TEXT,
    "containerType" TEXT,
    "remarks" TEXT,
    "homogenizedAt" TIMESTAMP(3),
    "readyForPacketingAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SampleEvent" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT,
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SampleMedia" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SampleSealLabel" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sealNo" TEXT,
    "labelText" TEXT,
    "sealStatus" TEXT DEFAULT 'PENDING',
    "labeledAt" TIMESTAMP(3),
    "sealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleSealLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sample_lotId_key" ON "Sample"("lotId");
CREATE UNIQUE INDEX "Sample_inspectionId_key" ON "Sample"("inspectionId");
CREATE UNIQUE INDEX "Sample_sampleCode_key" ON "Sample"("sampleCode");
CREATE INDEX "Sample_companyId_sampleStatus_idx" ON "Sample"("companyId", "sampleStatus");
CREATE INDEX "Sample_jobId_createdAt_idx" ON "Sample"("jobId", "createdAt");

CREATE INDEX "SampleEvent_sampleId_eventTime_idx" ON "SampleEvent"("sampleId", "eventTime");
CREATE INDEX "SampleEvent_eventType_eventTime_idx" ON "SampleEvent"("eventType", "eventTime");

CREATE INDEX "SampleMedia_sampleId_capturedAt_idx" ON "SampleMedia"("sampleId", "capturedAt");
CREATE INDEX "SampleMedia_sampleId_mediaType_idx" ON "SampleMedia"("sampleId", "mediaType");

CREATE UNIQUE INDEX "SampleSealLabel_sampleId_key" ON "SampleSealLabel"("sampleId");

ALTER TABLE "Sample" ADD CONSTRAINT "Sample_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SampleEvent" ADD CONSTRAINT "SampleEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SampleEvent" ADD CONSTRAINT "SampleEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SampleMedia" ADD CONSTRAINT "SampleMedia_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SampleMedia" ADD CONSTRAINT "SampleMedia_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SampleSealLabel" ADD CONSTRAINT "SampleSealLabel_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
