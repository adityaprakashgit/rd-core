-- AlterTable
ALTER TABLE "ModuleWorkflowSettings"
ADD COLUMN     "creatorIsDefaultAssignee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deadlineRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "decisionRequiredBeforeSampling" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "submitToRndEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowJobCollaborators" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoPacketIdGeneration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "packetIdPrefix" TEXT,
ADD COLUMN     "packetIdSequenceFormat" TEXT,
ADD COLUMN     "hiddenImageCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sealEditRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "holdRejectNotesMandatory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnAssign" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnSubmit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnDecision" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowedModuleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CompanyProfileSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT,
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "sameAsBilling" BOOLEAN NOT NULL DEFAULT true,
    "gstNumber" TEXT,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfileSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfileSettings_companyId_key" ON "CompanyProfileSettings"("companyId");
