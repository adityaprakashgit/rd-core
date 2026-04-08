"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, HStack, Heading, SimpleGrid, Stack, Text, VStack, useToast } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint } from "@/components/enterprise/AsyncState";
import { WorkflowStepTracker } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { getStoredAuth } from "@/lib/auth-client";
import { buildWorkflowSteps, getJobWorkflowPresentation, getWorkflowStepRoute, summarizeLotProgress } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function UserInspDashboard() {
  const router = useRouter();
  const toast = useToast();
  const { viewMode } = useWorkspaceView();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<"ADMIN" | "OPERATIONS" | "RND" | "VIEWER" | null>(null);
  const [archivingJobId, setArchivingJobId] = useState<string | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [activePanel, setActivePanel] = useState<"overview" | "jobs">("overview");

  const canArchive = sessionRole === "ADMIN" || sessionRole === "OPERATIONS";
  const jobsPerPage = 2;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs?view=${viewMode}`);
      if (!res.ok) {
        throw new Error("The workspace queue could not be loaded.");
      }
      const data: unknown = await res.json();
      setJobs(Array.isArray(data) ? (data as InspectionJob[]) : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "The workspace queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setSessionRole(getStoredAuth()?.role ?? null);
  }, []);

  const handleArchive = useCallback(
    async (jobId: string) => {
      if (!canArchive || archivingJobId) {
        return;
      }

      setArchivingJobId(jobId);
      try {
        const response = await fetch(`/api/jobs/${jobId}/archive`, { method: "POST" });
        const payload = await response.json().catch(() => null) as { details?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.details ?? "Archive failed.");
        }
        toast({ title: "Job archived", status: "success" });
        await fetchJobs();
      } catch (archiveError) {
        const message = archiveError instanceof Error ? archiveError.message : "Archive failed.";
        toast({ title: "Archive failed", description: message, status: "error" });
      } finally {
        setArchivingJobId(null);
      }
    },
    [archivingJobId, canArchive, fetchJobs, toast]
  );

  const summary = useMemo(() => {
    const active = jobs.filter((job) => ["IN_PROGRESS", "SAMPLING_PENDING"].includes(job.status)).length;
    const needsLab = jobs.filter((job) => ["RND_RUNNING", "QA"].includes(job.status)).length;
    const readyForDocs = jobs.filter((job) => ["REPORT_READY", "LOCKED", "COMPLETED", "DISPATCHED"].includes(job.status)).length;
    return {
      total: jobs.length,
      active,
      needsLab,
      readyForDocs,
    };
  }, [jobs]);

  const nextJob = useMemo(() => {
    const ranked = [...jobs].sort((left, right) => {
      const leftStage = getJobWorkflowPresentation(left).stage;
      const rightStage = getJobWorkflowPresentation(right).stage;
      const order = ["sampling", "lot_capture", "intake", "lab", "reporting", "complete", "blocked"];
      return order.indexOf(leftStage) - order.indexOf(rightStage);
    });
    return ranked[0] ?? null;
  }, [jobs]);

  const jobsPageCount = Math.max(Math.ceil(jobs.length / jobsPerPage), 1);
  const pagedJobs = useMemo(
    () => jobs.slice((jobsPage - 1) * jobsPerPage, jobsPage * jobsPerPage),
    [jobs, jobsPage]
  );

  useEffect(() => {
    setJobsPage((current) => Math.min(current, jobsPageCount));
  }, [jobsPageCount]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6} h="full" overflow="hidden">
        <Stack direction={{ base: "column", lg: "row" }} justify="space-between" spacing={4}>
          <Box>
            <HStack spacing={2} mb={2} flexWrap="wrap">
              <Badge colorScheme="brand" borderRadius="full" px={2.5} py={1}>
                CONTROL CENTER
              </Badge>
              <Badge colorScheme="gray" borderRadius="full" px={2.5} py={1}>
                {viewMode === "all" ? "COMPANY VIEW" : "MY TASKS"}
              </Badge>
            </HStack>
            <Heading size="lg" color="text.primary">
              Execution Control
            </Heading>
          </Box>

          <Button
            leftIcon={<ArrowRight size={16} />}
            borderRadius="xl"
            onClick={() => router.push("/rd")}
            alignSelf={{ base: "start", lg: "center" }}
            minH="48px"
          >
            Create job
          </Button>
        </Stack>

        {loading ? <PageSkeleton cards={4} rows={2} /> : null}
        {!loading && error ? (
          <InlineErrorState
            title="Workspace queue unavailable"
            description={error}
            onRetry={() => void fetchJobs()}
          />
        ) : null}

        {!loading && !error ? (
          <>
            <HStack spacing={3}>
              <Button variant={activePanel === "overview" ? "solid" : "outline"} onClick={() => setActivePanel("overview")}>
                Overview
              </Button>
              <Button variant={activePanel === "jobs" ? "solid" : "outline"} onClick={() => setActivePanel("jobs")}>
                Jobs
              </Button>
            </HStack>

            {activePanel === "overview" ? (
            <VStack align="stretch" spacing={5}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
              <Card>
                <Text fontSize="sm" color="text.secondary">
                  Jobs in this view
                </Text>
                <Text fontSize="3xl" fontWeight="bold" color="text.primary" mt={2}>
                  {summary.total}
                </Text>
              </Card>
              <Card>
                <Text fontSize="sm" color="text.secondary">
                  Waiting on lab or QA
                </Text>
                <Text fontSize="3xl" fontWeight="bold" color="blue.600" mt={2}>
                  {summary.needsLab}
                </Text>
              </Card>
              <Card>
                <Text fontSize="sm" color="text.secondary">
                  Ready for documents
                </Text>
                <Text fontSize="3xl" fontWeight="bold" color="green.600" mt={2}>
                  {summary.readyForDocs}
                </Text>
              </Card>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5}>
              <Box gridColumn={{ xl: "span 2" }}>
                <Card>
                  {nextJob ? (
                    <Card bg="bg.rail">
                      <Stack direction={{ base: "column", md: "row" }} justify="space-between" spacing={4}>
                        <Box>
                          <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                            Next priority
                          </Text>
                          <Heading size="md" mt={1} color="text.primary">
                            {nextJob.inspectionSerialNumber}
                          </Heading>
                          <Text color="text.secondary">{nextJob.clientName}</Text>
                        </Box>
                        <VStack align={{ base: "stretch", md: "end" }} spacing={2}>
                          <Badge colorScheme={getJobWorkflowPresentation(nextJob).tone} borderRadius="full" px={3} py={1}>
                            {getJobWorkflowPresentation(nextJob).label}
                          </Badge>
                          <Button minH="48px" onClick={() => router.push(`/userinsp/job/${nextJob.id}?view=${viewMode}`)}>
                            {getJobWorkflowPresentation(nextJob).nextAction}
                          </Button>
                        </VStack>
                      </Stack>
                    </Card>
                  ) : null}
                </Card>
              </Box>

              <Card>
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                    Queue rules
                  </Text>
                  <SectionHint label="Current view" value={viewMode === "all" ? "All company jobs" : "Assigned jobs only"} />
                  <SectionHint label="Primary action" value={nextJob ? getJobWorkflowPresentation(nextJob).nextAction : "Create first job"} />
                  <SectionHint label="Documents handoff" value={`${summary.readyForDocs} jobs`} />
                </VStack>
              </Card>
            </SimpleGrid>
            </VStack>
            ) : null}

            {activePanel === "jobs" && jobs.length === 0 ? (
              <EmptyWorkState
                title="No jobs in this workspace"
                description="There is nothing assigned in this view yet. Create a job or switch to company view."
                action={
                  <Button minH="48px" onClick={() => router.push("/rd")}>
                    Create first job
                  </Button>
                }
              />
            ) : activePanel === "jobs" ? (
              <VStack align="stretch" spacing={4}>
                {pagedJobs.map((job) => {
                  const presentation = getJobWorkflowPresentation(job);
                  const lotProgress = summarizeLotProgress(job);

                  return (
                    <Card key={job.id}>
                      <VStack align="stretch" spacing={4}>
                        <Stack direction={{ base: "column", xl: "row" }} spacing={5} justify="space-between">
                          <Box>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="teal" borderRadius="full" px={3} py={1}>
                                {job.inspectionSerialNumber}
                              </Badge>
                              <Badge colorScheme={presentation.tone} variant="subtle" borderRadius="full" px={2.5} py={1}>
                                {presentation.label}
                              </Badge>
                            </HStack>
                            <Heading size="md" mt={3} color="text.primary">
                              {job.clientName}
                            </Heading>
                            <Text fontSize="sm" color="text.secondary" mt={1}>
                              {job.commodity}
                            </Text>
                          </Box>
                          <VStack align={{ base: "stretch", xl: "end" }} spacing={2}>
                            <Button minH="48px" onClick={() => router.push(`/userinsp/job/${job.id}?view=${viewMode}`)}>
                              {presentation.nextAction}
                            </Button>
                            <Button
                              minH="48px"
                              variant="outline"
                              onClick={() => router.push(`/userinsp/job/${job.id}?view=${viewMode}`)}
                            >
                              Open job
                            </Button>
                            {canArchive ? (
                              <Button
                                minH="48px"
                                variant="outline"
                                colorScheme="red"
                                isLoading={archivingJobId === job.id}
                                loadingText="Archiving"
                                onClick={() => void handleArchive(job.id)}
                              >
                                Archive
                              </Button>
                            ) : null}
                          </VStack>
                        </Stack>

                        <WorkflowStepTracker
                          title="Job flow"
                          steps={buildWorkflowSteps(job).map((step) => ({
                            ...step,
                            onClick: () => router.push(getWorkflowStepRoute(job.id, step.id)),
                          }))}
                          compact
                        />

                        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                              Lots
                            </Text>
                            <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={1}>
                              {lotProgress.total}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                              In progress
                            </Text>
                            <Text fontSize="2xl" fontWeight="bold" color="orange.600" mt={1}>
                              {lotProgress.inProgress}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                              Not started
                            </Text>
                            <Text fontSize="2xl" fontWeight="bold" color="gray.700" mt={1}>
                              {lotProgress.notStarted}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                              Updated
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary" mt={1}>
                              {formatDate(job.updatedAt)}
                            </Text>
                          </Box>
                        </SimpleGrid>
                      </VStack>
                    </Card>
                  );
                })}
                {jobs.length > jobsPerPage ? (
                  <HStack justify="flex-end" spacing={3}>
                    <Button size="sm" variant="outline" onClick={() => setJobsPage((current) => Math.max(1, current - 1))} isDisabled={jobsPage <= 1}>
                      Prev
                    </Button>
                    <Text fontSize="xs" color="text.secondary">
                      {jobsPage}/{jobsPageCount}
                    </Text>
                    <Button size="sm" variant="outline" onClick={() => setJobsPage((current) => Math.min(jobsPageCount, current + 1))} isDisabled={jobsPage >= jobsPageCount}>
                      Next
                    </Button>
                  </HStack>
                ) : null}
              </VStack>
            ) : null}
          </>
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
