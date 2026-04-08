import { redirect } from "next/navigation";

export default async function OperationsJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}/workflow?source=operations`);
}
