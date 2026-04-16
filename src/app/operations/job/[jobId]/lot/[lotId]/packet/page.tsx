import { redirect } from "next/navigation";

export default async function LotPacketPage({
  params,
}: {
  params: Promise<{ jobId: string; lotId: string }>;
}) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}/workflow?section=packets`);
}
