-- Preserve old lot-scoped Sampling photos as canonical MediaFile evidence before
-- removing the legacy Sampling table.
INSERT INTO "MediaFile" ("id", "companyId", "jobId", "lotId", "category", "storageKey", "fileName", "createdAt")
SELECT
  'migrated_sampling_before_' || s."id",
  s."companyId",
  l."jobId",
  s."lotId",
  'BEFORE',
  s."beforePhotoUrl",
  'Migrated sampling before photo',
  s."createdAt"
FROM "Sampling" s
JOIN "InspectionLot" l ON l."id" = s."lotId"
WHERE s."beforePhotoUrl" IS NOT NULL AND btrim(s."beforePhotoUrl") <> '';

INSERT INTO "MediaFile" ("id", "companyId", "jobId", "lotId", "category", "storageKey", "fileName", "createdAt")
SELECT
  'migrated_sampling_during_' || s."id",
  s."companyId",
  l."jobId",
  s."lotId",
  'SAMPLING_IN_PROGRESS',
  s."duringPhotoUrl",
  'Migrated sampling during photo',
  s."createdAt"
FROM "Sampling" s
JOIN "InspectionLot" l ON l."id" = s."lotId"
WHERE s."duringPhotoUrl" IS NOT NULL AND btrim(s."duringPhotoUrl") <> '';

INSERT INTO "MediaFile" ("id", "companyId", "jobId", "lotId", "category", "storageKey", "fileName", "createdAt")
SELECT
  'migrated_sampling_after_' || s."id",
  s."companyId",
  l."jobId",
  s."lotId",
  'AFTER',
  s."afterPhotoUrl",
  'Migrated sampling after photo',
  s."createdAt"
FROM "Sampling" s
JOIN "InspectionLot" l ON l."id" = s."lotId"
WHERE s."afterPhotoUrl" IS NOT NULL AND btrim(s."afterPhotoUrl") <> '';

UPDATE "InspectionLot" l
SET "samplingPhotoUrl" = COALESCE(
  NULLIF(btrim(s."duringPhotoUrl"), ''),
  NULLIF(btrim(s."afterPhotoUrl"), ''),
  NULLIF(btrim(s."beforePhotoUrl"), '')
)
FROM "Sampling" s
WHERE s."lotId" = l."id"
  AND (l."samplingPhotoUrl" IS NULL OR btrim(l."samplingPhotoUrl") = '')
  AND COALESCE(
    NULLIF(btrim(s."duringPhotoUrl"), ''),
    NULLIF(btrim(s."afterPhotoUrl"), ''),
    NULLIF(btrim(s."beforePhotoUrl"), '')
  ) IS NOT NULL;

DROP TABLE "Sampling";
