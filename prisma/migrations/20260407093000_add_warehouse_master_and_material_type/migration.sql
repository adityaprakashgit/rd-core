ALTER TABLE "ItemMaster" ADD COLUMN "materialType" TEXT;

ALTER TABLE "InspectionJob" ADD COLUMN "materialType" TEXT;

CREATE TABLE "WarehouseMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseMaster_companyId_warehouseName_key" ON "WarehouseMaster"("companyId", "warehouseName");
CREATE INDEX "WarehouseMaster_companyId_idx" ON "WarehouseMaster"("companyId");
