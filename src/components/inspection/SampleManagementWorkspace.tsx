"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";

import { EvidenceRail } from "@/components/inspection/EvidenceRail";
import { SealScanner } from "@/components/inspection/SealScanner";
import { EmptyWorkState, InlineErrorState, PageSkeleton, TopErrorBanner } from "@/components/enterprise/AsyncState";
import { ProcessFlowLayout } from "@/components/enterprise/PageTemplates";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import { WorkflowStepTracker, type WorkflowStep } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import {
  deriveSampleStatus,
  getRequiredMissingMedia,
  getSampleReadiness,
  hasHomogenizedSample,
  hasSampleDetails,
  hasSealAndLabel,
  mapSampleMediaByType,
} from "@/lib/sample-management";
import { SAMPLE_EVIDENCE_ITEMS } from "@/lib/evidence-definition";
import type { LotInspectionRecord, SampleMediaType, SampleRecord } from "@/types/inspection";

type InspectionExecutionPayload = {
  lot: {
    id: string;
    lotNumber: string;
    materialName?: string | null;
    materialCategory?: string | null;
    status?: string | null;
    job: {
      id: string;
      clientName: string;
      commodity: string;
      status: string;
    };
  };
  inspection: LotInspectionRecord | null;
};

const mediaConfigs = SAMPLE_EVIDENCE_ITEMS;
const requiredMediaConfigs = mediaConfigs.filter((config) => config.required);

function buildWorkflowSteps(sample: SampleRecord | null): WorkflowStep[] {
  const status = deriveSampleStatus(sample);
  const readiness = getSampleReadiness(sample);
  const detailsDone = hasSampleDetails(sample);
  const homogenized = hasHomogenizedSample(sample);
  const sealed = hasSealAndLabel(sample);
  const requiredMediaComplete = getRequiredMissingMedia(sample).length === 0;

  return [
    { id: "start", label: "Start", state: sample ? "completed" : "current" },
    { id: "details", label: "Details", state: detailsDone ? "completed" : sample ? "current" : "next" },
    { id: "media", label: "Proof", state: requiredMediaComplete ? "completed" : sample ? "current" : "next" },
    { id: "homogenize", label: "Homogenize", state: homogenized ? "completed" : detailsDone ? "current" : "next" },
    { id: "seal", label: "Seal", state: sealed ? "completed" : homogenized ? "current" : "next" },
    {
      id: "ready",
      label: "Ready",
      state: status === "READY_FOR_PACKETING" || readiness.isReady ? "completed" : sealed ? "current" : "next",
    },
  ];
}

export function SampleManagementWorkspace({
  backHref,
}: {
  backHref: (jobId: string, viewMode: string) => string;
}) {
  const { jobId, lotId } = useParams<{ jobId: string; lotId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { viewMode } = useWorkspaceView();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InspectionExecutionPayload | null>(null);
  const [sample, setSample] = useState<SampleRecord | null>(null);
  const [detailsForm, setDetailsForm] = useState({
    sampleType: "",
    samplingMethod: "",
    sampleQuantity: "",
    sampleUnit: "",
    containerType: "",
    remarks: "",
  });
  const [sealForm, setSealForm] = useState({
    sealNo: "",
  });
  const [sealAuto, setSealAuto] = useState(false);
  const [starting, setStarting] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingSeal, setSavingSeal] = useState(false);
  const [generatingSeal, setGeneratingSeal] = useState(false);
  const [markingHomogenized, setMarkingHomogenized] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState<SampleMediaType | null>(null);
  const [mediaErrors, setMediaErrors] = useState<Partial<Record<SampleMediaType, string>>>({});
  const [stepErrors, setStepErrors] = useState<Partial<Record<"start" | "details" | "seal" | "homogenized" | "ready", string>>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSurfaceError(null);
    try {
      const [executionRes, sampleRes] = await Promise.all([
        fetch(`/api/inspection/execution?lotId=${lotId}`),
        fetch(`/api/inspection/sample-management?lotId=${lotId}`),
      ]);

      if (!executionRes.ok || !sampleRes.ok) {
        const executionPayload = executionRes.ok ? null : await executionRes.json().catch(() => null);
        const samplePayload = sampleRes.ok ? null : await sampleRes.json().catch(() => null);
        throw new Error(
          executionPayload?.details ??
            samplePayload?.details ??
            "Failed to load sample management workspace.",
        );
      }

      const nextPayload = (await executionRes.json()) as InspectionExecutionPayload;
      const nextSample = (await sampleRes.json()) as SampleRecord | null;

      setPayload(nextPayload);
      setSample(nextSample);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load sample management workspace.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setDetailsForm({
      sampleType: sample?.sampleType ?? "",
      samplingMethod: sample?.samplingMethod ?? "",
      sampleQuantity: sample?.sampleQuantity !== null && sample?.sampleQuantity !== undefined ? String(sample.sampleQuantity) : "",
      sampleUnit: sample?.sampleUnit ?? "",
      containerType: sample?.containerType ?? "",
      remarks: sample?.remarks ?? "",
    });
    setSealForm({
      sealNo: sample?.sealLabel?.sealNo ?? "",
    });
    setSealAuto(false);
  }, [sample]);

  const inspection = payload?.inspection ?? null;
  const lot = payload?.lot ?? null;
  const readiness = useMemo(() => getSampleReadiness(sample), [sample]);
  const mediaMap = useMemo(() => mapSampleMediaByType(sample?.media), [sample?.media]);
  const currentStatus = deriveSampleStatus(sample);
  const workflowSteps = useMemo(() => buildWorkflowSteps(sample), [sample]);
  const requiredMediaCount = requiredMediaConfigs.length;
  const isSealFormatValid = /^\d{16}$/.test(sealForm.sealNo.trim());
  const lotApproved =
    !inspection ||
    inspection?.inspectionStatus === "COMPLETED" && inspection?.decisionStatus === "READY_FOR_SAMPLING";
  const inspectionApprovalRequired = Boolean(inspection) && !lotApproved;

  const updateSample = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId, ...body }),
      });

      if (!res.ok) {
        const errorPayload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(errorPayload?.details ?? "Unable to save sample state.");
      }

      const updated = (await res.json()) as SampleRecord;
      setSample(updated);
      return updated;
    },
    [lotId],
  );

  const handleStartSampling = useCallback(async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/inspection/sample-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Unable to start sampling.");
      }
      const created = (await res.json()) as SampleRecord;
      setSample(created);
      setStepErrors((prev) => ({ ...prev, start: undefined }));
      setSurfaceError(null);
      toast({ title: "Sampling started", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start sampling.";
      setStepErrors((prev) => ({ ...prev, start: message }));
      setSurfaceError(message);
      toast({ title: "Start failed", description: message, status: "error" });
    } finally {
      setStarting(false);
    }
  }, [lotId, toast]);

  const handleSaveDetails = useCallback(async () => {
    setSavingDetails(true);
    try {
      await updateSample({
        sampleType: detailsForm.sampleType,
        samplingMethod: detailsForm.samplingMethod,
        sampleQuantity: detailsForm.sampleQuantity,
        sampleUnit: detailsForm.sampleUnit,
        containerType: detailsForm.containerType,
        remarks: detailsForm.remarks,
      });
      setStepErrors((prev) => ({ ...prev, details: undefined }));
      setSurfaceError(null);
      toast({ title: "Sample details saved", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save details.";
      setStepErrors((prev) => ({ ...prev, details: message }));
      setSurfaceError(message);
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setSavingDetails(false);
    }
  }, [detailsForm, toast, updateSample]);

  const handleSaveSeal = useCallback(async () => {
    if (!/^\d{16}$/.test(sealForm.sealNo.trim())) {
      const message = "Seal number must be exactly 16 digits.";
      setStepErrors((prev) => ({ ...prev, seal: message }));
      setSurfaceError(message);
      toast({ title: "Seal validation failed", description: message, status: "error" });
      return;
    }
    setSavingSeal(true);
    try {
      await updateSample({
        sealNo: sealForm.sealNo,
        sealAuto,
        markSealed: true,
      });
      setStepErrors((prev) => ({ ...prev, seal: undefined }));
      setSurfaceError(null);
      toast({ title: "Seal saved", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save seal details.";
      setStepErrors((prev) => ({ ...prev, seal: message }));
      setSurfaceError(message);
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setSavingSeal(false);
    }
  }, [sealAuto, sealForm.sealNo, toast, updateSample]);

  const handleGenerateSeal = useCallback(async () => {
    setGeneratingSeal(true);
    try {
      const res = await fetch("/api/seal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Unable to generate seal.");
      }

      const data = (await res.json()) as { sealNumber?: string };
      if (!data.sealNumber) {
        throw new Error("Seal generation failed.");
      }

      setSealForm((prev) => ({ ...prev, sealNo: data.sealNumber ?? prev.sealNo }));
      setSealAuto(true);
      setStepErrors((prev) => ({ ...prev, seal: undefined }));
      toast({ title: "Seal number generated", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate seal.";
      setStepErrors((prev) => ({ ...prev, seal: message }));
      toast({ title: "Generation failed", description: message, status: "error" });
    } finally {
      setGeneratingSeal(false);
    }
  }, [jobId, toast]);

  const handleMarkHomogenized = useCallback(async () => {
    setMarkingHomogenized(true);
    try {
      await updateSample({ markHomogenized: true });
      setStepErrors((prev) => ({ ...prev, homogenized: undefined }));
      setSurfaceError(null);
      toast({ title: "Sample marked homogenized", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update homogeneous state.";
      setStepErrors((prev) => ({ ...prev, homogenized: message }));
      setSurfaceError(message);
      toast({ title: "Update failed", description: message, status: "error" });
    } finally {
      setMarkingHomogenized(false);
    }
  }, [toast, updateSample]);

  const handleMarkReady = useCallback(async () => {
    setMarkingReady(true);
    try {
      await updateSample({ markReadyForPacketing: true });
      setStepErrors((prev) => ({ ...prev, ready: undefined }));
      setSurfaceError(null);
      toast({ title: "Sample ready for packeting", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to mark sample ready.";
      setStepErrors((prev) => ({ ...prev, ready: message }));
      setSurfaceError(message);
      toast({ title: "Readiness blocked", description: message, status: "error" });
    } finally {
      setMarkingReady(false);
    }
  }, [toast, updateSample]);

  const handleMediaUpload = useCallback(
    async (config: (typeof SAMPLE_EVIDENCE_ITEMS)[number], file: File) => {
      setUploadingMedia(config.mediaType);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("lotId", lotId);
        formData.append("category", config.uploadCategory);

        const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const payload = (await uploadRes.json().catch(() => null)) as { details?: string } | null;
          throw new Error(payload?.details ?? "Upload failed.");
        }

        const uploadPayload = (await uploadRes.json()) as { url: string };
        await updateSample({
          mediaEntries: [{ mediaType: config.mediaType, fileUrl: uploadPayload.url }],
        });
        setMediaErrors((prev) => ({ ...prev, [config.mediaType]: undefined }));
        setSurfaceError(null);
        toast({ title: `${config.title} uploaded`, status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setMediaErrors((prev) => ({ ...prev, [config.mediaType]: message }));
        setSurfaceError(message);
        toast({ title: "Upload failed", description: message, status: "error" });
      } finally {
        setUploadingMedia(null);
      }
    },
    [lotId, toast, updateSample],
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
        <InlineErrorState
          title="Sample workspace unavailable"
          description={loadError}
          onRetry={() => void fetchData()}
        />
      </ControlTowerLayout>
    );
  }

  if (!payload || !lot) {
    return (
      <ControlTowerLayout>
        <EmptyWorkState title="Lot not found" description="The selected lot could not be loaded." />
      </ControlTowerLayout>
    );
  }

  const evidenceRailItems = requiredMediaConfigs.map((config) => {
    const media = mediaMap[config.mediaType];
    const error = mediaErrors[config.mediaType] ?? null;
    return {
      id: config.mediaType,
      title: config.title,
      note: config.note,
      required: config.required,
      status: error ? ("retake" as const) : media?.fileUrl ? ("uploaded" as const) : ("missing" as const),
      previewUrl: media?.fileUrl ?? null,
      error,
      isLoading: uploadingMedia === config.mediaType,
      isDisabled: !sample,
    };
  });

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        {surfaceError ? (
          <TopErrorBanner title="Action blocked" description={surfaceError} onDismiss={() => setSurfaceError(null)} />
        ) : null}

        <Stack direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "stretch", lg: "center" }} spacing={3}>
          <HStack spacing={3} align="start">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={() => router.push(backHref(jobId, viewMode))}>
              Back to Job
            </Button>
            <Box>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="teal" variant="solid" borderRadius="full" px={3} py={1}>
                  {lot.lotNumber}
                </Badge>
                <WorkflowStateChip status={currentStatus} />
                {sample?.sampleCode ? (
                  <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1}>
                    {sample.sampleCode}
                  </Badge>
                ) : null}
              </HStack>
              <Heading size="lg" color="text.primary" mt={2}>
                Sample Management
              </Heading>
              <Text fontSize="sm" color="text.secondary">
                {lot.job.clientName} • {lot.job.commodity}
              </Text>
            </Box>
          </HStack>

          {currentStatus === "READY_FOR_PACKETING" ? (
            <Button
              colorScheme="purple"
              leftIcon={<FlaskConical size={16} />}
              onClick={() => router.push(`${pathname.replace(/\/$/, "")}/packet`)}
            >
              Open Packet Management
            </Button>
          ) : null}
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
            {[
              { label: "Inspection decision", value: inspection?.decisionStatus ?? "PENDING", note: "Must be approved before sampling" },
              { label: "Sample state", value: currentStatus.replaceAll("_", " "), note: "Current lifecycle stage" },
              { label: "Required proof", value: `${mediaConfigs.filter((item) => item.required && mediaMap[item.mediaType]).length}/${requiredMediaCount}`, note: "Required media captured" },
              { label: "Readiness", value: readiness.isReady ? "Ready" : `${readiness.missing.length} pending`, note: "Packet generation gate" },
            ].map((item) => (
            <Card key={item.label} variant="outline" borderRadius="xl">
              <CardBody p={5}>
                <Text fontSize="sm" color="text.muted">
                  {item.label}
                </Text>
                <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={2}>
                  {item.value}
                </Text>
                <Text fontSize="sm" color="text.secondary" mt={1}>
                  {item.note}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        {inspectionApprovalRequired ? (
          <InlineErrorState
            title="Lot not ready for sampling"
            description="Inspection must be completed and approved before a sample can be created for this lot."
            onRetry={() => void fetchData()}
          />
        ) : null}

        <ProcessFlowLayout
          contextLabel="Traceability"
          tracker={<WorkflowStepTracker title="Sample progress" steps={workflowSteps} compact />}
          activeStep={
            <VStack align="stretch" spacing={4}>
              <Card variant="outline" borderRadius="xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 1
                  </Text>
                  <Heading size="md" mt={1}>
                    Start sampling
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2}>
                    Create the official sample record. One active sample per lot is enforced in MVP.
                  </Text>
                  {sample ? (
                    <HStack mt={5} spacing={3} p={4} bg="bg.rail" borderRadius="lg" border="1px solid" borderColor="border.default">
                      <Icon as={CheckCircle2} boxSize={5} color="green.500" />
                      <Box>
                        <Text fontWeight="semibold" color="text.primary">
                          Sampling started
                        </Text>
                        <Text fontSize="sm" color="text.secondary">
                          Official sample record exists for this lot.
                        </Text>
                      </Box>
                    </HStack>
                  ) : (
                    <Button mt={5} colorScheme="teal" leftIcon={<ClipboardCheck size={16} />} onClick={() => void handleStartSampling()} isLoading={starting} isDisabled={inspectionApprovalRequired}>
                      Start sampling
                    </Button>
                  )}
                  {stepErrors.start ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize="sm" color="red.700">{stepErrors.start}</Text>
                    </Box>
                  ) : null}
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 2
                  </Text>
                  <Heading size="md" mt={1}>
                    Sample details
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2} mb={5}>
                    Keep this short and guided. These fields drive readiness and traceability.
                  </Text>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Sample type</FormLabel>
                      <Input value={detailsForm.sampleType} onChange={(event) => setDetailsForm((prev) => ({ ...prev, sampleType: event.target.value }))} placeholder="Primary / retain / control" isDisabled={!sample} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Sampling method</FormLabel>
                      <Input value={detailsForm.samplingMethod} onChange={(event) => setDetailsForm((prev) => ({ ...prev, samplingMethod: event.target.value }))} placeholder="Manual grab, composite..." isDisabled={!sample} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Quantity</FormLabel>
                      <Input type="number" value={detailsForm.sampleQuantity} onChange={(event) => setDetailsForm((prev) => ({ ...prev, sampleQuantity: event.target.value }))} placeholder="0.0" isDisabled={!sample} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Unit</FormLabel>
                      <Select value={detailsForm.sampleUnit} onChange={(event) => setDetailsForm((prev) => ({ ...prev, sampleUnit: event.target.value }))} placeholder="Select unit" isDisabled={!sample}>
                        <option value="KG">KG</option>
                        <option value="G">G</option>
                        <option value="PCS">PCS</option>
                        <option value="ML">ML</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Container type</FormLabel>
                      <Input value={detailsForm.containerType} onChange={(event) => setDetailsForm((prev) => ({ ...prev, containerType: event.target.value }))} placeholder="Bag, jar, pouch..." isDisabled={!sample} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Remarks</FormLabel>
                      <Textarea value={detailsForm.remarks} onChange={(event) => setDetailsForm((prev) => ({ ...prev, remarks: event.target.value }))} rows={3} placeholder="Optional notes" isDisabled={!sample} />
                    </FormControl>
                  </SimpleGrid>

                  <Button mt={5} colorScheme="teal" onClick={() => void handleSaveDetails()} isLoading={savingDetails} isDisabled={!sample}>
                    Save details
                  </Button>
                  {stepErrors.details ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize="sm" color="red.700">{stepErrors.details}</Text>
                    </Box>
                  ) : null}
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 3
                  </Text>
              <Heading size="md" mt={1}>
                    Capture proof
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2} mb={5}>
                    Keep this minimal. Only the homogenized sample photo is required here. Packet photos belong in packet management.
                  </Text>

                  <EvidenceRail
                    items={evidenceRailItems}
                    onUpload={(itemId, file) => {
                      const config = mediaConfigs.find((entry) => entry.mediaType === itemId);
                      if (!config) {
                        return;
                      }
                      void handleMediaUpload(config, file);
                    }}
                    onClearError={(itemId) => {
                      setMediaErrors((prev) => ({ ...prev, [itemId as SampleMediaType]: undefined }));
                    }}
                  />
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 4
                  </Text>
                  <Heading size="md" mt={1}>
                    Homogeneous sample
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2} mb={5}>
                    This confirmation is explicit. Packet generation is blocked until homogeneous state is confirmed and its proof is captured.
                  </Text>

                  <Stack direction={{ base: "column", md: "row" }} spacing={4} align={{ base: "stretch", md: "center" }}>
                    <Box flex={1} p={4} borderRadius="lg" bg="bg.rail" border="1px solid" borderColor="border.default">
                      <Text fontWeight="semibold" color="text.primary">
                        Has the sample been homogenized?
                      </Text>
                      <Text fontSize="sm" color="text.secondary" mt={1}>
                        {hasHomogenizedSample(sample)
                          ? `Confirmed at ${sample?.homogenizedAt ? new Date(sample.homogenizedAt).toLocaleString() : ""}`
                          : "Not yet confirmed."}
                      </Text>
                    </Box>
                    <Button colorScheme="purple" leftIcon={<ShieldCheck size={16} />} onClick={() => void handleMarkHomogenized()} isLoading={markingHomogenized} isDisabled={!sample || hasHomogenizedSample(sample)}>
                      Mark homogenized
                    </Button>
                  </Stack>
                  {stepErrors.homogenized ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize="sm" color="red.700">{stepErrors.homogenized}</Text>
                    </Box>
                  ) : null}
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 5
                  </Text>
                  <Heading size="md" mt={1}>
                    Scan and confirm seal
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2} mb={5}>
                    Scan the pre-printed seal first. Use manual entry only if scan is unavailable.
                  </Text>

                  <SimpleGrid columns={{ base: 1, md: 1 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Seal number</FormLabel>
                      <HStack align="stretch" flexWrap={{ base: "wrap", sm: "nowrap" }}>
                        <Input
                          value={sealForm.sealNo}
                          onChange={(event) => {
                            setSealForm((prev) => ({ ...prev, sealNo: event.target.value.replace(/\D/g, "").slice(0, 16) }));
                            setSealAuto(false);
                          }}
                          placeholder="Scan or enter 16-digit seal number"
                          inputMode="numeric"
                          isDisabled={!sample}
                        />
                        <SealScanner
                          onScanned={(sealNumber) => {
                            setSealForm((prev) => ({ ...prev, sealNo: sealNumber }));
                            setSealAuto(false);
                          }}
                          onManualConfirm={(sealNumber) => {
                            setSealForm((prev) => ({ ...prev, sealNo: sealNumber }));
                            setSealAuto(false);
                          }}
                          isDisabled={!sample}
                        />
                        <Button
                          variant="outline"
                          onClick={() => void handleGenerateSeal()}
                          isLoading={generatingSeal}
                          isDisabled={!sample}
                        >
                          Auto-generate
                        </Button>
                      </HStack>
                      <HStack mt={2} spacing={2} flexWrap="wrap">
                        <WorkflowStateChip status={isSealFormatValid ? "SEAL_VALID" : "SEAL_INVALID"} />
                        <WorkflowStateChip status={sealAuto ? "SEAL_AUTO" : "SEAL_MANUAL"} />
                      </HStack>
                      <Text fontSize="xs" color="text.secondary" mt={2}>
                        {sealAuto ? "Seal was generated by system." : "Scan seal, then save. Manual entry is fallback only."}
                      </Text>
                    </FormControl>
                  </SimpleGrid>

                  <Button
                    mt={5}
                    colorScheme="blue"
                    leftIcon={<PackageCheck size={16} />}
                    onClick={() => void handleSaveSeal()}
                    isLoading={savingSeal}
                    isDisabled={!sample || !isSealFormatValid}
                  >
                    Save seal
                  </Button>
                  {stepErrors.seal ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize="sm" color="red.700">{stepErrors.seal}</Text>
                    </Box>
                  ) : null}
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={6}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 6
                  </Text>
                  <Heading size="md" mt={1}>
                    Complete
                  </Heading>
                  <Text fontSize="sm" color="text.secondary" mt={2} mb={5}>
                    Readiness requires sample details, homogenized sample proof, homogeneous confirmation, and seal traceability.
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {(readiness.missing.length > 0 ? readiness.missing : ["Ready for packet generation"]).map((item) => (
                      <HStack key={item} spacing={3} p={3} borderRadius="md" bg="bg.rail">
                        <Icon as={readiness.isReady ? CheckCircle2 : ClipboardCheck} color={readiness.isReady ? "green.500" : "gray.500"} />
                        <Text fontSize="sm" color="text.primary">
                          {item}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>

                  <Button mt={5} colorScheme="green" leftIcon={<CheckCircle2 size={16} />} onClick={() => void handleMarkReady()} isLoading={markingReady} isDisabled={!sample || inspectionApprovalRequired}>
                    Mark ready for packeting
                  </Button>
                  {stepErrors.ready ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize="sm" color="red.700">{stepErrors.ready}</Text>
                    </Box>
                  ) : null}
                </CardBody>
              </Card>
            </VStack>
          }
          context={
            <VStack align="stretch" spacing={4}>
              <Card variant="outline" borderRadius="xl">
                <CardBody p={5}>
                  <Heading size="sm" color="text.primary">
                    Sample detail card
                  </Heading>
                  <VStack align="stretch" spacing={3} mt={4}>
                    <Box>
                      <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                        Sample code
                      </Text>
                      <Text fontWeight="semibold" color="text.primary">
                        {sample?.sampleCode ?? "Not created"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                        Linked lot
                      </Text>
                      <Text color="text.primary">{lot.lotNumber}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                        Material
                      </Text>
                      <Text color="text.primary">{lot.materialName ?? lot.materialCategory ?? "Not set"}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                        Quantity
                      </Text>
                      <Text color="text.primary">
                        {sample?.sampleQuantity ? `${sample.sampleQuantity} ${sample.sampleUnit ?? ""}`.trim() : "Pending"}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                        Missing actions
                      </Text>
                      <Text color="text.primary">
                        {readiness.missing.length > 0 ? readiness.missing.join(", ") : "None"}
                      </Text>
                    </Box>
                  </VStack>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={5}>
                  <Heading size="sm" color="text.primary">
                    Media gallery
                  </Heading>
                  <VStack align="stretch" spacing={3} mt={4}>
                    {mediaConfigs
                      .filter((config) => mediaMap[config.mediaType]?.fileUrl)
                      .map((config) => (
                        <Box key={config.mediaType} borderRadius="xl" overflow="hidden" border="1px solid" borderColor="gray.200">
                          <Image src={mediaMap[config.mediaType]?.fileUrl} alt={config.title} h="140px" w="full" objectFit="cover" />
                          <Box p={3}>
                            <Text fontWeight="semibold" color="text.primary">
                              {config.title}
                            </Text>
                            <Text fontSize="sm" color="text.secondary">
                              {config.note}
                            </Text>
                          </Box>
                        </Box>
                      ))}
                    {Object.keys(mediaMap).length === 0 ? (
                      <EmptyWorkState title="No sample media yet" description="Capture sample proof to build the traceability gallery." />
                    ) : null}
                  </VStack>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={5}>
                  <Heading size="sm" color="text.primary">
                    Event timeline
                  </Heading>
                  <VStack align="stretch" spacing={3} mt={4}>
                    {(sample?.events ?? []).length === 0 ? (
                      <Text fontSize="sm" color="text.secondary">
                        No sample events recorded yet.
                      </Text>
                    ) : (
                      (sample?.events ?? []).map((event) => (
                        <HStack key={event.id} align="start" spacing={3} p={3} borderRadius="lg" bg="gray.50">
                          <Icon as={CheckCircle2} boxSize={4} color="green.500" mt={1} />
                          <Box>
                            <Text fontWeight="semibold" color="text.primary">
                              {event.eventType.replaceAll("_", " ")}
                            </Text>
                            <Text fontSize="sm" color="text.secondary">
                              {new Date(event.eventTime).toLocaleString()}
                            </Text>
                            {event.remarks ? (
                              <Text fontSize="sm" color="text.secondary" mt={1}>
                                {event.remarks}
                              </Text>
                            ) : null}
                          </Box>
                        </HStack>
                      ))
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          }
        />
      </VStack>
    </ControlTowerLayout>
  );
}
