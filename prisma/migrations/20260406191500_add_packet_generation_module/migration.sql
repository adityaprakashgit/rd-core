ALTER TABLE "SamplePacket"
ADD COLUMN "packetCode" TEXT,
ADD COLUMN "packetStatus" TEXT NOT NULL DEFAULT 'READY',
ADD COLUMN "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "usedAt" TIMESTAMP(3);

UPDATE "SamplePacket"
SET "packetCode" = CONCAT('PKT-', UPPER(SUBSTRING("sampleId" FROM 1 FOR 6)), '-', LPAD("packetNumber"::text, 4, '0'))
WHERE "packetCode" IS NULL;

ALTER TABLE "SamplePacket"
ALTER COLUMN "packetCode" SET NOT NULL;

CREATE UNIQUE INDEX "SamplePacket_packetCode_key" ON "SamplePacket"("packetCode");
