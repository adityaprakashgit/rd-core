"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Heading, HStack, SimpleGrid, Stack, Text, VStack, useToast } from "@chakra-ui/react";
import { FileDown, Puzzle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint } from "@/components/enterprise/AsyncState";
import { WorkflowStepTracker } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { getStoredAuth } from "@/lib/auth-client";
import { buildWorkflowSteps, getJobWorkflowPresentation, getWorkflowStepRoute, summarizeLotProgress } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function UserRdDashboard() {
  const router = useRouter();
  const toast = useToast();
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
      const res = await fetch("/api/jobs?view=all");
      if (!res.ok) {
        throw new Error("The lab queue could not be loaded.");
      }
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "The lab queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    const activeLab = jobs.filter((job) => ["RND_RUNNING", "QA"].includes(job.status)).length;
    const reportReady = jobs.filter((job) => ["REPORT_READY", "LOCKED"].includes(job.status)).length;
    const completed = jobs.filter((job) => ["COMPLETED", "DISPATCHED"].includes(job.status)).length;
    return { total: jobs.length, activeLab, reportReady, completed };
  }, [jobs]);

  const queue = useMemo(() => {
    return [...jobs].sort((left, right) => {
      const leftPresentation = getJobWorkflowPresentation(left);
      const rightPresentation = getJobWorkflowPresentation(right);
      const order = ["lab", "reporting", "sampling", "lot_capture", "intake", "complete", "blocked"];
      return order.indexOf(leftPresentation.stage) - order.indexOf(rightPresentation.stage);
    });
  }, [jobs]);

  const focusJob = queue[0] ?? null;
  const jobsPageCount = Math.max(Math.ceil(queue.length / jobsPerPage), 1);
  const pagedQueue = useMemo(
    () => queue.slice((jobsPage - 1) * jobsPerPage, jobsPage * jobsPerPage),
    [jobsPage, queue]
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
              <Badge colorScheme="purple" borderRadius="full" px={2.5} py={1}>
                LAB & ANALYSIS
              </Badge>
              <Badge colorScheme="gray" borderRadius="full" px={2.5} py={1}>
                ACTIVE WORK
              </Badge>
            </HStack>
            <Heading size="lg" color="text.primary">
              Lab Queue
            </Heading>
          </Box>

          <HStack spacing={3} flexWrap="wrap">
            <Button minH="48px" variant="outline" leftIcon={<Puzzle size={16} />} onClick={() => router.push("/playground")}>
              Open playground
            </Button>
            <Button minH="48px" onClick={() => router.push("/rd")}>
              Create job
            </Button>
          </HStack>
        </Stack>

        {loading ? <PageSkeleton cards={4} rows={2} /> : null}
        {!loading && error ? (
          <InlineErrorState
            title="Lab workspace unavailable"
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
                <Text fontSize="sm" color="text.secondary">Active lab reviews</Text>
                <Text fontSize="3xl" fontWeight="bold" color="purple.600" mt={2}>{summary.activeLab}</Text>
              </Card>
              <Card>
                <Text fontSize="sm" color="text.secondary">Ready for client documents</Text>
                <Text fontSize="3xl" fontWeight="bold" color="teal.600" mt={2}>{summary.reportReady}</Text>
              </Card>
              <Card>
                <Text fontSize="sm" color="text.secondary">Closed out</Text>
                <Text fontSize="3xl" fontWeight="bold" color="green.600" mt={2}>{summary.completed}</Text>
              </Card>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5}>
              <Box gridColumn={{ xl: "span 2" }}>
                <Card>
                  {focusJob ? (
                    <Card bg="bg.rail">
                      <Stack direction={{ base: "column", md: "row" }} justify="space-between" spacing={4}>
                        <Box>
                          <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                            Current analytical priority
                          </Text>
                          <Heading size="md" mt={1} color="text.primary">
                            {focusJob.inspectionSerialNumber}
                          </Heading>
                          <Text color="text.secondary">{focusJob.clientName}</Text>
                        </Box>
                        <VStack align={{ base: "stretch", md: "end" }} spacing={2}>
                          <Badge colorScheme={getJobWorkflowPresentation(focusJob).tone} borderRadius="full" px={3} py={1}>
                            {getJobWorkflowPresentation(focusJob).label}
                          </Badge>
                          <Button minH="48px" onClick={() => router.push(`/userrd/job/${focusJob.id}`)}>
                            {getJobWorkflowPresentation(focusJob).nextAction}
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
                    Lab rules
                  </Text>
                  <SectionHint label="Jobs in queue" value={String(summary.total)} />
                  <SectionHint label="Primary action" value={focusJob ? getJobWorkflowPresentation(focusJob).nextAction : "Create first job"} />
                  <SectionHint label="Reports waiting" value={`${summary.reportReady} jobs`} />
                </VStack>
              </Card>
            </SimpleGrid>
            </VStack>
            ) : null}

            {activePanel === "jobs" && queue.length === 0 ? (
              <EmptyWorkState
                title="No lab jobs yet"
                description="There is nothing ready for analysis in this workspace right now."
                action={<Button minH="48px" onClick={() => router.push("/rd")}>Create first job</Button>}
              />
            ) : activePanel === "jobs" ? (
              <VStack align="stretch" spacing={4}>
                {pagedQueue.map((job) => {
                  const presentation = getJobWorkflowPresentation(job);
                  const lotProgress = summarizeLotProgress(job);
                  const reports = job.reportSnapshots?.length ?? 0;
                  const actionHref = presentation.stage === "reporting" ? "/reports" : `/userrd/job/${job.id}`;

                  return (
                    <Card key={job.id}>
                      <VStack align="stretch" spacing={4}>
                        <Stack direction={{ base: "column", xl: "row" }} spacing={5} justify="space-between">
                          <Box>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="purple" borderRadius="full" px={3} py={1}>
                                {job.inspectionSerialNumber || job.jobReferenceNumber}
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
                            <Button
                              minH="48px"
                              leftIcon={presentation.stage === "reporting" ? <FileDown size={16} /> : undefined}
                              onClick={() => router.push(actionHref)}
                            >
                              {presentation.stage === "reporting" ? "Open reports" : presentation.nextAction}
                            </Button>
                            <Button minH="48px" variant="outline" onClick={() => router.push(`/userrd/job/${job.id}`)}>
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
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Lots sampled</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="purple.600" mt={1}>{lotProgress.completed}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Active lots</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="orange.600" mt={1}>{lotProgress.inProgress}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Snapshots</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="teal.600" mt={1}>{reports}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Updated</Text>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary" mt={1}>{formatDate(job.updatedAt)}</Text>
                          </Box>
                        </SimpleGrid>
                      </VStack>
                    </Card>
                  );
                })}
                {queue.length > jobsPerPage ? (
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
