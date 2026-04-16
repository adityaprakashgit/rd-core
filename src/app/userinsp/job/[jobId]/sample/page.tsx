import { redirect } from "next/navigation";

export default async function JobSamplePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}/workflow?section=sampling`);
}

