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
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  FileDown,
  Layers3,
  PackageSearch,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { InspectionJob, InspectionLot, Sampling } from "@/types/inspection";

type MetricCardProps = {
  title: string;
  value: string | number;
  detail: string;
  accent: string;
};

const workflowStages = [
  { key: "CREATED", label: "CREATED", accent: "gray" },
  { key: "LOTS_READY", label: "LOTS_READY", accent: "cyan" },
  { key: "SAMPLING", label: "SAMPLING", accent: "orange" },
  { key: "QA", label: "QA", accent: "blue" },
  { key: "LOCKED", label: "LOCKED", accent: "green" },
  { key: "DISPATCHED", label: "DISPATCHED", accent: "teal" },
];

function MetricCard({ title, value, detail, accent }: MetricCardProps) {
  return (
    <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
      <CardBody p={5}>
        <HStack justify="space-between" align="start" mb={4}>
          <Box w="2" h="10" borderRadius="full" bg={`${accent}.400`} />
          <Badge variant="subtle" colorScheme={accent} borderRadius="full" px={2.5} py={1}>
            KPI
          </Badge>
        </HStack>
        <Text fontSize="sm" color="gray.500" fontWeight="medium">
          {title}
        </Text>
        <Text fontSize="3xl" fontWeight="bold" color="gray.900" mt={1}>
          {value}
        </Text>
        <Text fontSize="sm" color="gray.600" mt={1}>
          {detail}
        </Text>
      </CardBody>
    </Card>
  );
}

function formatTime(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function getStatusColor(status: string) {
  switch (status) {
    case "LOCKED":
      return "green";
    case "QA":
      return "blue";
    case "DISPATCHED":
      return "teal";
    case "SAMPLING":
      return "orange";
    case "LOTS_READY":
      return "cyan";
    default:
      return "gray";
  }
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

export default function OperationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/inspection/jobs?view=all");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load operations jobs", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const metrics = useMemo(() => {
    const total = jobs.length;
    const lotsReady = jobs.filter((job) => (job.lots?.length ?? 0) > 0).length;
    const samplingActive = jobs.filter((job) => {
      const totalLots = job.lots?.length ?? 0;
      const sampledLots = job.lots?.filter((lot) => isLotSamplingCompleted(lot)).length ?? 0;
      return totalLots > 0 && sampledLots > 0 && sampledLots < totalLots;
    }).length;
    const locked = jobs.filter((job) => job.status === "LOCKED").length;
    const dispatched = jobs.filter((job) => job.status === "DISPATCHED").length;
    return { total, lotsReady, samplingActive, locked, dispatched };
  }, [jobs]);

  const workflowCounts = useMemo(() => {
    const counts = workflowStages.reduce<Record<string, number>>((acc, stage) => {
      acc[stage.key] = 0;
      return acc;
    }, {});

    jobs.forEach((job) => {
      const totalLots = job.lots?.length ?? 0;
      const sampledLots = job.lots?.filter((lot) => isLotSamplingCompleted(lot)).length ?? 0;

      if (job.status in counts) {
        counts[job.status] += 1;
        return;
      }
      if (sampledLots > 0 && sampledLots < totalLots) {
        counts.SAMPLING += 1;
        return;
      }
      if (totalLots > 0) {
        counts.LOTS_READY += 1;
        return;
      }
      counts.CREATED += 1;
    });

    return counts;
  }, [jobs]);

  if (loading) {
    return (
      <ControlTowerLayout>
        <Center minH="40vh">
          <Spinner size="xl" color="teal.500" />
        </Center>
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" align="start" flexWrap="wrap" spacing={4}>
          <VStack align="start" spacing={1}>
            <HStack spacing={2}>
              <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
                OPERATIONS
              </Badge>
              <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={2.5} py={1}>
                LIVE
              </Badge>
            </HStack>
            <Heading size="lg" color="gray.900">
              Operations Control Tower
            </Heading>
            <Text color="gray.600" maxW="4xl">
              Structured inspection registry for intake, sampling, QA, and dispatch execution.
            </Text>
          </VStack>

          <HStack spacing={3} wrap="wrap">
            <Button colorScheme="teal" borderRadius="xl" onClick={() => router.push("/rd")}>
              Create Job
            </Button>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={3} py={1}>
              EXECUTION READY
            </Badge>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} spacing={4}>
          <MetricCard title="Total Jobs" value={metrics.total} detail="Inspection jobs in the registry." accent="teal" />
          <MetricCard title="Lots Ready" value={metrics.lotsReady} detail="Jobs with at least one lot onboarded." accent="cyan" />
          <MetricCard title="Sampling Active" value={metrics.samplingActive} detail="Jobs with partial sampling progress." accent="orange" />
          <MetricCard title="Locked" value={metrics.locked} detail="Jobs sealed for governance review." accent="green" />
          <MetricCard title="Dispatched" value={metrics.dispatched} detail="Jobs released to downstream operations." accent="purple" />
        </SimpleGrid>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack justify="space-between" align="start" mb={4} flexWrap="wrap" spacing={4}>
              <VStack align="start" spacing={1}>
                <HStack>
                  <Icon as={Workflow} color="teal.600" />
                  <Text fontWeight="bold" color="gray.900">
                    Workflow Engine
                  </Text>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  CREATED to DISPATCHED visibility across the operations lane.
                </Text>
              </VStack>
              <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={3} py={1}>
                CONTROLLED COPY
              </Badge>
            </HStack>

            <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={3}>
              {workflowStages.map((stage) => (
                <Box key={stage.key} p={4} borderWidth="1px" borderRadius="xl" borderColor="gray.200" bg="gray.50">
                  <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">
                    {stage.label.replace("_", " ")}
                  </Text>
                  <HStack justify="space-between" mt={2}>
                    <Text fontSize="2xl" fontWeight="bold" color={`${stage.accent}.600`}>
                      {workflowCounts[stage.key] ?? 0}
                    </Text>
                    <Box w="2.5" h="2.5" borderRadius="full" bg={`${stage.accent}.400`} />
                  </HStack>
                </Box>
              ))}
            </SimpleGrid>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
          <Box gridColumn={{ xl: "span 2" }}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Heading size="md" color="gray.900">
                  Inspection Jobs
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Job cards with sampling progress and workflow entry points.
                </Text>
              </Box>

              <VStack align="stretch" spacing={4}>
                {jobs.map((job) => {
                  const totalLots = job.lots?.length ?? 0;
                  const sampledLots = job.lots?.filter((lot) => isLotSamplingCompleted(lot)).length ?? 0;
                  const progress = totalLots > 0 ? (sampledLots / totalLots) * 100 : 0;

                  return (
                    <Card key={job.id} variant="outline" borderRadius="2xl" bg="white" shadow="sm">
                      <CardBody p={5}>
                        <SimpleGrid columns={{ base: 1, lg: 4 }} spacing={4} alignItems="center">
                          <VStack align="start" spacing={1}>
                            <HStack spacing={2} wrap="wrap">
                              <Badge colorScheme="teal" variant="solid" borderRadius="full" px={3} py={1}>
                                {job.inspectionSerialNumber || job.jobReferenceNumber || "JOB"}
                              </Badge>
                              <Badge colorScheme={getStatusColor(job.status)} variant="subtle" borderRadius="full" px={2.5} py={1}>
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
                              Sampling
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                              {sampledLots}/{totalLots || 0} lot(s) sampled
                            </Text>
                            <Progress value={progress} size="sm" borderRadius="full" colorScheme={sampledLots === totalLots && totalLots > 0 ? "green" : "teal"} w="full" />
                          </VStack>

                          <VStack align="start" spacing={2}>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                              State
                            </Text>
                            <HStack spacing={2}>
                              <Icon as={Layers3} color="gray.400" boxSize={4} />
                              <Text fontSize="sm" color="gray.700">
                                {totalLots} lot(s) registered
                              </Text>
                            </HStack>
                            <HStack spacing={2}>
                              <Icon as={ShieldCheck} color="gray.400" boxSize={4} />
                              <Text fontSize="sm" color="gray.700">
                                Last updated {formatTime(job.updatedAt || job.createdAt)}
                              </Text>
                            </HStack>
                          </VStack>

                          <VStack align="end" spacing={2}>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                              Actions
                            </Text>
                            <HStack spacing={2} wrap="wrap" justify="end">
                              <Button colorScheme="teal" borderRadius="xl" onClick={() => router.push(`/operations/job/${job.id}`)}>
                                Open Workflow
                              </Button>
                              <Button variant="outline" borderRadius="xl" leftIcon={<ScanFace size={16} />} onClick={() => router.push(`/operations/job/${job.id}`)}>
                                Lots
                              </Button>
                              <Button variant="outline" borderRadius="xl" leftIcon={<FileDown size={16} />}>
                                Summary
                              </Button>
                            </HStack>
                          </VStack>
                        </SimpleGrid>
                      </CardBody>
                    </Card>
                  );
                })}

                {jobs.length === 0 && (
                  <Card variant="outline" borderRadius="2xl" bg="white">
                    <CardBody>
                      <Center py={14}>
                        <VStack spacing={2}>
                          <Icon as={PackageSearch} boxSize={8} color="gray.300" />
                          <Text color="gray.500">No operational jobs are registered.</Text>
                        </VStack>
                      </Center>
                    </CardBody>
                  </Card>
                )}
              </VStack>
            </VStack>
          </Box>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm" h="full">
            <CardBody p={6}>
              <HStack justify="space-between" align="start" mb={4}>
                <VStack align="start" spacing={1}>
                  <Heading size="md" color="gray.900">
                    Module Readiness
                  </Heading>
                  <Text fontSize="sm" color="gray.600">
                    Operational control modules and dispatch readiness.
                  </Text>
                </VStack>
                <Icon as={Sparkles} color="teal.600" />
              </HStack>

              <VStack align="stretch" spacing={3}>
                {[
                  { title: "Job & Lot Intake", desc: "Job registration and lot onboarding.", status: "READY", color: "green" },
                  { title: "Sampling Discipline", desc: "Photo traceability and unit capture.", status: "CONTROLLED", color: "blue" },
                  { title: "QA Governance", desc: "Quality gates and lock transitions.", status: "READY", color: "green" },
                  { title: "Dispatch Documentation", desc: "Release-ready documentation packets.", status: "READY", color: "teal" },
                ].map((item) => (
                  <Card key={item.title} variant="outline" borderRadius="xl" bg={`${item.color}.50`} borderColor={`${item.color}.100`}>
                    <CardBody p={4}>
                      <HStack justify="space-between" align="start" spacing={3}>
                        <Box>
                          <Text fontWeight="bold" color="gray.900">
                            {item.title}
                          </Text>
                          <Text fontSize="sm" color="gray.600" mt={1}>
                            {item.desc}
                          </Text>
                        </Box>
                        <Badge colorScheme={item.color} variant="subtle" borderRadius="full" px={2.5} py={1}>
                          {item.status}
                        </Badge>
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
