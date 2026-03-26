import { PrismaClient } from "@prisma/client";

import { CurrentUser } from "@/lib/session";
import { assertCompanyScope } from "@/lib/rbac";

type JobCompanyRecord = {
  companyId: string;
};

export async function assertJobCompanyScope(
  prisma: PrismaClient,
  jobId: string,
  currentUser: CurrentUser
): Promise<void> {
  const job = await prisma.inspectionJob.findUnique({
    where: { id: jobId },
    select: { companyId: true },
  });

  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }

  assertCompanyScope(currentUser.companyId, (job as JobCompanyRecord).companyId);
}
