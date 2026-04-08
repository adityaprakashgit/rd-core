CREATE TYPE "WorkflowEscalationType" AS ENUM (
  'DUPLICATE_JOB',
  'LOT_CONFLICT',
  'VALIDATION_ERROR',
  'PACKING_POLICY_BLOCK',
  'AUDIT_LOG_FAILURE',
  'OPERATIONAL_BLOCK'
);

CREATE TYPE "WorkflowEscalationSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "WorkflowEscalationStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "WorkflowEscalation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "WorkflowEscalationType" NOT NULL,
  "severity" "WorkflowEscalationSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "WorkflowEscalationStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "detailsJson" JSONB,
  "overrideReason" TEXT,
  "resolutionNote" TEXT,
  "jobId" TEXT,
  "lotId" TEXT,
  "raisedByUserId" TEXT,
  "assignedToUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowEscalation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowEscalation_companyId_status_createdAt_idx"
ON "WorkflowEscalation"("companyId", "status", "createdAt" DESC);

CREATE INDEX "WorkflowEscalation_companyId_type_createdAt_idx"
ON "WorkflowEscalation"("companyId", "type", "createdAt" DESC);

CREATE INDEX "WorkflowEscalation_jobId_idx" ON "WorkflowEscalation"("jobId");
CREATE INDEX "WorkflowEscalation_lotId_idx" ON "WorkflowEscalation"("lotId");

ALTER TABLE "WorkflowEscalation"
  ADD CONSTRAINT "WorkflowEscalation_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowEscalation"
  ADD CONSTRAINT "WorkflowEscalation_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowEscalation"
  ADD CONSTRAINT "WorkflowEscalation_raisedByUserId_fkey"
  FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowEscalation"
  ADD CONSTRAINT "WorkflowEscalation_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
