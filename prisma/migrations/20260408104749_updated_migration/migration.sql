/*
  Warnings:

  - A unique constraint covering the columns `[jobId]` on the table `HomogeneousSample` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lotId,bagNumber]` on the table `InspectionBag` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ReportSnapshot_jobId_idx";

-- AlterTable
ALTER TABLE "InspectionLot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rd_chemical_master" ALTER COLUMN "allowedUnits" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rd_template_master" ALTER COLUMN "stepNames" DROP DEFAULT,
ALTER COLUMN "expectedMeasurements" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "HomogeneousSample_jobId_key" ON "HomogeneousSample"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionBag_lotId_bagNumber_key" ON "InspectionBag"("lotId", "bagNumber");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "InspectionChecklistResponse_inspectionId_checklistItemMasterId_" RENAME TO "InspectionChecklistResponse_inspectionId_checklistItemMaste_key";
