-- Playground master tables

CREATE TABLE IF NOT EXISTS "rd_step_master" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "defaultDurationSeconds" INTEGER NOT NULL DEFAULT 600,
  "requiresTimer" BOOLEAN NOT NULL DEFAULT true,
  "allowsChemicals" BOOLEAN NOT NULL DEFAULT true,
  "allowsAssets" BOOLEAN NOT NULL DEFAULT true,
  "requiresAsset" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rd_step_master_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rd_step_master_companyId_idx" ON "rd_step_master"("companyId");

CREATE TABLE IF NOT EXISTS "rd_chemical_master" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "baseUnit" TEXT NOT NULL,
  "allowedUnits" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "location" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rd_chemical_master_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rd_chemical_master_companyId_idx" ON "rd_chemical_master"("companyId");

CREATE TABLE IF NOT EXISTS "rd_asset_master" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "location" TEXT NOT NULL DEFAULT '',
  "calibrationDate" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rd_asset_master_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rd_asset_master_companyId_idx" ON "rd_asset_master"("companyId");

CREATE TABLE IF NOT EXISTS "rd_unit_master" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "unitCode" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "conversionToBase" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rd_unit_master_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rd_unit_master_companyId_idx" ON "rd_unit_master"("companyId");

CREATE TABLE IF NOT EXISTS "rd_template_master" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "stepNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "expectedMeasurements" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rd_template_master_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rd_template_master_companyId_idx" ON "rd_template_master"("companyId");
