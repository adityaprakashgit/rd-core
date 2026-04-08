import { redirect } from "next/navigation";

export default async function LotPacketPage({
  params,
}: {
  params: Promise<{ jobId: string; lotId: string }>;
}) {
  const { jobId, lotId } = await params;
  redirect(`/jobs/${jobId}/workflow?lotId=${lotId}&section=packets`);
}
