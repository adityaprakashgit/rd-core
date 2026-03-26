/*
  Warnings:

  - A unique constraint covering the columns `[sampleId,packetNumber]` on the table `SamplePacket` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lotId]` on the table `Sampling` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SamplePacket_sampleId_packetNumber_key" ON "SamplePacket"("sampleId", "packetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sampling_lotId_key" ON "Sampling"("lotId");
