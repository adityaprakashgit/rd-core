import { redirect } from "next/navigation";

export default async function RndJobReviewRedirect({
  params,
}: {
  params: Promise<{ rndJobId: string }>;
}) {
  const { rndJobId } = await params;
  redirect(`/rnd/jobs/${rndJobId}?tab=review`);
}
