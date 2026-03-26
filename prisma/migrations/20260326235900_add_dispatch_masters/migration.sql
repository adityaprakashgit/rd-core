CREATE TABLE IF NOT EXISTS "ClientMaster" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "billToAddress" TEXT NOT NULL,
  "shipToAddress" TEXT NOT NULL,
  "gstOrId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientMaster_companyId_clientName_key" ON "ClientMaster"("companyId", "clientName");
CREATE INDEX IF NOT EXISTS "ClientMaster_companyId_idx" ON "ClientMaster"("companyId");

CREATE TABLE IF NOT EXISTS "TransporterMaster" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "transporterName" TEXT NOT NULL,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gstOrId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransporterMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TransporterMaster_companyId_transporterName_key" ON "TransporterMaster"("companyId", "transporterName");
CREATE INDEX IF NOT EXISTS "TransporterMaster_companyId_idx" ON "TransporterMaster"("companyId");

CREATE TABLE IF NOT EXISTS "ItemMaster" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "description" TEXT,
  "uom" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ItemMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ItemMaster_companyId_itemName_key" ON "ItemMaster"("companyId", "itemName");
CREATE INDEX IF NOT EXISTS "ItemMaster_companyId_idx" ON "ItemMaster"("companyId");
