"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Thead,
  Tr,
  Th,
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  Camera,
  Layers3,
  Plus,
  ScanFace,
  Eye,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { AuditTrail } from "@/components/inspection/AuditTrail";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { AuditLog, InspectionJob, InspectionLot, Sampling } from "@/types/inspection";

function getSamplingRecord(lot: InspectionLot): Sampling | null {
  const samplingValue = lot.sampling as Sampling | Sampling[] | null | undefined;
  if (!samplingValue) {
    return null;
  }
  return Array.isArray(samplingValue) ? samplingValue[0] ?? null : samplingValue;
}

function getLotSamplingStatus(lot: InspectionLot) {
  const sampling = getSamplingRecord(lot);
  if (!sampling) {
    return { label: "Not Started", color: "gray" };
  }

  const hasAllImages = Boolean(sampling.beforePhotoUrl && sampling.duringPhotoUrl && sampling.afterPhotoUrl);
  return hasAllImages
    ? { label: "Completed", color: "green" }
    : { label: "In Progress", color: "orange" };
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { viewMode } = useWorkspaceView();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [savingLot, setSavingLot] = useState(false);
  const [newLotNumber, setNewLotNumber] = useState("");
  const [newTotalBags, setNewTotalBags] = useState("1");

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, logsRes] = await Promise.all([
        fetch(`/api/inspection/jobs?view=${viewMode}`),
        fetch(`/api/inspection/audit?jobId=${jobId}`),
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(Array.isArray(jobsData) ? jobsData : []);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(Array.isArray(logsData) ? logsData : []);
      }
    } catch {
      toast({ title: "Failed to load job data", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [jobId, toast, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const job = useMemo(() => jobs.find((entry) => entry.id === jobId) ?? null, [jobs, jobId]);

  const lotStats = useMemo(() => {
    const lots = job?.lots ?? [];
    const completed = lots.filter((lot) => getLotSamplingStatus(lot).label === "Completed").length;
    const inProgress = lots.filter((lot) => getLotSamplingStatus(lot).label === "In Progress").length;
    const notStarted = lots.filter((lot) => getLotSamplingStatus(lot).label === "Not Started").length;
    return { total: lots.length, completed, inProgress, notStarted };
  }, [job]);

  const handleAddLot = useCallback(async () => {
    if (!jobId || !newLotNumber.trim()) {
      toast({ title: "Lot number is required", status: "warning" });
      return;
    }

    setSavingLot(true);
    try {
      const res = await fetch("/api/inspection/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotNumber: newLotNumber.trim(),
          totalBags: Number(newTotalBags) || 1,
        }),
      });

      if (!res.ok) {
        throw await res.json();
      }

      toast({ title: "Lot added", status: "success" });
      setNewLotNumber("");
      setNewTotalBags("1");
      onClose();
      await fetchData();
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to add lot";
      toast({ title: "Add lot failed", description: details, status: "error" });
    } finally {
      setSavingLot(false);
    }
  }, [fetchData, jobId, newLotNumber, newTotalBags, onClose, toast]);

  const navigateToNextPendingLot = useCallback(() => {
    if (!job?.lots?.length) {
      return;
    }

    const pending = job.lots.find((lot) => getLotSamplingStatus(lot).label !== "Completed") ?? job.lots[0];
    router.push(`/userinsp/job/${jobId}/lot/${pending.id}?view=${viewMode}`);
  }, [job, jobId, router, viewMode]);

  if (loading) {
    return (
      <ControlTowerLayout>
        <Center minH="40vh">
          <Spinner size="xl" color="teal.500" />
        </Center>
      </ControlTowerLayout>
    );
  }

  if (!job) {
    return (
      <ControlTowerLayout>
        <Center minH="40vh">
          <Text color="gray.500">Job not found.</Text>
        </Center>
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" flexWrap="wrap" spacing={3}>
          <HStack spacing={3}>
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => router.push("/userinsp")}
            >
              Back
            </Button>
            <Box>
              <HStack spacing={2} wrap="wrap">
                <Badge colorScheme="teal" variant="solid" borderRadius="full" px={3} py={1}>
                  {job.inspectionSerialNumber || job.jobReferenceNumber || "JOB"}
                </Badge>
                <Badge colorScheme={job.status === "LOCKED" ? "green" : job.status === "QA" ? "blue" : "gray"} variant="subtle" borderRadius="full" px={2.5} py={1}>
                  {job.status}
                </Badge>
              </HStack>
              <Heading size="lg" color="gray.900" mt={2}>
                {job.clientName}
              </Heading>
              <Text color="gray.600" fontSize="sm" mt={1}>
                Commodity: {job.commodity}
              </Text>
            </Box>
          </HStack>

          <HStack spacing={3} flexWrap="wrap">
            <Button leftIcon={<Plus size={16} />} colorScheme="teal" borderRadius="xl" onClick={onOpen}>
              Add Lot
            </Button>
            <Button
              leftIcon={<ScanFace size={16} />}
              variant="outline"
              borderRadius="xl"
              onClick={navigateToNextPendingLot}
              isDisabled={!job.lots?.length}
            >
              Open Next Lot
            </Button>
            <Button
              leftIcon={<Eye size={16} />}
              variant="outline"
              borderRadius="xl"
              onClick={() => router.push(`/userinsp/job/${jobId}/lot/${job.lots?.[0]?.id}?view=${viewMode}`)}
              isDisabled={!job.lots?.length}
            >
              Open First Lot
            </Button>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} display={{ base: "none", md: "grid" }}>
          {[
            { label: "Lots Registered", value: lotStats.total, accent: "teal", detail: "Inventory under control" },
            { label: "Not Started", value: lotStats.notStarted, accent: "gray", detail: "Awaiting sampling capture" },
            { label: "In Progress", value: lotStats.inProgress, accent: "orange", detail: "Partial sampling saved" },
            { label: "Completed", value: lotStats.completed, accent: "green", detail: "Sampling workflow sealed" },
          ].map((item) => (
            <Card key={item.label} variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <Text fontSize="sm" color="gray.500" fontWeight="medium">
                  {item.label}
                </Text>
                <Text fontSize="3xl" fontWeight="bold" color={`${item.accent}.600`} mt={2}>
                  {item.value}
                </Text>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {item.detail}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
          <Box gridColumn={{ xl: "span 2" }}>
            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={0}>
                <Box p={5} borderBottomWidth="1px" borderColor="gray.100">
                  <Heading size="md" color="gray.900">
                    Lots Table
                  </Heading>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Lot status and actions.
                  </Text>
                </Box>

                <TableContainer>
                  <Table size="sm" variant="simple">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Lot Number</Th>
                        <Th>Total Bags</Th>
                        <Th>Sampling Status</Th>
                        <Th textAlign="right">Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {job.lots?.map((lot) => {
                        const status = getLotSamplingStatus(lot);
                        return (
                          <Tr key={lot.id}>
                            <Td fontWeight="semibold" color="gray.900">
                              {lot.lotNumber}
                            </Td>
                            <Td>{lot.totalBags}</Td>
                            <Td>
                              <Badge colorScheme={status.color} variant="subtle" borderRadius="full" px={2.5} py={1}>
                                {status.label}
                              </Badge>
                            </Td>
                            <Td>
                              <HStack justify="end" spacing={2} flexWrap="wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  leftIcon={<Camera size={14} />}
                                  onClick={() => router.push(`/userinsp/job/${jobId}/lot/${lot.id}?view=${viewMode}`)}
                                >
                                  Open Sampling
                                </Button>
                                <Button
                                  size="sm"
                                  colorScheme="teal"
                                  onClick={() => router.push(`/userinsp/job/${jobId}/lot/${lot.id}?view=${viewMode}`)}
                                >
                                  Open Lot
                                </Button>
                              </HStack>
                            </Td>
                          </Tr>
                        );
                      })}

                      {(job.lots?.length ?? 0) === 0 && (
                        <Tr>
                          <Td colSpan={4}>
                            <Center py={12}>
                              <VStack spacing={2}>
                                <Icon as={Layers3} boxSize={8} color="gray.300" />
                                <Text color="gray.500">No records.</Text>
                              </VStack>
                            </Center>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </Box>

          <VStack align="stretch" spacing={6}>
            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <HStack justify="space-between" mb={4}>
                  <Heading size="sm" color="gray.900">
                    Status Summary
                  </Heading>
                  <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
                    CONTROLLED
                  </Badge>
                </HStack>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">
                      Completed
                    </Text>
                    <Text fontWeight="bold" color="gray.900">
                      {lotStats.completed}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">
                      In Progress
                    </Text>
                    <Text fontWeight="bold" color="gray.900">
                      {lotStats.inProgress}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.600">
                      Not Started
                    </Text>
                    <Text fontWeight="bold" color="gray.900">
                      {lotStats.notStarted}
                    </Text>
                  </HStack>
                  <Divider />
                  <Text fontSize="sm" color="gray.600">
                    Status from lot records.
                  </Text>
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <Heading size="sm" color="gray.900" mb={3}>
                  Audit Trail
                </Heading>
                <AuditTrail logs={logs} />
              </CardBody>
            </Card>
          </VStack>
        </SimpleGrid>
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent borderRadius="2xl">
          <ModalHeader>Add Lot</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel>Lot number</FormLabel>
                <Input value={newLotNumber} onChange={(e) => setNewLotNumber(e.target.value)} placeholder="LOT-001" />
              </FormControl>
              <FormControl>
                <FormLabel>Total bags</FormLabel>
                <Input type="number" min={1} value={newTotalBags} onChange={(e) => setNewTotalBags(e.target.value)} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="teal" onClick={handleAddLot} isLoading={savingLot}>
                Save Lot
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ControlTowerLayout>
  );
}
