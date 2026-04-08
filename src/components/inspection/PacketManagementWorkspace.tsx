"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Image,
  Input,
  Progress,
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
  Camera,
  CheckCircle2,
  PackageCheck,
  ScanLine,
} from "lucide-react";

import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint, TopErrorBanner } from "@/components/enterprise/AsyncState";
import { MobileActionRail, WorkbenchPageTemplate } from "@/components/enterprise/PageTemplates";
import { WorkflowStepTracker, type WorkflowStep } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  derivePacketStatus,
  getPacketReadiness,
  mapPacketMediaByType,
  PACKET_TYPES,
  sumAllocatedPacketQuantity,
  type PacketMediaType,
} from "@/lib/packet-management";
import { deriveSampleStatus } from "@/lib/sample-management";
import type { LotInspectionRecord, PacketRecord, SampleRecord } from "@/types/inspection";

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

type PacketDraft = {
  packetType: string;
  packetQuantity: string;
  packetUnit: string;
  remarks: string;
  sealNo: string;
  labelText: string;
  labelCode: string;
};

type MediaConfig = {
  mediaType: PacketMediaType;
  title: string;
  uploadCategory: string;
  required: boolean;
};

const mediaConfigs: MediaConfig[] = [
  {
    mediaType: "PACKET_LABEL",
    title: "Packet label",
    uploadCategory: "LABEL_CLOSEUP",
    required: true,
  },
  {
    mediaType: "PACKET_SEALED",
    title: "Sealed packet",
    uploadCategory: "SEALED_BAG",
    required: true,
  },
  {
    mediaType: "PACKET_CONDITION",
    title: "Packet condition",
    uploadCategory: "LOT_OVERVIEW",
    required: false,
  },
  {
    mediaType: "PACKET_GROUP_VIEW",
    title: "Group view",
    uploadCategory: "LOT_OVERVIEW",
    required: false,
  },
];

const packetUnitOptions = ["g", "kg", "ml", "l", "pcs"];

function getPacketStatusColor(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "green";
    case "ALLOCATED":
      return "purple";
    case "RESERVED":
      return "orange";
    case "USED":
      return "gray";
    case "SEALED":
      return "blue";
    case "LABELED":
      return "cyan";
    case "DETAILS_CAPTURED":
      return "yellow";
    case "BLOCKED":
      return "red";
    default:
      return "gray";
  }
}

function buildWorkflowSteps(sample: SampleRecord | null, packets: PacketRecord[]): WorkflowStep[] {
  const draftExists = packets.length > 0;
  const detailsComplete = packets.some((packet) => derivePacketStatus(packet) !== "CREATED");
  const proofComplete = packets.some((packet) => {
    const mediaMap = mapPacketMediaByType(packet.media);
    return Boolean(mediaMap.PACKET_LABEL?.fileUrl && mediaMap.PACKET_SEALED?.fileUrl);
  });
  const readyCount = packets.filter((packet) => packet.packetStatus === "AVAILABLE").length;

  return [
    { id: "sample", label: "Ready Sample", state: sample ? "completed" : "blocked" },
    { id: "plan", label: "Packet Plan", state: draftExists ? "completed" : sample ? "current" : "upcoming" },
    { id: "details", label: "Details", state: detailsComplete ? "completed" : draftExists ? "current" : "upcoming" },
    { id: "proof", label: "Proof", state: proofComplete ? "completed" : detailsComplete ? "current" : "upcoming" },
    { id: "ready", label: "Availability", state: readyCount > 0 ? "completed" : proofComplete ? "current" : "upcoming" },
  ];
}

function buildDraft(packet: PacketRecord): PacketDraft {
  return {
    packetType: packet.packetType ?? "",
    packetQuantity:
      packet.packetQuantity !== null && packet.packetQuantity !== undefined ? String(packet.packetQuantity) : "",
    packetUnit: packet.packetUnit ?? "",
    remarks: packet.remarks ?? "",
    sealNo: packet.sealLabel?.sealNo ?? "",
    labelText: packet.sealLabel?.labelText ?? "",
    labelCode: packet.sealLabel?.labelCode ?? packet.packetCode,
  };
}

export function PacketManagementWorkspace() {
  const { jobId, lotId } = useParams<{ jobId: string; lotId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InspectionExecutionPayload | null>(null);
  const [sample, setSample] = useState<SampleRecord | null>(null);
  const [packets, setPackets] = useState<PacketRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PacketDraft>>({});
  const [packetCount, setPacketCount] = useState("1");
  const [creating, setCreating] = useState(false);
  const [savingPacketId, setSavingPacketId] = useState<string | null>(null);
  const [readyPacketId, setReadyPacketId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

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
        throw new Error(executionPayload?.details ?? samplePayload?.details ?? "Failed to load packet workspace.");
      }

      const nextPayload = (await executionRes.json()) as InspectionExecutionPayload;
      const nextSample = (await sampleRes.json()) as SampleRecord | null;

      setPayload(nextPayload);
      setSample(nextSample);

      if (nextSample?.id) {
        const packetsRes = await fetch(`/api/rd/packet?sampleId=${nextSample.id}`);
        if (!packetsRes.ok) {
          const errorPayload = (await packetsRes.json().catch(() => null)) as { details?: string } | null;
          throw new Error(errorPayload?.details ?? "Failed to load packets.");
        }

        const nextPackets = (await packetsRes.json()) as PacketRecord[];
        setPackets(Array.isArray(nextPackets) ? nextPackets : []);
      } else {
        setPackets([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load packet workspace.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, PacketDraft> = {};
      for (const packet of packets) {
        next[packet.id] = current[packet.id] ?? buildDraft(packet);
      }
      return next;
    });
  }, [packets]);

  const workflowSteps = useMemo(() => buildWorkflowSteps(sample, packets), [packets, sample]);
  const allocatedQuantity = useMemo(() => sumAllocatedPacketQuantity(packets), [packets]);
  const totalQuantity = typeof sample?.sampleQuantity === "number" ? sample.sampleQuantity : 0;
  const remainingQuantity = totalQuantity > 0 ? Math.max(totalQuantity - allocatedQuantity, 0) : 0;
  const progressValue = totalQuantity > 0 ? Math.min((allocatedQuantity / totalQuantity) * 100, 100) : 0;
  const readyPackets = useMemo(() => packets.filter((packet) => packet.packetStatus === "AVAILABLE"), [packets]);
  const lot = payload?.lot ?? null;
  const sampleReady = deriveSampleStatus(sample) === "READY_FOR_PACKETING";

  const updatePacket = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/rd/packet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Unable to save packet.");
      }

      const updated = (await res.json()) as PacketRecord;
      setPackets((current) => current.map((packet) => (packet.id === updated.id ? updated : packet)));
      return updated;
    },
    [],
  );

  const handleCreatePackets = useCallback(async () => {
    if (!sample?.id) {
      return;
    }

    const count = Number.parseInt(packetCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      setSurfaceError("Packet count must be a positive whole number.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/rd/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: sample.id, count }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Unable to create packets.");
      }

      const nextPackets = (await res.json()) as PacketRecord[];
      setPackets(nextPackets);
      setSurfaceError(null);
      toast({ title: "Packet cards created", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create packets.";
      setSurfaceError(message);
      toast({ title: "Creation failed", description: message, status: "error" });
    } finally {
      setCreating(false);
    }
  }, [packetCount, sample?.id, toast]);

  const handleSaveDetails = useCallback(
    async (packetId: string) => {
      const draft = drafts[packetId];
      if (!draft) {
        return;
      }

      const hasCompleteSealDraft = Boolean(
        draft.sealNo.trim() && draft.labelText.trim() && draft.labelCode.trim(),
      );

      setSavingPacketId(packetId);
      try {
        await updatePacket({
          packetId,
          packetType: draft.packetType,
          packetQuantity: draft.packetQuantity,
          packetUnit: draft.packetUnit,
          remarks: draft.remarks,
          sealNo: draft.sealNo,
          labelText: draft.labelText,
          labelCode: draft.labelCode,
          ...(hasCompleteSealDraft ? { markLabeled: true, markSealed: true } : {}),
        });
        setSurfaceError(null);
        toast({ title: "Packet card saved", status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save packet card.";
        setSurfaceError(message);
        toast({ title: "Save failed", description: message, status: "error" });
      } finally {
        setSavingPacketId(null);
      }
    },
    [drafts, toast, updatePacket],
  );

  const handleMarkReady = useCallback(
    async (packetId: string) => {
      const draft = drafts[packetId];
      if (!draft) {
        return;
      }

      setReadyPacketId(packetId);
      try {
        await updatePacket({
          packetId,
          packetType: draft.packetType,
          packetQuantity: draft.packetQuantity,
          packetUnit: draft.packetUnit,
          remarks: draft.remarks,
          sealNo: draft.sealNo,
          labelText: draft.labelText,
          labelCode: draft.labelCode,
          markLabeled: true,
          markSealed: true,
          markAvailable: true,
        });
        setSurfaceError(null);
        toast({ title: "Packet marked available", status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to mark packet available.";
        setSurfaceError(message);
        toast({ title: "Readiness blocked", description: message, status: "error" });
      } finally {
        setReadyPacketId(null);
      }
    },
    [drafts, toast, updatePacket],
  );

  const handleMediaUpload = useCallback(
    async (packetId: string, config: MediaConfig, file: File) => {
      setUploadingKey(`${packetId}:${config.mediaType}`);
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
        await updatePacket({
          packetId,
          mediaEntries: [{ mediaType: config.mediaType, fileUrl: uploadPayload.url }],
        });
        setSurfaceError(null);
        toast({ title: `${config.title} uploaded`, status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setSurfaceError(message);
        toast({ title: "Upload failed", description: message, status: "error" });
      } finally {
        setUploadingKey(null);
      }
    },
    [lotId, toast, updatePacket],
  );

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={3} rows={3} />
      </ControlTowerLayout>
    );
  }

  if (loadError) {
    return (
      <ControlTowerLayout>
        <InlineErrorState title="Packet workspace unavailable" description={loadError} onRetry={() => void fetchData()} />
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

  if (!sample) {
    return (
      <ControlTowerLayout>
        <EmptyWorkState
          title="Sample not started"
          description="Start sample management first. Packet planning begins only after the homogeneous sample exists."
          action={
            <Button onClick={() => router.push(pathname.replace(/\/packet$/, ""))}>
              Back to Sample Management
            </Button>
          }
        />
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6} h="full" overflow="hidden">
        {surfaceError ? (
          <TopErrorBanner title="Action blocked" description={surfaceError} onDismiss={() => setSurfaceError(null)} />
        ) : null}

        <Stack direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "stretch", lg: "center" }} spacing={3}>
          <HStack spacing={3} align="start">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => router.push(pathname.replace(/\/packet$/, ""))}
            >
              Back to Sample
            </Button>
            <Box>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="teal" variant="solid" borderRadius="full" px={3} py={1}>
                  {lot.lotNumber}
                </Badge>
                <Badge colorScheme={sampleReady ? "green" : "orange"} borderRadius="full" px={3} py={1}>
                  {deriveSampleStatus(sample).replaceAll("_", " ")}
                </Badge>
                <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1}>
                  {sample.sampleCode}
                </Badge>
              </HStack>
              <Heading size="lg" color="text.primary" mt={2}>
                Packet Management
              </Heading>
              <Text fontSize="sm" color="text.secondary">
                {lot.job.clientName} • {lot.job.commodity}
              </Text>
            </Box>
          </HStack>

          <Button colorScheme="purple" leftIcon={<PackageCheck size={16} />} onClick={() => router.push(`/userrd/job/${jobId}`)}>
            Open Trial Workspace
          </Button>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Sample quantity
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {sample.sampleQuantity ?? "—"} {sample.sampleUnit ?? ""}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Packet cards
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {packets.length}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Ready packets
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {readyPackets.length}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Remaining quantity
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {totalQuantity > 0 ? remainingQuantity : "—"} {sample.sampleUnit ?? ""}
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card variant="outline" borderRadius="2xl">
          <CardBody p={5}>
            <WorkflowStepTracker title="Packet flow" steps={workflowSteps} compact />
          </CardBody>
        </Card>

        <WorkbenchPageTemplate
          rightLabel="Quantity & Readiness"
          left={
            <VStack align="stretch" spacing={4}>
              <Card variant="outline" borderRadius="2xl">
                <CardBody p={6}>
                  <Stack direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "stretch", lg: "center" }} spacing={4}>
                    <Box>
                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                        Step 1
                      </Text>
                      <Heading size="md" color="text.primary" mt={1}>
                        Create packet plan
                      </Heading>
                      <Text fontSize="sm" color="text.secondary" mt={1}>
                        Split the homogeneous sample into draft packet cards, then complete each card before release.
                      </Text>
                    </Box>
                    <HStack spacing={3}>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        size="sm"
                        w="92px"
                        value={packetCount}
                        onChange={(event) => setPacketCount(event.target.value)}
                        isDisabled={!sampleReady}
                      />
                      <Button colorScheme="purple" isLoading={creating} onClick={handleCreatePackets} isDisabled={!sampleReady}>
                        Create packet cards
                      </Button>
                    </HStack>
                  </Stack>
                </CardBody>
              </Card>

              {packets.length === 0 ? (
                <EmptyWorkState
                  title="No packets yet"
                  description={
                    sampleReady
                      ? "Create the first packet card to start quantity split, proof capture, and downstream availability."
                      : "Sample must reach READY FOR PACKETING before packet cards can be created."
                  }
                />
              ) : (
                packets.map((packet) => {
                  const draft = drafts[packet.id] ?? buildDraft(packet);
                  const mediaMap = mapPacketMediaByType(packet.media);
                  const readiness = getPacketReadiness(packet);
                  const currentStatus = derivePacketStatus(packet);
                  const requiredProofDone = mediaConfigs.filter((item) => item.required).filter((item) => mediaMap[item.mediaType]?.fileUrl).length;

                  return (
                    <Card key={packet.id} variant="outline" borderRadius="2xl" borderColor={packet.packetStatus === "AVAILABLE" ? "green.200" : undefined}>
                      <CardBody p={6}>
                        <Stack spacing={5}>
                          <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "start" }} spacing={3}>
                            <Box>
                              <HStack spacing={2} flexWrap="wrap">
                                <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={3} py={1}>
                                  Packet #{packet.packetNo}
                                </Badge>
                                <Badge colorScheme={getPacketStatusColor(currentStatus)} borderRadius="full" px={3} py={1}>
                                  {packet.packetStatus.replaceAll("_", " ")}
                                </Badge>
                                <Badge colorScheme={packet.allocation?.allocationStatus === "AVAILABLE" ? "green" : "gray"} variant="subtle" borderRadius="full" px={3} py={1}>
                                  {packet.allocation?.allocationStatus ?? "BLOCKED"}
                                </Badge>
                              </HStack>
                              <Heading size="sm" mt={3} color="text.primary">
                                {packet.packetCode}
                              </Heading>
                              <Text fontSize="sm" color="text.secondary" mt={1}>
                                Packet identity, seal proof, and availability are managed per card.
                              </Text>
                            </Box>

                            <SimpleGrid columns={{ base: 3, md: 3 }} spacing={3} minW={{ md: "320px" }}>
                              <Box p={3} borderRadius="xl" bg="gray.50">
                                <Text fontSize="xs" color="text.muted" textTransform="uppercase">
                                  Quantity
                                </Text>
                                <Text fontWeight="semibold" color="text.primary">
                                  {packet.packetQuantity ?? "—"} {packet.packetUnit ?? ""}
                                </Text>
                              </Box>
                              <Box p={3} borderRadius="xl" bg="gray.50">
                                <Text fontSize="xs" color="text.muted" textTransform="uppercase">
                                  Proof
                                </Text>
                                <Text fontWeight="semibold" color="text.primary">
                                  {requiredProofDone}/{mediaConfigs.filter((item) => item.required).length}
                                </Text>
                              </Box>
                              <Box p={3} borderRadius="xl" bg="gray.50">
                                <Text fontSize="xs" color="text.muted" textTransform="uppercase">
                                  Ready
                                </Text>
                                <Text fontWeight="semibold" color="text.primary">
                                  {readiness.isReady ? "Yes" : `${readiness.missing.length} pending`}
                                </Text>
                              </Box>
                            </SimpleGrid>
                          </Stack>

                          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                            <FormControl>
                              <FormLabel>Packet type</FormLabel>
                              <Select
                                value={draft.packetType}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [packet.id]: { ...draft, packetType: event.target.value },
                                  }))
                                }
                              >
                                <option value="">Select packet type</option>
                                {PACKET_TYPES.map((packetType) => (
                                  <option key={packetType} value={packetType}>
                                    {packetType.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <SimpleGrid columns={2} spacing={3}>
                              <FormControl>
                                <FormLabel>Quantity</FormLabel>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={draft.packetQuantity}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [packet.id]: { ...draft, packetQuantity: event.target.value },
                                    }))
                                  }
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel>Unit</FormLabel>
                                <Select
                                  value={draft.packetUnit}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [packet.id]: { ...draft, packetUnit: event.target.value },
                                    }))
                                  }
                                >
                                  <option value="">Select unit</option>
                                  {packetUnitOptions.map((unit) => (
                                    <option key={unit} value={unit}>
                                      {unit}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            </SimpleGrid>
                          </SimpleGrid>

                          <FormControl>
                            <FormLabel>Remarks</FormLabel>
                            <Textarea
                              rows={2}
                              value={draft.remarks}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [packet.id]: { ...draft, remarks: event.target.value },
                                }))
                              }
                              placeholder="Optional packet handling notes"
                            />
                          </FormControl>

                          <HStack spacing={3} flexWrap="wrap">
                            <Button
                              size="sm"
                              leftIcon={<ScanLine size={14} />}
                              isLoading={savingPacketId === packet.id}
                              onClick={() => void handleSaveDetails(packet.id)}
                            >
                              Save card
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="green"
                              leftIcon={<CheckCircle2 size={14} />}
                              isLoading={readyPacketId === packet.id}
                              onClick={() => void handleMarkReady(packet.id)}
                            >
                              Mark ready
                            </Button>
                          </HStack>

                          <Divider />

                          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5}>
                            <VStack align="stretch" spacing={4}>
                              <Heading size="sm" color="text.primary">
                                Seal and label
                              </Heading>
                              <FormControl>
                                <FormLabel>Label text</FormLabel>
                                <Input
                                  value={draft.labelText}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [packet.id]: { ...draft, labelText: event.target.value },
                                    }))
                                  }
                                  placeholder="Visible packet label"
                                />
                              </FormControl>
                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                                <FormControl>
                                  <FormLabel>Label code</FormLabel>
                                  <Input
                                    value={draft.labelCode}
                                    onChange={(event) =>
                                      setDrafts((current) => ({
                                        ...current,
                                        [packet.id]: { ...draft, labelCode: event.target.value },
                                      }))
                                    }
                                    placeholder="Machine-readable code"
                                  />
                                </FormControl>
                                <FormControl>
                                  <FormLabel>Seal number</FormLabel>
                                  <Input
                                    value={draft.sealNo}
                                    onChange={(event) =>
                                      setDrafts((current) => ({
                                        ...current,
                                        [packet.id]: { ...draft, sealNo: event.target.value },
                                      }))
                                    }
                                    placeholder="Seal reference"
                                  />
                                </FormControl>
                              </SimpleGrid>
                            </VStack>

                            <VStack align="stretch" spacing={4}>
                              <Heading size="sm" color="text.primary">
                                Proof capture
                              </Heading>
                              {mediaConfigs.map((config) => {
                                const inputKey = `${packet.id}:${config.mediaType}`;
                                const media = mediaMap[config.mediaType];
                                return (
                                  <Box key={config.mediaType} p={4} borderRadius="xl" borderWidth="1px" borderColor="border.default">
                                    <HStack justify="space-between" align="start" spacing={3}>
                                      <Box>
                                        <HStack spacing={2}>
                                          <Text fontWeight="semibold" color="text.primary">
                                            {config.title}
                                          </Text>
                                          {config.required ? (
                                            <Badge colorScheme="orange" variant="subtle">
                                              Required
                                            </Badge>
                                          ) : null}
                                        </HStack>
                                        <Text fontSize="sm" color="text.secondary" mt={1}>
                                          {media?.fileUrl ? "Proof uploaded." : "Capture or upload proof."}
                                        </Text>
                                      </Box>
                                      <Button
                                        size="sm"
                                        variant={media?.fileUrl ? "outline" : "solid"}
                                        leftIcon={<Camera size={14} />}
                                        isLoading={uploadingKey === inputKey}
                                        onClick={() => fileInputsRef.current[inputKey]?.click()}
                                      >
                                        {media?.fileUrl ? "Replace" : "Add photo"}
                                      </Button>
                                    </HStack>

                                    {media?.fileUrl ? (
                                      <Image src={media.fileUrl} alt={config.title} mt={3} borderRadius="lg" maxH="160px" objectFit="cover" />
                                    ) : null}

                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: "none" }}
                                      ref={(node) => {
                                        fileInputsRef.current[inputKey] = node;
                                      }}
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void handleMediaUpload(packet.id, config, file);
                                        }
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </Box>
                                );
                              })}
                            </VStack>
                          </SimpleGrid>

                          {!readiness.isReady ? (
                            <Box p={4} borderRadius="xl" bg="orange.50" border="1px solid" borderColor="orange.100">
                              <Text fontSize="sm" fontWeight="semibold" color="orange.800">
                                Missing before availability
                              </Text>
                              <VStack align="stretch" spacing={1} mt={2}>
                                {readiness.missing.map((item) => (
                                  <Text key={item} fontSize="sm" color="orange.700">
                                    • {item}
                                  </Text>
                                ))}
                              </VStack>
                            </Box>
                          ) : null}
                        </Stack>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </VStack>
          }
          right={
            <VStack align="stretch" spacing={4}>
              <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.rail">
                <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                  Quantity split
                </Text>
                <Text fontWeight="semibold" color="text.primary" mt={1}>
                  {allocatedQuantity} / {totalQuantity || "—"} {sample.sampleUnit ?? ""}
                </Text>
                <Progress mt={3} value={progressValue} colorScheme="purple" borderRadius="full" />
                <Text fontSize="sm" color="text.secondary" mt={2}>
                  Remaining: {totalQuantity > 0 ? `${remainingQuantity} ${sample.sampleUnit ?? ""}` : "Not tracked"}
                </Text>
              </Box>

              <Card variant="outline" borderRadius="2xl">
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <SectionHint label="Sample status" value={deriveSampleStatus(sample).replaceAll("_", " ")} />
                    <SectionHint label="Packet cards" value={String(packets.length)} />
                    <SectionHint label="Available packets" value={String(readyPackets.length)} />
                    <SectionHint
                      label="Blocked packets"
                      value={String(packets.filter((packet) => packet.allocation?.allocationStatus !== "AVAILABLE").length)}
                    />
                  </VStack>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="2xl" bg="purple.50">
                <CardBody>
                  <VStack align="stretch" spacing={2}>
                    <Text fontSize="sm" fontWeight="semibold" color="purple.900">
                      Downstream rule
                    </Text>
                    <Text fontSize="sm" color="purple.800">
                      Trials should consume only packets marked AVAILABLE. Draft or blocked packets stay out of trial selection.
                    </Text>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          }
        />

        <MobileActionRail>
          <Button variant="outline" onClick={() => router.push(pathname.replace(/\/packet$/, ""))}>
            Back
          </Button>
          <Button colorScheme="purple" isLoading={creating} onClick={handleCreatePackets} isDisabled={!sampleReady}>
            Create cards
          </Button>
          <Button colorScheme="green" onClick={() => router.push(`/userrd/job/${jobId}`)}>
            Trials
          </Button>
        </MobileActionRail>
      </VStack>
    </ControlTowerLayout>
  );
}
