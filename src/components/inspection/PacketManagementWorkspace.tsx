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
  Trash2,
} from "lucide-react";

import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint, TopErrorBanner } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { DetailTabsLayout, ExceptionBanner, HistoryTimeline, LinkedRecordsPanel } from "@/components/enterprise/EnterprisePatterns";
import { MobileActionRail, WorkbenchPageTemplate } from "@/components/enterprise/PageTemplates";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
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
};

type PacketOutputLinkage = {
  activeReport: { snapshotId: string; url: string } | null;
  activeCoa: { snapshotId: string; url: string } | null;
  currentForDispatch: { snapshotId: string; url: string } | null;
  previousReports: Array<{ snapshotId: string; status: string }>;
  selectionSource: "LINEAGE" | "LEGACY_FALLBACK" | null;
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

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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

function buildDraft(packet: PacketRecord, sampleUnit?: string | null): PacketDraft {
  return {
    packetType: packet.packetType ?? "",
    packetQuantity:
      packet.packetQuantity !== null && packet.packetQuantity !== undefined ? String(packet.packetQuantity) : "",
    packetUnit: packet.packetUnit ?? sampleUnit ?? "",
    remarks: packet.remarks ?? "",
    sealNo: packet.sealLabel?.sealNo ?? "",
    labelText: packet.sealLabel?.labelText ?? "",
  };
}

function formatDraftQuantity(value: number) {
  const normalized = Number(value.toFixed(4));
  return Number.isInteger(normalized) ? String(normalized) : String(normalized).replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function applyLastPacketRemainingWeight(
  draftMap: Record<string, PacketDraft>,
  packets: PacketRecord[],
  totalQuantity: number,
  sampleUnit: string | null | undefined,
) {
  if (totalQuantity <= 0 || packets.length < 2) {
    return draftMap;
  }

  const orderedPackets = [...packets].sort((left, right) => left.packetNo - right.packetNo);
  const lastPacket = orderedPackets.at(-1);
  if (!lastPacket) {
    return draftMap;
  }

  const othersTotal = orderedPackets
    .slice(0, -1)
    .reduce((sum, packet) => sum + Math.max(Number(draftMap[packet.id]?.packetQuantity || 0) || 0, 0), 0);
  const remaining = Math.max(totalQuantity - othersTotal, 0);

  return {
    ...draftMap,
    [lastPacket.id]: {
      ...(draftMap[lastPacket.id] ?? buildDraft(lastPacket, sampleUnit)),
      packetQuantity: formatDraftQuantity(remaining),
      packetUnit: draftMap[lastPacket.id]?.packetUnit || sampleUnit || "",
    },
  };
}

function buildEqualWeightPlan(count: number, totalQuantity: number, sampleUnit: string | null | undefined) {
  if (count <= 0 || totalQuantity <= 0) {
    return [];
  }

  const baseShare = Number((totalQuantity / count).toFixed(4));
  let allocated = 0;

  return Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1;
    const packetQuantity = isLast ? Number((totalQuantity - allocated).toFixed(4)) : baseShare;
    allocated += packetQuantity;
    return {
      packetQuantity,
      packetUnit: sampleUnit ?? "",
    };
  });
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
  const [deletingPacketId, setDeletingPacketId] = useState<string | null>(null);
  const [generatingSealPacketId, setGeneratingSealPacketId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [selectedPacketOutput, setSelectedPacketOutput] = useState<PacketOutputLinkage | null>(null);

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
    setDrafts(() => {
      const next: Record<string, PacketDraft> = {};
      for (const packet of packets) {
        next[packet.id] = buildDraft(packet, sample?.sampleUnit);
      }
      return applyLastPacketRemainingWeight(next, packets, sample?.sampleQuantity ?? 0, sample?.sampleUnit);
    });
  }, [packets, sample?.sampleQuantity, sample?.sampleUnit]);

  useEffect(() => {
    setSelectedPacketId((current) => {
      if (current && packets.some((packet) => packet.id === current)) {
        return current;
      }
      return packets[0]?.id ?? null;
    });
  }, [packets]);

  useEffect(() => {
    let active = true;
    if (!selectedPacketId) {
      setSelectedPacketOutput(null);
      return () => {
        active = false;
      };
    }

    async function loadPacketOutput() {
      try {
        const response = await fetch(`/api/packets/${selectedPacketId}`);
        if (!response.ok) {
          throw new Error("Failed to load packet output linkage.");
        }
        const payload = (await response.json()) as { reportLinkage?: PacketOutputLinkage };
        if (!active) {
          return;
        }
        setSelectedPacketOutput(payload.reportLinkage ?? null);
      } catch {
        if (!active) {
          return;
        }
        setSelectedPacketOutput(null);
      }
    }

    void loadPacketOutput();
    return () => {
      active = false;
    };
  }, [selectedPacketId]);

  const workflowSteps = useMemo(() => buildWorkflowSteps(sample, packets), [packets, sample]);
  const allocatedQuantity = useMemo(() => sumAllocatedPacketQuantity(packets), [packets]);
  const totalQuantity = typeof sample?.sampleQuantity === "number" ? sample.sampleQuantity : 0;
  const remainingQuantity = totalQuantity > 0 ? Math.max(totalQuantity - allocatedQuantity, 0) : 0;
  const progressValue = totalQuantity > 0 ? Math.min((allocatedQuantity / totalQuantity) * 100, 100) : 0;
  const readyPackets = useMemo(() => packets.filter((packet) => packet.packetStatus === "AVAILABLE"), [packets]);
  const lot = payload?.lot ?? null;
  const lotNumber = lot?.lotNumber ?? "—";
  const selectedPacket = packets.find((packet) => packet.id === selectedPacketId) ?? packets[0] ?? null;
  const selectedPacketReadiness = selectedPacket ? getPacketReadiness(selectedPacket) : null;
  const sampleReady = deriveSampleStatus(sample) === "READY_FOR_PACKETING";
  const activeReportUrl = selectedPacketOutput?.activeReport?.url ?? null;
  const activeCoaUrl = selectedPacketOutput?.activeCoa?.url ?? null;
  const currentForDispatchUrl = selectedPacketOutput?.currentForDispatch?.url ?? null;
  const hasLinkedCoa = Boolean(activeCoaUrl);
  const hasDispatchArtifact = Boolean(currentForDispatchUrl);
  const autoBalancedPacketId = useMemo(() => {
    if (totalQuantity <= 0 || packets.length < 2) {
      return null;
    }
    return [...packets].sort((left, right) => left.packetNo - right.packetNo).at(-1)?.id ?? null;
  }, [packets, totalQuantity]);
  const dispatchBlockers = useMemo(() => {
    const blockers: Array<{
      id: string;
      title: string;
      description: string;
      actionLabel: string;
      actionHref: string;
    }> = [];

    if (!hasLinkedCoa) {
      blockers.push({
        id: "missing-coa",
        title: "Missing COA",
        description: "Certificate of Analysis is not available for this lot yet.",
        actionLabel: "Open Documents",
        actionHref: `/documents?job=${jobId}&lot=${lotNumber}`,
      });
    }

    if (!hasDispatchArtifact) {
      blockers.push({
        id: "missing-dispatch-doc",
        title: "Missing dispatch document artifact",
        description: "Dispatch document artifact is not available in the current job stage.",
        actionLabel: "View PDF",
        actionHref: `/reports?jobId=${jobId}`,
      });
    }

    if (selectedPacketReadiness && !selectedPacketReadiness.isReady) {
      blockers.push({
        id: "packet-proof",
        title: "Incomplete required packet evidence",
        description: selectedPacketReadiness.missing.length
          ? selectedPacketReadiness.missing.map((item) => item.replaceAll("_", " ")).join(", ")
          : "Packet readiness checks are still pending.",
        actionLabel: "Open Packet Detail",
        actionHref: pathname,
      });
    }

    if (readyPackets.length === 0) {
      blockers.push({
        id: "stage-not-ready",
        title: "Stage not ready",
        description: "No packet is marked AVAILABLE for downstream dispatch preparation.",
        actionLabel: "Open Traceability",
        actionHref: `/traceability/lot/${lotId}`,
      });
    }

    return blockers;
  }, [hasDispatchArtifact, hasLinkedCoa, jobId, lotId, lotNumber, pathname, readyPackets.length, selectedPacketReadiness]);

  const updateDraft = useCallback(
    (packetId: string, patch: Partial<PacketDraft>) => {
      const packet = packets.find((currentPacket) => currentPacket.id === packetId);
      if (!packet) {
        return;
      }

      setDrafts((current) =>
        applyLastPacketRemainingWeight(
          {
            ...current,
            [packetId]: {
              ...(current[packetId] ?? buildDraft(packet, sample?.sampleUnit)),
              ...patch,
            },
          },
          packets,
          totalQuantity,
          sample?.sampleUnit,
        ),
      );
    },
    [packets, sample?.sampleUnit, totalQuantity],
  );

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

  const handleCreatePackets = useCallback(async (mode: "manual" | "equal" = "manual") => {
    if (!sample?.id) {
      return;
    }

    const count = Number.parseInt(packetCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      setSurfaceError("Packet count must be a positive whole number.");
      return;
    }
    if (mode === "equal" && totalQuantity <= 0) {
      setSurfaceError("Equal split requires a tracked sample quantity.");
      return;
    }

    setCreating(true);
    try {
      const equalPlan = mode === "equal" ? buildEqualWeightPlan(count, totalQuantity, sample.sampleUnit) : [];
      const res = await fetch("/api/rd/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleId: sample.id,
          count,
          ...(mode === "equal" ? { packets: equalPlan } : {}),
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Unable to create packets.");
      }

      const nextPackets = (await res.json()) as PacketRecord[];
      setPackets(nextPackets);
      setSurfaceError(null);
      toast({ title: mode === "equal" ? "Equal packet plan created" : "Packet cards created", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create packets.";
      setSurfaceError(message);
      toast({ title: "Creation failed", description: message, status: "error" });
    } finally {
      setCreating(false);
    }
  }, [packetCount, sample, toast, totalQuantity]);

  const handleDeletePacket = useCallback(
    async (packetId: string) => {
      setDeletingPacketId(packetId);
      try {
        const res = await fetch("/api/rd/packet", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packetId }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { details?: string } | null;
          throw new Error(payload?.details ?? "Unable to delete packet.");
        }

        setPackets((current) => current.filter((packet) => packet.id !== packetId));
        setDrafts((current) => {
          const next = { ...current };
          delete next[packetId];
          return applyLastPacketRemainingWeight(next, packets.filter((packet) => packet.id !== packetId), totalQuantity, sample?.sampleUnit);
        });
        setSurfaceError(null);
        toast({ title: "Packet deleted", status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete packet.";
        setSurfaceError(message);
        toast({ title: "Delete failed", description: message, status: "error" });
      } finally {
        setDeletingPacketId(null);
      }
    },
    [packets, sample?.sampleUnit, toast, totalQuantity],
  );

  const handleSaveDetails = useCallback(
    async (packetId: string) => {
      const draft = drafts[packetId];
      if (!draft) {
        return;
      }

      const hasSealNo = Boolean(draft.sealNo.trim());
      const hasLabelText = Boolean(draft.labelText.trim());

      setSavingPacketId(packetId);
      try {
        await updatePacket({
          packetId,
          packetType: draft.packetType,
          packetQuantity: draft.packetQuantity,
          packetUnit: draft.packetUnit || sample?.sampleUnit || "",
          remarks: draft.remarks,
          sealNo: draft.sealNo,
          labelText: draft.labelText,
          ...(hasLabelText ? { markLabeled: true } : {}),
          ...(hasSealNo ? { markSealed: true } : {}),
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
    [drafts, sample?.sampleUnit, toast, updatePacket],
  );

  const handleMarkReady = useCallback(
    async (packetId: string) => {
      const draft = drafts[packetId];
      if (!draft) {
        return;
      }

      const hasSealNo = Boolean(draft.sealNo.trim());
      const hasLabelText = Boolean(draft.labelText.trim());

      setReadyPacketId(packetId);
      try {
        await updatePacket({
          packetId,
          packetType: draft.packetType,
          packetQuantity: draft.packetQuantity,
          packetUnit: draft.packetUnit || sample?.sampleUnit || "",
          remarks: draft.remarks,
          sealNo: draft.sealNo,
          labelText: draft.labelText,
          ...(hasLabelText ? { markLabeled: true } : {}),
          ...(hasSealNo ? { markSealed: true } : {}),
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
    [drafts, sample?.sampleUnit, toast, updatePacket],
  );

  const handleGenerateSeal = useCallback(
    async (packetId: string) => {
      setGeneratingSealPacketId(packetId);
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

        updateDraft(packetId, { sealNo: data.sealNumber });
        setSurfaceError(null);
        toast({ title: "Seal number generated", status: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to generate seal.";
        setSurfaceError(message);
        toast({ title: "Generation failed", description: message, status: "error" });
      } finally {
        setGeneratingSealPacketId(null);
      }
    },
    [jobId, toast, updateDraft],
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
      <VStack align="stretch" spacing={6}>
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
                <WorkflowStateChip status={deriveSampleStatus(sample)} />
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
          <Card variant="outline" borderRadius="xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Sample quantity
              </Text>
              <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={2}>
                {sample.sampleQuantity ?? "—"} {sample.sampleUnit ?? ""}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Packet cards
              </Text>
              <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={2}>
                {packets.length}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Ready packets
              </Text>
              <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={2}>
                {readyPackets.length}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Remaining quantity
              </Text>
              <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={2}>
                {totalQuantity > 0 ? remainingQuantity : "—"} {sample.sampleUnit ?? ""}
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card variant="outline" borderRadius="xl">
          <CardBody p={5}>
            <WorkflowStepTracker title="Packet flow" steps={workflowSteps} compact />
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="xl">
          <CardBody p={5}>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Heading size="sm">Packet List</Heading>
                <Badge colorScheme="gray" variant="subtle">{packets.length} packets</Badge>
              </HStack>
              <EnterpriseDataTable
                rows={packets}
                rowKey={(row) => row.id}
                emptyLabel="No packets available."
                columns={[
                  { id: "packet-id", header: "Packet ID", render: (row) => row.packetCode },
                  { id: "linked-lot", header: "Linked lot", render: (row) => row.lot?.lotNumber ?? lot.lotNumber },
                  { id: "quantity", header: "Quantity", render: (row) => `${row.packetQuantity ?? "—"} ${row.packetUnit ?? ""}` },
                  { id: "status", header: "Status", render: (row) => <WorkflowStateChip status={row.packetStatus} /> },
                  { id: "storage-dispatch", header: "Storage / dispatch state", render: (row) => row.allocation?.allocationStatus ?? "BLOCKED" },
                  {
                    id: "coa",
                    header: "Linked COA",
                    render: () => <WorkflowStateChip status={hasLinkedCoa ? "COA_AVAILABLE" : "COA_PENDING"} />,
                  },
                  {
                    id: "dispatch-docs",
                    header: "Linked dispatch documents",
                    render: () => (
                      <Button
                        as="a"
                        href={currentForDispatchUrl ?? `/reports?jobId=${jobId}`}
                        target={currentForDispatchUrl ? "_blank" : undefined}
                        size="xs"
                        variant="outline"
                      >
                        View PDF
                      </Button>
                    ),
                  },
                ]}
                rowActions={[
                  { id: "select", label: "Open Packet Detail", onClick: (row) => setSelectedPacketId(row.id) },
                  { id: "lot-map", label: "Packet-to-Lot Mapping", onClick: (row) => router.push(`/operations/job/${jobId}/lot/${row.lotId ?? lotId}`) },
                  { id: "trace", label: "Open Traceability", onClick: (row) => router.push(`/traceability/lot/${row.lotId ?? lotId}`) },
                ]}
              />
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="xl">
          <CardBody p={5}>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Heading size="sm">Packet Detail</Heading>
                {selectedPacket ? <Badge colorScheme="brand" variant="subtle">{selectedPacket.packetCode}</Badge> : null}
              </HStack>
              <DetailTabsLayout
                tabs={[
                  {
                    id: "overview",
                    label: "Overview",
                    content: (
                      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                        <SectionHint label="Packet ID" value={selectedPacket?.packetCode ?? "Not Available"} />
                        <SectionHint label="Quantity" value={selectedPacket ? `${selectedPacket.packetQuantity ?? "—"} ${selectedPacket.packetUnit ?? ""}` : "Not Available"} />
                        <SectionHint label="Status" value={selectedPacket?.packetStatus.replaceAll("_", " ") ?? "Not Available"} />
                      </SimpleGrid>
                    ),
                  },
                  {
                    id: "source-lot",
                    label: "Source Lot",
                    content: (
                      <LinkedRecordsPanel
                        items={[
                          { label: "Job Number", value: jobId, href: `/userrd/job/${jobId}` },
                          { label: "Lot Number", value: lot.lotNumber, href: pathname.replace(/\/packet$/, "") },
                          { label: "Sample", value: sample.sampleCode || "Not Available" },
                          { label: "Packet", value: selectedPacket?.packetCode ?? "Not Available" },
                        ]}
                      />
                    ),
                  },
                  {
                    id: "quality-summary",
                    label: "Quality / Test Summary",
                    content: (
                      <VStack align="stretch" spacing={3}>
                        <SectionHint label="Required checks" value={selectedPacketReadiness?.isReady ? "Completed" : "Pending"} />
                        <SectionHint label="Missing checks" value={selectedPacketReadiness ? String(selectedPacketReadiness.missing.length) : "0"} />
                        <SectionHint label="Allocation" value={selectedPacket?.allocation?.allocationStatus ?? "BLOCKED"} />
                        <SectionHint
                          label="Current for Dispatch"
                          value={selectedPacketOutput?.currentForDispatch ? "Current for Dispatch" : "Pending"}
                        />
                      </VStack>
                    ),
                  },
                  {
                    id: "documents",
                    label: "Documents",
                    content: (
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                        <Button as="a" href={activeReportUrl ?? `/reports?jobId=${jobId}`} target={activeReportUrl ? "_blank" : undefined} variant="outline">
                          View PDF
                        </Button>
                        <Button variant="outline" onClick={() => router.push(`/reports?jobId=${jobId}`)}>Download Packing List PDF</Button>
                        <Button as="a" href={activeReportUrl ?? `/reports?jobId=${jobId}`} target={activeReportUrl ? "_blank" : undefined} variant="outline">
                          Download Report PDF
                        </Button>
                        <Button variant="outline" onClick={() => router.push(`/traceability/lot/${lotId}`)}>Open Traceability</Button>
                        <WorkflowStateChip status={hasLinkedCoa ? "COA_AVAILABLE" : "COA_PENDING"} />
                        <Button as="a" href={activeCoaUrl ?? "/documents"} target={activeCoaUrl ? "_blank" : undefined} variant="outline">
                          Active COA
                        </Button>
                        <SectionHint label="Previous Reports" value={String(selectedPacketOutput?.previousReports.length ?? 0)} />
                      </SimpleGrid>
                    ),
                  },
                  {
                    id: "dispatch",
                    label: "Dispatch",
                    content: (
                      <VStack align="stretch" spacing={3}>
                        {dispatchBlockers.length === 0 ? (
                          <SectionHint label="Dispatch readiness" value={`${readyPackets.length} packet(s) ready`} />
                        ) : (
                          <>
                            <ExceptionBanner
                              status="warning"
                              title="Dispatch readiness blocked"
                              description="Resolve all blockers before moving to dispatch."
                            />
                            {dispatchBlockers.map((blocker) => (
                              <Card key={blocker.id} variant="outline">
                                <CardBody p={4}>
                                  <VStack align="stretch" spacing={2}>
                                    <Text fontWeight="semibold">{blocker.title}</Text>
                                    <Text fontSize="sm" color="text.secondary">{blocker.description}</Text>
                                    <Button size="sm" variant="outline" alignSelf="start" onClick={() => router.push(blocker.actionHref)}>
                                      {blocker.actionLabel}
                                    </Button>
                                  </VStack>
                                </CardBody>
                              </Card>
                            ))}
                          </>
                        )}
                      </VStack>
                    ),
                  },
                  {
                    id: "audit-trail",
                    label: "Audit Trail",
                    content: (
                      <HistoryTimeline
                        events={(selectedPacket?.events ?? []).map((event) => ({
                          id: event.id,
                          title: event.eventType.replaceAll("_", " "),
                          subtitle: event.remarks ?? "Packet audit event",
                          at: formatDate(event.eventTime),
                        }))}
                      />
                    ),
                  },
                ]}
                rightRail={
                  <VStack align="stretch" spacing={3}>
                    <LinkedRecordsPanel
                      items={[
                        { label: "Job Number", value: jobId, href: `/userrd/job/${jobId}` },
                        { label: "Lot Number", value: lot.lotNumber, href: pathname.replace(/\/packet$/, "") },
                        { label: "Current Step", value: lot.job.status.replaceAll("_", " ") },
                        { label: "Sample", value: sample.sampleCode || "Not Available" },
                        { label: "Packet", value: selectedPacket?.packetCode ?? "Not Available" },
                        { label: "Traceability", value: "Open", href: `/traceability/lot/${lotId}` },
                      ]}
                    />
                    <HistoryTimeline
                      events={(selectedPacket?.events ?? []).slice(0, 5).map((event) => ({
                        id: `rail-${event.id}`,
                        title: event.eventType.replaceAll("_", " "),
                        subtitle: event.remarks ?? "Packet audit event",
                        at: formatDate(event.eventTime),
                      }))}
                    />
                  </VStack>
                }
              />
            </VStack>
          </CardBody>
        </Card>

        <WorkbenchPageTemplate
          rightLabel="Quantity & Readiness"
          left={
            <VStack align="stretch" spacing={4}>
              <Card variant="outline" borderRadius="xl">
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
                    <Stack direction={{ base: "column", md: "row" }} spacing={3} align="stretch">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        size="sm"
                        w={{ base: "full", md: "92px" }}
                        value={packetCount}
                        onChange={(event) => setPacketCount(event.target.value)}
                        isDisabled={!sampleReady}
                      />
                      <Button w={{ base: "full", md: "auto" }} colorScheme="purple" isLoading={creating} onClick={() => void handleCreatePackets("manual")} isDisabled={!sampleReady}>
                        Create packet cards
                      </Button>
                      <Button
                        w={{ base: "full", md: "auto" }}
                        variant="outline"
                        isLoading={creating}
                        onClick={() => void handleCreatePackets("equal")}
                        isDisabled={!sampleReady || totalQuantity <= 0}
                      >
                        Create equal split
                      </Button>
                    </Stack>
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
                    <Card key={packet.id} variant="outline" borderRadius="xl" borderColor={packet.packetStatus === "AVAILABLE" ? "green.200" : undefined}>
                      <CardBody p={6}>
                        <Stack spacing={5}>
                          {draft.packetUnit && packet.packetUnit !== draft.packetUnit ? (
                            <Box p={3} borderRadius="lg" bg="bg.rail" border="1px solid" borderColor="border.default">
                              <Text fontSize="sm" color="text.secondary">
                                Unit will be saved as {draft.packetUnit}. Packet unit is inherited from the sample.
                              </Text>
                            </Box>
                          ) : null}
                          <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "start" }} spacing={3}>
                            <Box>
                              <HStack spacing={2} flexWrap="wrap">
                                <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={3} py={1}>
                                  Packet #{packet.packetNo}
                                </Badge>
                                <WorkflowStateChip status={currentStatus} />
                                <WorkflowStateChip status={packet.allocation?.allocationStatus ?? "BLOCKED"} />
                                <Button
                                  size="xs"
                                  colorScheme="red"
                                  variant="ghost"
                                  leftIcon={<Trash2 size={12} />}
                                  isLoading={deletingPacketId === packet.id}
                                  onClick={() => void handleDeletePacket(packet.id)}
                                  isDisabled={
                                    packet.allocation?.allocationStatus === "RESERVED" ||
                                    packet.allocation?.allocationStatus === "ALLOCATED" ||
                                    packet.allocation?.allocationStatus === "USED"
                                  }
                                >
                                  Delete
                                </Button>
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
                                onChange={(event) => updateDraft(packet.id, { packetType: event.target.value })}
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
                                <VStack align="stretch" spacing={1}>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={draft.packetQuantity}
                                    onChange={(event) => updateDraft(packet.id, { packetQuantity: event.target.value })}
                                    isDisabled={packet.id === autoBalancedPacketId}
                                  />
                                  {packet.id === autoBalancedPacketId && totalQuantity > 0 ? (
                                    <Text fontSize="xs" color="text.secondary">
                                      Auto-filled from remaining available weight.
                                    </Text>
                                  ) : null}
                                </VStack>
                              </FormControl>
                              <FormControl>
                                <FormLabel>Unit</FormLabel>
                                <VStack align="stretch" spacing={1}>
                                  {sample?.sampleUnit ? (
                                    <Input value={sample.sampleUnit} isReadOnly />
                                  ) : (
                                    <Select
                                      value={draft.packetUnit}
                                      onChange={(event) => updateDraft(packet.id, { packetUnit: event.target.value })}
                                    >
                                      <option value="">Select unit</option>
                                      {packetUnitOptions.map((unit) => (
                                        <option key={unit} value={unit}>
                                          {unit}
                                        </option>
                                      ))}
                                    </Select>
                                  )}
                                  {sample?.sampleUnit ? (
                                    <Text fontSize="xs" color="orange.700">
                                      Unit is fixed from sample quantity as {sample.sampleUnit}. Equal split packets keep this unit locked.
                                    </Text>
                                  ) : null}
                                </VStack>
                              </FormControl>
                            </SimpleGrid>
                          </SimpleGrid>

                          <FormControl>
                            <FormLabel>Remarks</FormLabel>
                            <Textarea
                              rows={2}
                              value={draft.remarks}
                              onChange={(event) => updateDraft(packet.id, { remarks: event.target.value })}
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
                                  onChange={(event) => updateDraft(packet.id, { labelText: event.target.value })}
                                  placeholder="Visible packet label"
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel>Seal no.</FormLabel>
                                <HStack align="stretch">
                                  <Input
                                    value={draft.sealNo}
                                    onChange={(event) => updateDraft(packet.id, { sealNo: event.target.value })}
                                    placeholder="Auto-generate or enter seal number"
                                  />
                                  <Button
                                    variant="outline"
                                    leftIcon={<ScanLine size={14} />}
                                    isLoading={generatingSealPacketId === packet.id}
                                    onClick={() => void handleGenerateSeal(packet.id)}
                                  >
                                    Auto
                                  </Button>
                                </HStack>
                              </FormControl>
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
                                        onClick={() => fileInputsRef.current[`${inputKey}:camera`]?.click()}
                                      >
                                        {media?.fileUrl ? "Retake photo" : "Capture photo"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        isLoading={uploadingKey === inputKey}
                                        onClick={() => fileInputsRef.current[`${inputKey}:device`]?.click()}
                                      >
                                        {media?.fileUrl ? "Replace from device" : "Upload from device"}
                                      </Button>
                                      {media?.fileUrl ? (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            if (typeof window !== "undefined") {
                                              window.open(media.fileUrl, "_blank", "noopener,noreferrer");
                                            }
                                          }}
                                        >
                                          View photo
                                        </Button>
                                      ) : null}
                                    </HStack>

                                    {media?.fileUrl ? (
                                      <Image src={media.fileUrl} alt={config.title} mt={3} borderRadius="lg" maxH="160px" objectFit="cover" />
                                    ) : null}

                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      style={{ display: "none" }}
                                      ref={(node) => {
                                        fileInputsRef.current[`${inputKey}:camera`] = node;
                                      }}
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void handleMediaUpload(packet.id, config, file);
                                        }
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: "none" }}
                                      ref={(node) => {
                                        fileInputsRef.current[`${inputKey}:device`] = node;
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
                            <Box p={4} borderRadius="lg" bg="bg.rail" border="1px solid" borderColor="border.default">
                              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                Missing before availability
                              </Text>
                              {packet.id === autoBalancedPacketId && totalQuantity > 0 ? (
                                <Text fontSize="xs" color="text.secondary" mt={1}>
                                  Last packet quantity is auto-balanced from the remaining sample weight.
                                </Text>
                              ) : null}
                              <VStack align="stretch" spacing={1} mt={2}>
                                {readiness.missing.map((item) => (
                                  <Text key={item} fontSize="sm" color="text.secondary">
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

              <Card variant="outline" borderRadius="xl">
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

              <Card variant="outline" borderRadius="xl" bg="bg.surface">
                <CardBody>
                  <VStack align="stretch" spacing={2}>
                    <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                      Downstream rule
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
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
          <Button colorScheme="purple" isLoading={creating} onClick={() => void handleCreatePackets("manual")} isDisabled={!sampleReady}>
            Create cards
          </Button>
          <Button variant="outline" isLoading={creating} onClick={() => void handleCreatePackets("equal")} isDisabled={!sampleReady || totalQuantity <= 0}>
            Equal split
          </Button>
          <Button colorScheme="green" onClick={() => router.push(`/userrd/job/${jobId}`)}>
            Trials
          </Button>
        </MobileActionRail>
      </VStack>
    </ControlTowerLayout>
  );
}
