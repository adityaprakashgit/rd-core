CREATE TABLE "LoginAttempt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userId" TEXT,
  "success" BOOLEAN NOT NULL,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginAttempt_companyId_email_createdAt_idx" ON "LoginAttempt"("companyId", "email", "createdAt");
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");

ALTER TABLE "LoginAttempt"
ADD CONSTRAINT "LoginAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
