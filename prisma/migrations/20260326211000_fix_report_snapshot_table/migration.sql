CREATE TABLE IF NOT EXISTS "ReportSnapshot" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReportSnapshot_jobId_idx" ON "ReportSnapshot"("jobId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReportSnapshot_jobId_fkey'
  ) THEN
    ALTER TABLE "ReportSnapshot"
      ADD CONSTRAINT "ReportSnapshot_jobId_fkey"
      FOREIGN KEY ("jobId")
      REFERENCES "InspectionJob"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
