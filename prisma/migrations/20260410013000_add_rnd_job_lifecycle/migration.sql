CREATE TYPE "RndJobStatus" AS ENUM (
  'CREATED',
  'READY_FOR_TEST_SETUP',
  'READY_FOR_TESTING',
  'IN_TESTING',
  'AWAITING_REVIEW',
  'APPROVED',
  'COMPLETED',
  'REWORK_REQUIRED'
);

CREATE TYPE "RndJobType" AS ENUM (
  'INITIAL_TEST',
  'RETEST',
  'CLIENT_REQUESTED_RETEST',
  'BACKUP_TEST',
  'RETAIN_TEST'
);

CREATE TYPE "RndReviewAction" AS ENUM (
  'APPROVE',
  'REJECT',
  'REWORK'
);

CREATE TABLE "RndJob" (
  "id" TEXT NOT NULL,
  "rndJobNumber" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "parentJobId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "packetId" TEXT NOT NULL,
  "previousRndJobId" TEXT,
  "status" "RndJobStatus" NOT NULL DEFAULT 'CREATED',
  "jobType" "RndJobType" NOT NULL DEFAULT 'INITIAL_TEST',
  "packetUse" TEXT,
  "testType" TEXT,
  "testMethod" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "deadline" TIMESTAMP(3),
  "assignedToId" TEXT,
  "approverUserId" TEXT,
  "remarks" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "testingStartedAt" TIMESTAMP(3),
  "resultsSubmittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RndJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RndJobReading" (
  "id" TEXT NOT NULL,
  "rndJobId" TEXT NOT NULL,
  "parameter" TEXT NOT NULL,
  "value" DECIMAL(65,30) NOT NULL,
  "unit" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RndJobReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RndJobAttachment" (
  "id" TEXT NOT NULL,
  "rndJobId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSizeBytes" INTEGER,
  "notes" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RndJobAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RndJobReview" (
  "id" TEXT NOT NULL,
  "rndJobId" TEXT NOT NULL,
  "action" "RndReviewAction" NOT NULL,
  "notes" TEXT,
  "reviewedById" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RndJobReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RndJob_rndJobNumber_key" ON "RndJob"("rndJobNumber");
CREATE INDEX "RndJob_companyId_status_receivedAt_idx" ON "RndJob"("companyId", "status", "receivedAt" DESC);
CREATE INDEX "RndJob_companyId_assignedToId_idx" ON "RndJob"("companyId", "assignedToId");
CREATE INDEX "RndJob_companyId_approverUserId_idx" ON "RndJob"("companyId", "approverUserId");
CREATE INDEX "RndJob_parentJobId_createdAt_idx" ON "RndJob"("parentJobId", "createdAt" DESC);
CREATE INDEX "RndJob_packetId_idx" ON "RndJob"("packetId");
CREATE INDEX "RndJobReading_rndJobId_createdAt_idx" ON "RndJobReading"("rndJobId", "createdAt");
CREATE INDEX "RndJobAttachment_rndJobId_createdAt_idx" ON "RndJobAttachment"("rndJobId", "createdAt");
CREATE INDEX "RndJobReview_rndJobId_reviewedAt_idx" ON "RndJobReview"("rndJobId", "reviewedAt" DESC);

ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_parentJobId_fkey"
  FOREIGN KEY ("parentJobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_sampleId_fkey"
  FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_packetId_fkey"
  FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_previousRndJobId_fkey"
  FOREIGN KEY ("previousRndJobId") REFERENCES "RndJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RndJobReading"
  ADD CONSTRAINT "RndJobReading_rndJobId_fkey"
  FOREIGN KEY ("rndJobId") REFERENCES "RndJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RndJobAttachment"
  ADD CONSTRAINT "RndJobAttachment_rndJobId_fkey"
  FOREIGN KEY ("rndJobId") REFERENCES "RndJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RndJobAttachment"
  ADD CONSTRAINT "RndJobAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RndJobReview"
  ADD CONSTRAINT "RndJobReview_rndJobId_fkey"
  FOREIGN KEY ("rndJobId") REFERENCES "RndJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RndJobReview"
  ADD CONSTRAINT "RndJobReview_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH source_packets AS (
  SELECT
    p."id" AS packet_id,
    p."companyId" AS company_id,
    p."jobId" AS parent_job_id,
    p."lotId" AS lot_id,
    p."sampleId" AS sample_id,
    p."packetType" AS packet_use,
    COALESCE(p."submittedToRndAt", p."updatedAt", p."createdAt") AS received_at,
    j."deadline" AS deadline,
    COALESCE(j."handedOverToRndTo", j."assignedToId") AS assigned_to_id,
    j."createdByUserId" AS created_by_user_id,
    j."status" AS parent_status,
    EXISTS (
      SELECT 1
      FROM "RDTrial" t
      JOIN "RDMeasurement" m ON m."trialId" = t."id"
      WHERE t."packetId" = p."id"
    ) AS has_measurements,
    EXISTS (
      SELECT 1
      FROM "RDTrial" t
      WHERE t."packetId" = p."id"
    ) AS has_trial,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM COALESCE(p."submittedToRndAt", p."updatedAt", p."createdAt"))
      ORDER BY COALESCE(p."submittedToRndAt", p."updatedAt", p."createdAt"), p."id"
    ) AS seq,
    EXTRACT(YEAR FROM COALESCE(p."submittedToRndAt", p."updatedAt", p."createdAt"))::int AS received_year
  FROM "Packet" p
  JOIN "InspectionJob" j ON j."id" = p."jobId"
  WHERE p."submittedToRndAt" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "RndJob" rj
      WHERE rj."packetId" = p."id"
    )
), inserted AS (
  INSERT INTO "RndJob" (
    "id",
    "rndJobNumber",
    "companyId",
    "parentJobId",
    "lotId",
    "sampleId",
    "packetId",
    "status",
    "jobType",
    "packetUse",
    "priority",
    "deadline",
    "assignedToId",
    "receivedAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    ('rnd_' || md5(packet_id || ':' || seq::text))::text,
    ('RND-' || received_year::text || '-' || LPAD(seq::text, 4, '0'))::text,
    company_id,
    parent_job_id,
    lot_id,
    sample_id,
    packet_id,
    CASE
      WHEN parent_status IN ('LOCKED', 'REPORT_READY', 'COMPLETED', 'DISPATCHED') THEN 'COMPLETED'::"RndJobStatus"
      WHEN has_measurements THEN 'AWAITING_REVIEW'::"RndJobStatus"
      WHEN has_trial THEN 'IN_TESTING'::"RndJobStatus"
      WHEN packet_use IS NOT NULL THEN 'READY_FOR_TESTING'::"RndJobStatus"
      ELSE 'READY_FOR_TEST_SETUP'::"RndJobStatus"
    END,
    'INITIAL_TEST'::"RndJobType",
    packet_use,
    'MEDIUM',
    deadline,
    assigned_to_id,
    received_at,
    received_at,
    NOW()
  FROM source_packets
  RETURNING "id", "parentJobId"
)
INSERT INTO "AuditLog" (
  "id",
  "jobId",
  "userId",
  "entity",
  "action",
  "notes",
  "metadata",
  "createdAt"
)
SELECT
  ('audit_' || md5(i."id" || ':' || i."parentJobId"))::text,
  i."parentJobId",
  j."createdByUserId",
  'RND_JOB',
  'RND_JOB_BACKFILLED',
  'Backfilled R&D job from historical packet handover.',
  jsonb_build_object('rndJobId', i."id", 'backfill', true),
  NOW()
FROM inserted i
JOIN "InspectionJob" j ON j."id" = i."parentJobId";
