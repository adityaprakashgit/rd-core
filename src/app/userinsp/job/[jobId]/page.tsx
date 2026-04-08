import { redirect } from "next/navigation";

export default async function UserInspectionJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}/workflow?source=userinsp`);
}
