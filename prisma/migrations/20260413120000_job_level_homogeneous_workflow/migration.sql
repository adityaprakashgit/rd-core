-- Convert post-inspection ownership to one job-level homogeneous sample.
-- Lot links are retained only as nullable historical compatibility fields.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Packet_lotId_fkey'
  ) THEN
    ALTER TABLE "Packet" DROP CONSTRAINT "Packet_lotId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RndJob_lotId_fkey'
  ) THEN
    ALTER TABLE "RndJob" DROP CONSTRAINT "RndJob_lotId_fkey";
  END IF;
END $$;

ALTER TABLE "Packet"
  ALTER COLUMN "lotId" DROP NOT NULL;

ALTER TABLE "RndJob"
  ALTER COLUMN "lotId" DROP NOT NULL;

-- Ensure every legacy HomogeneousSample has a canonical managed Sample row.
INSERT INTO "Sample" (
  "id",
  "companyId",
  "jobId",
  "lotId",
  "inspectionId",
  "sampleCode",
  "sampleStatus",
  "sampleType",
  "samplingMethod",
  "samplingDate",
  "sampleQuantity",
  "sampleUnit",
  "containerType",
  "remarks",
  "homogeneousProofDone",
  "homogenizedAt",
  "readyForPacketingAt",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('sample_', substr(md5(random()::text || clock_timestamp()::text || hs."id"), 1, 24)),
  j."companyId",
  hs."jobId",
  NULL,
  NULL,
  concat(coalesce(nullif(j."inspectionSerialNumber", ''), j."jobReferenceNumber", j."id"), '-HOMO'),
  'READY_FOR_PACKETING',
  'HOMOGENEOUS',
  'SCOOPS_FROM_ALL_LOTS',
  hs."createdAt",
  NULL,
  NULL,
  NULL,
  'Migrated from legacy homogeneous sample.',
  true,
  hs."createdAt",
  hs."createdAt",
  j."createdByUserId",
  hs."createdAt",
  CURRENT_TIMESTAMP
FROM "HomogeneousSample" hs
JOIN "InspectionJob" j ON j."id" = hs."jobId"
WHERE NOT EXISTS (
  SELECT 1 FROM "Sample" s WHERE s."jobId" = hs."jobId"
)
ON CONFLICT ("sampleCode") DO NOTHING;

CREATE TEMP TABLE "_SampleCanonical" ON COMMIT DROP AS
SELECT
  s."id",
  s."jobId",
  first_value(s."id") OVER (
    PARTITION BY s."jobId"
    ORDER BY
      CASE s."sampleStatus"
        WHEN 'READY_FOR_PACKETING' THEN 0
        WHEN 'SEALED' THEN 1
        WHEN 'HOMOGENIZED' THEN 2
        WHEN 'DETAILS_CAPTURED' THEN 3
        WHEN 'SAMPLING_IN_PROGRESS' THEN 4
        ELSE 5
      END,
      s."readyForPacketingAt" DESC NULLS LAST,
      s."homogenizedAt" DESC NULLS LAST,
      s."createdAt" ASC,
      s."id" ASC
  ) AS "canonicalId"
FROM "Sample" s;

-- Prevent packet number conflicts while reassigning packets from duplicate samples.
WITH impacted_jobs AS (
  SELECT "jobId"
  FROM "_SampleCanonical"
  GROUP BY "jobId"
  HAVING COUNT(*) > 1
),
ranked_packets AS (
  SELECT
    p."id",
    100000 + row_number() OVER (
      PARTITION BY p."jobId"
      ORDER BY p."createdAt", p."packetNo", p."id"
    ) AS "temporaryPacketNo"
  FROM "Packet" p
  JOIN impacted_jobs ij ON ij."jobId" = p."jobId"
)
UPDATE "Packet" p
SET "packetNo" = rp."temporaryPacketNo"
FROM ranked_packets rp
WHERE p."id" = rp."id";

UPDATE "Packet" p
SET "sampleId" = sc."canonicalId"
FROM "_SampleCanonical" sc
WHERE p."sampleId" = sc."id"
  AND sc."id" <> sc."canonicalId";

UPDATE "RndJob" r
SET "sampleId" = sc."canonicalId"
FROM "_SampleCanonical" sc
WHERE r."sampleId" = sc."id"
  AND sc."id" <> sc."canonicalId";

UPDATE "RndReportVersion" rrv
SET "sampleId" = sc."canonicalId"
FROM "_SampleCanonical" sc
WHERE rrv."sampleId" = sc."id"
  AND sc."id" <> sc."canonicalId";

UPDATE "SampleEvent" se
SET "sampleId" = sc."canonicalId"
FROM "_SampleCanonical" sc
WHERE se."sampleId" = sc."id"
  AND sc."id" <> sc."canonicalId";

UPDATE "SampleMedia" sm
SET "sampleId" = sc."canonicalId"
FROM "_SampleCanonical" sc
WHERE sm."sampleId" = sc."id"
  AND sc."id" <> sc."canonicalId";

WITH duplicate_labels AS (
  SELECT
    ssl."id",
    sc."canonicalId",
    row_number() OVER (
      PARTITION BY sc."canonicalId"
      ORDER BY ssl."sealedAt" DESC NULLS LAST, ssl."createdAt" DESC, ssl."id"
    ) AS rn,
    EXISTS (
      SELECT 1
      FROM "SampleSealLabel" canonical_ssl
      WHERE canonical_ssl."sampleId" = sc."canonicalId"
    ) AS canonical_has_label
  FROM "SampleSealLabel" ssl
  JOIN "_SampleCanonical" sc ON sc."id" = ssl."sampleId"
  WHERE sc."id" <> sc."canonicalId"
)
DELETE FROM "SampleSealLabel" ssl
USING duplicate_labels dl
WHERE ssl."id" = dl."id"
  AND (dl.canonical_has_label OR dl.rn > 1);

UPDATE "SampleSealLabel" ssl
SET "sampleId" = sc."canonicalId"
FROM "_SampleCanonical" sc
WHERE ssl."sampleId" = sc."id"
  AND sc."id" <> sc."canonicalId";

DELETE FROM "Sample" s
USING "_SampleCanonical" sc
WHERE s."id" = sc."id"
  AND sc."id" <> sc."canonicalId";

-- Bring legacy SamplePacket records under canonical Packet rows when they do not already exist.
INSERT INTO "Packet" (
  "id",
  "companyId",
  "jobId",
  "lotId",
  "sampleId",
  "packetCode",
  "packetNo",
  "packetStatus",
  "packetQuantity",
  "packetWeight",
  "packetUnit",
  "packetType",
  "remarks",
  "readyAt",
  "submittedToRndAt",
  "submittedToRndBy",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('packet_', substr(md5(random()::text || clock_timestamp()::text || sp."id"), 1, 24)),
  j."companyId",
  hs."jobId",
  NULL,
  s."id",
  sp."packetCode",
  200000 + row_number() OVER (
    PARTITION BY s."id"
    ORDER BY sp."packetNumber", sp."generatedAt", sp."id"
  ),
  CASE
    WHEN sp."usedAt" IS NOT NULL THEN 'USED'
    WHEN sp."packetStatus" = 'READY' THEN 'AVAILABLE'
    ELSE sp."packetStatus"
  END,
  NULL,
  NULL,
  NULL,
  'TESTING',
  'Migrated from legacy homogeneous packet.',
  CASE WHEN sp."packetStatus" = 'READY' THEN sp."generatedAt" ELSE NULL END,
  NULL,
  NULL,
  j."createdByUserId",
  sp."generatedAt",
  CURRENT_TIMESTAMP
FROM "SamplePacket" sp
JOIN "HomogeneousSample" hs ON hs."id" = sp."sampleId"
JOIN "InspectionJob" j ON j."id" = hs."jobId"
JOIN "Sample" s ON s."jobId" = hs."jobId"
WHERE NOT EXISTS (
  SELECT 1 FROM "Packet" p WHERE p."packetCode" = sp."packetCode"
);

WITH renumbered_packets AS (
  SELECT
    p."id",
    300000 + row_number() OVER (
      PARTITION BY p."sampleId"
      ORDER BY p."createdAt", p."packetNo", p."id"
    ) AS "temporaryPacketNo"
  FROM "Packet" p
)
UPDATE "Packet" p
SET "packetNo" = rp."temporaryPacketNo"
FROM renumbered_packets rp
WHERE p."id" = rp."id";

WITH final_packet_numbers AS (
  SELECT
    p."id",
    row_number() OVER (
      PARTITION BY p."sampleId"
      ORDER BY p."createdAt", p."packetNo", p."id"
    ) AS "packetNo"
  FROM "Packet" p
)
UPDATE "Packet" p
SET "packetNo" = fpn."packetNo"
FROM final_packet_numbers fpn
WHERE p."id" = fpn."id";

-- Clear ownership fields that used to make post-inspection records look lot-scoped.
UPDATE "Sample"
SET "lotId" = NULL,
    "inspectionId" = NULL;

UPDATE "Packet"
SET "lotId" = NULL;

UPDATE "RndJob"
SET "lotId" = NULL;

ALTER TABLE "Packet"
  ADD CONSTRAINT "Packet_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RndJob"
  ADD CONSTRAINT "RndJob_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sample"
  ADD CONSTRAINT "Sample_jobId_key" UNIQUE ("jobId");
