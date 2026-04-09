-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "decisionAt" TIMESTAMP(3),
ADD COLUMN     "decisionBy" TEXT,
ADD COLUMN     "decisionOutcome" TEXT,
ADD COLUMN     "sentToAdminAt" TIMESTAMP(3),
ADD COLUMN     "sentToAdminBy" TEXT;

-- AlterTable
ALTER TABLE "InspectionJob" ADD COLUMN     "adminDecisionAt" TIMESTAMP(3),
ADD COLUMN     "adminDecisionBy" TEXT,
ADD COLUMN     "adminDecisionStatus" TEXT,
ADD COLUMN     "handedOverToRndAt" TIMESTAMP(3),
ADD COLUMN     "handedOverToRndBy" TEXT,
ADD COLUMN     "handedOverToRndTo" TEXT,
ADD COLUMN     "jobStartedAt" TIMESTAMP(3),
ADD COLUMN     "operationsCompletedAt" TIMESTAMP(3),
ADD COLUMN     "sentToAdminAt" TIMESTAMP(3),
ADD COLUMN     "sentToAdminBy" TEXT;
