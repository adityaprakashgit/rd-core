-- Prevent duplicate initial R&D jobs for the same packet.
-- Retest lineage continues to use previousRndJobId and is not affected.
CREATE UNIQUE INDEX IF NOT EXISTS "RndJob_packetId_initial_key"
ON "RndJob"("packetId")
WHERE "previousRndJobId" IS NULL;
