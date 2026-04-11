CREATE TYPE "PacketUsageEntryType" AS ENUM (
  'ALLOCATE',
  'CONSUME',
  'RELEASE',
  'RECLASSIFY',
  'ADJUST'
);

CREATE TYPE "PacketUsageDirection" AS ENUM (
  'IN',
  'OUT'
);

CREATE TYPE "ResultPrecedenceStatus" AS ENUM (
  'ACTIVE',
  'SUPERSEDED'
);

ALTER TABLE "RndJob"
ADD COLUMN "resultPrecedence" "ResultPrecedenceStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "PacketUsageLedger" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "packetId" TEXT NOT NULL,
  "rndJobId" TEXT,
  "entryType" "PacketUsageEntryType" NOT NULL,
  "useType" TEXT,
  "quantity" DECIMAL(65,30) NOT NULL,
  "unit" TEXT NOT NULL,
  "direction" "PacketUsageDirection" NOT NULL,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PacketUsageLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PacketUsageLedger_companyId_packetId_createdAt_idx"
ON "PacketUsageLedger"("companyId", "packetId", "createdAt" DESC);

CREATE INDEX "PacketUsageLedger_rndJobId_createdAt_idx"
ON "PacketUsageLedger"("rndJobId", "createdAt" DESC);

ALTER TABLE "PacketUsageLedger"
  ADD CONSTRAINT "PacketUsageLedger_packetId_fkey"
  FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PacketUsageLedger"
  ADD CONSTRAINT "PacketUsageLedger_rndJobId_fkey"
  FOREIGN KEY ("rndJobId") REFERENCES "RndJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PacketUsageLedger"
  ADD CONSTRAINT "PacketUsageLedger_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
