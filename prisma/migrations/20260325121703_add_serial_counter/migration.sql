/*
  Warnings:

  - A unique constraint covering the columns `[inspectionSerialNumber]` on the table `InspectionJob` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InspectionJob" ADD COLUMN     "inspectionSerialNumber" TEXT;

-- CreateTable
CREATE TABLE "SerialCounter" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL,

    CONSTRAINT "SerialCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerialCounter_year_key" ON "SerialCounter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionJob_inspectionSerialNumber_key" ON "InspectionJob"("inspectionSerialNumber");
