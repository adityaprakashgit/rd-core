CREATE TABLE "RndReportVersion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "parentJobId" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "rndJobId" TEXT NOT NULL,
  "reportSnapshotId" TEXT NOT NULL,
  "precedence" "ResultPrecedenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RndReportVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RndReportVersion_companyId_parentJobId_sampleId_precedence_idx"
ON "RndReportVersion"("companyId", "parentJobId", "sampleId", "precedence");

CREATE INDEX "RndReportVersion_rndJobId_createdAt_idx"
ON "RndReportVersion"("rndJobId", "createdAt" DESC);

CREATE INDEX "RndReportVersion_reportSnapshotId_idx"
ON "RndReportVersion"("reportSnapshotId");

ALTER TABLE "RndReportVersion"
  ADD CONSTRAINT "RndReportVersion_rndJobId_fkey"
  FOREIGN KEY ("rndJobId") REFERENCES "RndJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RndReportVersion"
  ADD CONSTRAINT "RndReportVersion_reportSnapshotId_fkey"
  FOREIGN KEY ("reportSnapshotId") REFERENCES "ReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH lineage AS (
  SELECT
    rj."companyId" AS company_id,
    rj."parentJobId" AS parent_job_id,
    rj."sampleId" AS sample_id
  FROM "RndJob" rj
  WHERE rj."status" IN ('APPROVED'::"RndJobStatus", 'COMPLETED'::"RndJobStatus")
  GROUP BY rj."companyId", rj."parentJobId", rj."sampleId"
), active_candidate AS (
  SELECT
    rj."id" AS rnd_job_id,
    rj."companyId" AS company_id,
    rj."parentJobId" AS parent_job_id,
    rj."sampleId" AS sample_id,
    ROW_NUMBER() OVER (
      PARTITION BY rj."companyId", rj."parentJobId", rj."sampleId"
      ORDER BY
        CASE WHEN rj."resultPrecedence" = 'ACTIVE'::"ResultPrecedenceStatus" THEN 0 ELSE 1 END,
        COALESCE(rj."reviewedAt", rj."updatedAt", rj."createdAt") DESC,
        rj."id" DESC
    ) AS rn
  FROM "RndJob" rj
  JOIN lineage l
    ON l.company_id = rj."companyId"
   AND l.parent_job_id = rj."parentJobId"
   AND l.sample_id = rj."sampleId"
  WHERE rj."status" IN ('APPROVED'::"RndJobStatus", 'COMPLETED'::"RndJobStatus")
), latest_snapshot AS (
  SELECT
    rs."id" AS report_snapshot_id,
    rs."jobId" AS parent_job_id,
    rs."createdAt" AS created_at,
    ROW_NUMBER() OVER (
      PARTITION BY rs."jobId"
      ORDER BY rs."createdAt" DESC, rs."id" DESC
    ) AS rn
  FROM "ReportSnapshot" rs
), active_insert AS (
  INSERT INTO "RndReportVersion" (
    "id",
    "companyId",
    "parentJobId",
    "sampleId",
    "rndJobId",
    "reportSnapshotId",
    "precedence",
    "createdAt",
    "updatedAt"
  )
  SELECT
    ('rrv_backfill_active_' || md5(ac.company_id || ':' || ac.parent_job_id || ':' || ac.sample_id || ':' || ls.report_snapshot_id))::text,
    ac.company_id,
    ac.parent_job_id,
    ac.sample_id,
    ac.rnd_job_id,
    ls.report_snapshot_id,
    'ACTIVE'::"ResultPrecedenceStatus",
    NOW(),
    NOW()
  FROM active_candidate ac
  JOIN latest_snapshot ls
    ON ls.parent_job_id = ac.parent_job_id
   AND ls.rn = 1
  WHERE ac.rn = 1
    AND NOT EXISTS (
      SELECT 1
      FROM "RndReportVersion" existing
      WHERE existing."rndJobId" = ac.rnd_job_id
        AND existing."reportSnapshotId" = ls.report_snapshot_id
    )
  RETURNING "companyId", "parentJobId", "sampleId"
), unambiguous_lineage AS (
  SELECT
    l.company_id,
    l.parent_job_id,
    l.sample_id
  FROM lineage l
  JOIN "RndJob" rj
    ON rj."companyId" = l.company_id
   AND rj."parentJobId" = l.parent_job_id
   AND rj."sampleId" = l.sample_id
   AND rj."status" IN ('APPROVED'::"RndJobStatus", 'COMPLETED'::"RndJobStatus")
  GROUP BY l.company_id, l.parent_job_id, l.sample_id
  HAVING COUNT(*) = 1
), single_job AS (
  SELECT
    rj."id" AS rnd_job_id,
    rj."companyId" AS company_id,
    rj."parentJobId" AS parent_job_id,
    rj."sampleId" AS sample_id
  FROM "RndJob" rj
  JOIN unambiguous_lineage ul
    ON ul.company_id = rj."companyId"
   AND ul.parent_job_id = rj."parentJobId"
   AND ul.sample_id = rj."sampleId"
  WHERE rj."status" IN ('APPROVED'::"RndJobStatus", 'COMPLETED'::"RndJobStatus")
), older_snapshots AS (
  SELECT
    sj.company_id,
    sj.parent_job_id,
    sj.sample_id,
    sj.rnd_job_id,
    rs."id" AS report_snapshot_id
  FROM single_job sj
  JOIN latest_snapshot ls
    ON ls.parent_job_id = sj.parent_job_id
   AND ls.rn = 1
  JOIN "ReportSnapshot" rs
    ON rs."jobId" = sj.parent_job_id
   AND rs."id" <> ls.report_snapshot_id
), superseded_insert AS (
  INSERT INTO "RndReportVersion" (
    "id",
    "companyId",
    "parentJobId",
    "sampleId",
    "rndJobId",
    "reportSnapshotId",
    "precedence",
    "createdAt",
    "updatedAt"
  )
  SELECT
    ('rrv_backfill_prev_' || md5(os.company_id || ':' || os.parent_job_id || ':' || os.sample_id || ':' || os.report_snapshot_id))::text,
    os.company_id,
    os.parent_job_id,
    os.sample_id,
    os.rnd_job_id,
    os.report_snapshot_id,
    'SUPERSEDED'::"ResultPrecedenceStatus",
    NOW(),
    NOW()
  FROM older_snapshots os
  WHERE NOT EXISTS (
    SELECT 1
    FROM "RndReportVersion" existing
    WHERE existing."rndJobId" = os.rnd_job_id
      AND existing."reportSnapshotId" = os.report_snapshot_id
  )
  RETURNING "companyId", "parentJobId", "sampleId"
), inserted_rollup AS (
  SELECT
    combined."companyId" AS company_id,
    combined."parentJobId" AS parent_job_id,
    combined."sampleId" AS sample_id,
    COUNT(*)::int AS inserted_count
  FROM (
    SELECT * FROM active_insert
    UNION ALL
    SELECT * FROM superseded_insert
  ) combined
  GROUP BY combined."companyId", combined."parentJobId", combined."sampleId"
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
  ('audit_rnd_report_backfill_' || md5(ir.company_id || ':' || ir.parent_job_id || ':' || ir.sample_id))::text,
  ir.parent_job_id,
  j."createdByUserId",
  'RND_REPORT_VERSION',
  'RND_REPORT_VERSION_BACKFILLED',
  'Backfilled R&D report version linkage from historical snapshots.',
  jsonb_build_object(
    'backfill', true,
    'companyId', ir.company_id,
    'parentJobId', ir.parent_job_id,
    'sampleId', ir.sample_id,
    'insertedCount', ir.inserted_count
  ),
  NOW()
FROM inserted_rollup ir
JOIN "InspectionJob" j ON j."id" = ir.parent_job_id
ON CONFLICT ("id") DO NOTHING;
