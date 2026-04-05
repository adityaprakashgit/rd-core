"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Heading,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  Layers3,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { APP_TEXT } from "@/lib/ui-copy";
import type { InspectionJob, InspectionLot, Sampling } from "@/types/inspection";

type WorkspaceStage = "PENDING" | "IN_PROGRESS" | "QA" | "LOCKED" | "DISPATCHED";

function getBadgeColor(status: string): string {
  switch (status) {
    case "DISPATCHED":
      return "teal";
    case "LOCKED":
      return "green";
    case "QA":
      return "blue";
    case "IN_PROGRESS":
      return "orange";
    case "PENDING":
    case "CREATED":
      return "gray";
    default:
      return "purple";
  }
}

function profileName(user: InspectionJob["assignedTo"] | InspectionJob["assignedBy"] | InspectionJob["createdByUser"], fallback: string): string {
  return user?.profile?.displayName ?? fallback;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function countWorkflowStage(job: InspectionJob): WorkspaceStage {
  if (job.status === "DISPATCHED") {
    return "DISPATCHED";
  }

  if (job.status === "LOCKED") {
    return "LOCKED";
  }

  if (job.status === "QA") {
    return "QA";
  }

  if (job.status === "IN_PROGRESS") {
    return "IN_PROGRESS";
  }

  return "PENDING";
}

function getSamplingRecord(lot: InspectionLot): Sampling | null {
  const samplingValue = lot.sampling as Sampling | Sampling[] | null | undefined;
  if (!samplingValue) {
    return null;
  }
  return Array.isArray(samplingValue) ? samplingValue[0] ?? null : samplingValue;
}

function isLotSamplingCompleted(lot: InspectionLot): boolean {
  const sampling = getSamplingRecord(lot);
  return Boolean(sampling?.beforePhotoUrl && sampling?.duringPhotoUrl && sampling?.afterPhotoUrl);
}

export default function UserInspDashboard() {
  const router = useRouter();
  const { viewMode } = useWorkspaceView();
  const toast = useToast();

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs?view=${viewMode}`);
      if (!res.ok) {
        throw new Error("Failed to fetch workspace jobs");
      }

      const data: unknown = await res.json();
      setJobs(Array.isArray(data) ? (data as InspectionJob[]) : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch workspace jobs";
      toast({ title: "Workspace load failed", description: message, status: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast, viewMode]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const metrics = useMemo(() => {
    const total = jobs.length;
    const pending = jobs.filter((job) => countWorkflowStage(job) === "PENDING").length;
    const inProgress = jobs.filter((job) => countWorkflowStage(job) === "IN_PROGRESS").length;
    const qa = jobs.filter((job) => countWorkflowStage(job) === "QA").length;
    const closed = jobs.filter((job) => countWorkflowStage(job) === "LOCKED" || countWorkflowStage(job) === "DISPATCHED").length;

    return { total, pending, inProgress, qa, closed };
  }, [jobs]);

  const stages = useMemo(
    () => [
      { key: "PENDING", label: "PENDING", accent: "gray" },
      { key: "IN_PROGRESS", label: "IN PROGRESS", accent: "orange" },
      { key: "QA", label: "QA", accent: "blue" },
      { key: "LOCKED", label: "LOCKED", accent: "green" },
      { key: "DISPATCHED", label: "DISPATCHED", accent: "teal" },
    ],
    []
  );

  const stageCounts = useMemo(() => {
    return stages.reduce<Record<string, number>>((acc, stage) => {
      acc[stage.key] = jobs.filter((job) => countWorkflowStage(job) === stage.key).length;
      return acc;
    }, {});
  }, [jobs, stages]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Stack direction={{ base: "column", lg: "row" }} justify="space-between" spacing={4}>
          <Box>
            <HStack spacing={2} mb={2}>
              <Badge colorScheme="teal" borderRadius="full" px={2.5} py={1}>
                CONTROL TOWER
              </Badge>
              <Badge colorScheme="gray" borderRadius="full" px={2.5} py={1}>
                {viewMode === "all" ? "COMPANY VIEW" : "MY TASKS"}
              </Badge>
            </HStack>
            <Heading size="lg" color="gray.900">
              {APP_TEXT.dashboard}
            </Heading>
            <Text color="gray.600" maxW="4xl">Assigned jobs and workflow.</Text>
          </Box>

          <Button
            leftIcon={<ArrowRight size={16} />}
            colorScheme="teal"
            borderRadius="xl"
            onClick={() => router.push("/rd")}
            alignSelf={{ base: "start", lg: "center" }}
          >
            Create Job
          </Button>
        </Stack>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} spacing={4} display={{ base: "none", md: "grid" }}>
          <Card variant="outline" borderRadius="2xl" shadow="sm">
            <CardBody>
              <Text fontSize="sm" color="gray.500">Total Jobs</Text>
              <Text fontSize="3xl" fontWeight="bold" mt={1}>{metrics.total}</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl" shadow="sm">
            <CardBody>
              <Text fontSize="sm" color="gray.500">Pending</Text>
              <Text fontSize="3xl" fontWeight="bold" mt={1} color="gray.800">{metrics.pending}</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl" shadow="sm">
            <CardBody>
              <Text fontSize="sm" color="gray.500">In Progress</Text>
              <Text fontSize="3xl" fontWeight="bold" mt={1} color="orange.600">{metrics.inProgress}</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl" shadow="sm">
            <CardBody>
              <Text fontSize="sm" color="gray.500">QA</Text>
              <Text fontSize="3xl" fontWeight="bold" mt={1} color="blue.600">{metrics.qa}</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl" shadow="sm">
            <CardBody>
              <Text fontSize="sm" color="gray.500">Closed</Text>
              <Text fontSize="3xl" fontWeight="bold" mt={1} color="green.600">{metrics.closed}</Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card variant="outline" borderRadius="2xl" shadow="sm">
          <CardBody p={6}>
            <HStack justify="space-between" align="start" mb={4} flexWrap="wrap" spacing={4}>
              <Box>
                <HStack spacing={2} mb={1}>
                  <Icon as={Workflow} color="teal.600" />
                  <Text fontWeight="bold" color="gray.900">Workflow Engine</Text>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  Current pipeline status.
                </Text>
              </Box>
              <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={3} py={1}>
                LIVE
              </Badge>
            </HStack>

            <SimpleGrid columns={{ base: 2, md: 3, lg: 5 }} spacing={3}>
              {stages.map((stage) => {
                const active = (stageCounts[stage.key] ?? 0) > 0;
                return (
                  <Box
                    key={stage.key}
                    p={4}
                    borderWidth="1px"
                    borderRadius="xl"
                    borderColor={active ? `${stage.accent}.200` : "gray.200"}
                    bg={active ? `${stage.accent}.50` : "white"}
                  >
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">
                      {stage.label}
                    </Text>
                    <HStack justify="space-between" mt={2}>
                      <Text fontSize="2xl" fontWeight="bold" color={active ? `${stage.accent}.600` : "gray.300"}>
                        {stageCounts[stage.key] ?? 0}
                      </Text>
                      <Box w="2.5" h="2.5" borderRadius="full" bg={active ? `${stage.accent}.400` : "gray.200"} />
                    </HStack>
                  </Box>
                );
              })}
            </SimpleGrid>
          </CardBody>
        </Card>

        {loading ? (
          <Center py={20}>
            <Spinner size="xl" color="teal.500" />
          </Center>
        ) : jobs.length === 0 ? (
          <Card variant="outline" borderRadius="2xl" shadow="sm">
            <CardBody py={16}>
              <Center>
                <VStack spacing={3}>
                  <Icon as={ClipboardList} boxSize={8} color="gray.300" />
                  <Text color="gray.500">No records.</Text>
                </VStack>
              </Center>
            </CardBody>
          </Card>
        ) : (
          <VStack align="stretch" spacing={4}>
            {jobs.map((job) => {
              const sampledLots = job.lots?.filter((lot) => isLotSamplingCompleted(lot)).length ?? 0;
              const totalLots = job.lots?.length ?? 0;
              const progress = totalLots > 0 ? Math.round((sampledLots / totalLots) * 100) : 0;

              return (
                <Card key={job.id} variant="outline" borderRadius="2xl" shadow="sm">
                  <CardBody p={5}>
                    <SimpleGrid columns={{ base: 1, xl: 4 }} spacing={4} alignItems="center">
                      <VStack align="start" spacing={1}>
                        <HStack spacing={2} flexWrap="wrap">
                          <Badge colorScheme="teal" borderRadius="full" px={3} py={1}>
                            {job.inspectionSerialNumber}
                          </Badge>
                          <Badge colorScheme={getBadgeColor(job.status)} variant="subtle" borderRadius="full" px={2.5} py={1}>
                            {job.status}
                          </Badge>
                        </HStack>
                        <Text fontSize="lg" fontWeight="bold" color="gray.900">
                          {job.clientName}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {job.commodity}
                        </Text>
                      </VStack>

                      <VStack align="start" spacing={2}>
                        <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                          Assignment
                        </Text>
                        <Text fontSize="sm" color="gray.700">
                          Assigned To: {profileName(job.assignedTo, "Unassigned")}
                        </Text>
                        <Text fontSize="sm" color="gray.700">
                          Assigned By: {profileName(job.assignedBy, "—")}
                        </Text>
                      </VStack>

                      <VStack align="start" spacing={2}>
                        <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                          Sampling Progress
                        </Text>
                        <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                          {sampledLots}/{totalLots || 0} lot(s) sampled
                        </Text>
                        <Progress
                          value={progress}
                          size="sm"
                          borderRadius="full"
                          colorScheme={progress === 100 ? "green" : "teal"}
                          w="full"
                        />
                      </VStack>

                      <VStack align={{ base: "stretch", xl: "end" }} spacing={2}>
                        <HStack spacing={2}>
                          <Icon as={Layers3} boxSize={4} color="gray.400" />
                          <Text fontSize="sm" color="gray.700">{totalLots} lot(s)</Text>
                        </HStack>
                        <HStack spacing={2}>
                          <Icon as={Clock3} boxSize={4} color="gray.400" />
                          <Text fontSize="sm" color="gray.700">Updated {formatDate(job.updatedAt)}</Text>
                        </HStack>
                        <Button
                          colorScheme="teal"
                          borderRadius="xl"
            onClick={() => router.push(`/userinsp/job/${job.id}?view=${viewMode}`)}
                          alignSelf={{ base: "stretch", xl: "end" }}
                        >
                          Open Job
                        </Button>
                      </VStack>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              );
            })}
          </VStack>
        )}
      </VStack>
    </ControlTowerLayout>
  );
}
