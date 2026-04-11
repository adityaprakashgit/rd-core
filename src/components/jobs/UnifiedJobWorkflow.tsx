"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  Tabs,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import {
  EnterpriseStickyTable,
  ExceptionBanner,
  HistoryTimeline,
  LinkedRecordsPanel,
  PageActionBar,
  PageIdentityBar,
  QuickEditDrawer,
} from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import { SealScanner } from "@/components/inspection/SealScanner";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { getUploadCategoryKey } from "@/lib/evidence-definition";
import { getMissingRequiredImageProofLabels } from "@/lib/image-proof-policy";
import { canApproveFinalDecision, type ModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { toComparableQuantity } from "@/lib/packet-management";
import { normalizeRole } from "@/lib/role";
import type { InspectionJob, InspectionLot, PublicUser } from "@/types/inspection";

type ClientOption = {
  id: string;
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  gstOrId?: string | null;
  contactPerson?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  sameAsBilling?: boolean;
};

type ItemOption = {
  id: string;
  itemName: string;
  materialType?: string | null;
  description?: string | null;
};

type ContainerTypeOption = {
  id: string;
  name: string;
};

type RndAssigneeOption = {
  id: string;
  displayName: string;
  email: string | null;
  role: PublicUser["role"];
};

type WorkflowPayload = {
  job: InspectionJob;
  settings: ModuleWorkflowPolicy;
  clients: ClientOption[];
  items: ItemOption[];
  containerTypes: ContainerTypeOption[];
  rndAssignees: RndAssigneeOption[];
  workflowStage: string;
  nextAction: string;
  blockers: string[];
  images: Array<{ id: string; category: string; fileName?: string | null }>;
  decision: { status: string; note?: string | null } | null;
  sample: InspectionLot["sample"] | null;
  sealMapping: { lotId: string | null; lotNumber: string | null; sealNumber: string | null; status: string | null };
  packets: NonNullable<NonNullable<InspectionLot["sample"]>["packets"]>;
  assignment: { createdBy: string | null; assignedTo: string | null; deadline: string | Date | null };
  milestones: {
    jobCreatedAt: string | Date;
    jobStartedAt?: string | Date | null;
    sentToAdminAt?: string | Date | null;
    sentToAdminBy?: string | null;
    adminDecisionAt?: string | Date | null;
    adminDecisionBy?: string | null;
    adminDecisionStatus?: string | null;
    operationsCompletedAt?: string | Date | null;
    handedOverToRndAt?: string | Date | null;
    handedOverToRndBy?: string | null;
    handedOverToRndTo?: string | null;
    handedOverToRndToLabel?: string | null;
  };
  history: Array<{ id: string; label: string; timestamp: string | Date; actor: string }>;
};

type SessionUser = {
  role: PublicUser["role"];
  email?: string | null;
  profile?: PublicUser["profile"];
};

type PacketUse = "TESTING" | "RETAIN" | "BACKUP" | "REFERENCE";
type WorkflowSectionId =
  | "job"
  | "lots"
  | "images"
  | "decision"
  | "sampling"
  | "seal"
  | "packets"
  | "handover";

type PacketDraftRow = {
  id: string;
  packetId: string;
  packetWeight: string;
  packetUnit: string;
  packetUse: PacketUse | "";
  notes: string;
  status: "Draft";
};


function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not Available";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not Available" : parsed.toLocaleString();
}

function buildAutoLotNumber(settings: ModuleWorkflowPolicy["workflow"], lots: InspectionLot[]) {
  const prefix = settings.lotNumberPrefix?.trim() || "LOT";
  const width = Math.max(settings.lotNumberSequenceFormat?.length ?? 4, 4);
  const next = String(lots.length + 1).padStart(width, "0");
  return `${prefix}-${next}`;
}

function normalizePacketUse(value: string | null | undefined): PacketUse | "" {
  if (!value) return "";
  const normalized = value.trim().toUpperCase();
  if (normalized === "TESTING" || normalized === "RETAIN" || normalized === "BACKUP" || normalized === "REFERENCE") {
    return normalized as PacketUse;
  }
  if (normalized === "LAB_TEST_PACKET") {
    return "TESTING";
  }
  if (normalized === "RETAIN_PACKET") {
    return "RETAIN";
  }
  if (normalized === "BACKUP_PACKET") {
    return "BACKUP";
  }
  if (normalized === "REF_PACKET") {
    return "REFERENCE";
  }
  return "";
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function fromComparable(valueInBase: number, targetUnit: string) {
  const normalized = targetUnit.trim().toUpperCase();
  if (normalized === "KG") {
    return valueInBase / 1000;
  }
  if (normalized === "G") {
    return valueInBase;
  }
  if (normalized === "MG") {
    return valueInBase * 1000;
  }
  return valueInBase;
}

function normalizeSection(value: string | null | undefined): WorkflowSectionId {
  if (!value) return "job";
  const normalized = value.trim().toLowerCase();
  if (normalized === "lots") return "lots";
  if (normalized === "images") return "images";
  if (normalized === "decision") return "decision";
  if (normalized === "sampling") return "sampling";
  if (normalized === "seal") return "seal";
  if (normalized === "packets") return "packets";
  if (normalized === "handover") return "handover";
  return "job";
}

export function UnifiedJobWorkflow() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WorkflowPayload | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedImageLabel, setSelectedImageLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    clientId: "",
    clientName: "",
    commodity: "",
    plantLocation: "",
    deadline: "",
  });
  const [clientForm, setClientForm] = useState({
    clientName: "",
    billToAddress: "",
    shipToAddress: "",
    gstOrId: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    sameAsBilling: true,
  });
  const [lotForm, setLotForm] = useState({
    lotNumber: "",
    quantityMode: "SINGLE_PIECE",
    materialName: "",
    totalBags: "1",
    weightUnit: "KG",
  });
  const [sampleForm, setSampleForm] = useState({
    sampleCode: "",
    sampleType: "",
    samplingMethod: "",
    sampleQuantity: "",
    sampleUnit: "KG",
    containerType: "",
    remarks: "",
  });
  const [packetCount, setPacketCount] = useState("1");
  const [packetDrafts, setPacketDrafts] = useState<Record<string, { packetWeight: string; packetUnit: string; packetUse: PacketUse | ""; notes: string }>>({});
  const [draftPacketRows, setDraftPacketRows] = useState<PacketDraftRow[]>([]);
  const [defaultPacketUnit, setDefaultPacketUnit] = useState("KG");
  const [rndHandoverTarget, setRndHandoverTarget] = useState("");
  const [activeSection, setActiveSection] = useState<WorkflowSectionId>(normalizeSection(searchParams.get("section")));

  const fetchWorkflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workflowRes, sessionRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/workflow`),
        fetch("/api/session/me"),
      ]);
      if (!workflowRes.ok || !sessionRes.ok) {
        throw new Error("Unified job workflow could not be loaded.");
      }
      const workflowPayload = (await workflowRes.json()) as WorkflowPayload;
      const sessionPayload = (await sessionRes.json()) as SessionUser;
      setPayload(workflowPayload);
      setCurrentUser(sessionPayload);

      const preferredLotId = searchParams.get("lotId");
      const firstLotId = workflowPayload.job.lots?.[0]?.id ?? null;
      const nextLotId =
        preferredLotId && workflowPayload.job.lots?.some((lot) => lot.id === preferredLotId) ? preferredLotId : firstLotId;
      setSelectedLotId(nextLotId);
      setRndHandoverTarget(workflowPayload.milestones.handedOverToRndTo ?? "");
      const resolvedClientId =
        workflowPayload.job.clientId ??
        workflowPayload.clients.find(
          (client) =>
            client.clientName.trim().toLowerCase() ===
            (workflowPayload.job.clientName ?? "").trim().toLowerCase(),
        )?.id ??
        "";

      setJobForm({
        clientId: resolvedClientId,
        clientName: workflowPayload.job.clientName,
        commodity: workflowPayload.job.commodity,
        plantLocation: workflowPayload.job.plantLocation ?? "",
        deadline:
          typeof workflowPayload.job.deadline === "string" && workflowPayload.job.deadline
            ? workflowPayload.job.deadline.slice(0, 10)
            : "",
      });
      setLotForm((current) => ({
        ...current,
        lotNumber:
          workflowPayload.settings.workflow.autoLotNumbering
            ? buildAutoLotNumber(workflowPayload.settings.workflow, workflowPayload.job.lots ?? [])
            : current.lotNumber,
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unified job workflow could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [jobId, searchParams]);

  useEffect(() => {
    void fetchWorkflow();
  }, [fetchWorkflow]);

  useEffect(() => {
    setActiveSection(normalizeSection(searchParams.get("section")));
  }, [searchParams]);

  const job = payload?.job ?? null;
  const settings = payload?.settings ?? null;
  const clients = payload?.clients ?? [];
  const items = payload?.items ?? [];
  const containerTypes = payload?.containerTypes ?? [];
  const selectedLot = useMemo(
    () => job?.lots?.find((lot) => lot.id === selectedLotId) ?? job?.lots?.[0] ?? null,
    [job?.lots, selectedLotId],
  );
  const selectedSample = selectedLot?.sample ?? null;
  const packets = useMemo(() => selectedSample?.packets ?? [], [selectedSample?.packets]);
  const rndAssignees = payload?.rndAssignees ?? [];
  const isAdminUser = normalizeRole(currentUser?.role ?? null) === "ADMIN";
  const draftStorageKey = useMemo(
    () => (selectedSample ? `packet-draft:${jobId}:${selectedSample.id}` : null),
    [jobId, selectedSample],
  );
  const packetStageBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!selectedSample) {
      blockers.push("Sample is required before packet creation.");
    }
    if (selectedLot?.inspection?.decisionStatus !== "READY_FOR_SAMPLING") {
      blockers.push("Final decision must be Pass before packet creation.");
    }
    if (selectedSample && !selectedSample.homogeneousProofDone && !selectedSample.homogenizedAt) {
      blockers.push("Homogeneous proof is pending.");
    }
    if (settings?.seal.sealScanRequired && selectedSample && !selectedSample.sealLabel?.sealNo && !selectedLot?.sealNumber) {
      blockers.push("Seal step is incomplete.");
    }
    return blockers;
  }, [selectedSample, selectedLot?.inspection?.decisionStatus, selectedLot?.sealNumber, settings?.seal.sealScanRequired]);
  const missingRequiredImageProof = useMemo(() => {
    if (!selectedLot || !settings) {
      return [];
    }
    return getMissingRequiredImageProofLabels(
      settings.images.requiredImageCategories,
      (selectedLot.mediaFiles ?? []).map((file) => file.category),
    );
  }, [selectedLot, settings]);

  const packetAllocation = useMemo(() => {
    if (!selectedSample?.sampleQuantity || !selectedSample.sampleUnit) {
      return null;
    }
    const sampleComparable = toComparableQuantity(selectedSample.sampleQuantity, selectedSample.sampleUnit);
    if (!sampleComparable) {
      return null;
    }
    const draftComparableTotal = draftPacketRows.reduce((total, row) => {
      const weight = parsePositiveNumber(row.packetWeight);
      const comparable = toComparableQuantity(weight, row.packetUnit);
      if (!comparable || comparable.dimension !== sampleComparable.dimension) return total;
      return total + comparable.value;
    }, 0);
    const persistedComparableTotal = packets.reduce((total, packet) => {
      const draft = packetDrafts[packet.id];
      const comparable = toComparableQuantity(
        parsePositiveNumber(draft?.packetWeight ?? "") ?? packet.packetWeight ?? packet.packetQuantity ?? null,
        draft?.packetUnit ?? packet.packetUnit,
      );
      if (!comparable || comparable.dimension !== sampleComparable.dimension) return total;
      return total + comparable.value;
    }, 0);
    const allocatedBase = draftPacketRows.length > 0 ? draftComparableTotal : persistedComparableTotal;
    const remainingBase = sampleComparable.value - allocatedBase;
    return {
      available: selectedSample.sampleQuantity,
      allocated: fromComparable(allocatedBase, selectedSample.sampleUnit),
      remaining: fromComparable(Math.max(remainingBase, 0), selectedSample.sampleUnit),
      overAllocated: remainingBase < 0,
      unit: selectedSample.sampleUnit,
    };
  }, [draftPacketRows, packetDrafts, packets, selectedSample]);

  useEffect(() => {
    if (!selectedSample) {
      setSampleForm({
        sampleCode: "",
        sampleType: "",
        samplingMethod: "",
        sampleQuantity: "",
        sampleUnit: "KG",
        containerType: "",
        remarks: "",
      });
      return;
    }
    setSampleForm({
      sampleCode: selectedSample.sampleCode ?? "",
      sampleType: selectedSample.sampleType ?? "",
      samplingMethod: selectedSample.samplingMethod ?? "",
      sampleQuantity:
        selectedSample.sampleQuantity !== null && selectedSample.sampleQuantity !== undefined
          ? String(selectedSample.sampleQuantity)
          : "",
      sampleUnit: selectedSample.sampleUnit ?? "KG",
      containerType: selectedSample.containerType ?? "",
      remarks: selectedSample.remarks ?? "",
    });
  }, [selectedSample]);

  useEffect(() => {
    const nextDrafts: Record<string, { packetWeight: string; packetUnit: string; packetUse: PacketUse | ""; notes: string }> = {};
    for (const packet of packets) {
      nextDrafts[packet.id] = {
        packetWeight:
          packet.packetWeight !== null && packet.packetWeight !== undefined
            ? String(packet.packetWeight)
            : packet.packetQuantity !== null && packet.packetQuantity !== undefined
              ? String(packet.packetQuantity)
              : "",
        packetUnit: packet.packetUnit ?? "KG",
        packetUse: normalizePacketUse(packet.packetType),
        notes: packet.remarks ?? "",
      };
    }
    setPacketDrafts(nextDrafts);
  }, [packets]);

  useEffect(() => {
    if (!draftStorageKey) {
      setDraftPacketRows([]);
      return;
    }
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) {
      setDraftPacketRows([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PacketDraftRow[];
      setDraftPacketRows(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDraftPacketRows([]);
    }
  }, [draftStorageKey]);

  const handleSaveJobBasics = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobForm),
      });
      if (!response.ok) {
        throw new Error("Job basics could not be saved.");
      }
      await fetchWorkflow();
      toast({ title: "Job basics saved", status: "success" });
    } catch (saveError) {
      toast({ title: "Save failed", description: saveError instanceof Error ? saveError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!isAdminUser) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this job from active workflow? The job will be archived and removed from active queues.",
    );
    if (!confirmed) {
      return;
    }

    setDeletingJob(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/archive`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details || "Job could not be deleted.");
      }

      toast({ title: "Job deleted", description: "The job has been archived.", status: "success" });
      router.push("/jobs");
      router.refresh();
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description: deleteError instanceof Error ? deleteError.message : "Delete failed.",
        status: "error",
      });
    } finally {
      setDeletingJob(false);
    }
  };

  const handleAutoSaveClient = async (clientId: string, clientName: string) => {
    setSavingClient(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientName }),
      });
      if (!response.ok) {
        throw new Error("Client selection could not be saved.");
      }
      setPayload((current) =>
        current
          ? {
            ...current,
            job: {
              ...current.job,
              clientId,
              clientName,
            },
          }
          : current,
      );
    } catch (saveError) {
      toast({
        title: "Client save failed",
        description: saveError instanceof Error ? saveError.message : "Save failed.",
        status: "error",
      });
    } finally {
      setSavingClient(false);
    }
  };

  const handleCreateClient = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/masters/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientForm,
          shipToAddress: clientForm.sameAsBilling ? clientForm.billToAddress : clientForm.shipToAddress,
        }),
      });
      if (!response.ok) {
        throw new Error("Client could not be created.");
      }
      const created = (await response.json()) as ClientOption;
      await fetchWorkflow();
      setClientDrawerOpen(false);
      setJobForm((current) => ({
        ...current,
        clientId: created.id,
        clientName: created.clientName,
      }));
      await handleAutoSaveClient(created.id, created.clientName);
      toast({ title: "Client created", status: "success" });
    } catch (createError) {
      toast({ title: "Client create failed", description: createError instanceof Error ? createError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLot = async () => {
    if (!selectedLot && settings?.workflow.autoLotNumbering && job) {
      setLotForm((current) => ({
        ...current,
        lotNumber: buildAutoLotNumber(settings.workflow, job.lots ?? []),
      }));
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotNumber: lotForm.lotNumber,
          materialName: lotForm.materialName,
          quantityMode: lotForm.quantityMode,
          totalBags: Number(lotForm.totalBags),
          weightUnit: lotForm.weightUnit,
        }),
      });
      if (!response.ok) {
        throw new Error("Lot could not be created.");
      }
      await fetchWorkflow();
      setLotForm({
        lotNumber: settings ? buildAutoLotNumber(settings.workflow, (job?.lots ?? []).concat()) : "",
        quantityMode: "SINGLE_PIECE",
        materialName: "",
        totalBags: "1",
        weightUnit: "KG",
      });
      toast({ title: "Lot created", status: "success" });
    } catch (createError) {
      toast({ title: "Lot create failed", description: createError instanceof Error ? createError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!selectedLot || !selectedImageLabel) {
      return;
    }
    setSaving(true);
    try {
      const category = getUploadCategoryKey(selectedImageLabel);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lotId", selectedLot.id);
      formData.append("category", category);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error("Image upload failed.");
      }
      await fetchWorkflow();
      toast({ title: "Image uploaded", status: "success" });
    } catch (uploadError) {
      toast({ title: "Upload failed", description: uploadError instanceof Error ? uploadError.message : "Upload failed.", status: "error" });
    } finally {
      setSaving(false);
      setSelectedImageLabel(null);
    }
  };

  const ensureInspectionRecord = async () => {
    if (!selectedLot) {
      return;
    }
    const response = await fetch("/api/inspection/execution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: selectedLot.id }),
    });
    if (!response.ok) {
      throw new Error("Inspection record could not be initialized.");
    }
  };

  const handleDecision = async (decision: "PENDING" | "READY_FOR_SAMPLING" | "ON_HOLD" | "REJECTED") => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      await ensureInspectionRecord();
      const overallRemark =
        decision === "ON_HOLD" || decision === "REJECTED"
          ? "Decision requires review note."
          : decision === "PENDING"
            ? "Ready for Decision"
            : "Approved for Sampling";
      const response = await fetch("/api/inspection/execution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          decisionStatus: decision,
          overallRemark,
        }),
      });
      if (!response.ok) {
        let details = "";
        try {
          const payload = (await response.json()) as { details?: unknown };
          details = typeof payload?.details === "string" ? payload.details : "";
        } catch {
          details = "";
        }
        throw new Error(details || "Decision update failed.");
      }
      await fetchWorkflow();
      toast({ title: "Decision updated", status: "success" });
    } catch (decisionError) {
      toast({ title: "Decision failed", description: decisionError instanceof Error ? decisionError.message : "Decision failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartSampling = async () => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          ...(settings?.workflow.autoSampleIdGeneration ? {} : { sampleCode: sampleForm.sampleCode }),
        }),
      });
      if (!response.ok) {
        throw new Error("Sampling could not be started.");
      }
      await fetchWorkflow();
      toast({ title: "Sampling started", status: "success" });
    } catch (sampleError) {
      toast({ title: "Sampling failed", description: sampleError instanceof Error ? sampleError.message : "Sampling failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSample = async () => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          ...(settings?.workflow.autoSampleIdGeneration ? {} : { sampleCode: sampleForm.sampleCode }),
          sampleType: sampleForm.sampleType,
          samplingMethod: sampleForm.samplingMethod,
          sampleQuantity: sampleForm.sampleQuantity,
          sampleUnit: sampleForm.sampleUnit,
          containerType: sampleForm.containerType,
          remarks: sampleForm.remarks,
        }),
      });
      if (!response.ok) {
        throw new Error("Sample details could not be saved.");
      }
      await fetchWorkflow();
      toast({ title: "Sample details saved", status: "success" });
    } catch (sampleError) {
      toast({ title: "Save failed", description: sampleError instanceof Error ? sampleError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkHomogeneous = async () => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId: selectedLot.id, markHomogenized: true }),
      });
      if (!response.ok) {
        throw new Error("Homogeneous proof could not be marked.");
      }
      await fetchWorkflow();
      toast({ title: "Homogeneous proof saved", status: "success" });
    } catch (sampleError) {
      toast({ title: "Update failed", description: sampleError instanceof Error ? sampleError.message : "Update failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeal = async (sealNo: string) => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          sealNo,
          sealAuto: false,
          markSealed: true,
        }),
      });
      if (!response.ok) {
        throw new Error("Seal could not be saved.");
      }
      await fetchWorkflow();
      toast({ title: "Seal saved", status: "success" });
    } catch (sealError) {
      toast({ title: "Seal failed", description: sealError instanceof Error ? sealError.message : "Seal failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSealsForAll = async () => {
    if (!job?.lots?.length) {
      return;
    }
    setSaving(true);
    try {
      for (const lot of job.lots) {
        if (lot.sealNumber) {
          continue;
        }
        const response = await fetch(`/api/lots/${lot.id}/seal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto: true }),
        });
        if (!response.ok) {
          let details = "";
          try {
            const payload = (await response.json()) as { details?: unknown };
            details = typeof payload?.details === "string" ? payload.details : "";
          } catch {
            details = "";
          }
          throw new Error(details || `Seal generation failed for ${lot.lotNumber}.`);
        }
      }
      await fetchWorkflow();
      toast({ title: "Seal numbers generated", status: "success" });
    } catch (sealError) {
      toast({ title: "Bulk generation failed", description: sealError instanceof Error ? sealError.message : "Generation failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePackets = async () => {
    if (!selectedSample) {
      return;
    }
    if (draftPacketRows.length === 0) {
      toast({ title: "No draft packets", description: "Use Auto Create Rows or Manual Add Packet first.", status: "warning" });
      return;
    }
    for (const row of draftPacketRows) {
      if (!row.packetWeight || !row.packetUnit || !row.packetUse) {
        toast({
          title: "Packet draft incomplete",
          description: "Each draft packet requires weight, unit, and packet use.",
          status: "warning",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch("/api/rd/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleId: selectedSample.id,
          count: draftPacketRows.length,
          packets: draftPacketRows.map((row) => ({
            packetWeight: Number(row.packetWeight),
            packetUnit: row.packetUnit,
            packetUse: row.packetUse,
            notes: row.notes || null,
          })),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string; error?: string } | null;
        throw new Error(payload?.details || payload?.error || "Packets could not be created.");
      }
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      setDraftPacketRows([]);
      await fetchWorkflow();
      toast({ title: "Packets created", status: "success" });
    } catch (packetError) {
      toast({ title: "Packet create failed", description: packetError instanceof Error ? packetError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraftPackets = () => {
    if (!draftStorageKey) {
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draftPacketRows));
    toast({ title: "Packet draft saved", status: "success" });
  };

  const handleAutoCreateDraftRows = () => {
    const requested = Number.parseInt(packetCount, 10);
    if (!Number.isInteger(requested) || requested <= 0 || requested > 50) {
      toast({ title: "Invalid packet count", description: "Packet count must be between 1 and 50.", status: "warning" });
      return;
    }
    const start = draftPacketRows.length + 1;
    const rows: PacketDraftRow[] = Array.from({ length: requested }, (_, index) => ({
      id: `draft-${Date.now()}-${start + index}`,
      packetId: `Draft Packet ${start + index}`,
      packetWeight: "",
      packetUnit: defaultPacketUnit,
      packetUse: "",
      notes: "",
      status: "Draft",
    }));
    setDraftPacketRows((current) => [...current, ...rows]);
  };

  const handleManualAddDraftRow = () => {
    setDraftPacketRows((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${current.length + 1}`,
        packetId: `Draft Packet ${current.length + 1}`,
        packetWeight: "",
        packetUnit: defaultPacketUnit,
        packetUse: "",
        notes: "",
        status: "Draft",
      },
    ]);
  };

  const handleRemoveDraftRow = (id: string) => {
    setDraftPacketRows((current) => current.filter((row) => row.id !== id));
  };

  const handleSavePacket = async (packetId: string) => {
    const draft = packetDrafts[packetId];
    if (!draft) {
      return;
    }
    if (!draft.packetWeight || !draft.packetUnit || !draft.packetUse) {
      toast({
        title: "Packet incomplete",
        description: "Packet weight, unit, and packet use are required.",
        status: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/rd/packet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetId,
          packetWeight: draft.packetWeight,
          packetUnit: draft.packetUnit,
          packetUse: draft.packetUse,
          remarks: draft.notes,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string; error?: string } | null;
        throw new Error(payload?.details || payload?.error || "Packet could not be updated.");
      }
      await fetchWorkflow();
      toast({ title: "Packet updated", status: "success" });
    } catch (packetError) {
      toast({ title: "Packet save failed", description: packetError instanceof Error ? packetError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitToRnd = async () => {
    if (!packets.length) {
      return;
    }
    if (!rndHandoverTarget) {
      toast({ title: "R&D handover target required", description: "Select the R&D user who will receive this workflow.", status: "warning" });
      return;
    }
    setSaving(true);
    try {
      for (const packet of packets) {
        const draft = packetDrafts[packet.id];
        if (!draft?.packetWeight || !draft?.packetUnit || !draft?.packetUse) {
          throw new Error("Every packet requires weight, unit, and packet use before Submit to R&D.");
        }
        const response = await fetch("/api/rd/packet", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packetId: packet.id,
            packetWeight: draft.packetWeight,
            packetUnit: draft.packetUnit,
            packetUse: draft.packetUse,
            remarks: draft.notes,
            markSubmittedToRnd: true,
            handedOverToRndTo: rndHandoverTarget,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { details?: string; error?: string } | null;
          throw new Error(payload?.details || payload?.error || `Submit to R&D failed for ${packet.packetCode}.`);
        }
      }
      await fetchWorkflow();
      toast({ title: "Submitted to R&D", status: "success" });
    } catch (submitError) {
      toast({ title: "Submit failed", description: submitError instanceof Error ? submitError.message : "Submit failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={4} rows={4} />
      </ControlTowerLayout>
    );
  }

  if (error || !job || !settings) {
    return (
      <ControlTowerLayout>
        <InlineErrorState title="Workflow unavailable" description={error ?? "Workflow unavailable"} onRetry={() => void fetchWorkflow()} />
      </ControlTowerLayout>
    );
  }

  const workflowPayload = payload!;
  const nextPrimaryAction = workflowPayload.nextAction ?? "Add Lot";
  const processTimeline = [
    {
      id: "job-created",
      title: "Job Created",
      subtitle: "Parent job record created.",
      at: formatDate(workflowPayload.milestones.jobCreatedAt),
    },
    {
      id: "job-started",
      title: "Job Started",
      subtitle: workflowPayload.milestones.jobStartedAt ? "First lot created." : "Pending first lot creation.",
      at: workflowPayload.milestones.jobStartedAt ? formatDate(workflowPayload.milestones.jobStartedAt) : undefined,
    },
    {
      id: "sent-to-admin",
      title: "Sent to Admin",
      subtitle: workflowPayload.milestones.sentToAdminAt
        ? `Submitted by ${workflowPayload.milestones.sentToAdminBy || "Not Available"}.`
        : "Pending operations submission for final decision.",
      at: workflowPayload.milestones.sentToAdminAt ? formatDate(workflowPayload.milestones.sentToAdminAt) : undefined,
    },
    {
      id: "admin-decision",
      title: "Admin Decision",
      subtitle: workflowPayload.milestones.adminDecisionAt
        ? `${workflowPayload.milestones.adminDecisionStatus || "Decision"} by ${workflowPayload.milestones.adminDecisionBy || "Not Available"}.`
        : "Pending final admin decision.",
      at: workflowPayload.milestones.adminDecisionAt ? formatDate(workflowPayload.milestones.adminDecisionAt) : undefined,
    },
    {
      id: "operations-completed",
      title: "Operations Completed",
      subtitle: workflowPayload.milestones.operationsCompletedAt
        ? "Operations-side proof, packets, and readiness completed."
        : "Pending full operations completion across all lots.",
      at: workflowPayload.milestones.operationsCompletedAt ? formatDate(workflowPayload.milestones.operationsCompletedAt) : undefined,
    },
    {
      id: "handover-rnd",
      title: "Handed Over to R&D",
      subtitle: workflowPayload.milestones.handedOverToRndAt
        ? `Submitted by ${workflowPayload.milestones.handedOverToRndBy || "Not Available"}${workflowPayload.milestones.handedOverToRndToLabel ? ` to ${workflowPayload.milestones.handedOverToRndToLabel}` : ""}.`
        : "Pending R&D handover.",
      at: workflowPayload.milestones.handedOverToRndAt ? formatDate(workflowPayload.milestones.handedOverToRndAt) : undefined,
    },
  ];
  const workflowSections: Array<{ id: WorkflowSectionId; label: string }> = [
    { id: "job", label: "Job Basics" },
    { id: "lots", label: "Lots" },
    { id: "images", label: "Images" },
    { id: "decision", label: "Final Decision" },
    { id: "sampling", label: "Sampling" },
    { id: "seal", label: "Seal" },
    { id: "packets", label: "Packets" },
    { id: "handover", label: "Submit to R&D" },
  ];

  const focusSectionForNextAction = () => {
    if (nextPrimaryAction === "Add Lot") {
      setActiveSection("lots");
      void handleCreateLot();
      return;
    }
    if (nextPrimaryAction === "Submit for Decision" || nextPrimaryAction === "Pass / Hold / Reject") {
      setActiveSection("decision");
      return;
    }
    if (nextPrimaryAction === "Start Sampling") {
      setActiveSection("sampling");
      void handleStartSampling();
      return;
    }
    if (nextPrimaryAction === "Mark Homogeneous Proof") {
      setActiveSection("sampling");
      void handleMarkHomogeneous();
      return;
    }
    if (nextPrimaryAction === "Create Packets") {
      setActiveSection("packets");
      void handleCreatePackets();
      return;
    }
    setActiveSection("handover");
    void handleSubmitToRnd();
  };

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="Job Workflow"
          subtitle="One guided workflow from Job Basics to Submit to R&D."
          breadcrumbs={[
            { label: "Jobs", href: "/jobs" },
            { label: job.inspectionSerialNumber || job.jobReferenceNumber || "Job" },
            { label: "Workflow" },
          ]}
          status={
            <HStack spacing={2}>
              <WorkflowStateChip status={job.status} />
              <Badge colorScheme="gray" variant="subtle">Current CTA: {nextPrimaryAction}</Badge>
            </HStack>
          }
        />

        <PageActionBar
          primaryAction={
            <Button
              colorScheme="blue"
              onClick={focusSectionForNextAction}
              isLoading={saving || deletingJob}
              size="lg"
              boxShadow="sm"
            >
              {nextPrimaryAction}
            </Button>
          }
          secondaryActions={
            <HStack spacing={4} flexWrap="wrap">
              <Text fontSize="sm" color="text.secondary" fontWeight="medium">
                Unified Workflow: {activeSection.toUpperCase()}
              </Text>
              {isAdminUser ? (
                <Button
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => void handleDeleteJob()}
                  isLoading={deletingJob}
                >
                  Delete Job
                </Button>
              ) : null}
            </HStack>
          }
        />

        <Box
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="lg"
          bg="bg.surface"
          px={3}
          py={2}
          position="sticky"
          top={{ base: "76px", lg: "88px" }}
          zIndex={2}
        >
          <Tabs variant="line-enterprise" index={Math.max(workflowSections.findIndex((section) => section.id === activeSection), 0)}>
            <TabList overflowX="auto" overflowY="hidden">
              {workflowSections.map((section) => (
                <Tab
                  key={section.id}
                  whiteSpace="nowrap"
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </Box>

        <Stack direction={{ base: "column", xl: "row" }} spacing={4} align="start">
          <VStack align="stretch" spacing={4} flex="1">
            {activeSection === "job" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">1. Job Basics</Heading>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <FormControl>
                        <FormLabel>Client Name</FormLabel>
                        <Select
                          value={jobForm.clientId}
                          isDisabled={savingClient}
                          onChange={(event) => {
                            const nextClientId = event.target.value;
                            const selectedClient = clients.find((client) => client.id === nextClientId);
                            const nextClientName = selectedClient?.clientName ?? "";
                            setJobForm((current) => ({
                              ...current,
                              clientId: nextClientId,
                              clientName: nextClientName,
                            }));
                            void handleAutoSaveClient(nextClientId, nextClientName);
                          }}
                        >
                          <option value="">Select client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>{client.clientName}</option>
                          ))}
                        </Select>
                        <FormHelperText>Client selection auto-saves immediately.</FormHelperText>
                        <Button mt={2} size="sm" variant="outline" onClick={() => setClientDrawerOpen(true)}>
                          Add New Client
                        </Button>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Item</FormLabel>
                        <Select
                          value={jobForm.commodity}
                          onChange={(event) => setJobForm((current) => ({ ...current, commodity: event.target.value }))}
                        >
                          <option value="">Select item</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.itemName}>{item.itemName}</option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Assigned user</FormLabel>
                        <Input value={job.assignedTo?.profile?.displayName ?? "Current user"} isReadOnly />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Deadline</FormLabel>
                        <Input type="date" value={jobForm.deadline} onChange={(event) => setJobForm((current) => ({ ...current, deadline: event.target.value }))} />
                      </FormControl>
                    </SimpleGrid>
                    <Button alignSelf="start" onClick={() => void handleSaveJobBasics()} isLoading={saving}>Save Job</Button>
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "lots" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">2. Lots</Heading>
                    <HStack spacing={2} flexWrap="wrap">
                      {(job.lots ?? []).map((lot) => (
                        <Button key={lot.id} size="sm" variant={selectedLot?.id === lot.id ? "solid" : "outline"} onClick={() => setSelectedLotId(lot.id)}>
                          {lot.lotNumber}
                        </Button>
                      ))}
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <FormControl>
                        <FormLabel>Lot Number</FormLabel>
                        <Input
                          value={lotForm.lotNumber}
                          onChange={(event) => setLotForm((current) => ({ ...current, lotNumber: event.target.value }))}
                          isReadOnly={settings.workflow.autoLotNumbering}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Quantity Mode</FormLabel>
                        <Select value={lotForm.quantityMode} onChange={(event) => setLotForm((current) => ({ ...current, quantityMode: event.target.value }))}>
                          <option value="SINGLE_PIECE">Single piece</option>
                          <option value="MULTI_WEIGHT">Multi-weight</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Material Name</FormLabel>
                        <Input value={lotForm.materialName} onChange={(event) => setLotForm((current) => ({ ...current, materialName: event.target.value }))} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>{lotForm.quantityMode === "MULTI_WEIGHT" ? "Bag Rows" : "Total Bags"}</FormLabel>
                        <Input value={lotForm.totalBags} onChange={(event) => setLotForm((current) => ({ ...current, totalBags: event.target.value }))} />
                      </FormControl>
                    </SimpleGrid>
                    {lotForm.quantityMode === "MULTI_WEIGHT" ? (
                      <Text fontSize="sm" color="text.secondary">Multi-weight lots capture gross/net/tare per bag row. Lot-level summary is derived.</Text>
                    ) : null}
                    <Button alignSelf="start" onClick={() => void handleCreateLot()} isLoading={saving}>Add Lot</Button>
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "images" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">3. Images</Heading>
                    {!selectedLot ? (
                      <EmptyWorkState title="No lot selected" description="Select a lot to capture required images." />
                    ) : (
                      <EnterpriseStickyTable>
                        <Table size="sm">
                          <Thead>
                            <Tr>
                              <Th>Image Category</Th>
                              <Th>Status</Th>
                              <Th>Action</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {settings.images.requiredImageCategories.map((label) => {
                              const uploadCategory = getUploadCategoryKey(label);
                              const exists = selectedLot.mediaFiles?.some((file) => file.category === uploadCategory);
                              return (
                                <Tr key={label}>
                                  <Td>{label}</Td>
                                  <Td>
                                    <Badge colorScheme={exists ? "green" : "orange"}>{exists ? "Uploaded" : "Missing"}</Badge>
                                  </Td>
                                  <Td>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedImageLabel(label);
                                        fileRef.current?.click();
                                      }}
                                    >
                                      Upload Images
                                    </Button>
                                  </Td>
                                </Tr>
                              );
                            })}
                          </Tbody>
                        </Table>
                      </EnterpriseStickyTable>
                    )}
                    {settings.images.imageTimestampRequired ? (
                      <Text fontSize="sm" color="text.secondary">Timestamp overlay is enabled for image capture in this company configuration.</Text>
                    ) : null}
                    {settings.ui.showOptionalImageSection && settings.images.optionalImageCategories.length > 0 ? (
                      <Box>
                        <Text fontSize="sm" fontWeight="medium" color="text.primary" mb={2}>
                          Optional Images
                        </Text>
                        <VStack align="stretch" spacing={1}>
                          {settings.images.optionalImageCategories.map((label) => (
                            <Text key={label} fontSize="sm" color="text.secondary">
                              {label}
                            </Text>
                          ))}
                        </VStack>
                      </Box>
                    ) : null}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "decision" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">4. Final Decision</Heading>
                    {!selectedLot ? (
                      <EmptyWorkState title="No lot selected" description="Select a lot to submit or approve the decision." />
                    ) : (
                      <>
                        <Text fontSize="sm" color="text.secondary">
                          Operations submit lots for decision only after required proof is complete. Final Pass, Hold, and Reject are controlled by the configured approver policy.
                        </Text>
                        {missingRequiredImageProof.length > 0 ? (
                          <Text fontSize="sm" color="orange.600">
                            Missing required proof: {missingRequiredImageProof.join(", ")}.
                          </Text>
                        ) : null}
                        <HStack spacing={3} flexWrap="wrap">
                          <Button
                            variant="outline"
                            onClick={() => void handleDecision("PENDING")}
                            isLoading={saving}
                            isDisabled={missingRequiredImageProof.length > 0}
                          >
                            Submit for Decision
                          </Button>
                          {canApproveFinalDecision(currentUser?.role, settings.workflow.finalDecisionApproverPolicy) ? (
                            <>
                              <Button
                                onClick={() => void handleDecision("READY_FOR_SAMPLING")}
                                isLoading={saving}
                                isDisabled={missingRequiredImageProof.length > 0}
                              >
                                Pass
                              </Button>
                              <Button colorScheme="yellow" onClick={() => void handleDecision("ON_HOLD")} isLoading={saving}>Hold</Button>
                              <Button colorScheme="red" onClick={() => void handleDecision("REJECTED")} isLoading={saving}>Reject</Button>
                            </>
                          ) : null}
                        </HStack>
                        <Text fontSize="sm" color="text.secondary">
                          Current Decision: {selectedLot.inspection?.decisionStatus?.replaceAll("_", " ") ?? "PENDING"}
                        </Text>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "sampling" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">5. Sampling</Heading>
                    {!selectedLot ? (
                      <EmptyWorkState title="No lot selected" description="Select a lot to manage sample details." />
                    ) : (
                      <>
                        {!selectedSample ? (
                          <Button alignSelf="start" onClick={() => void handleStartSampling()} isLoading={saving}>Start Sampling</Button>
                        ) : null}
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <FormControl>
                            <FormLabel>Sample ID</FormLabel>
                            <Input
                              value={
                                selectedSample?.sampleCode ??
                                (settings.workflow.autoSampleIdGeneration ? "Auto generated after start" : sampleForm.sampleCode)
                              }
                              isReadOnly={settings.workflow.autoSampleIdGeneration || Boolean(selectedSample?.sampleCode)}
                              onChange={(event) => setSampleForm((current) => ({ ...current, sampleCode: event.target.value }))}
                              placeholder={settings.workflow.autoSampleIdGeneration ? "Auto generated after start" : "Enter Sample ID"}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Container Type</FormLabel>
                            <Select value={sampleForm.containerType} onChange={(event) => setSampleForm((current) => ({ ...current, containerType: event.target.value }))}>
                              <option value="">Select container</option>
                              {containerTypes.map((containerType) => (
                                <option key={containerType.id} value={containerType.name}>{containerType.name}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Sample Type</FormLabel>
                            <Input value={sampleForm.sampleType} onChange={(event) => setSampleForm((current) => ({ ...current, sampleType: event.target.value }))} />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Sampling Method</FormLabel>
                            <Input value={sampleForm.samplingMethod} onChange={(event) => setSampleForm((current) => ({ ...current, samplingMethod: event.target.value }))} />
                          </FormControl>
                        </SimpleGrid>
                        <HStack spacing={3} flexWrap="wrap">
                          <Button onClick={() => void handleSaveSample()} isLoading={saving}>Save Sampling</Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleMarkHomogeneous()}
                            isLoading={saving}
                            isDisabled={!settings.sampling.homogeneousProofRequired}
                          >
                            Mark Homogeneous Proof
                          </Button>
                        </HStack>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "seal" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">6. Seal</Heading>
                    {!selectedLot ? (
                      <EmptyWorkState title="No lot selected" description="Select a lot to manage seal flow." />
                    ) : (
                      <>
                        <HStack spacing={3} flexWrap="wrap">
                          <SealScanner onScanned={(sealNo) => void handleSaveSeal(sealNo)} onManualConfirm={(sealNo) => void handleSaveSeal(sealNo)} isDisabled={!settings.seal.sealScanRequired && Boolean(selectedSample?.sealLabel?.sealNo)} />
                          <Button
                            variant="outline"
                            onClick={() => void handleGenerateSealsForAll()}
                            isLoading={saving}
                            isDisabled={!settings.seal.bulkSealGenerationEnabled}
                          >
                            Generate Seal Numbers
                          </Button>
                        </HStack>
                        <EnterpriseStickyTable>
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Lot No</Th>
                                <Th>Bag No</Th>
                                <Th>Weight</Th>
                                <Th>Gross</Th>
                                <Th>Net</Th>
                                <Th>Seal No</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {(job.lots ?? []).flatMap((lot) =>
                                (lot.bags?.length ? lot.bags : [{ id: lot.id, bagNumber: 1, grossWeight: lot.grossWeight ?? null, netWeight: lot.netWeight ?? null }]).map((bag) => (
                                  <Tr key={`${lot.id}-${bag.id}`}>
                                    <Td>{lot.lotNumber}</Td>
                                    <Td>{bag.bagNumber}</Td>
                                    <Td>{lot.weightUnit ?? "KG"}</Td>
                                    <Td>{bag.grossWeight ?? "Not Available"}</Td>
                                    <Td>{bag.netWeight ?? "Not Available"}</Td>
                                    <Td>{lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? "Not Available"}</Td>
                                  </Tr>
                                )),
                              )}
                            </Tbody>
                          </Table>
                        </EnterpriseStickyTable>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "packets" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">7. Packet Creation</Heading>
                    {!selectedSample ? (
                      <EmptyWorkState title="Sample required" description="Start sampling before creating packets." />
                    ) : (
                      <>
                        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted">Job Number</Text>
                            <Text fontWeight="semibold">{job.inspectionSerialNumber || job.jobReferenceNumber || "Not Available"}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted">Lot Number</Text>
                            <Text fontWeight="semibold">{selectedLot?.lotNumber ?? "Not Available"}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted">Sample ID</Text>
                            <Text fontWeight="semibold">{selectedSample.sampleCode || "Not Available"}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted">Available Sample Quantity</Text>
                            <Text fontWeight="semibold">
                              {selectedSample.sampleQuantity ?? "Not Available"} {selectedSample.sampleUnit ?? ""}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted">Container / Seal</Text>
                            <Text fontWeight="semibold">
                              {selectedSample.containerType || "Container not set"} / {selectedSample.sealLabel?.sealNo || selectedLot?.sealNumber || "Seal pending"}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" textTransform="uppercase" color="text.muted">Current Stage</Text>
                            <Text fontWeight="semibold">{workflowPayload.workflowStage}</Text>
                          </Box>
                        </SimpleGrid>

                        {packetStageBlockers.length > 0 ? (
                          <ExceptionBanner
                            title="Packet blockers"
                            description={packetStageBlockers.join(" ")}
                            status="warning"
                          />
                        ) : null}

                        {packetAllocation ? (
                          <HStack
                            spacing={4}
                            borderWidth="1px"
                            borderColor={packetAllocation.overAllocated ? "red.300" : "border.default"}
                            borderRadius="lg"
                            px={3}
                            py={2}
                            wrap="wrap"
                          >
                            <Text fontSize="sm">Available: <Text as="span" fontWeight="semibold">{packetAllocation.available} {packetAllocation.unit}</Text></Text>
                            <Text fontSize="sm">Allocated: <Text as="span" fontWeight="semibold">{packetAllocation.allocated.toFixed(2)} {packetAllocation.unit}</Text></Text>
                            <Text fontSize="sm">Remaining: <Text as="span" fontWeight="semibold">{packetAllocation.remaining.toFixed(2)} {packetAllocation.unit}</Text></Text>
                            {packetAllocation.overAllocated ? <Badge colorScheme="red">Over-allocated</Badge> : <Badge colorScheme="green">Within limit</Badge>}
                          </HStack>
                        ) : null}

                        <VStack align="stretch" spacing={3}>
                          <HStack spacing={3} align="end">
                            <FormControl maxW="160px">
                              <FormLabel mb={1}>Packets to create</FormLabel>
                              <Input
                                value={packetCount}
                                onChange={(event) => setPacketCount(event.target.value)}
                                aria-label="Packets to create"
                              />
                            </FormControl>
                            <FormControl maxW="160px">
                              <FormLabel mb={1}>Default Unit</FormLabel>
                              <Select value={defaultPacketUnit} onChange={(event) => setDefaultPacketUnit(event.target.value)}>
                                <option value="KG">KG</option>
                                <option value="G">G</option>
                                <option value="PCS">PCS</option>
                              </Select>
                            </FormControl>
                            <Button onClick={handleAutoCreateDraftRows} isDisabled={packetStageBlockers.length > 0}>Auto Create Rows</Button>
                            <Button variant="outline" onClick={handleManualAddDraftRow} isDisabled={packetStageBlockers.length > 0}>Manual Add Packet</Button>
                          </HStack>
                          <Text fontSize="sm" color="text.secondary">
                            Create draft rows first, then enter packet weight, unit, and packet use. Drafts do not create records until you click Create Packets.
                          </Text>
                        </VStack>

                        <EnterpriseStickyTable>
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Packet ID</Th>
                                <Th>Packet Weight</Th>
                                <Th>Unit</Th>
                                <Th>Packet Use</Th>
                                <Th>Notes</Th>
                                <Th>Status</Th>
                                <Th>Action</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {draftPacketRows.length > 0
                                ? draftPacketRows.map((row) => (
                                  <Tr key={row.id}>
                                    <Td>{row.packetId}</Td>
                                    <Td>
                                      <Input
                                        size="sm"
                                        value={row.packetWeight}
                                        onChange={(event) =>
                                          setDraftPacketRows((current) =>
                                            current.map((entry) =>
                                              entry.id === row.id ? { ...entry, packetWeight: event.target.value } : entry,
                                            ),
                                          )
                                        }
                                      />
                                    </Td>
                                    <Td>
                                      <Select
                                        size="sm"
                                        value={row.packetUnit}
                                        onChange={(event) =>
                                          setDraftPacketRows((current) =>
                                            current.map((entry) =>
                                              entry.id === row.id ? { ...entry, packetUnit: event.target.value } : entry,
                                            ),
                                          )
                                        }
                                      >
                                        <option value="KG">KG</option>
                                        <option value="G">G</option>
                                        <option value="PCS">PCS</option>
                                      </Select>
                                    </Td>
                                    <Td>
                                      <Select
                                        size="sm"
                                        value={row.packetUse}
                                        onChange={(event) =>
                                          setDraftPacketRows((current) =>
                                            current.map((entry) =>
                                              entry.id === row.id ? { ...entry, packetUse: event.target.value as PacketUse } : entry,
                                            ),
                                          )
                                        }
                                      >
                                        <option value="">Select use</option>
                                        <option value="TESTING">Testing</option>
                                        <option value="RETAIN">Retain</option>
                                        <option value="BACKUP">Backup</option>
                                        <option value="REFERENCE">Reference</option>
                                      </Select>
                                    </Td>
                                    <Td>
                                      <Input
                                        size="sm"
                                        value={row.notes}
                                        onChange={(event) =>
                                          setDraftPacketRows((current) =>
                                            current.map((entry) =>
                                              entry.id === row.id ? { ...entry, notes: event.target.value } : entry,
                                            ),
                                          )
                                        }
                                      />
                                    </Td>
                                    <Td><Badge colorScheme="gray">Draft</Badge></Td>
                                    <Td><Button size="xs" variant="outline" onClick={() => handleRemoveDraftRow(row.id)}>Remove</Button></Td>
                                  </Tr>
                                ))
                                : packets.map((packet) => (
                                  <Tr key={packet.id}>
                                    <Td>{packet.packetCode}</Td>
                                    <Td>
                                      <Input
                                        size="sm"
                                        value={packetDrafts[packet.id]?.packetWeight ?? ""}
                                        onChange={(event) =>
                                          setPacketDrafts((current) => ({
                                            ...current,
                                            [packet.id]: { ...current[packet.id], packetWeight: event.target.value },
                                          }))
                                        }
                                      />
                                    </Td>
                                    <Td>
                                      <Select
                                        size="sm"
                                        value={packetDrafts[packet.id]?.packetUnit ?? "KG"}
                                        onChange={(event) =>
                                          setPacketDrafts((current) => ({
                                            ...current,
                                            [packet.id]: { ...current[packet.id], packetUnit: event.target.value },
                                          }))
                                        }
                                      >
                                        <option value="KG">KG</option>
                                        <option value="G">G</option>
                                        <option value="PCS">PCS</option>
                                      </Select>
                                    </Td>
                                    <Td>
                                      <Select
                                        size="sm"
                                        value={packetDrafts[packet.id]?.packetUse ?? ""}
                                        onChange={(event) =>
                                          setPacketDrafts((current) => ({
                                            ...current,
                                            [packet.id]: { ...current[packet.id], packetUse: event.target.value as PacketUse },
                                          }))
                                        }
                                      >
                                        <option value="">Select use</option>
                                        <option value="TESTING">Testing</option>
                                        <option value="RETAIN">Retain</option>
                                        <option value="BACKUP">Backup</option>
                                        <option value="REFERENCE">Reference</option>
                                      </Select>
                                    </Td>
                                    <Td>
                                      <Input
                                        size="sm"
                                        value={packetDrafts[packet.id]?.notes ?? ""}
                                        onChange={(event) =>
                                          setPacketDrafts((current) => ({
                                            ...current,
                                            [packet.id]: { ...current[packet.id], notes: event.target.value },
                                          }))
                                        }
                                      />
                                    </Td>
                                    <Td><Badge variant="subtle">{packet.packetStatus.replaceAll("_", " ")}</Badge></Td>
                                    <Td><Button size="xs" variant="outline" onClick={() => void handleSavePacket(packet.id)} isLoading={saving}>Save Packet</Button></Td>
                                  </Tr>
                                ))}
                            </Tbody>
                          </Table>
                        </EnterpriseStickyTable>
                        <HStack spacing={3}>
                          <Button variant="outline" onClick={handleSaveDraftPackets} isDisabled={draftPacketRows.length === 0}>
                            Save Draft
                          </Button>
                          <Button onClick={() => void handleCreatePackets()} isLoading={saving} isDisabled={draftPacketRows.length === 0 || packetStageBlockers.length > 0}>
                            Create Packets
                          </Button>
                        </HStack>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "handover" ? (
              <Card variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading as="h2" size="md">8. Submit to R&amp;D</Heading>
                    <Text fontSize="sm" color="text.secondary">
                      This is the terminal operations action. Every packet must carry packet weight, unit, and packet use before submission.
                    </Text>
                    <FormControl maxW={{ base: "full", md: "320px" }} isRequired>
                      <FormLabel>Hand Over To</FormLabel>
                      <Select value={rndHandoverTarget} onChange={(event) => setRndHandoverTarget(event.target.value)}>
                        <option value="">Select R&amp;D user</option>
                        {rndAssignees.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.displayName}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      alignSelf="start"
                      onClick={() => void handleSubmitToRnd()}
                      isLoading={saving}
                      isDisabled={
                        !packets.length ||
                        !rndHandoverTarget ||
                        draftPacketRows.length > 0 ||
                        Boolean(packetStageBlockers.length) ||
                        Boolean(packetAllocation?.overAllocated)
                      }
                    >
                      Submit to R&amp;D
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            ) : null}
          </VStack>

          <Box w={{ base: "full", xl: "340px" }} position={{ xl: "sticky" }} top={{ xl: "92px" }}>
            <VStack align="stretch" spacing={4}>
              <LinkedRecordsPanel
                items={[
                  { label: "Job Number", value: job.inspectionSerialNumber || job.jobReferenceNumber || "Not Available" },
                  { label: "Client", value: job.clientName || "Not Available" },
                  { label: "Item", value: job.commodity || "Not Available" },
                  { label: "Assigned User", value: job.assignedTo?.profile?.displayName || "Not Available" },
                  { label: "Deadline", value: formatDate(job.deadline) },
                  { label: "Lot Summary", value: `${job.lots?.length ?? 0} lot(s)` },
                  { label: "Sample ID", value: selectedSample?.sampleCode || "Not Available" },
                  { label: "Packet Count", value: `${packets.length}` },
                  { label: "Documents", value: `${job.reportSnapshots?.length ?? 0}`, href: `/documents?job=${job.inspectionSerialNumber || job.jobReferenceNumber || job.id}` },
                  { label: "History", value: "Open", href: `/traceability/lots/${selectedLot?.id ?? ""}` },
                ]}
              />

              {settings.ui.showBlockersInline &&
                (payload?.blockers ?? []).filter((b) => {
                  if (activeSection === "decision" && b.includes("Final decision must be passed")) return false;
                  if (activeSection === "sampling" && b.includes("Final decision must be passed")) return false;
                  return true;
                }).length > 0 ? (
                <ExceptionBanner
                  title="Current blockers"
                  description={(payload?.blockers ?? [])
                    .filter((b) => {
                      if (activeSection === "decision" && b.includes("Final decision must be passed")) return false;
                      if (activeSection === "sampling" && b.includes("Final decision must be passed")) return false;
                      return true;
                    })
                    .join(" ")}
                  status="warning"
                />
              ) : null}

              {selectedLot?.inspection?.decisionStatus === "ON_HOLD" || selectedLot?.inspection?.decisionStatus === "REJECTED" ? (
                <ExceptionBanner
                  title="Decision blocks progression"
                  description="Hold and Reject block downstream sampling and packet work until resolved."
                  status="warning"
                />
              ) : null}

              <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.surface" p={4}>
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                    Process Timeline
                  </Text>
                  <HistoryTimeline events={processTimeline} />
                </VStack>
              </Box>
            </VStack>
          </Box>
        </Stack>

        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUploadImage(file);
            }
            event.currentTarget.value = "";
          }}
        />

        <QuickEditDrawer
          isOpen={clientDrawerOpen}
          onClose={() => setClientDrawerOpen(false)}
          title="Add New Client"
          onSave={() => void handleCreateClient()}
          isSaving={saving}
          saveLabel="Create Client"
        >
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel>Client Name</FormLabel>
              <Input value={clientForm.clientName} onChange={(event) => setClientForm((current) => ({ ...current, clientName: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Billing Address</FormLabel>
              <Input value={clientForm.billToAddress} onChange={(event) => setClientForm((current) => ({ ...current, billToAddress: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>GST Number</FormLabel>
              <Input value={clientForm.gstOrId} onChange={(event) => setClientForm((current) => ({ ...current, gstOrId: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Contact Person</FormLabel>
              <Input value={clientForm.contactPerson} onChange={(event) => setClientForm((current) => ({ ...current, contactPerson: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Contact Number</FormLabel>
              <Input value={clientForm.contactNumber} onChange={(event) => setClientForm((current) => ({ ...current, contactNumber: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input value={clientForm.email} onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Shipping Address</FormLabel>
              <Input
                value={clientForm.shipToAddress}
                onChange={(event) => setClientForm((current) => ({ ...current, shipToAddress: event.target.value }))}
                isDisabled={clientForm.sameAsBilling}
                placeholder={clientForm.sameAsBilling ? "Same as Billing" : ""}
              />
            </FormControl>
            <Button variant="outline" onClick={() => setClientForm((current) => ({ ...current, sameAsBilling: !current.sameAsBilling }))}>
              {clientForm.sameAsBilling ? "Same as Billing: On" : "Same as Billing: Off"}
            </Button>
          </VStack>
        </QuickEditDrawer>
      </VStack>
    </ControlTowerLayout>
  );
}
