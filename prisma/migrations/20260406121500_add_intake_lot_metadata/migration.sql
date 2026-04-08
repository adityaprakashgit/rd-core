-- Add richer intake metadata to InspectionLot for mobile-first intake flow
ALTER TABLE "InspectionLot"
  ADD COLUMN IF NOT EXISTS "materialName" TEXT,
  ADD COLUMN IF NOT EXISTS "materialCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "quantityMode" TEXT NOT NULL DEFAULT 'SINGLE_PIECE',
  ADD COLUMN IF NOT EXISTS "bagCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "pieceCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "weightUnit" TEXT,
  ADD COLUMN IF NOT EXISTS "remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "InspectionLot"
SET "updatedAt" = COALESCE("updatedAt", "createdAt");
