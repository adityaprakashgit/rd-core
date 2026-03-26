/*
  Warnings:

  - Made the column `inspectionSerialNumber` on table `InspectionJob` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "InspectionJob" ALTER COLUMN "inspectionSerialNumber" SET NOT NULL;
