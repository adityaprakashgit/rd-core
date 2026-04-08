"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  FormControl,
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
  Select,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FlaskConical,
  Plus,
} from "lucide-react";

import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint } from "@/components/enterprise/AsyncState";
import { DetailTabsLayout, HistoryTimeline, LinkedRecordsPanel } from "@/components/enterprise/EnterprisePatterns";
import { WorkbenchPageTemplate } from "@/components/enterprise/PageTemplates";
import { WorkflowStepTracker, type WorkflowStep } from "@/components/enterprise/WorkflowStepTracker";
import { AuditTrail } from "@/components/inspection/AuditTrail";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { getStoredAuth } from "@/lib/auth-client";
import { deriveSampleStatus } from "@/lib/sample-management";
import { buildWorkflowSteps, getWorkflowStepRoute } from "@/lib/workflow-stage";
import {
  getDefaultReportPreferences,
  getReportDocumentTypeLabel,
  REPORT_DOCUMENT_TYPES,
  REPORT_PREFERENCES_STORAGE_KEY,
  sanitizeReportPreferences,
  type ReportPreferences,
} from "@/lib/report-preferences";
import type { AuditLog, InspectionJob, RDTrial, SamplePacket } from "@/types/inspection";

type RdStage = "sample" | "packets" | "trials" | "report" | "qa";

function inferStage({
  readySampleCount,
  packets,
  trials,
  job,
}: {
  readySampleCount: number;
  packets: SamplePacket[];
  trials: RDTrial[];
  job: InspectionJob | null;
}): RdStage {
  if (readySampleCount === 0 && packets.length === 0) {
    return "sample";
  }
  if (packets.length === 0) {
    return "packets";
  }
  if (trials.length === 0 || trials.some((trial) => trial.measurements.length === 0)) {
    return "trials";
  }
  if (job?.status !== "QA" && job?.status !== "LOCKED") {
    return "report";
  }
  return "qa";
}

function formatMeasurementValue(value: number | string | null | undefined) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(4) : "—";
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function isEnterKey(event: React.KeyboardEvent<HTMLInputElement>) {
  return event.key === "Enter";
}

export default function UserRdJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [job, setJob] = useState<InspectionJob | null>(null);
  const [packets, setPackets] = useState<SamplePacket[]>([]);
  const [trials, setTrials] = useState<RDTrial[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState<string | null>(null);
  const [elementInput, setElementInput] = useState<Record<string, string>>({});
  const [valueInput, setValueInput] = useState<Record<string, string>>({});
  const [buildingReport, setBuildingReport] = useState(false);
  const [reportResult, setReportResult] = useState<{ validation: { isValid: boolean; errors?: string[] } } | null>(null);
  const [performingQA, setPerformingQA] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");
  const [reportPreferences, setReportPreferences] = useState<ReportPreferences>(() =>
    getDefaultReportPreferences("Inspection Control Tower")
  );
  const [selectedDocumentType, setSelectedDocumentType] = useState<ReportPreferences["defaultDocumentType"]>("EXPORT");
  const [pdfPreview, setPdfPreview] = useState<{ fileName: string; url: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/inspection/audit?jobId=${jobId}`);
    if (!res.ok) {
      throw new Error("Failed to load audit trail.");
    }
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
  }, [jobId]);

  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [jobsRes, trialsRes, snapshotsRes, packetsRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch(`/api/rd/trial?jobId=${jobId}`),
        fetch(`/api/report/generate?jobId=${jobId}`),
        fetch(`/api/rd/packet?jobId=${jobId}`),
      ]);

      if (!jobsRes.ok || !trialsRes.ok || !snapshotsRes.ok || !packetsRes.ok) {
        throw new Error("Failed to load R&D workspace.");
      }

      const jobs = await jobsRes.json();
      const nextJob = Array.isArray(jobs) ? jobs.find((entry: InspectionJob) => entry.id === jobId) ?? null : null;
      setJob(nextJob);

      const trialsData = await trialsRes.json();
      setTrials(Array.isArray(trialsData) ? trialsData : []);
      const packetsData = await packetsRes.json();
      setPackets(Array.isArray(packetsData) ? packetsData : []);

      await fetchLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load R&D workspace.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchLogs, jobId]);

  useEffect(() => {
    if (jobId) {
      void fetchBaseData();
    }
  }, [fetchBaseData, jobId]);

  useEffect(() => {
    const baseCompanyName = "Inspection Control Tower";
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(REPORT_PREFERENCES_STORAGE_KEY) : null;
    const nextPreferences = stored
      ? (() => {
          try {
            return sanitizeReportPreferences(JSON.parse(stored), baseCompanyName);
          } catch {
            return getDefaultReportPreferences(baseCompanyName);
          }
        })()
      : getDefaultReportPreferences(baseCompanyName);
    setReportPreferences(nextPreferences);
    setSelectedDocumentType(nextPreferences.defaultDocumentType);
    setIsAdmin(getStoredAuth()?.role === "ADMIN");
  }, []);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
    };
  }, [pdfPreview]);

  const handleTrialStart = useCallback(async () => {
    if (!selectedPacketId) {
      toast({ title: "Select a packet first", status: "error" });
      return;
    }

    setStartingTrial(true);
    try {
      const res = await fetch("/api/rd/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, packetId: selectedPacketId, trialNumber: trials.length + 1 }),
      });
      if (!res.ok) throw await res.json();
      await fetchBaseData();
      setSelectedPacketId("");
    } catch (error: unknown) {
      const details =
        error && typeof error === "object" && "details" in error ? String((error as { details?: unknown }).details) : undefined;
      toast({ title: "Trial creation failed", description: details, status: "error" });
    } finally {
      setStartingTrial(false);
    }
  }, [fetchBaseData, jobId, selectedPacketId, toast, trials.length]);

  const handleMeasurementSave = async (trialId: string) => {
    const element = elementInput[trialId];
    const value = valueInput[trialId];
    if (!element || !value) return;

    setSavingMeasurement(trialId);
    try {
      const res = await fetch("/api/rd/measurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialId, element, value: parseFloat(value) }),
      });
      if (!res.ok) throw await res.json();
      await fetchBaseData();
      setElementInput((prev) => ({ ...prev, [trialId]: "" }));
      setValueInput((prev) => ({ ...prev, [trialId]: "" }));
    } catch {
      toast({ title: "Measurement save failed", status: "error" });
    } finally {
      setSavingMeasurement(null);
    }
  };

  const handleReportBuild = async () => {
    setBuildingReport(true);
    try {
      const res = await fetch("/api/report/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw await res.json();
      setReportResult(await res.json());
    } catch {
      toast({ title: "Validation failed", status: "error" });
    } finally {
      setBuildingReport(false);
    }
  };

  const handleExport = async (format: "pdf" | "excel") => {
    try {
      const res = await fetch("/api/report/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          format,
          documentType: selectedDocumentType,
          reportPreferences,
        }),
      });

      if (!res.ok) {
        throw new Error("Export failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const fileName = `${selectedDocumentType}_Report_${job?.inspectionSerialNumber || job?.jobReferenceNumber || "job"}.${format === "excel" ? "xlsx" : "pdf"}`;

      if (format === "pdf") {
        setPdfPreview((current) => {
          if (current?.url) {
            URL.revokeObjectURL(current.url);
          }
          return { fileName, url };
        });
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", status: "error" });
    }
  };

  const handleDownloadPreview = () => {
    if (!pdfPreview) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = pdfPreview.url;
    anchor.download = pdfPreview.fileName;
    anchor.click();
  };

  const closePreview = () => {
    setPdfPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  };

  const handleQAAction = async (action: "SUBMIT" | "APPROVE" | "REJECT") => {
    setPerformingQA(true);
    try {
      const res = await fetch("/api/inspection/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
        throw new Error(payload?.details ?? payload?.error ?? "QA action failed.");
      }
      await fetchBaseData();
      toast({ title: "Status updated", status: "success" });
    } catch (error) {
      const description = error instanceof Error ? error.message : "QA action failed.";
      toast({ title: "QA error", description, status: "error" });
    } finally {
      setPerformingQA(false);
    }
  };

  const isLocked = job?.status === "LOCKED";
  const isQA = job?.status === "QA";
  const isEditable = !isLocked && !isQA;
  const readySampleLots = useMemo(
    () =>
      (job?.lots ?? []).filter((lot) => lot.sample && deriveSampleStatus(lot.sample) === "READY_FOR_PACKETING"),
    [job?.lots],
  );
  const availablePackets = useMemo(
    () => packets.filter((packet) => packet.packetStatus === "AVAILABLE" && packet.allocation?.allocationStatus === "AVAILABLE"),
    [packets],
  );
  const rdStage = useMemo(
    () => inferStage({ readySampleCount: readySampleLots.length, packets, trials, job }),
    [job, packets, readySampleLots.length, trials],
  );
  const jumpToSection = useCallback((sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  const navigateWorkflowStep = useCallback(
    (stepId: string) => {
      if (!job) {
        return;
      }

      switch (stepId) {
        case "lab":
          jumpToSection(
            rdStage === "sample"
              ? "rd-sample-section"
              : rdStage === "packets"
                ? "rd-packets-section"
                : rdStage === "trials"
                  ? "rd-trials-section"
                  : rdStage === "report"
                    ? "rd-report-section"
                    : "rd-qa-section",
          );
          return;
        case "reporting":
          jumpToSection("rd-report-section");
          return;
        default:
          router.push(getWorkflowStepRoute(job.id, stepId));
      }
    },
    [job, jumpToSection, rdStage, router],
  );
  const workflowSteps = useMemo<WorkflowStep[]>(
    () =>
      job
        ? buildWorkflowSteps(job).map((step) => ({
            ...step,
            onClick: () => navigateWorkflowStep(step.id),
          }))
        : [],
    [job, navigateWorkflowStep],
  );
  const trialCount = trials.length;
  const measurementCount = trials.reduce((sum, trial) => sum + trial.measurements.length, 0);
  const incompleteTrials = trials.filter((trial) => trial.measurements.length === 0).length;

  const primaryAction = useMemo(() => {
    if (readySampleLots.length === 0 && packets.length === 0) {
      return "Finish sample handoff";
    }
    if (packets.length === 0) {
      return "Finalize packets";
    }
    if (trials.length === 0) {
      return "Start first trial";
    }
    if (incompleteTrials > 0) {
      return `Complete ${incompleteTrials} trial${incompleteTrials === 1 ? "" : "s"}`;
    }
    if (job?.status === "QA") {
      return "Resolve QA decision";
    }
    if (job?.status === "LOCKED") {
      return "Export final report";
    }
    return "Validate and build report";
  }, [incompleteTrials, job?.status, packets.length, readySampleLots.length, trials.length]);
  const releaseCriteria = useMemo(
    () => [
      {
        label: "At least one sample ready for packeting",
        satisfied: readySampleLots.length > 0,
        detail: "Packet management starts only after the sample handoff is complete.",
      },
      {
        label: "At least one packet available",
        satisfied: availablePackets.length > 0,
        detail: "Trials stay blocked until packet records are released for use.",
      },
      {
        label: "All trials have measurements",
        satisfied: trialCount > 0 && incompleteTrials === 0,
        detail: "Validation is meaningful only after every trial has data.",
      },
      {
        label: "Report validated",
        satisfied: Boolean(reportResult?.validation.isValid),
        detail: "Run validation before export or QA handoff.",
      },
      {
        label: "QA status resolved",
        satisfied: job?.status === "LOCKED" || job?.status === "QA",
        detail: "Approval happens after the lab stage is complete.",
      },
    ],
    [availablePackets.length, incompleteTrials, job?.status, readySampleLots.length, reportResult?.validation.isValid, trialCount],
  );

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={4} rows={3} />
      </ControlTowerLayout>
    );
  }

  if (loadError) {
    return (
      <ControlTowerLayout>
        <InlineErrorState title="R&D workspace unavailable" description={loadError} onRetry={() => void fetchBaseData()} />
      </ControlTowerLayout>
    );
  }

  if (!job) {
    return (
      <ControlTowerLayout>
        <EmptyWorkState title="Job not found" description="The selected R&D workspace could not be loaded." />
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Stack id="rd-overview-section" direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "stretch", lg: "center" }} spacing={3}>
          <HStack spacing={3} align="start">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={() => router.push("/userrd")}>
              Back to R&D
            </Button>
            <Box>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="purple" variant="solid" borderRadius="full" px={3} py={1}>
                  {job.inspectionSerialNumber || job.jobReferenceNumber || "JOB"}
                </Badge>
                <Badge colorScheme={isLocked ? "green" : isQA ? "yellow" : "blue"} borderRadius="full" px={3} py={1}>
                  {job.status}
                </Badge>
                <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1}>
                  Next: {primaryAction}
                </Badge>
              </HStack>
              <Heading size="lg" color="text.primary" mt={2}>
                R&D Job Workspace
              </Heading>
            </Box>
          </HStack>

          <HStack spacing={3} flexWrap="wrap">
            {job.status !== "LOCKED" ? (
              job.status !== "QA" ? (
                <Button colorScheme="yellow" onClick={() => void handleQAAction("SUBMIT")} isLoading={performingQA} leftIcon={<ClipboardCheck size={18} />}>
                  Send to QA
                </Button>
              ) : (
                <>
                  <Button colorScheme="green" onClick={() => void handleQAAction("APPROVE")} isLoading={performingQA} leftIcon={<CheckCircle2 size={18} />}>
                    Approve
                  </Button>
                  <Button colorScheme="red" variant="outline" onClick={() => void handleQAAction("REJECT")} isLoading={performingQA}>
                    Reject
                  </Button>
                </>
              )
            ) : null}
          </HStack>
        </Stack>

        <SimpleGrid display={{ base: "none", lg: "grid" }} columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          {[
            { label: "Current stage", value: rdStage.toUpperCase() },
            { label: "Packets", value: packets.length },
            { label: "Trials", value: trialCount },
            { label: "Measurements", value: measurementCount },
          ].map((item) => (
            <Card key={item.label} variant="outline" borderRadius="2xl">
              <CardBody p={5}>
                <Text fontSize="sm" color="text.muted">
                  {item.label}
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                  {item.value}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        <Card variant="outline" borderRadius="2xl">
          <CardBody p={5}>
            <WorkflowStepTracker title="Job progress" steps={workflowSteps} compact />
          </CardBody>
        </Card>

        <DetailTabsLayout
          tabs={[
            {
              id: "sample-testing-board",
              label: "Sample Testing Board",
              content: (
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color="text.secondary">
                    Review sample handoff and packet readiness for this job.
                  </Text>
                  <HStack spacing={2} flexWrap="wrap">
                    <Button size="sm" variant="outline" onClick={() => jumpToSection("rd-sample-section")}>
                      Open sample section
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => jumpToSection("rd-packets-section")}>
                      Open packet section
                    </Button>
                  </HStack>
                </VStack>
              ),
            },
            {
              id: "test-entry",
              label: "Test Entry",
              content: (
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color="text.secondary">
                    Capture and update trial measurements for packet-linked testing.
                  </Text>
                  <Button size="sm" variant="outline" alignSelf="start" onClick={() => jumpToSection("rd-trials-section")}>
                    Open test entry section
                  </Button>
                </VStack>
              ),
            },
            {
              id: "result-review-approval",
              label: "Result Review / Approval",
              content: (
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color="text.secondary">
                    Validate report readiness, then progress QA decisions.
                  </Text>
                  <HStack spacing={2} flexWrap="wrap">
                    <Button size="sm" variant="outline" onClick={() => jumpToSection("rd-report-section")}>
                      Open result review section
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => jumpToSection("rd-qa-section")}>
                      Open approval history
                    </Button>
                  </HStack>
                </VStack>
              ),
            },
            {
              id: "rd-history",
              label: "R&D History",
              content: (
                <HistoryTimeline
                  events={logs.slice(0, 20).map((log) => ({
                    id: log.id,
                    title: log.entity ? `${log.entity} · ${log.action}` : log.action,
                    subtitle: log.notes || "R&D audit event",
                    at: formatDate(log.createdAt),
                  }))}
                />
              ),
            },
          ]}
          rightRail={
            <VStack align="stretch" spacing={3}>
              <LinkedRecordsPanel
                items={[
                  { label: "Job Number", value: job.inspectionSerialNumber || job.jobReferenceNumber || "Not Available" },
                  { label: "Current Step", value: rdStage.toUpperCase() },
                  { label: "Sample", value: readySampleLots[0]?.sample?.sampleCode || "Not Available" },
                  { label: "Packet", value: availablePackets[0]?.packetCode || "Not Available" },
                  { label: "Traceability", value: "Open", href: readySampleLots[0] ? `/traceability/lot/${readySampleLots[0].id}` : undefined },
                ]}
              />
              <HistoryTimeline
                events={logs.slice(0, 5).map((log) => ({
                  id: `rail-${log.id}`,
                  title: log.entity ? `${log.entity} · ${log.action}` : log.action,
                  subtitle: log.notes || "R&D audit event",
                  at: formatDate(log.createdAt),
                }))}
              />
            </VStack>
          }
        />

        <WorkbenchPageTemplate
          rightLabel="Status & Governance"
          left={
            <VStack align="stretch" spacing={4}>
              <Card id="rd-sample-section" variant="outline" borderRadius="2xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 1
                  </Text>
                  <Heading size="md" color="text.primary" mt={1}>
                    Sample handoff
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2}>
                    Packet and trial work now starts from lot-level samples that reached READY FOR PACKETING in the inspection flow.
                  </Text>

                  {readySampleLots.length > 0 ? (
                    <VStack align="stretch" spacing={3} mt={4}>
                      {readySampleLots.map((lot) => (
                        <Stack
                          key={lot.id}
                          direction={{ base: "column", md: "row" }}
                          spacing={4}
                          p={4}
                          bg="green.50"
                          borderRadius="xl"
                          border="1px solid"
                          borderColor="green.100"
                        >
                          <VStack align="start" spacing={1} flex={1}>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="green" variant="solid" borderRadius="full" px={3} py={1}>
                                Ready
                              </Badge>
                              <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={3} py={1}>
                                {lot.lotNumber}
                              </Badge>
                            </HStack>
                            <Text fontSize="sm" color="text.primary" fontWeight="medium">
                              {lot.materialName || "Lot sample"} is ready for packet creation.
                            </Text>
                            <Text fontSize="xs" color="text.secondary">
                              Open the lot packet workspace to create, seal, and release packets.
                            </Text>
                          </VStack>
                          <Button
                            size="sm"
                            colorScheme="green"
                            variant="outline"
                            onClick={() => router.push(`/operations/job/${job.id}/lot/${lot.id}/packet`)}
                          >
                            Open packet workspace
                          </Button>
                        </Stack>
                      ))}
                    </VStack>
                  ) : (
                    <EmptyWorkState
                      title="No samples ready yet"
                      description="Finish sample management on at least one lot before packeting and trials can start."
                    />
                  )}
                </CardBody>
              </Card>

              <Card id="rd-packets-section" variant="outline" borderRadius="2xl">
                <CardBody p={6}>
                  <Stack direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "stretch", lg: "center" }} spacing={3} mb={5}>
                    <Box>
                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                        Step 2
                      </Text>
                      <Heading size="md" color="text.primary" mt={1}>
                        Packets
                      </Heading>
                    </Box>
                    <Text fontSize="sm" color="text.secondary">
                      Packet editing happens inside each lot packet workspace.
                    </Text>
                  </Stack>

                  <TableContainer>
                    <Table variant="simple" size="sm">
                      <Thead bg="gray.50">
                        <Tr>
                          <Th>Lot</Th>
                          <Th>Sequence</Th>
                          <Th>Packet code</Th>
                          <Th>Status</Th>
                          <Th>Allocation</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {packets.length === 0 ? (
                          <Tr>
                            <Td colSpan={5} textAlign="center" py={4}>
                              <Text color="text.secondary" fontSize="sm">
                                No packets created yet.
                              </Text>
                            </Td>
                          </Tr>
                        ) : (
                          packets.map((packet) => (
                            <Tr key={packet.id}>
                              <Td fontSize="sm" color="text.secondary">
                                {packet.lot?.lotNumber ?? "—"}
                              </Td>
                              <Td>
                                <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={3} py={1}>
                                  Packet #{packet.packetNo}
                                </Badge>
                              </Td>
                              <Td fontFamily="mono" fontSize="xs" color="text.secondary">
                                {packet.packetCode}
                              </Td>
                              <Td>
                                <Badge colorScheme={packet.packetStatus === "AVAILABLE" ? "green" : "gray"} variant="subtle" borderRadius="full" px={3} py={1}>
                                  {packet.packetStatus}
                                </Badge>
                              </Td>
                              <Td fontSize="sm" color="text.secondary">
                                {packet.allocation?.allocationStatus ?? "BLOCKED"}
                              </Td>
                            </Tr>
                          ))
                        )}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </CardBody>
              </Card>

              <Card id="rd-trials-section" variant="outline" borderRadius="2xl">
                <CardBody p={6}>
                  <Stack direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "stretch", lg: "center" }} spacing={3} mb={5}>
                    <Box>
                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                        Step 3
                      </Text>
                      <Heading size="md" color="text.primary" mt={1}>
                        Trials
                      </Heading>
                    </Box>
                    <Stack direction={{ base: "column", md: "row" }} spacing={3}>
                      <FormControl minW={{ md: "260px" }}>
                        <Select
                          size="sm"
                          placeholder={availablePackets.length > 0 ? "Select available packet" : "No packet available"}
                          value={selectedPacketId}
                          onChange={(event) => setSelectedPacketId(event.target.value)}
                          isDisabled={!isEditable || availablePackets.length === 0}
                        >
                          {availablePackets.map((packet) => (
                            <option key={packet.id} value={packet.id}>
                              {packet.packetCode} {packet.lot?.lotNumber ? `• ${packet.lot.lotNumber}` : ""}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        size="sm"
                        colorScheme="purple"
                        leftIcon={<Plus size={16} />}
                        onClick={handleTrialStart}
                        isLoading={startingTrial}
                        isDisabled={!isEditable || availablePackets.length === 0 || !selectedPacketId}
                      >
                        Add trial
                      </Button>
                    </Stack>
                  </Stack>

                  <VStack align="stretch" spacing={4}>
                    {trials.length === 0 ? (
                      <EmptyWorkState title="No trials created yet" description="Start the first trial by selecting an AVAILABLE packet." />
                    ) : (
                      trials.map((trial) => (
                        <Box key={trial.id} p={5} borderRadius="xl" bg="gray.50" border="1px solid" borderColor="gray.200">
                          <HStack justify="space-between" mb={4} flexWrap="wrap">
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="purple" variant="solid" px={3} py={1} borderRadius="full">
                                Trial #{trial.trialNumber}
                              </Badge>
                              {trial.packet?.packetCode ? (
                                <Badge colorScheme="blue" variant="subtle" px={3} py={1} borderRadius="full">
                                  {trial.packet.packetCode}
                                </Badge>
                              ) : null}
                            </HStack>
                            <Badge colorScheme={trial.measurements.length > 0 ? "green" : "orange"} variant="subtle" borderRadius="full" px={3} py={1}>
                              {trial.measurements.length > 0 ? `${trial.measurements.length} measurement(s)` : "Needs measurements"}
                            </Badge>
                          </HStack>
                          {trial.packet ? (
                            <Text fontSize="sm" color="text.secondary" mb={4}>
                              Packet allocation: {trial.packet.packetType ?? "Packet"} • {trial.packet.packetQuantity ?? "—"} {trial.packet.packetUnit ?? ""}
                            </Text>
                          ) : null}
                          <Table variant="simple" size="sm" bg="white" borderRadius="lg" mb={4}>
                            <Thead bg="gray.100">
                              <Tr>
                                <Th>Element</Th>
                                <Th isNumeric>Value</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {trial.measurements.map((measurement) => (
                                <Tr key={measurement.id}>
                                  <Td fontWeight="bold" color="text.primary">
                                    {measurement.element}
                                  </Td>
                                  <Td isNumeric fontWeight="bold" color="purple.600">
                                    {formatMeasurementValue(measurement.value)}
                                  </Td>
                                </Tr>
                              ))}
                              {trial.measurements.length === 0 ? (
                                <Tr>
                                  <Td colSpan={2} textAlign="center" py={3}>
                                    <Text color="text.secondary" fontSize="sm">
                                      No measurements yet.
                                    </Text>
                                  </Td>
                                </Tr>
                              ) : null}
                            </Tbody>
                          </Table>
                          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                            <FormControl>
                              <Input
                                placeholder="Element (e.g. Au)"
                                size="sm"
                                bg="white"
                                value={elementInput[trial.id] || ""}
                                onChange={(event) => setElementInput((prev) => ({ ...prev, [trial.id]: event.target.value }))}
                                onKeyDown={(event) => {
                                  if (isEnterKey(event)) {
                                    event.preventDefault();
                                    void handleMeasurementSave(trial.id);
                                  }
                                }}
                                isDisabled={!isEditable}
                              />
                            </FormControl>
                            <FormControl>
                              <Input
                                placeholder="Value"
                                size="sm"
                                bg="white"
                                type="number"
                                step="0.0001"
                                value={valueInput[trial.id] || ""}
                                onChange={(event) => setValueInput((prev) => ({ ...prev, [trial.id]: event.target.value }))}
                                onKeyDown={(event) => {
                                  if (isEnterKey(event)) {
                                    event.preventDefault();
                                    void handleMeasurementSave(trial.id);
                                  }
                                }}
                                isDisabled={!isEditable}
                              />
                            </FormControl>
                            <Button size="sm" colorScheme="green" onClick={() => void handleMeasurementSave(trial.id)} isLoading={savingMeasurement === trial.id} isDisabled={!isEditable}>
                              Add measurement
                            </Button>
                          </SimpleGrid>
                        </Box>
                      ))
                    )}
                  </VStack>
                </CardBody>
              </Card>

              <Card id="rd-report-section" variant="outline" borderRadius="2xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 4
                  </Text>
                  <Heading size="md" color="text.primary" mt={1}>
                    Report and export
                  </Heading>

                  <VStack align="stretch" spacing={4}>
                    <HStack spacing={3} flexWrap="wrap">
                      <Button size="md" colorScheme="blue" leftIcon={<FlaskConical size={18} />} onClick={handleReportBuild} isLoading={buildingReport}>
                        Check report
                      </Button>
                      {reportResult ? (
                        <Badge colorScheme={reportResult.validation.isValid ? "green" : "orange"} variant="subtle" borderRadius="full" px={3} py={1}>
                          {reportResult.validation.isValid ? "Validated" : "Incomplete"}
                        </Badge>
                      ) : (
                        <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={3} py={1}>
                          Not validated
                        </Badge>
                      )}
                    </HStack>

                    {reportResult?.validation.errors?.length ? (
                      <VStack align="stretch" spacing={2} p={4} borderRadius="xl" bg="orange.50" border="1px solid" borderColor="orange.100">
                        {reportResult.validation.errors.map((error) => (
                          <HStack key={error} align="start" spacing={3}>
                            <Icon as={AlertCircle} color="orange.500" mt={0.5} />
                            <Text fontSize="sm" color="text.primary">
                              {error}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    ) : null}

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <FormControl>
                        <Select
                          size="sm"
                          value={selectedDocumentType}
                          onChange={(event) =>
                            setSelectedDocumentType(event.target.value as ReportPreferences["defaultDocumentType"])
                          }
                        >
                          {REPORT_DOCUMENT_TYPES.map((documentType) => (
                            <option key={documentType} value={documentType}>
                              {getReportDocumentTypeLabel(documentType)} Format
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <Button size="sm" variant="outline" leftIcon={<Download size={14} />} onClick={() => void handleExport("excel")}>
                        Download Excel
                      </Button>
                      <Button size="sm" variant="outline" leftIcon={<Download size={14} />} colorScheme="red" onClick={() => void handleExport("pdf")}>
                        View PDF
                      </Button>
                    </SimpleGrid>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          }
          right={
            <VStack align="stretch" spacing={4}>
              <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.rail">
                <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                  Current priority
                </Text>
                <Text fontWeight="semibold" color="text.primary" mt={1}>
                  {primaryAction}
                </Text>
              </Box>

              <Card variant="outline" borderRadius="2xl">
                <Accordion allowToggle defaultIndex={[]}>
                  <AccordionItem border="none">
                    <AccordionButton px={4} py={4}>
                      <Box flex="1" textAlign="left">
                        <Text fontWeight="semibold" color="text.primary">
                          Stage checks
                        </Text>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel px={4} pb={4}>
                      <VStack align="stretch" spacing={3}>
                        <SectionHint label="Ready sample lots" value={readySampleLots.length > 0 ? String(readySampleLots.length) : "No"} />
                        <SectionHint label="Packets created" value={packets.length > 0 ? String(packets.length) : "No"} />
                        <SectionHint label="Available packets" value={availablePackets.length > 0 ? String(availablePackets.length) : "No"} />
                        <SectionHint label="Trials started" value={trialCount > 0 ? String(trialCount) : "No"} />
                        <SectionHint label="Incomplete trials" value={String(incompleteTrials)} />
                        <SectionHint label="Validation state" value={reportResult?.validation.isValid ? "Valid" : "Pending"} />
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </Card>

              <Card variant="outline" borderRadius="2xl" bg="orange.50">
                <Accordion allowToggle defaultIndex={[]}>
                  <AccordionItem border="none">
                    <AccordionButton px={4} py={4}>
                      <Box flex="1" textAlign="left">
                        <Text fontWeight="semibold" color="text.primary">
                          Validation criteria
                        </Text>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel px={4} pb={4}>
                      <VStack align="stretch" spacing={3}>
                        {releaseCriteria.map((criterion) => (
                          <HStack key={criterion.label} align="start" spacing={3}>
                            <Icon as={criterion.satisfied ? CheckCircle2 : AlertCircle} color={criterion.satisfied ? "green.500" : "orange.500"} mt={0.5} />
                            <Box>
                              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                {criterion.label}
                              </Text>
                              <Text fontSize="xs" color="text.secondary">
                                {criterion.detail}
                              </Text>
                            </Box>
                          </HStack>
                        ))}
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </Card>

              {isAdmin ? (
                <Card id="rd-qa-section" variant="outline" borderRadius="2xl" borderTop="4px solid" borderTopColor="purple.500">
                  <Accordion allowToggle defaultIndex={[]}>
                    <AccordionItem border="none">
                      <AccordionButton px={4} py={4}>
                        <Box flex="1" textAlign="left">
                          <Text fontWeight="semibold" color="text.primary">
                            Audit trail
                          </Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel px={4} pb={4}>
                        <AuditTrail logs={logs} />
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ) : null}

              <Card variant="outline" borderRadius="2xl" bg="purple.50">
                <Accordion allowToggle defaultIndex={[]}>
                  <AccordionItem border="none">
                    <AccordionButton px={4} py={4}>
                      <Box flex="1" textAlign="left">
                        <HStack>
                          <Icon as={AlertCircle} color="purple.500" />
                          <Text fontWeight="bold" fontSize="sm" color="purple.800">
                            Governance
                          </Text>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel px={4} pb={4}>
                      <Text fontSize="xs" color="purple.700">
                        Validation and QA should happen only after packets and trials are fully complete.
                      </Text>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </Card>
            </VStack>
          }
        />
      </VStack>

      <Modal isOpen={Boolean(pdfPreview)} onClose={closePreview} size="full" motionPreset="slideInBottom">
        <ModalOverlay bg="blackAlpha.600" />
        <ModalContent borderRadius={{ base: 0, md: "2xl" }} overflow="hidden">
          <ModalHeader>
            <Stack spacing={1}>
              <Heading size="sm" color="text.primary">
                PDF preview
              </Heading>
            </Stack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="gray.50" p={{ base: 0, md: 4 }}>
            {pdfPreview ? (
              <Box
                as="iframe"
                title={pdfPreview.fileName}
                src={pdfPreview.url}
                w="full"
                h={{ base: "calc(100vh - 160px)", md: "calc(100vh - 210px)" }}
                border="0"
                bg="white"
              />
            ) : null}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={closePreview}>
              Back to report
            </Button>
            <Button colorScheme="red" onClick={handleDownloadPreview}>
              Download Report PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ControlTowerLayout>
  );
}
