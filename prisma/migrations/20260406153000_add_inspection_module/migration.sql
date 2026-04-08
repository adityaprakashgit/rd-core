-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "inspectionStatus" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "decisionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "overallRemark" TEXT,
    "identityRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "packagingRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "materialRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "samplingBlockedFlag" BOOLEAN NOT NULL DEFAULT true,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistItemMaster" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "materialCategory" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistItemMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistResponse" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checklistItemMasterId" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "responseValue" TEXT,
    "responseText" TEXT,
    "isException" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionIssue" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "issueCategory" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionIssue_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MediaFile"
ADD COLUMN "inspectionId" TEXT,
ADD COLUMN "inspectionIssueId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_lotId_key" ON "Inspection"("lotId");

-- CreateIndex
CREATE INDEX "Inspection_jobId_createdAt_idx" ON "Inspection"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_createdAt_idx" ON "Inspection"("inspectorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistItemMaster_itemKey_key" ON "InspectionChecklistItemMaster"("itemKey");

-- CreateIndex
CREATE INDEX "InspectionChecklistItemMaster_isActive_displayOrder_idx" ON "InspectionChecklistItemMaster"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistResponse_inspectionId_checklistItemMasterId_key" ON "InspectionChecklistResponse"("inspectionId", "checklistItemMasterId");

-- CreateIndex
CREATE INDEX "InspectionChecklistResponse_inspectionId_displayOrder_idx" ON "InspectionChecklistResponse"("inspectionId", "displayOrder");

-- CreateIndex
CREATE INDEX "InspectionIssue_inspectionId_createdAt_idx" ON "InspectionIssue"("inspectionId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionIssue_inspectionId_status_idx" ON "InspectionIssue"("inspectionId", "status");

-- CreateIndex
CREATE INDEX "MediaFile_inspectionId_createdAt_idx" ON "MediaFile"("inspectionId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaFile_inspectionIssueId_createdAt_idx" ON "MediaFile"("inspectionIssueId", "createdAt");

-- AddForeignKey
ALTER TABLE "Inspection"
ADD CONSTRAINT "Inspection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection"
ADD CONSTRAINT "Inspection_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection"
ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistResponse"
ADD CONSTRAINT "InspectionChecklistResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistResponse"
ADD CONSTRAINT "InspectionChecklistResponse_checklistItemMasterId_fkey" FOREIGN KEY ("checklistItemMasterId") REFERENCES "InspectionChecklistItemMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionIssue"
ADD CONSTRAINT "InspectionIssue_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile"
ADD CONSTRAINT "MediaFile_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile"
ADD CONSTRAINT "MediaFile_inspectionIssueId_fkey" FOREIGN KEY ("inspectionIssueId") REFERENCES "InspectionIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
