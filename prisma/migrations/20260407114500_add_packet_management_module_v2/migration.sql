-- Packet management anchored to Sample records
CREATE TABLE "Packet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "packetCode" TEXT NOT NULL,
    "packetNo" INTEGER NOT NULL,
    "packetStatus" TEXT NOT NULL DEFAULT 'CREATED',
    "packetQuantity" DOUBLE PRECISION,
    "packetUnit" TEXT,
    "packetType" TEXT,
    "remarks" TEXT,
    "readyAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Packet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PacketEvent" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT,
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacketEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PacketMedia" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacketMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PacketSealLabel" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "sealNo" TEXT,
    "labelText" TEXT,
    "labelCode" TEXT,
    "sealStatus" TEXT DEFAULT 'PENDING',
    "sealedAt" TIMESTAMP(3),
    "labeledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketSealLabel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PacketAllocation" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "allocationStatus" TEXT NOT NULL DEFAULT 'BLOCKED',
    "allocatedToType" TEXT,
    "allocatedToId" TEXT,
    "allocatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketAllocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RDTrial" ADD COLUMN "packetId" TEXT;

CREATE UNIQUE INDEX "Packet_packetCode_key" ON "Packet"("packetCode");
CREATE UNIQUE INDEX "Packet_sampleId_packetNo_key" ON "Packet"("sampleId", "packetNo");
CREATE INDEX "Packet_companyId_packetStatus_idx" ON "Packet"("companyId", "packetStatus");
CREATE INDEX "Packet_jobId_createdAt_idx" ON "Packet"("jobId", "createdAt");
CREATE INDEX "Packet_sampleId_packetStatus_idx" ON "Packet"("sampleId", "packetStatus");

CREATE INDEX "PacketEvent_packetId_eventTime_idx" ON "PacketEvent"("packetId", "eventTime");
CREATE INDEX "PacketEvent_eventType_eventTime_idx" ON "PacketEvent"("eventType", "eventTime");

CREATE INDEX "PacketMedia_packetId_capturedAt_idx" ON "PacketMedia"("packetId", "capturedAt");
CREATE INDEX "PacketMedia_packetId_mediaType_idx" ON "PacketMedia"("packetId", "mediaType");

CREATE UNIQUE INDEX "PacketSealLabel_packetId_key" ON "PacketSealLabel"("packetId");

CREATE UNIQUE INDEX "PacketAllocation_packetId_key" ON "PacketAllocation"("packetId");
CREATE INDEX "PacketAllocation_allocationStatus_allocatedAt_idx" ON "PacketAllocation"("allocationStatus", "allocatedAt");

CREATE UNIQUE INDEX "RDTrial_packetId_key" ON "RDTrial"("packetId");

ALTER TABLE "Packet" ADD CONSTRAINT "Packet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PacketEvent" ADD CONSTRAINT "PacketEvent_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PacketEvent" ADD CONSTRAINT "PacketEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PacketMedia" ADD CONSTRAINT "PacketMedia_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PacketMedia" ADD CONSTRAINT "PacketMedia_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PacketSealLabel" ADD CONSTRAINT "PacketSealLabel_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PacketAllocation" ADD CONSTRAINT "PacketAllocation_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RDTrial" ADD CONSTRAINT "RDTrial_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
