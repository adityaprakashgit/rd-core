-- Job-centric decision and sampling ownership
ALTER TABLE "InspectionJob"
  ADD COLUMN "finalDecisionStatus" TEXT,
  ADD COLUMN "finalDecisionAt" TIMESTAMP(3),
  ADD COLUMN "finalDecisionBy" TEXT,
  ADD COLUMN "finalDecisionNote" TEXT;

-- Keep legacy lot link optional for compatibility while moving to job-level sample ownership
ALTER TABLE "Sample"
  ALTER COLUMN "lotId" DROP NOT NULL,
  ALTER COLUMN "inspectionId" DROP NOT NULL;
