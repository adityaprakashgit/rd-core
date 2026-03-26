-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATIONS', 'RND', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- Seed bootstrap users for the control tower and audit system
INSERT INTO "User" ("id", "companyId", "email", "role", "isActive", "createdAt", "updatedAt")
VALUES
    ('user1', 'test', 'admin@test.local', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ops1', 'test', 'ops@test.local', 'OPERATIONS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rnd1', 'test', 'rnd@test.local', 'RND', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('viewer1', 'test', 'viewer@test.local', 'VIEWER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('SYSTEM', 'test', 'system@test.local', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "UserProfile" ("id", "userId", "displayName", "companyName", "jobTitle", "avatarUrl", "createdAt", "updatedAt")
VALUES
    ('profile-user1', 'user1', 'Aditya Prakash', 'Aditya Test', 'Control Tower Admin', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('profile-ops1', 'ops1', 'Operations User', 'Aditya Test', 'Operations', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('profile-rnd1', 'rnd1', 'R&D User', 'Aditya Test', 'R&D', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('profile-viewer1', 'viewer1', 'Viewer User', 'Aditya Test', 'Viewer', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AlterTable
ALTER TABLE "InspectionJob"
    ADD COLUMN "assignedToId" TEXT,
    ADD COLUMN "assignedById" TEXT,
    ADD COLUMN "assignedAt" TIMESTAMP(3),
    ALTER COLUMN "status" SET DEFAULT 'PENDING';

UPDATE "InspectionJob"
SET "status" = 'PENDING'
WHERE "status" = 'CREATED';

-- AlterTable
ALTER TABLE "InspectionLot"
    ADD COLUMN "companyId" TEXT,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "assignedToId" TEXT,
    ADD COLUMN "assignedById" TEXT,
    ADD COLUMN "assignedAt" TIMESTAMP(3);

UPDATE "InspectionLot" lot
SET "companyId" = job."companyId"
FROM "InspectionJob" job
WHERE lot."jobId" = job."id";

ALTER TABLE "InspectionLot"
    ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Sampling"
    ADD COLUMN "companyId" TEXT,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "assignedToId" TEXT,
    ADD COLUMN "assignedById" TEXT,
    ADD COLUMN "assignedAt" TIMESTAMP(3);

UPDATE "Sampling" sampling
SET "companyId" = lot."companyId"
FROM "InspectionLot" lot
WHERE sampling."lotId" = lot."id";

ALTER TABLE "Sampling"
    ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog"
    ADD COLUMN "entity" TEXT NOT NULL DEFAULT 'JOB',
    ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "InspectionJob_companyId_idx" ON "InspectionJob"("companyId");

-- CreateIndex
CREATE INDEX "InspectionJob_companyId_assignedToId_idx" ON "InspectionJob"("companyId", "assignedToId");

-- CreateIndex
CREATE INDEX "InspectionJob_createdByUserId_idx" ON "InspectionJob"("createdByUserId");

-- CreateIndex
CREATE INDEX "InspectionLot_companyId_idx" ON "InspectionLot"("companyId");

-- CreateIndex
CREATE INDEX "InspectionLot_companyId_assignedToId_idx" ON "InspectionLot"("companyId", "assignedToId");

-- CreateIndex
CREATE INDEX "Sampling_companyId_idx" ON "Sampling"("companyId");

-- CreateIndex
CREATE INDEX "Sampling_companyId_assignedToId_idx" ON "Sampling"("companyId", "assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionLot" ADD CONSTRAINT "InspectionLot_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionLot" ADD CONSTRAINT "InspectionLot_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sampling" ADD CONSTRAINT "Sampling_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sampling" ADD CONSTRAINT "Sampling_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
