-- Add seal and traceability fields to InspectionLot
ALTER TABLE "InspectionLot"
  ADD COLUMN IF NOT EXISTS "sealNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "sealAuto" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "grossWeight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tareWeight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "netWeight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "bagPhotoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "samplingPhotoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sealPhotoUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InspectionLot_sealNumber_key" ON "InspectionLot"("sealNumber");
CREATE INDEX IF NOT EXISTS "InspectionLot_companyId_sealNumber_idx" ON "InspectionLot"("companyId", "sealNumber");
