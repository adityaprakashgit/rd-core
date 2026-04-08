import { redirect } from "next/navigation";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ jobId: string; lotId: string }>;
}) {
  const { jobId, lotId } = await params;
  redirect(`/jobs/${jobId}/workflow?lotId=${lotId}&section=lots`);
}
