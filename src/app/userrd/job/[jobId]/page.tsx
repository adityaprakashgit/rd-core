import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export default async function LegacyUserRdJobRedirect({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  const active = await prisma.rndJob.findFirst({
    where: {
      parentJobId: jobId,
      status: {
        in: ["CREATED", "READY_FOR_TEST_SETUP", "READY_FOR_TESTING", "IN_TESTING", "AWAITING_REVIEW", "REWORK_REQUIRED"],
      },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (active) {
    redirect(`/rnd/jobs/${active.id}`);
  }

  const latest = await prisma.rndJob.findFirst({
    where: { parentJobId: jobId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (latest) {
    redirect(`/rnd/jobs/${latest.id}`);
  }

  redirect("/rnd");
}
