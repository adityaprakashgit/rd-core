-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
