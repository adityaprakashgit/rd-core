"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  ClipboardList,
  FlaskConical,
  FileDown,
  Layers3,
  Plus,
  Puzzle,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { InspectionJob } from "@/types/inspection";
import { APP_TEXT } from "@/lib/ui-copy";

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
  { key: "LAB", label: "LAB", accent: "purple" },
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
    case "LAB":
      return "purple";
    case "SAMPLING":
      return "orange";
    default:
      return "gray";
  }
}

export default function UserRdDashboard() {
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
      toast({ title: "Failed to load R&D jobs", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const metrics = useMemo(() => {
    const total = jobs.length;
    const sampled = jobs.filter((job) => (job.lots?.filter((lot) => Boolean(lot.sampling)).length ?? 0) > 0).length;
    const pendingQA = jobs.filter((job) => job.status === "QA").length;
    const locked = jobs.filter((job) => job.status === "LOCKED").length;
    const reports = jobs.filter((job) => (job.reportSnapshots?.length ?? 0) > 0).length;
    return { total, sampled, pendingQA, locked, reports };
  }, [jobs]);

  const workflowCounts = useMemo(() => {
    const counts = workflowStages.reduce<Record<string, number>>((acc, stage) => {
      acc[stage.key] = 0;
      return acc;
    }, {});

    jobs.forEach((job) => {
      const totalLots = job.lots?.length ?? 0;
      const sampledLots = job.lots?.filter((lot) => Boolean(lot.sampling)).length ?? 0;

      if (job.status in counts) {
        counts[job.status] += 1;
        return;
      }
      if (sampledLots > 0 && sampledLots < totalLots) {
        counts.SAMPLING += 1;
        return;
      }
      if (sampledLots > 0 && sampledLots === totalLots && totalLots > 0) {
        counts.LAB += 1;
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
              <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={2.5} py={1}>
                R&D CONTROL
              </Badge>
              <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={1}>
                LIVE
              </Badge>
            </HStack>
            <Heading size="lg" color="gray.900">
              {APP_TEXT.dashboard}
            </Heading>
            <Text color="gray.600" maxW="4xl">Jobs and workflow overview.</Text>
          </VStack>

          <HStack spacing={3} wrap="wrap">
            <Button leftIcon={<Plus size={16} />} colorScheme="teal" borderRadius="xl" onClick={() => router.push("/rd")}>
              Create Job
            </Button>
            <Button
              leftIcon={<Puzzle size={16} />}
              variant="outline"
              borderRadius="xl"
              onClick={() => router.push("/playground")}
            >
              Open Playground
            </Button>
            <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={3} py={1}>
              ACTIVE
            </Badge>
          </HStack>
        </HStack>

        <SimpleGrid
          columns={{ base: 1, sm: 2, xl: 5 }}
          spacing={4}
          display={{ base: "none", md: "grid" }}
        >
          <MetricCard title="Assigned Jobs" value={metrics.total} detail="Inspection jobs in R&D scope." accent="purple" />
          <MetricCard title="Sampling Live" value={metrics.sampled} detail="Jobs with active sampling records." accent="orange" />
          <MetricCard title="Pending QA" value={metrics.pendingQA} detail="Jobs queued for quality review." accent="blue" />
          <MetricCard title="Locked" value={metrics.locked} detail="Jobs sealed for downstream use." accent="green" />
          <MetricCard title="Reports Generated" value={metrics.reports} detail="Jobs with generated report snapshots." accent="teal" />
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
                  Current pipeline status.
                </Text>
              </VStack>
              <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={3} py={1}>
                LIVE
              </Badge>
            </HStack>

            <SimpleGrid columns={{ base: 2, md: 4, lg: 7 }} spacing={3}>
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
                  {APP_TEXT.jobs}
                </Heading>
                <Text fontSize="sm" color="gray.600">Assigned jobs.</Text>
              </Box>

              <VStack align="stretch" spacing={4}>
                {jobs.map((job) => {
                  const totalLots = job.lots?.length ?? 0;
                  const sampledLots = job.lots?.filter((lot) => Boolean(lot.sampling)).length ?? 0;
                  const progress = totalLots > 0 ? (sampledLots / totalLots) * 100 : 0;

                  return (
                    <Card key={job.id} variant="outline" borderRadius="2xl" bg="white" shadow="sm">
                      <CardBody p={5}>
                        <SimpleGrid columns={{ base: 1, lg: 4 }} spacing={4} alignItems="center">
                          <VStack align="start" spacing={1}>
                            <HStack spacing={2} wrap="wrap">
                              <Badge colorScheme="purple" variant="solid" borderRadius="full" px={3} py={1}>
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
                              Assay progress
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                              {sampledLots}/{totalLots || 0} lot(s) sampled
                            </Text>
                            <Progress value={progress} size="sm" borderRadius="full" colorScheme={sampledLots === totalLots && totalLots > 0 ? "green" : "purple"} w="full" />
                          </VStack>

                          <VStack align="start" spacing={2}>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                              Reporting
                            </Text>
                            <HStack spacing={2}>
                              <Icon as={ClipboardList} color="gray.400" boxSize={4} />
                              <Text fontSize="sm" color="gray.700">
                                {job.reportSnapshots?.length ?? 0} snapshot(s)
                              </Text>
                            </HStack>
                            <HStack spacing={2}>
                              <Icon as={Layers3} color="gray.400" boxSize={4} />
                              <Text fontSize="sm" color="gray.700">
                                {totalLots} lot(s) registered
                              </Text>
                            </HStack>
                          </VStack>

                          <VStack align="end" spacing={2}>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                              Updated
                            </Text>
                            <Text fontSize="sm" color="gray.700">
                              {formatTime(job.updatedAt || job.createdAt)}
                            </Text>
                            <HStack spacing={2} wrap="wrap" justify="end">
                              <Button colorScheme="teal" borderRadius="xl" onClick={() => router.push(`/userrd/job/${job.id}`)}>
                                Open Job
                              </Button>
                              <Button variant="outline" borderRadius="xl" leftIcon={<FileDown size={16} />} onClick={() => router.push("/reports")}>
                                Open Reports
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
                          <Icon as={FlaskConical} boxSize={8} color="gray.300" />
                          <Text color="gray.500">No records.</Text>
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
                    {APP_TEXT.status}
                  </Heading>
                  <Text fontSize="sm" color="gray.600">Secondary status.</Text>
                </VStack>
                <Icon as={Sparkles} color="teal.600" />
              </HStack>

              <Accordion allowMultiple defaultIndex={[]}>
                {[
                  { title: "Capture", status: "ACTIVE", color: "green" },
                  { title: "Trials", status: "READY", color: "blue" },
                  { title: "Metrics", status: "CONTROLLED", color: "purple" },
                  { title: "Audit", status: "READY", color: "teal" },
                ].map((item) => (
                  <AccordionItem key={item.title} border="none" mb={2}>
                    <Card variant="outline" borderRadius="xl" bg={`${item.color}.50`} borderColor={`${item.color}.100`}>
                      <AccordionButton px={4} py={3}>
                        <HStack justify="space-between" w="full">
                          <Text fontWeight="bold" color="gray.900">{item.title}</Text>
                          <HStack>
                            <Badge colorScheme={item.color} variant="subtle" borderRadius="full" px={2.5} py={1}>
                              {item.status}
                            </Badge>
                            <AccordionIcon />
                          </HStack>
                        </HStack>
                      </AccordionButton>
                      <AccordionPanel pt={0} pb={3}>
                        <Text fontSize="sm" color="gray.600">Status panel</Text>
                      </AccordionPanel>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
