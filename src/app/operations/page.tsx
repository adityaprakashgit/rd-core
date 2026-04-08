"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Heading, HStack, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react";
import { FileDown, ScanFace } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint } from "@/components/enterprise/AsyncState";
import { WorkflowStepTracker } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { buildWorkflowSteps, getJobWorkflowPresentation, getWorkflowStepRoute, summarizeLotProgress } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function OperationsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [activePanel, setActivePanel] = useState<"overview" | "jobs">("overview");
  const jobsPerPage = 2;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs?view=all");
      if (!res.ok) {
        throw new Error("The execution queue could not be loaded.");
      }
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "The execution queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const summary = useMemo(() => {
    const executionNow = jobs.filter((job) => ["IN_PROGRESS", "SAMPLING_PENDING"].includes(job.status)).length;
    const blockedOnLab = jobs.filter((job) => ["RND_RUNNING", "QA"].includes(job.status)).length;
    const complete = jobs.filter((job) => ["REPORT_READY", "LOCKED", "COMPLETED", "DISPATCHED"].includes(job.status)).length;
    return { total: jobs.length, executionNow, blockedOnLab, complete };
  }, [jobs]);

  const queue = useMemo(() => {
    return [...jobs].sort((left, right) => {
      const leftPresentation = getJobWorkflowPresentation(left);
      const rightPresentation = getJobWorkflowPresentation(right);
      const order = ["sampling", "lot_capture", "intake", "lab", "reporting", "complete", "blocked"];
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
              <Badge colorScheme="brand" borderRadius="full" px={2.5} py={1}>
                OPERATIONS
              </Badge>
              <Badge colorScheme="gray" borderRadius="full" px={2.5} py={1}>
                LIVE EXECUTION
              </Badge>
            </HStack>
            <Heading size="lg" color="text.primary">
              Execution Queue
            </Heading>
          </Box>

          <Button minH="48px" onClick={() => router.push("/rd")}>
            Create job
          </Button>
        </Stack>

        {loading ? <PageSkeleton cards={4} rows={2} /> : null}
        {!loading && error ? (
          <InlineErrorState
            title="Execution workspace unavailable"
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
                <Text fontSize="sm" color="text.secondary">Need execution now</Text>
                <Text fontSize="3xl" fontWeight="bold" color="orange.600" mt={2}>{summary.executionNow}</Text>
              </Card>
              <Card>
                <Text fontSize="sm" color="text.secondary">Blocked on lab or QA</Text>
                <Text fontSize="3xl" fontWeight="bold" color="blue.600" mt={2}>{summary.blockedOnLab}</Text>
              </Card>
              <Card>
                <Text fontSize="sm" color="text.secondary">Operationally complete</Text>
                <Text fontSize="3xl" fontWeight="bold" color="green.600" mt={2}>{summary.complete}</Text>
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
                            Current bottleneck
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
                          <Button minH="48px" onClick={() => router.push(`/operations/job/${focusJob.id}`)}>
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
                    Execution rules
                  </Text>
                  <SectionHint label="Jobs in registry" value={String(summary.total)} />
                  <SectionHint label="Primary queue" value={focusJob ? "Continue the next incomplete lot" : "Create first job"} />
                  <SectionHint label="Reports handoff" value={`${summary.complete} jobs`} />
                </VStack>
              </Card>
            </SimpleGrid>
            </VStack>
            ) : null}

            {activePanel === "jobs" && queue.length === 0 ? (
              <EmptyWorkState
                title="No execution jobs yet"
                description="There is nothing in the operations queue. Create a job to start lot intake."
                action={<Button minH="48px" onClick={() => router.push("/rd")}>Create first job</Button>}
              />
            ) : activePanel === "jobs" ? (
              <VStack align="stretch" spacing={4}>
                {pagedQueue.map((job) => {
                  const presentation = getJobWorkflowPresentation(job);
                  const lotProgress = summarizeLotProgress(job);
                  const primaryAction = presentation.stage === "reporting" ? "Open reports" : presentation.nextAction;

                  return (
                    <Card key={job.id}>
                      <VStack align="stretch" spacing={4}>
                        <Stack direction={{ base: "column", xl: "row" }} spacing={5} justify="space-between">
                          <Box>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="teal" borderRadius="full" px={3} py={1}>
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
                              leftIcon={presentation.stage === "reporting" ? <FileDown size={16} /> : <ScanFace size={16} />}
                              onClick={() => router.push(presentation.stage === "reporting" ? "/reports" : `/operations/job/${job.id}`)}
                            >
                              {primaryAction}
                            </Button>
                            <Button minH="48px" variant="outline" onClick={() => router.push(`/operations/job/${job.id}`)}>
                              Open job
                            </Button>
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
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Lots</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={1}>{lotProgress.total}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Sampling live</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="orange.600" mt={1}>{lotProgress.inProgress}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">Ready</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="green.600" mt={1}>{lotProgress.completed}</Text>
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
