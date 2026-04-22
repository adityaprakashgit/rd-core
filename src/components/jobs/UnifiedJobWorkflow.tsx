"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Image,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Flex,
  Input,
  Select,
  SimpleGrid,
  Spinner,
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
import { AlertTriangle, Lock } from "lucide-react";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import {
  EnterpriseStickyTable,
  ExceptionBanner,
  HistoryTimeline,
  PageActionBar,
  PageIdentityBar,
  QuickEditDrawer,
  enterpriseDrawerBodyProps,
  enterpriseDrawerContentProps,
  enterpriseDrawerFooterProps,
  enterpriseDrawerHeaderProps,
} from "@/components/enterprise/EnterprisePatterns";
import { MobileActionRail } from "@/components/enterprise/PageTemplates";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import { SealScanner } from "@/components/inspection/SealScanner";
import { LotEditModal } from "@/components/inspection/LotEditModal";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  BATCH_EVIDENCE_CATEGORIES,
  getEvidenceCategoryLabel,
  getUploadCategoryKey,
  normalizeEvidenceCategoryKey,
} from "@/lib/evidence-definition";
import { EXECUTION_TERMS, replaceExecutionTerminology } from "@/lib/execution-terminology";
import { getMissingRequiredImageProofLabels } from "@/lib/image-proof-policy";
import { resolveRequiredImageUploadCategories } from "@/lib/image-proof-policy";
import { canApproveFinalDecision, type ModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import { toComparableQuantity } from "@/lib/packet-management";
import { normalizeRole } from "@/lib/role";
import {
  getInspectionSamplingDisplayStatus,
  getSampleReadiness,
} from "@/lib/sample-management";
import { buildSealReadinessRows } from "@/lib/seal-readiness";
import { captureScrollY, logSaveUxEvent, restoreScrollY } from "@/lib/ui-save-debug";
import type { InspectionJob, InspectionLot, InspectionMediaFile, PublicUser } from "@/types/inspection";
import type { DecisionUpdateRequest, SampleStartRequest, SampleUpdateRequest } from "@/types/workflow-api";

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

const WORKFLOW_SECTION_ORDER: WorkflowSectionId[] = [
  "job",
  "lots",
  "images",
  "seal",
  "decision",
  "sampling",
  "packets",
  "handover",
];

type PacketDraftRow = {
  id: string;
  packetId: string;
  packetWeight: string;
  packetUnit: string;
  packetUse: PacketUse | "";
  notes: string;
  status: "Draft";
};

type SealGenerationSummary = {
  generated: string[];
  skipped: Array<{ lotNumber: string; reason: string }>;
  failed: Array<{ lotNumber: string; reason: string }>;
};

function RequiredFormLabel({ children }: { children: ReactNode }) {
  return (
    <FormLabel display="inline-flex" alignItems="center" gap={1}>
      {children}
      <Text as="span" color="red.500" aria-hidden="true">
        *
      </Text>
    </FormLabel>
  );
}

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

function getQuantityPrecision(unit: string | null | undefined) {
  const normalized = unit?.trim().toUpperCase() ?? "";
  if (normalized === "PCS") {
    return 0;
  }
  return 2;
}

function formatSplitQuantity(value: number, precision: number) {
  const normalized = Number(value.toFixed(precision));
  return Number.isInteger(normalized)
    ? String(normalized)
    : String(normalized)
        .replace(/(\.\d*?[1-9])0+$/u, "$1")
        .replace(/\.0+$/u, "");
}

function buildDistributedDraftRows(
  count: number,
  availableQuantity: number,
  quantityUnit: string,
  startIndex: number,
) {
  if (count <= 0 || availableQuantity <= 0) {
    return [];
  }

  const precision = getQuantityPrecision(quantityUnit);
  const scale = 10 ** precision;
  const totalUnits = Math.max(Math.round(availableQuantity * scale), 0);
  const baseUnits = Math.floor(totalUnits / count);
  const remainder = totalUnits - baseUnits * count;

  return Array.from({ length: count }, (_, index) => {
    const packetUnits = baseUnits + (index < remainder ? 1 : 0);
    return {
      id: `draft-${Date.now()}-${startIndex + index}`,
      packetId: `Draft Packet ${startIndex + index}`,
      packetWeight: formatSplitQuantity(packetUnits / scale, precision),
      packetUnit: quantityUnit,
      packetUse: "" as const,
      notes: "",
      status: "Draft" as const,
    };
  });
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
function getPacketBlockerMessage(
  blocker: string,
  context?: { lotHasSealNumber?: boolean; sampleHasSealEvidence?: boolean },
) {
  if (blocker.includes("Sample details are incomplete")) {
    return "Capture job sample details (Sample Quantity, Sample Unit, Container Type) in Homogeneous Sampling > Step 2 Sample details.";
  }
  if (blocker.includes("Homogeneous sample making photo is missing")) {
    return "Upload homogeneous sample photo in Homogeneous Sampling > Step 3 Capture proof before packet creation.";
  }
  if (blocker.includes("Homogeneous confirmation is missing")) {
    return "Mark homogeneous sample proof in Homogeneous Sampling > Step 4 Homogenize before packet creation.";
  }
  if (blocker.includes("Seal number is missing")) {
    return "Enter the seal number in Homogeneous Sampling > Step 3 Capture proof before packet creation.";
  }
  if (blocker.includes("Sealed sample photo is missing")) {
    if (context?.lotHasSealNumber && !context?.sampleHasSealEvidence) {
      return "Seal exists on bag; capture the sealed sample photo in Homogeneous Sampling > Step 3 Capture proof.";
    }
    return "Capture the sealed sample photo with the seal number visible in Homogeneous Sampling > Step 3 Capture proof before packet creation.";
  }
  return blocker;
}

function getSamplingRequiredChecklist(sample: InspectionLot["sample"] | null | undefined) {
  const mediaTypes = new Set((sample?.media ?? []).map((entry) => String(entry.mediaType ?? "").trim().toUpperCase()));
  return [
    {
      id: "sample-quantity",
      label: "Sample Quantity",
      completed: typeof sample?.sampleQuantity === "number" && Number.isFinite(sample.sampleQuantity) && sample.sampleQuantity > 0,
    },
    {
      id: "sample-unit",
      label: "Sample Unit",
      completed: Boolean(sample?.sampleUnit && sample.sampleUnit.trim().length > 0),
    },
    {
      id: "container-type",
      label: "Container Type",
      completed: Boolean(sample?.containerType && sample.containerType.trim().length > 0),
    },
    {
      id: "homogeneous-marked",
      label: "Homogeneous Proof Marked",
      completed: Boolean(sample?.homogeneousProofDone || sample?.homogenizedAt),
    },
    {
      id: "homogeneous-photo",
      label: "Homogenized Sample Photo Uploaded",
      completed: mediaTypes.has("HOMOGENIZED_SAMPLE"),
    },
  ];
}

export function UnifiedJobWorkflow() {
  const { jobId } = useParams<{ jobId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sampleProofFileRef = useRef<HTMLInputElement | null>(null);
  const selectedLotIdRef = useRef<string | null>(null);
  const pendingUploadLotIdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshingWorkflow, setIsRefreshingWorkflow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WorkflowPayload | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedImageLabel, setSelectedImageLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [batchSummaryOpen, setBatchSummaryOpen] = useState(false);
  const [lotPhotoDrawerOpen, setLotPhotoDrawerOpen] = useState(false);
  const [lotPhotoDrawerLotId, setLotPhotoDrawerLotId] = useState<string | null>(null);
  const [sealEditDrawerOpen, setSealEditDrawerOpen] = useState(false);
  const [sealEditDrawerLotId, setSealEditDrawerLotId] = useState<string | null>(null);
  const [sealEditValue, setSealEditValue] = useState("");
  const [sealDownloadDrawerOpen, setSealDownloadDrawerOpen] = useState(false);
  const [sealDownloadColumns, setSealDownloadColumns] = useState("4");
  const [sealDownloadPageSize, setSealDownloadPageSize] = useState("A4");
  const [sealDownloadPrinterType, setSealDownloadPrinterType] = useState<"THERMAL" | "INKJET" | "OTHER">("THERMAL");
  const [downloadingSealStickers, setDownloadingSealStickers] = useState(false);
  const [handoverCompletedAtLocal, setHandoverCompletedAtLocal] = useState<string | null>(null);
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
    materialName: "",
    bagCount: "1",
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
  const activeSectionRef = useRef<WorkflowSectionId>(normalizeSection(searchParams.get("section")));
  const [editLotId, setEditLotId] = useState<string | null>(null);
  const [sealGenerationSummary, setSealGenerationSummary] = useState<SealGenerationSummary | null>(null);

  const fetchWorkflow = useCallback(async (options?: { initial?: boolean; keepScrollY?: number | null; keepSection?: WorkflowSectionId | null; preferredLotId?: string | null }) => {
    const isInitial = options?.initial ?? false;
    const keepScrollY = options?.keepScrollY ?? (isInitial ? null : captureScrollY());
    const keepSection = options?.keepSection ?? null;
    const preferredLotId = options?.preferredLotId ?? null;
    if (isInitial) {
      setLoading(true);
    } else {
      setIsRefreshingWorkflow(true);
      logSaveUxEvent("save_started", { source: "UnifiedJobWorkflow:refresh", section: activeSectionRef.current });
    }
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

      const firstLotId = workflowPayload.job.lots?.[0]?.id ?? null;
      const currentSelectedLotId = selectedLotIdRef.current;
      const nextLotId =
        preferredLotId && workflowPayload.job.lots?.some((lot) => lot.id === preferredLotId)
          ? preferredLotId
          : currentSelectedLotId && workflowPayload.job.lots?.some((lot) => lot.id === currentSelectedLotId)
            ? currentSelectedLotId
            : firstLotId;
      setSelectedLotId(nextLotId);
      if (keepSection) {
        setActiveSection(keepSection);
      }
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
        materialName: current.materialName || workflowPayload.job.commodity || "",
        lotNumber:
          workflowPayload.settings.workflow.autoLotNumbering
            ? ""
            : current.lotNumber,
      }));
    } catch (fetchError) {
      if (!isInitial) {
        logSaveUxEvent("save_failed", {
          source: "UnifiedJobWorkflow:refresh",
          section: keepSection ?? activeSectionRef.current,
          message: fetchError instanceof Error ? fetchError.message : "Workflow refresh failed.",
        });
      }
      setError(fetchError instanceof Error ? fetchError.message : "Unified job workflow could not be loaded.");
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setIsRefreshingWorkflow(false);
        restoreScrollY(keepScrollY);
        logSaveUxEvent("save_success", { source: "UnifiedJobWorkflow:refresh", section: keepSection ?? activeSectionRef.current });
      }
    }
  }, [jobId]);

  useEffect(() => {
    const preferredLotId =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("lotId");
    void fetchWorkflow({ initial: true, preferredLotId });
  }, [fetchWorkflow, jobId]);

  useEffect(() => {
    const nextSection = normalizeSection(searchParams.get("section"));
    setActiveSection(nextSection);
    activeSectionRef.current = nextSection;
    logSaveUxEvent("route_changed", { source: "UnifiedJobWorkflow", section: nextSection });
  }, [searchParams]);

  useEffect(() => {
    selectedLotIdRef.current = selectedLotId;
  }, [selectedLotId]);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  const job = payload?.job ?? null;
  const settings = payload?.settings ?? null;
  const clients = payload?.clients ?? [];
  const items = payload?.items ?? [];
  const containerTypes = payload?.containerTypes ?? [];
  const selectedLot = useMemo(
    () => job?.lots?.find((lot) => lot.id === selectedLotId) ?? job?.lots?.[0] ?? null,
    [job?.lots, selectedLotId],
  );
  const selectedSample = payload?.sample ?? selectedLot?.sample ?? null;
  const jobSealNumbers = useMemo(
    () =>
      (job?.lots ?? []).map((lot) => lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? null),
    [job?.lots],
  );
  const jobSealDisplay = useMemo(() => {
    const resolvedSeals = Array.from(new Set(jobSealNumbers.filter((sealNumber): sealNumber is string => Boolean(sealNumber?.trim()))));
    if (resolvedSeals.length === 0) {
      return "Seal not set";
    }
    if (resolvedSeals.length === 1) {
      return resolvedSeals[0];
    }
    return `${resolvedSeals.length} seals assigned`;
  }, [jobSealNumbers]);
  const autoLotNumberPreview = useMemo(() => {
    if (!settings?.workflow.autoLotNumbering || !job) {
      return "";
    }
    return buildAutoLotNumber(settings.workflow, job.lots ?? []);
  }, [settings, job]);
  const packets = useMemo(() => payload?.packets ?? selectedSample?.packets ?? [], [payload?.packets, selectedSample?.packets]);
  const sampleReadiness = useMemo(
    () => getSampleReadiness(selectedSample, { lotSealNumbers: jobSealNumbers }),
    [jobSealNumbers, selectedSample],
  );
  const samplingRequiredChecklist = useMemo(() => getSamplingRequiredChecklist(selectedSample), [selectedSample]);
  const rndAssignees = payload?.rndAssignees ?? [];
  const isAdminUser = normalizeRole(currentUser?.role ?? null) === "ADMIN";
  const draftStorageKey = useMemo(
    () => (selectedSample ? `packet-draft:${jobId}:${selectedSample.id}` : null),
    [jobId, selectedSample],
  );
  const samplingBlockingLots = useMemo(
    () =>
      (job?.lots ?? []).filter((lot) => getInspectionSamplingDisplayStatus(lot.inspection) !== "READY_FOR_SAMPLING"),
    [job?.lots],
  );
  const allLotsReadyForHomogeneousSampling = Boolean(job?.lots?.length) && samplingBlockingLots.length === 0;
  const packetStageBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!selectedSample) {
      blockers.push("Job sample is required before packet creation.");
    }
    if (!allLotsReadyForHomogeneousSampling) {
      blockers.push("All bags must pass inspection before packet creation.");
    }
    if (selectedSample) {
      for (const blocker of sampleReadiness.blockers) {
        blockers.push(
          getPacketBlockerMessage(blocker.detail, {
            lotHasSealNumber: jobSealNumbers.some((sealNumber) => Boolean(sealNumber?.trim())),
            sampleHasSealEvidence: Boolean(selectedSample.sealLabel?.sealedAt),
          }),
        );
      }
    }
    return blockers;
  }, [allLotsReadyForHomogeneousSampling, jobSealNumbers, selectedSample, sampleReadiness.blockers]);
  const decisionMissingProofLots = useMemo(() => {
    if (!job?.lots?.length || !settings) {
      return [];
    }
    return (job.lots ?? [])
      .map((lot) => ({
        lotNumber: lot.lotNumber,
        missing: getMissingRequiredImageProofLabels(
          settings.images.requiredImageCategories,
          (lot.mediaFiles ?? []).map((file) => file.category),
        ),
      }))
      .filter((entry) => entry.missing.length > 0);
  }, [job?.lots, settings]);
  const sealReadinessRows = useMemo(() => buildSealReadinessRows(job?.lots), [job?.lots]);
  const readySealLots = useMemo(
    () => sealReadinessRows.filter((entry) => entry.eligible),
    [sealReadinessRows],
  );
  const allLotsHaveSeal = useMemo(
    () => (job?.lots ?? []).every((lot) => Boolean(lot.sample?.sealLabel?.sealNo || lot.sealNumber)),
    [job?.lots],
  );
  const batchPhotoCategory = BATCH_EVIDENCE_CATEGORIES[0] ?? "LOT_OVERVIEW";
  const batchPhotoLabel = getEvidenceCategoryLabel(batchPhotoCategory);
  const batchPhotoLatestMedia = useMemo(() => {
    const media = selectedLot?.mediaFiles ?? [];
    return media.filter((file) => normalizeEvidenceCategoryKey(file.category) === batchPhotoCategory).at(-1) ?? null;
  }, [batchPhotoCategory, selectedLot?.mediaFiles]);
  const batchPhotoPreviewUrl = batchPhotoLatestMedia?.storageKey ?? "";
  const batchPhotoExists = Boolean(batchPhotoLatestMedia);

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

  const finalDecisionStatus = job?.finalDecisionStatus ?? selectedLot?.inspection?.decisionStatus ?? null;

  const workflowSectionStates = useMemo(() => {
    const hasLots = Boolean(job?.lots?.length);
    const decisionRequiredBeforeSampling = Boolean(settings?.workflow.decisionRequiredBeforeSampling);
    const submitToRndEnabled = settings?.workflow.submitToRndEnabled !== false;
    const packetsAreBlocked =
      !selectedSample || !sampleReadiness.isReady || packetStageBlockers.length > 0;
    const handoverIsBlocked =
      draftPacketRows.length > 0 ||
      !packets.length ||
      !rndHandoverTarget ||
      Boolean(packetStageBlockers.length) ||
      Boolean(packetAllocation?.overAllocated) ||
      !submitToRndEnabled;

    const states = [
      {
        id: "job" as const,
        blocked: false,
        reason: null as string | null,
      },
      {
        id: "lots" as const,
        blocked: !hasLots,
        reason: !hasLots ? "Add at least one bag to begin workflow execution." : null,
      },
      {
        id: "images" as const,
        blocked: hasLots && decisionMissingProofLots.length > 0,
        reason:
          hasLots && decisionMissingProofLots.length > 0
            ? `Capture required proof before decision review: ${decisionMissingProofLots.map((entry) => `${entry.lotNumber} (${entry.missing.join(", ")})`).join("; ")}.`
            : null,
      },
      {
        id: "seal" as const,
        blocked: hasLots && decisionMissingProofLots.length === 0 && !allLotsHaveSeal,
        reason:
          hasLots && decisionMissingProofLots.length === 0 && !allLotsHaveSeal
            ? "Complete seal assignment for every bag before decision submission."
            : null,
      },
      {
        id: "decision" as const,
        blocked:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          decisionRequiredBeforeSampling &&
          finalDecisionStatus !== "READY_FOR_SAMPLING",
        reason:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          decisionRequiredBeforeSampling &&
          finalDecisionStatus !== "READY_FOR_SAMPLING"
            ? "Final decision must be passed by the configured approver before sampling."
            : null,
      },
      {
        id: "sampling" as const,
        blocked:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          (!allLotsReadyForHomogeneousSampling ||
            (decisionRequiredBeforeSampling && finalDecisionStatus !== "READY_FOR_SAMPLING")),
        reason:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          !allLotsReadyForHomogeneousSampling
            ? `All bags must pass inspection before homogeneous sampling. Blocking bags: ${samplingBlockingLots.map((lot) => lot.lotNumber).join(", ")}.`
            : hasLots &&
                decisionMissingProofLots.length === 0 &&
                allLotsHaveSeal &&
                decisionRequiredBeforeSampling &&
                finalDecisionStatus !== "READY_FOR_SAMPLING"
              ? "Final decision must be passed before homogeneous sampling."
              : null,
      },
      {
        id: "packets" as const,
        blocked:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          allLotsReadyForHomogeneousSampling &&
          packetsAreBlocked,
        reason:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          allLotsReadyForHomogeneousSampling &&
          packetsAreBlocked
            ? !selectedSample
              ? "Start homogeneous sampling before creating packets."
              : !sampleReadiness.isReady
                ? `Resolve sample readiness blockers: ${sampleReadiness.blockers.map((blocker) => blocker.detail).join(" | ")}`
                : packetStageBlockers.join(" ")
            : null,
      },
      {
        id: "handover" as const,
        blocked:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          allLotsReadyForHomogeneousSampling &&
          Boolean(selectedSample) &&
          sampleReadiness.isReady &&
          handoverIsBlocked,
        reason:
          hasLots &&
          decisionMissingProofLots.length === 0 &&
          allLotsHaveSeal &&
          allLotsReadyForHomogeneousSampling &&
          Boolean(selectedSample) &&
          sampleReadiness.isReady &&
          handoverIsBlocked
            ? !submitToRndEnabled
              ? "Submit to R&D is disabled by policy."
              : draftPacketRows.length > 0
                ? "Save draft packet rows before handover."
                : !packets.length
                  ? "Create at least one packet before handover."
                  : !rndHandoverTarget
                    ? "Select an R&D assignee before handover."
                    : Boolean(packetStageBlockers.length)
                      ? packetStageBlockers.join(" ")
                      : Boolean(packetAllocation?.overAllocated)
                        ? "Packet allocation is over the available sample quantity."
                        : null
            : null,
      },
    ];

    const firstBlockedIndex = states.findIndex((state) => state.blocked);
    return states.map((state, index) => ({
      ...state,
      locked: firstBlockedIndex >= 0 && index > firstBlockedIndex,
    }));
  }, [
    allLotsHaveSeal,
    allLotsReadyForHomogeneousSampling,
    decisionMissingProofLots,
    draftPacketRows.length,
    finalDecisionStatus,
    job?.lots?.length,
    packetAllocation?.overAllocated,
    packetStageBlockers,
    packets.length,
    rndHandoverTarget,
    sampleReadiness.isReady,
    sampleReadiness.blockers,
    samplingBlockingLots,
    selectedSample,
    settings?.workflow.decisionRequiredBeforeSampling,
    settings?.workflow.submitToRndEnabled,
  ]);

  const firstBlockedSection = workflowSectionStates.find((state) => state.blocked)?.id ?? null;
  const firstBlockedSectionIndex = firstBlockedSection
    ? WORKFLOW_SECTION_ORDER.findIndex((section) => section === firstBlockedSection)
    : -1;

  const workflowSectionLabels: Record<WorkflowSectionId, string> = {
    job: "Job Basics",
    lots: EXECUTION_TERMS.bag.plural,
    images: "Job Photo",
    seal: "Seal Evidence",
    decision: "Final Decision",
    sampling: "Homogeneous Sampling",
    packets: "Packets",
    handover: "Submit to R&D",
  };
  const workflowSections: Array<{ id: WorkflowSectionId; label: string }> = WORKFLOW_SECTION_ORDER.map((id) => ({
    id,
    label: workflowSectionLabels[id],
  }));
  const currentStepLabel = workflowSectionLabels[activeSection];
  const batchSummaryItems = useMemo(
    () => [
      { label: "Job Number", value: job?.inspectionSerialNumber || job?.jobReferenceNumber || "Not Available" },
      { label: "Client", value: job?.clientName || "Not Available" },
      { label: "Item", value: job?.commodity || "Not Available" },
      { label: "Assigned User", value: job?.assignedTo?.profile?.displayName || "Not Available" },
      { label: "Bags", value: `${job?.lots?.length ?? 0} bag(s)` },
      { label: "Job Sample ID", value: selectedSample?.sampleCode || "Not Available" },
      { label: "Packets", value: `${packets.length}` },
      { label: "Current Stage", value: currentStepLabel },
      { label: "Next Action", value: payload?.nextAction || "Not Available" },
      { label: "Deadline", value: formatDate(job?.deadline) },
    ],
    [
      job?.assignedTo?.profile?.displayName,
      job?.clientName,
      job?.commodity,
      job?.inspectionSerialNumber,
      job?.jobReferenceNumber,
      job?.deadline,
      job?.lots?.length,
      payload?.nextAction,
      packets.length,
      selectedSample?.sampleCode,
      currentStepLabel,
    ],
  );
  const lotPhotoDrawerLot = useMemo(
    () => job?.lots?.find((lot) => lot.id === lotPhotoDrawerLotId) ?? null,
    [job?.lots, lotPhotoDrawerLotId],
  );
  const lotPhotoRequiredCategories = useMemo(
    () => resolveRequiredImageUploadCategories(settings?.images.requiredImageCategories ?? []),
    [settings?.images.requiredImageCategories],
  );
  const lotPhotoOptionalCategories = useMemo(
    () =>
      Array.from(
        new Set(
          (settings?.images.optionalImageCategories ?? [])
            .map((entry) => normalizeEvidenceCategoryKey(entry))
            .filter((category): category is NonNullable<typeof category> => Boolean(category)),
        ),
      ),
    [settings?.images.optionalImageCategories],
  );
  const lotPhotoCapturedCategories = useMemo(() => {
    const files = lotPhotoDrawerLot?.mediaFiles ?? [];
    return new Set(
      files
        .map((file) => normalizeEvidenceCategoryKey(file.category))
        .filter((category): category is NonNullable<typeof category> => Boolean(category)),
    );
  }, [lotPhotoDrawerLot?.mediaFiles]);
  const lotPhotoFileByCategory = useMemo(() => {
    const byCategory = new Map<string, InspectionMediaFile>();
    for (const file of lotPhotoDrawerLot?.mediaFiles ?? []) {
      const category = normalizeEvidenceCategoryKey(file.category);
      if (category) {
        byCategory.set(category, file);
      }
    }
    return byCategory;
  }, [lotPhotoDrawerLot?.mediaFiles]);
  const lotPhotoRequiredCapturedCount = lotPhotoRequiredCategories.filter((category) => lotPhotoCapturedCategories.has(category)).length;
  const lotPhotoOptionalCapturedCount = lotPhotoOptionalCategories.filter((category) => lotPhotoCapturedCategories.has(category)).length;
  const lotSealNumber = lotPhotoDrawerLot?.sample?.sealLabel?.sealNo ?? lotPhotoDrawerLot?.sealNumber ?? null;
  const sealEditDrawerLot = useMemo(
    () => job?.lots?.find((lot) => lot.id === sealEditDrawerLotId) ?? null,
    [job?.lots, sealEditDrawerLotId],
  );
  const activeSectionState = workflowSectionStates.find((state) => state.id === activeSection) ?? null;
  const activeSectionBlocker = activeSectionState?.blocked ? (
    <ExceptionBanner
      title={`${workflowSectionLabels[activeSection]} blocked`}
      description={activeSectionState.reason ?? "Resolve the current blockers to unlock downstream stages."}
      status="error"
    />
  ) : null;
  const visibleWorkflowBlockers = (payload?.blockers ?? []).filter((blocker) => {
    if (activeSection === "decision" && blocker.includes("Final decision must be passed")) return false;
    if (activeSection === "sampling" && blocker.includes("Final decision must be passed")) return false;
    return true;
  });
  const showDesktopSideRail =
    visibleWorkflowBlockers.length > 0 || payload?.decision?.status === "ON_HOLD" || payload?.decision?.status === "REJECTED";

  const handleSectionChange = useCallback(
    (nextSection: WorkflowSectionId, options?: { syncUrl?: boolean }) => {
      const requestedIndex = WORKFLOW_SECTION_ORDER.findIndex((section) => section === nextSection);
      const redirectedSection =
        firstBlockedSection && firstBlockedSectionIndex >= 0 && requestedIndex > firstBlockedSectionIndex
          ? firstBlockedSection
          : nextSection;

      setActiveSection(redirectedSection);
      activeSectionRef.current = redirectedSection;

      if (options?.syncUrl === false) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      if (redirectedSection === "job") {
        params.delete("section");
      } else {
        params.set("section", redirectedSection);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [firstBlockedSection, firstBlockedSectionIndex, pathname, router, searchParams],
  );

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
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
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
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
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
    const nextAutoLotNumber =
      settings?.workflow.autoLotNumbering && job
        ? buildAutoLotNumber(settings.workflow, job.lots ?? [])
        : "";
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotNumber: settings?.workflow.autoLotNumbering ? nextAutoLotNumber : lotForm.lotNumber,
          materialName: lotForm.materialName.trim() || job?.commodity || "Item",
          quantityMode: "SINGLE_PIECE",
          bagCount: 1,
          totalBags: 1,
          weightUnit: lotForm.weightUnit,
        }),
      });
      if (!response.ok) {
        throw new Error("Bag could not be created.");
      }
      const createdLot = (await response.json()) as { id?: string | null };
      await fetchWorkflow({
        initial: false,
        keepSection: activeSection,
        keepScrollY: captureScrollY(),
        preferredLotId: createdLot?.id ?? null,
      });
      setLotForm((current) => ({
        ...current,
        materialName: job?.commodity || current.materialName,
        bagCount: "1",
        weightUnit: "KG",
      }));
      toast({ title: "Bag created", status: "success" });
    } catch (createError) {
      toast({ title: "Bag create failed", description: createError instanceof Error ? createError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    const uploadLotId = pendingUploadLotIdRef.current ?? selectedLot?.id ?? null;
    const uploadLabel = selectedImageLabel;
    if (!uploadLotId || !uploadLabel) {
      return;
    }
    setSaving(true);
    try {
      const category = getUploadCategoryKey(uploadLabel);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lotId", uploadLotId);
      formData.append("category", category);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error("Image upload failed.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: "Image uploaded", status: "success" });
    } catch (uploadError) {
      toast({ title: "Upload failed", description: uploadError instanceof Error ? uploadError.message : "Upload failed.", status: "error" });
    } finally {
      setSaving(false);
      setSelectedImageLabel(null);
      pendingUploadLotIdRef.current = null;
    }
  };

  const handleOpenLotPhotoDrawer = useCallback(
    (lot: InspectionLot) => {
      setSelectedLotId(lot.id);
      setLotPhotoDrawerLotId(lot.id);
      setLotPhotoDrawerOpen(true);
    },
    [setSelectedLotId],
  );

  const handleSelectLot = useCallback(
    (lot: InspectionLot) => {
      setSelectedLotId(lot.id);
      setLotPhotoDrawerLotId(lot.id);
      setLotPhotoDrawerOpen(true);
    },
    [setSelectedLotId],
  );

  const closeLotPhotoDrawer = useCallback(() => {
    setLotPhotoDrawerOpen(false);
    setLotPhotoDrawerLotId(null);
  }, []);

  const handleLaunchLotPhotoUpload = useCallback(
    (lot: InspectionLot, category: string) => {
      setSelectedLotId(lot.id);
      pendingUploadLotIdRef.current = lot.id;
      setSelectedImageLabel(category);
      fileRef.current?.click();
    },
    [setSelectedLotId],
  );

  const handleDownloadSealStickers = useCallback(async () => {
    if (!job) {
      return;
    }
    setDownloadingSealStickers(true);
    try {
      const response = await fetch("/api/report/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          columns: Number.parseInt(sealDownloadColumns, 10) || 4,
          pageSize: sealDownloadPageSize,
          printerType: sealDownloadPrinterType,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.details ?? "Seal label download failed.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `Stickers_${job.jobReferenceNumber || job.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setSealDownloadDrawerOpen(false);
      toast({ title: "Seal labels downloaded", status: "success" });
    } catch (downloadError) {
      toast({
        title: "Download failed",
        description: downloadError instanceof Error ? downloadError.message : "Seal label download failed.",
        status: "error",
      });
    } finally {
      setDownloadingSealStickers(false);
    }
  }, [job, sealDownloadColumns, sealDownloadPageSize, sealDownloadPrinterType, toast]);

  const ensureInspectionRecord = async () => {
    if (!selectedLot || !job) {
      return;
    }
    const response = await fetch("/api/inspection/execution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        lotId: selectedLot.id,
        caller: "UnifiedJobWorkflow",
      }),
    });
    if (!response.ok) {
      throw new Error("Inspection record could not be initialized.");
    }
  };

  const handleDecision = async (decision: "PENDING" | "READY_FOR_SAMPLING" | "ON_HOLD" | "REJECTED") => {
    if (!job) {
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
      const decisionPayload: DecisionUpdateRequest = {
        jobId: job.id,
        caller: "UnifiedJobWorkflow",
        decisionStatus: decision,
        overallRemark,
      };
      const response = await fetch("/api/inspection/execution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decisionPayload),
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
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: "Decision updated", status: "success" });
    } catch (decisionError) {
      toast({ title: "Decision failed", description: decisionError instanceof Error ? decisionError.message : "Decision failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartSampling = async () => {
    if (!job) {
      return;
    }
    if (!allLotsReadyForHomogeneousSampling) {
      toast({
        title: "Homogeneous sampling blocked",
        description: `All bags must pass inspection first. Blocking bags: ${
          samplingBlockingLots.map((lot) => lot.lotNumber).join(", ") || "None"
        }.`,
        status: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      const sampleStartPayload: SampleStartRequest = {
        jobId: job.id,
        caller: "UnifiedJobWorkflow",
        ...(settings?.workflow.autoSampleIdGeneration ? {} : { sampleCode: sampleForm.sampleCode }),
      };
      const response = await fetch("/api/inspection/sample-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleStartPayload),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string; error?: string } | null;
        throw new Error(payload?.details || payload?.error || "Sampling could not be started.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: "Sampling started", status: "success" });
    } catch (sampleError) {
      toast({ title: "Sampling failed", description: sampleError instanceof Error ? sampleError.message : "Sampling failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSample = async () => {
    if (!job) {
      return;
    }
    setSaving(true);
    try {
      const sampleUpdatePayload: SampleUpdateRequest = {
        jobId: job.id,
        caller: "UnifiedJobWorkflow",
        ...(settings?.workflow.autoSampleIdGeneration ? {} : { sampleCode: sampleForm.sampleCode }),
        sampleType: sampleForm.sampleType,
        samplingMethod: sampleForm.samplingMethod,
        sampleQuantity: sampleForm.sampleQuantity,
        sampleUnit: sampleForm.sampleUnit,
        containerType: sampleForm.containerType,
        remarks: sampleForm.remarks,
      };
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleUpdatePayload),
      });
      if (!response.ok) {
        throw new Error("Sample details could not be saved.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: "Sample details saved", status: "success" });
    } catch (sampleError) {
      toast({ title: "Save failed", description: sampleError instanceof Error ? sampleError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkHomogeneous = async () => {
    if (!job) {
      return;
    }
    setSaving(true);
    try {
      const sampleMarkPayload: SampleUpdateRequest = {
        jobId: job.id,
        caller: "UnifiedJobWorkflow",
        markHomogenized: true,
      };
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleMarkPayload),
      });
      if (!response.ok) {
        throw new Error("Homogeneous proof could not be marked.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: "Homogeneous proof saved", status: "success" });
    } catch (sampleError) {
      toast({ title: "Update failed", description: sampleError instanceof Error ? sampleError.message : "Update failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadHomogenizedSamplePhoto = async (file: File) => {
    if (!job || !selectedSample) {
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", job.id);
      formData.append("category", "HOMOGENEOUS");
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error("Homogenized sample photo upload failed.");
      }
      const uploadPayload = (await uploadRes.json()) as { url?: string };
      if (!uploadPayload.url) {
        throw new Error("Homogenized sample photo URL is missing.");
      }
      const sampleMediaPayload: SampleUpdateRequest = {
        jobId: job.id,
        caller: "UnifiedJobWorkflow",
        mediaEntries: [
          {
            mediaType: "HOMOGENIZED_SAMPLE",
            fileUrl: uploadPayload.url,
            remarks: "Homogenized sample proof",
          },
        ],
      };
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleMediaPayload),
      });
      if (!response.ok) {
        let details = "";
        try {
          const payload = (await response.json()) as { details?: unknown };
          details = typeof payload?.details === "string" ? payload.details : "";
        } catch {
          details = "";
        }
        throw new Error(details || "Homogenized sample proof could not be saved.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: "Homogenized sample photo uploaded", status: "success" });
    } catch (uploadError) {
      toast({
        title: "Homogenized proof failed",
        description: uploadError instanceof Error ? uploadError.message : "Upload failed.",
        status: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeal = async (sealNo: string) => {
    if (!job || !selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const sampleSealPayload: SampleUpdateRequest = {
        jobId: job.id,
        caller: "UnifiedJobWorkflow",
        sealNo,
        sealAuto: false,
        markSealed: true,
      };
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleSealPayload),
      });
      if (!response.ok) {
        throw new Error("Seal could not be saved.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
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
    const eligible = readySealLots;
    if (eligible.length === 0) {
      toast({
        title: "No eligible bags",
        description: "Complete the job-level Final Decision (Pass) before bulk seal generation.",
        status: "warning",
      });
      return;
    }
    setSaving(true);
    setSealGenerationSummary(null);
    try {
      const generated: string[] = [];
      const skipped = sealReadinessRows
        .filter((entry) => !entry.eligible)
        .map((entry) => ({ lotNumber: entry.lotNumber, reason: entry.reason }));
      const failed: Array<{ lotNumber: string; reason: string }> = [];

      for (const readyLot of eligible) {
        const response = await fetch(`/api/lots/${readyLot.lotId}/seal`, {
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
          failed.push({
            lotNumber: readyLot.lotNumber,
            reason: details || "Generation failed for this bag.",
          });
          continue;
        }
        generated.push(readyLot.lotNumber);
      }

      if (generated.length > 0) {
        await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      }

      setSealGenerationSummary({ generated, skipped, failed });
      const summaryDescription = [
        `Generated: ${generated.length}`,
        `Skipped: ${skipped.length}`,
        `Failed: ${failed.length}`,
      ].join(" | ");
      toast({
        title: generated.length > 0 ? "Seal generation completed" : "No seals generated",
        description: summaryDescription,
        status: generated.length > 0 ? "success" : "warning",
      });
    } catch (sealError) {
      toast({ title: "Bulk generation failed", description: sealError instanceof Error ? sealError.message : "Generation failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSealNumberForLot = useCallback(async (lot: InspectionLot, sealNumber?: string, auto = false) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/lots/${lot.id}/seal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auto ? { auto: true } : { sealNumber }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Unable to assign seal number.");
      }
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
      toast({ title: auto ? "Seal number generated" : "Seal number saved", status: "success" });
    } catch (error) {
      toast({
        title: auto ? "Seal generation failed" : "Seal save failed",
        description: error instanceof Error ? error.message : "Unable to assign seal number.",
        status: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [activeSection, fetchWorkflow, toast]);

  const openSealEditDrawer = useCallback(
    (lot: InspectionLot) => {
      setSelectedLotId(lot.id);
      setSealEditDrawerLotId(lot.id);
      setSealEditValue((lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? "").trim());
      setSealEditDrawerOpen(true);
    },
    [setSelectedLotId],
  );

  const closeSealEditDrawer = useCallback(() => {
    setSealEditDrawerOpen(false);
    setSealEditDrawerLotId(null);
    setSealEditValue("");
  }, []);

  const handleSaveSealEdit = useCallback(async () => {
    if (!sealEditDrawerLot) {
      return;
    }
    const nextSeal = sealEditValue.replace(/\D/g, "").slice(0, 16);
    if (!/^\d{16}$/.test(nextSeal)) {
      toast({ title: "Seal number requires 16 digits", status: "warning" });
      return;
    }
    await handleAssignSealNumberForLot(sealEditDrawerLot, nextSeal, false);
    closeSealEditDrawer();
  }, [closeSealEditDrawer, handleAssignSealNumberForLot, sealEditDrawerLot, sealEditValue, toast]);

  const handleCopySealNumber = useCallback(
    async (sealNumber: string) => {
      try {
        await navigator.clipboard.writeText(sealNumber);
        toast({ title: "Seal number copied", status: "success" });
      } catch {
        toast({
          title: "Copy failed",
          description: "Your browser blocked clipboard access.",
          status: "error",
        });
      }
    },
    [toast],
  );

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
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
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
    const availableQuantity = packetAllocation?.remaining ?? selectedSample?.sampleQuantity ?? 0;
    const quantityUnit = selectedSample?.sampleUnit?.trim() || defaultPacketUnit;
    if (!availableQuantity || availableQuantity <= 0) {
      toast({
        title: "No available sample weight",
        description: "The available sample weight must be greater than zero before auto-creating packet rows.",
        status: "warning",
      });
      return;
    }
    const start = draftPacketRows.length + 1;
    const rows = buildDistributedDraftRows(requested, availableQuantity, quantityUnit, start);
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
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
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
      setHandoverCompletedAtLocal(new Date().toISOString());
      await fetchWorkflow({ initial: false, keepSection: activeSection, keepScrollY: captureScrollY() });
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
        <InlineErrorState title="Workflow unavailable" description={error ?? "Workflow unavailable"} onRetry={() => void fetchWorkflow({ initial: true })} />
      </ControlTowerLayout>
    );
  }

  const workflowPayload = payload!;
  const normalizedWorkflowNextAction = String(workflowPayload.nextAction ?? "").trim().toUpperCase();
  const workflowIsClosed =
    ["LOCKED", "COMPLETED", "DISPATCHED"].includes(String(job.status ?? "").toUpperCase()) ||
    ["WORKFLOW COMPLETE", "DONE", "COMPLETED", "COMPLETE"].includes(normalizedWorkflowNextAction) ||
    Boolean(workflowPayload.milestones.handedOverToRndAt || handoverCompletedAtLocal);
  const sealNumbersLocked = Boolean((job.adminDecisionStatus ?? workflowPayload.milestones.adminDecisionStatus) === "PASS");
  const nextPrimaryAction = workflowPayload.nextAction ?? "Add Bag";
  const nextPrimaryActionDisplay = workflowIsClosed ? "Done" : replaceExecutionTerminology(nextPrimaryAction);
  const currentSectionIndex = WORKFLOW_SECTION_ORDER.findIndex((section) => section === activeSection);
  const nextSequentialSection = WORKFLOW_SECTION_ORDER[Math.min(Math.max(currentSectionIndex, 0) + 1, WORKFLOW_SECTION_ORDER.length - 1)] ?? "handover";
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
      subtitle: workflowPayload.milestones.jobStartedAt ? "First bag created." : "Pending first bag creation.",
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
        : "Pending full operations completion across all bags.",
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
  const focusSectionForNextAction = () => {
    if (workflowIsClosed) {
      setBatchSummaryOpen(true);
      return;
    }
    if (nextPrimaryAction === "Add Lot") {
      handleSectionChange("lots");
      void handleCreateLot();
      return;
    }
    if (nextPrimaryAction === "Save Images and Continue") {
      handleSectionChange("lots");
      return;
    }
    if (nextPrimaryAction === "Assign Seal") {
      handleSectionChange("seal");
      return;
    }
    if (nextPrimaryAction === "Submit for Decision" || nextPrimaryAction === "Pass / Hold / Reject") {
      handleSectionChange("decision");
      return;
    }
    if (nextPrimaryAction === "Resolve Lot Inspection") {
      handleSectionChange("lots");
      return;
    }
    if (nextPrimaryAction === "Start Sampling") {
      handleSectionChange("sampling");
      void handleStartSampling();
      return;
    }
    if (nextPrimaryAction === "Mark Homogeneous Proof") {
      handleSectionChange("sampling");
      void handleMarkHomogeneous();
      return;
    }
    if (nextPrimaryAction === "Create Packets") {
      handleSectionChange("packets");
      void handleCreatePackets();
      return;
    }
    handleSectionChange("handover");
    void handleSubmitToRnd();
  };

  const mobilePrimaryAction = (() => {
    if (workflowIsClosed) {
      return (
        <Button colorScheme="green" variant="outline" onClick={() => setBatchSummaryOpen(true)}>
          Done
        </Button>
      );
    }
    if (activeSection === "job") {
      return (
        <Button onClick={() => void handleSaveJobBasics()} isLoading={saving}>
          Save Job
        </Button>
      );
    }
    if (activeSection === "lots") {
      return (
        <Button onClick={() => void handleCreateLot()} isLoading={saving}>
          Add Bag
        </Button>
      );
    }
    if (activeSection === "images") {
      return (
        <Button onClick={() => handleSectionChange("seal")} isDisabled={!selectedLot || workflowIsClosed}>
          Continue to Seal
        </Button>
      );
    }
    if (activeSection === "decision") {
      const canApprove = canApproveFinalDecision(currentUser?.role, settings?.workflow.finalDecisionApproverPolicy ?? "ADMIN_ONLY");
      return canApprove ? (
        <Button
          onClick={() => void handleDecision("READY_FOR_SAMPLING")}
          isLoading={saving}
          isDisabled={!job || decisionMissingProofLots.length > 0 || !allLotsHaveSeal}
        >
          Pass
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={() => void handleDecision("PENDING")}
          isLoading={saving}
          isDisabled={!job || decisionMissingProofLots.length > 0 || !allLotsHaveSeal}
        >
          Submit for Decision
        </Button>
      );
    }
    if (activeSection === "sampling") {
      return !selectedSample ? (
        <Button
          onClick={() => void handleStartSampling()}
          isLoading={saving}
          isDisabled={!allLotsReadyForHomogeneousSampling}
        >
          Create Homogeneous Sample
        </Button>
      ) : (
        <Button onClick={() => void handleSaveSample()} isLoading={saving}>
          Save Sample Details
        </Button>
      );
    }
    if (activeSection === "seal") {
      return (
        <Button
          variant="outline"
          onClick={() => void handleGenerateSealsForAll()}
          isLoading={saving}
          isDisabled={!settings?.seal.bulkSealGenerationEnabled}
        >
          Generate Seal Numbers
        </Button>
      );
    }
    if (activeSection === "packets") {
      if (workflowIsClosed) {
        return (
          <Button colorScheme="green" variant="outline" onClick={() => setBatchSummaryOpen(true)}>
            Done
          </Button>
        );
      }
      return draftPacketRows.length > 0 ? (
        <Button variant="outline" onClick={handleSaveDraftPackets}>
          Save Draft
        </Button>
      ) : (
        <Button onClick={() => void handleCreatePackets()} isLoading={saving} isDisabled={Boolean(packetStageBlockers.length)}>
          Save Packets
        </Button>
      );
    }
    return (
      <Button
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
        Submit to R&D
      </Button>
    );
  })();
  const desktopPrimaryDisplay = { base: "none", lg: "inline-flex" } as const;

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title={`Job No ${job.inspectionSerialNumber || job.jobReferenceNumber || "Not Available"}`}
          subtitle="One guided workflow from job intake to R&D handoff."
          breadcrumbs={[
            { label: "Jobs", href: "/jobs" },
            { label: job.inspectionSerialNumber || job.jobReferenceNumber || "Job" },
            { label: "Workflow" },
          ]}
          status={
            <HStack spacing={2}>
              <WorkflowStateChip status={job.status} />
              <Badge colorScheme="gray" variant="subtle">Next Action: {nextPrimaryActionDisplay}</Badge>
            </HStack>
          }
        />

        <PageActionBar
          primaryAction={
            <Box display={{ base: "none", lg: "block" }}>
              <Button
                colorScheme={workflowIsClosed ? "green" : "blue"}
                variant={workflowIsClosed ? "outline" : "solid"}
                onClick={focusSectionForNextAction}
                isLoading={saving || deletingJob}
                isDisabled={workflowIsClosed}
                size="sm"
                boxShadow="sm"
              >
                {nextPrimaryActionDisplay}
              </Button>
            </Box>
          }
          secondaryActions={
            <Flex w="full" align="center" flexWrap="wrap" gap={3} minH="12" py={1}>
              <Box
                display="inline-flex"
                alignItems="center"
                minH="10"
                px={3}
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="full"
                bg="bg.surface"
              >
                <Text fontSize="sm" color="text.secondary" fontWeight="medium" lineHeight="1">
                  Current step: {workflowSectionLabels[activeSection]}
                </Text>
              </Box>
              <Button size="sm" variant="outline" onClick={() => setBatchSummaryOpen(true)}>
                Job Summary
              </Button>
              {isRefreshingWorkflow ? (
                <HStack spacing={1}>
                  <Spinner size="xs" color="text.secondary" />
                  <Text fontSize="sm" color="text.secondary">Updating...</Text>
                </HStack>
              ) : null}
              {isAdminUser ? (
              <Button
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => void handleDeleteJob()}
                  isLoading={deletingJob}
                  isDisabled={workflowIsClosed}
                >
                  Delete Job
                </Button>
              ) : null}
            </Flex>
          }
        />

        <Box
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="lg"
          bg="bg.surface"
          px={3}
          py={2}
          position="relative"
        >
          <Tabs
            variant="line-enterprise"
            index={Math.max(workflowSections.findIndex((section) => section.id === activeSection), 0)}
            onChange={(index) => {
              const nextSection = workflowSections[index]?.id;
              if (nextSection) {
                handleSectionChange(nextSection);
              }
            }}
          >
            <TabList overflowX="auto" overflowY="hidden" aria-label="Workflow sections">
              {workflowSections.map((section) => {
                const sectionState = workflowSectionStates.find((state) => state.id === section.id);
                return (
                  <Tab
                    key={section.id}
                    whiteSpace="nowrap"
                    isDisabled={sectionState?.locked || workflowIsClosed}
                    title={sectionState?.reason ?? (sectionState?.locked ? "Locked until the earlier blocked stage is resolved." : undefined)}
                    aria-invalid={sectionState?.blocked || undefined}
                    _disabled={{
                      opacity: 0.45,
                      cursor: "not-allowed",
                    }}
                    _selected={
                      sectionState?.blocked
                        ? {
                            color: "red.800",
                            borderColor: "red.500",
                            bg: "red.50",
                            fontWeight: "semibold",
                          }
                        : undefined
                    }
                    _hover={
                      sectionState?.blocked
                        ? {
                            color: "red.800",
                            bg: "red.50",
                          }
                        : undefined
                    }
                  >
                    <HStack as="span" spacing={1.5} align="center">
                      {sectionState?.blocked ? (
                        <AlertTriangle size={14} aria-hidden />
                      ) : sectionState?.locked ? (
                        <Lock size={14} aria-hidden />
                      ) : null}
                      <Text as="span">{section.label}</Text>
                      {sectionState?.blocked ? (
                        <Badge size="sm" colorScheme="red" variant="subtle">
                          Blocked
                        </Badge>
                      ) : sectionState?.locked ? (
                        <Badge size="sm" colorScheme="gray" variant="subtle">
                          Locked
                        </Badge>
                      ) : null}
                    </HStack>
                  </Tab>
                );
              })}
            </TabList>
          </Tabs>
        </Box>

        <Box as="fieldset" disabled={workflowIsClosed} border="0" p="0" m="0" minW="0">
          <Stack direction={{ base: "column", xl: "row" }} spacing={4} align={{ base: "stretch", xl: "start" }}>
          <VStack align="stretch" spacing={4} flex="1" w="full">
            {activeSection === "job" ? (
              <Card variant="outline" w="full">
                <CardBody>
                    <VStack align="stretch" spacing={4}>
                      {activeSectionBlocker}
                      <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
                        <VStack align="start" spacing={1}>
                          <Heading as="h2" size="sm">
                            1. Job Basics
                          </Heading>
                          <Text fontSize="sm" color="text.secondary">
                            Client selection auto-saves immediately.
                          </Text>
                        </VStack>
                      <Button size="sm" variant="outline" onClick={() => setClientDrawerOpen(true)} isDisabled={workflowIsClosed}>
                        Add New Client
                      </Button>
                      </HStack>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <FormControl>
                        <RequiredFormLabel>Client Name</RequiredFormLabel>
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
                          <FormHelperText>Saved automatically after selection.</FormHelperText>
                        </FormControl>
                        <FormControl>
                        <RequiredFormLabel>Item</RequiredFormLabel>
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
                        <RequiredFormLabel>Deadline</RequiredFormLabel>
                          <Input type="date" value={jobForm.deadline} onChange={(event) => setJobForm((current) => ({ ...current, deadline: event.target.value }))} />
                        </FormControl>
                      </SimpleGrid>
                    </VStack>
                  </CardBody>
                <CardFooter display={{ base: "none", lg: "flex" }} justifyContent="flex-end" pt={0}>
                  <Button onClick={() => void handleSaveJobBasics()} isLoading={saving} isDisabled={workflowIsClosed}>
                    Save Job
                  </Button>
                </CardFooter>
              </Card>
            ) : null}

            {activeSection === "lots" ? (
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">2. Bags</Heading>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <FormControl>
                        <RequiredFormLabel>Bag Number</RequiredFormLabel>
                        <Input
                          value={
                            settings.workflow.autoLotNumbering
                              ? autoLotNumberPreview || buildAutoLotNumber(settings.workflow, job.lots ?? [])
                              : lotForm.lotNumber
                          }
                          onChange={(event) => setLotForm((current) => ({ ...current, lotNumber: event.target.value }))}
                          isReadOnly={settings.workflow.autoLotNumbering}
                          placeholder={settings.workflow.autoLotNumbering ? "Auto-generated" : "Enter bag number"}
                        />
                        <FormHelperText>
                          {settings.workflow.autoLotNumbering
                            ? "Auto numbering is ON. Bag number is generated."
                            : "Auto numbering is OFF. Enter bag number manually."}
                        </FormHelperText>
                      </FormControl>
                      <FormControl>
                        <RequiredFormLabel>Material Name</RequiredFormLabel>
                        <Input
                          value={lotForm.materialName}
                          onChange={(event) => setLotForm((current) => ({ ...current, materialName: event.target.value }))}
                          placeholder="Defaults from job item; editable per bag."
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Bag Count</FormLabel>
                        <Input
                          type="number"
                          min={1}
                          value="1"
                          isReadOnly
                        />
                        <FormHelperText>Each bag is tracked as its own record.</FormHelperText>
                      </FormControl>
                    </SimpleGrid>

                    <Heading as="h3" size="sm">Created Bags</Heading>
                    <VStack align="stretch" spacing={3}>
                      {(job.lots ?? []).map((lot) => {
                        const isSelected = selectedLot?.id === lot.id;
                        return (
                          <Box
                            key={lot.id}
                            borderWidth="1px"
                            borderColor={isSelected ? "brand.300" : "border.default"}
                            borderRadius="lg"
                            bg={isSelected ? "bg.surfaceElevated" : "bg.surface"}
                            p={isSelected ? 3 : 3.5}
                          >
                            <Stack spacing={3}>
                              <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
                                <VStack align="start" spacing={0.5}>
                                  <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                    Bag Number
                                  </Text>
                                  <HStack spacing={2} flexWrap="wrap">
                                    <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="text.primary">
                                      {lot.lotNumber}
                                    </Text>
                                    {isSelected ? (
                                      <Badge colorScheme="brand" variant="subtle">
                                        Selected
                                      </Badge>
                                    ) : null}
                                  </HStack>
                                </VStack>
                                <HStack spacing={2} flexWrap="wrap">
                                  <Button
                                    size="sm"
                                    variant={isSelected ? "solid" : "outline"}
                                    colorScheme="brand"
                                    onClick={() => handleSelectLot(lot)}
                                    isDisabled={workflowIsClosed}
                                  >
                                    {isSelected ? "Selected" : "Select"}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditLotId(lot.id)} isDisabled={workflowIsClosed}>
                                    Edit Bag
                                  </Button>
                                </HStack>
                              </HStack>

                              {isSelected ? (
                                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Material Name
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {lot.materialName || "Not Available"}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Quantity Mode
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {(lot.quantityMode || "SINGLE_PIECE").replaceAll("_", " ")}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Total Bags
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {lot.bagCount ?? lot.totalBags ?? "Not Available"}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Lot Photos
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1}>
                                      {(() => {
                                        const lotCaptured = new Set(
                                          (lot.mediaFiles ?? [])
                                            .map((file) => normalizeEvidenceCategoryKey(file.category))
                                            .filter((category): category is NonNullable<typeof category> => Boolean(category)),
                                        );
                                        const requiredCaptured = lotPhotoRequiredCategories.filter((category) => lotCaptured.has(category)).length;
                                        return `${requiredCaptured}/${lotPhotoRequiredCategories.length} required captured`;
                                      })()}
                                    </Text>
                                  </Box>
                                </SimpleGrid>
                              ) : (
                                <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} spacing={3}>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Material Name
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {lot.materialName || "Not Available"}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Quantity Mode
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {(lot.quantityMode || "SINGLE_PIECE").replaceAll("_", " ")}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Weight
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      Gross {lot.grossWeight ?? "Not Available"}
                                    </Text>
                                    <Text fontSize="sm" color="text.secondary" lineHeight="1.4">
                                      Net {lot.netWeight ?? "Not Available"} {lot.weightUnit ?? ""}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Total Bags
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {lot.bagCount ?? lot.totalBags ?? "Not Available"}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                      Created At
                                    </Text>
                                    <Text fontSize="sm" color="text.primary" mt={1} lineHeight="1.4">
                                      {formatDate(lot.createdAt)}
                                    </Text>
                                  </Box>
                                </SimpleGrid>
                              )}

                              <HStack justify="space-between" align="center" spacing={3} flexWrap="wrap" pt={2} borderTopWidth="1px" borderColor="border.default">
                                <Box>
                                  <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                    Photo Upload
                                  </Text>
                                  <Text fontSize="sm" color="text.primary" mt={1}>
                                    {isSelected ? "Drawer opens automatically for this bag." : "Open the drawer to upload policy-required images."}
                                  </Text>
                                </Box>
                                <HStack spacing={2} flexWrap="wrap">
                                  <Button size="sm" variant="outline" onClick={() => handleOpenLotPhotoDrawer(lot)}>
                                    {isSelected ? "Reopen Uploader" : "Open Lot Photo Uploader"}
                                  </Button>
                                </HStack>
                              </HStack>
                            </Stack>
                          </Box>
                        );
                      })}
                    </VStack>

                    <Divider />

                    {editLotId && job.lots?.find((lot) => lot.id === editLotId) ? (
                      <LotEditModal
                        isOpen={true}
                        onClose={() => setEditLotId(null)}
                        onSaved={() => fetchWorkflow({ initial: false, keepSection: activeSection })}
                        lot={job.lots.find((lot) => lot.id === editLotId)!}
                      />
                    ) : null}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "images" ? (
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">3. Job Photo</Heading>
                    <Text fontSize="sm" color="text.secondary">
                      This section is only for one job-level overview photo. Bag photos stay in Bags.
                    </Text>
                    <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={4}>
                      <VStack align="stretch" spacing={4}>
                        <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
                          <VStack align="start" spacing={1}>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                              Job overview photo
                            </Text>
                            <Text fontSize="sm" color="text.secondary">
                              Upload the one photo that represents the whole job.
                            </Text>
                          </VStack>
                          <Badge colorScheme={batchPhotoExists ? "green" : "orange"} variant="subtle">
                            {batchPhotoExists ? "Uploaded" : "Missing"}
                          </Badge>
                        </HStack>

                        {batchPhotoExists && batchPhotoPreviewUrl ? (
                          <HStack align="start" spacing={3} flexWrap="wrap">
                            <Image
                              src={batchPhotoPreviewUrl}
                              alt={`${batchPhotoLabel} preview`}
                              boxSize="72px"
                              objectFit="cover"
                              borderRadius="md"
                              borderWidth="1px"
                              borderColor="border.default"
                            />
                            <Button size="sm" variant="ghost" onClick={() => window.open(batchPhotoPreviewUrl, "_blank", "noopener,noreferrer")}>
                              View Photo
                            </Button>
                          </HStack>
                        ) : (
                          <Text fontSize="sm" color="text.secondary">
                            No job photo uploaded yet.
                          </Text>
                        )}

                        <HStack spacing={3} flexWrap="wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedImageLabel(batchPhotoLabel);
                              fileRef.current?.click();
                            }}
                            isDisabled={workflowIsClosed}
                          >
                            {batchPhotoExists ? "Replace Job Photo" : "Upload Job Photo"}
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "decision" ? (
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">5. Final Decision</Heading>
                    {!selectedLot ? (
                      <EmptyWorkState title="No bags available" description="Create at least one bag before submitting or approving the job decision." />
                    ) : (
                      <>
                        <Text fontSize="sm" color="text.secondary">
                          Final Decision is job-level. Operations can submit only after required bag proof is complete. Pass, Hold, and Reject are controlled by the configured approver policy.
                        </Text>
                        {decisionMissingProofLots.length > 0 ? (
                          <Text fontSize="sm" color="orange.600">
                            Missing required proof in bags: {decisionMissingProofLots.map((entry) => `${entry.lotNumber} (${entry.missing.join(", ")})`).join("; ")}.
                          </Text>
                        ) : null}
                        {!allLotsHaveSeal ? (
                          <HStack spacing={3} align="start" flexWrap="wrap">
                            <Text fontSize="sm" color="orange.600">
                              Complete seal assignment for every bag in the Seal step before submitting for decision.
                            </Text>
                            <Button size="xs" variant="outline" onClick={() => handleSectionChange("seal")}>
                              Go to Seal
                            </Button>
                          </HStack>
                        ) : null}
                        <HStack spacing={3} flexWrap="wrap">
                          <Button
                            display={desktopPrimaryDisplay}
                            variant="outline"
                            onClick={() => void handleDecision("PENDING")}
                            isLoading={saving}
                            isDisabled={workflowIsClosed || decisionMissingProofLots.length > 0 || !allLotsHaveSeal}
                          >
                            Submit for Decision
                          </Button>
                          {canApproveFinalDecision(currentUser?.role, settings.workflow.finalDecisionApproverPolicy) ? (
                            <>
                              <Button
                                display={desktopPrimaryDisplay}
                                onClick={() => void handleDecision("READY_FOR_SAMPLING")}
                                isLoading={saving}
                                isDisabled={workflowIsClosed || decisionMissingProofLots.length > 0 || !allLotsHaveSeal}
                              >
                                Pass
                              </Button>
                              <Button colorScheme="yellow" onClick={() => void handleDecision("ON_HOLD")} isLoading={saving} isDisabled={workflowIsClosed}>
                                Hold
                              </Button>
                              <Button colorScheme="red" onClick={() => void handleDecision("REJECTED")} isLoading={saving} isDisabled={workflowIsClosed}>
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </HStack>
                        <Text fontSize="sm" color="text.secondary">
                          Current Decision: {payload?.decision?.status?.replaceAll("_", " ") ?? "PENDING"}
                        </Text>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "sampling" ? (
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">6. Homogeneous Sampling</Heading>
                    <Text fontSize="sm" color="text.secondary">
                      Create one job-level homogeneous sample by taking scoops from every passed bag, mixing them in one bag, then sealing it once.
                    </Text>
                    {!job.lots?.length ? (
                      <EmptyWorkState title="No bags available" description="Create at least one bag before capturing the job-level homogeneous sample." />
                    ) : (
                      <>
                        <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" p={3}>
                          <VStack align="stretch" spacing={2}>
                            <HStack justify="space-between" align="start" flexWrap="wrap">
                              <Box>
                                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                  Contributor bags
                                </Text>
                                <Text fontSize="sm" color="text.secondary">
                                  Every bag must be inspection-passed before this job sample can start.
                                </Text>
                              </Box>
                              <Badge colorScheme={allLotsReadyForHomogeneousSampling ? "green" : "orange"}>
                                {allLotsReadyForHomogeneousSampling
                                  ? "All bags ready"
                                  : `${samplingBlockingLots.length} bag(s) blocking`}
                              </Badge>
                            </HStack>
                            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={2}>
                              {(job.lots ?? []).map((lot) => {
                                const displayStatus = getInspectionSamplingDisplayStatus(lot.inspection);
                                return (
                                  <HStack key={lot.id} justify="space-between" borderWidth="1px" borderColor="border.default" borderRadius="md" px={3} py={2}>
                                    <Box>
                                      <Text fontSize="sm" fontWeight="semibold">{lot.lotNumber}</Text>
                                      <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary">{lot.materialName || job.commodity}</Text>
                                    </Box>
                                    <WorkflowStateChip status={displayStatus} />
                                  </HStack>
                                );
                              })}
                            </SimpleGrid>
                          </VStack>
                        </Box>
                        {!allLotsReadyForHomogeneousSampling ? (
                          <ExceptionBanner
                            status="warning"
                            title="Homogeneous sampling blocked"
                            description={`Complete/pass inspection for: ${samplingBlockingLots.map((lot) => lot.lotNumber).join(", ")}.`}
                          />
                        ) : null}
                        {!selectedSample ? (
                          <Button
                            display={desktopPrimaryDisplay}
                            alignSelf="start"
                            onClick={() => void handleStartSampling()}
                            isLoading={saving}
                            isDisabled={workflowIsClosed || !allLotsReadyForHomogeneousSampling}
                          >
                            Create Homogeneous Sample
                          </Button>
                        ) : null}
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <FormControl>
                        <RequiredFormLabel>Job Sample ID</RequiredFormLabel>
                            <Input
                              value={
                                selectedSample?.sampleCode ??
                                (settings.workflow.autoSampleIdGeneration ? "Auto generated after start" : sampleForm.sampleCode)
                              }
                              isReadOnly={settings.workflow.autoSampleIdGeneration || Boolean(selectedSample?.sampleCode)}
                              onChange={(event) => setSampleForm((current) => ({ ...current, sampleCode: event.target.value }))}
                              placeholder={settings.workflow.autoSampleIdGeneration ? "Auto generated after start" : "Enter Sample ID"}
                            />
                            <FormHelperText>One canonical homogeneous sample is created for the parent job.</FormHelperText>
                          </FormControl>
                          <FormControl>
                        <RequiredFormLabel>Container Type</RequiredFormLabel>
                            <Select value={sampleForm.containerType} onChange={(event) => setSampleForm((current) => ({ ...current, containerType: event.target.value }))}>
                              <option value="">Select container</option>
                              {containerTypes.map((containerType) => (
                                <option key={containerType.id} value={containerType.name}>{containerType.name}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl>
                        <RequiredFormLabel>Sample Type</RequiredFormLabel>
                            <Input value={sampleForm.sampleType} onChange={(event) => setSampleForm((current) => ({ ...current, sampleType: event.target.value }))} />
                          </FormControl>
                          <FormControl>
                        <RequiredFormLabel>Sampling Method</RequiredFormLabel>
                            <Input value={sampleForm.samplingMethod} onChange={(event) => setSampleForm((current) => ({ ...current, samplingMethod: event.target.value }))} />
                          </FormControl>
                          <FormControl>
                        <RequiredFormLabel>Sample Quantity</RequiredFormLabel>
                            <Input
                              value={sampleForm.sampleQuantity}
                              onChange={(event) => setSampleForm((current) => ({ ...current, sampleQuantity: event.target.value }))}
                              placeholder="Enter sample quantity"
                            />
                          </FormControl>
                          <FormControl>
                        <RequiredFormLabel>Sample Unit</RequiredFormLabel>
                            <Select value={sampleForm.sampleUnit} onChange={(event) => setSampleForm((current) => ({ ...current, sampleUnit: event.target.value }))}>
                              <option value="KG">KG</option>
                              <option value="G">G</option>
                              <option value="MG">MG</option>
                              <option value="PCS">PCS</option>
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                        <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" p={3}>
                          <VStack align="stretch" spacing={1.5}>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                              Current job sample
                            </Text>
                            {selectedSample ? (
                              <>
                                <Text fontSize="sm" color="text.secondary">
                                  Job Sample ID: {selectedSample.sampleCode || "Not set"}
                                </Text>
                                <Text fontSize="sm" color="text.secondary">
                                  Quantity: {selectedSample.sampleQuantity ?? "Not set"} {selectedSample.sampleUnit ?? ""}
                                </Text>
                                <Text fontSize="sm" color="text.secondary">
                                  Container Type: {selectedSample.containerType || "Not set"}
                                </Text>
                                <Text fontSize="sm" color="text.secondary">
                                  Scoop confirmation: {selectedSample.homogeneousProofDone || selectedSample.homogenizedAt ? "Scoops mixed from every bag" : "Not confirmed"}
                                </Text>
                                <Text fontSize="sm" color="text.secondary">
                                  Homogenized Photo: {selectedSample.media?.some((entry) => String(entry.mediaType).toUpperCase() === "HOMOGENIZED_SAMPLE") ? "Uploaded" : "Not uploaded"}
                                </Text>
                              </>
                            ) : (
                              <Text fontSize="sm" color="text.secondary">Sampling not started yet.</Text>
                            )}
                          </VStack>
                        </Box>
                        <VStack align="stretch" spacing={2}>
                          <Text fontSize="sm" fontWeight="medium" color="text.primary">Job sample readiness</Text>
                          {sampleReadiness.isReady ? (
                            <Badge colorScheme="green" alignSelf="start">Ready for Packeting</Badge>
                          ) : (
                            <VStack align="stretch" spacing={1}>
                              {sampleReadiness.blockers.map((blocker) => (
                                <Box key={blocker.key} p={3} borderRadius="md" bg="bg.rail" borderWidth="1px" borderColor="border.default">
                                  <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                    {blocker.groupTitle} · {blocker.proofLabel}
                                  </Text>
                                  <Text fontSize="sm" color="orange.600" mt={1}>
                                    {blocker.detail}
                                  </Text>
                                  <HStack mt={1} spacing={2} flexWrap="wrap" align="center">
                                    <Text fontSize={{ base: "xs", md: "sm" }} color="text.muted">
                                      Complete here: {blocker.locationLabel}
                                    </Text>
                                    {blocker.key === "seal-number" || blocker.key === "sealed-sample-photo" ? (
                                      <Button size="xs" variant="ghost" onClick={() => handleSectionChange("seal")}>
                                        Open Seal Evidence
                                      </Button>
                                    ) : null}
                                  </HStack>
                                </Box>
                              ))}
                            </VStack>
                          )}
                        </VStack>
                        <HStack spacing={3} flexWrap="wrap">
                          <Button display={desktopPrimaryDisplay} onClick={() => void handleSaveSample()} isLoading={saving} isDisabled={workflowIsClosed}>
                            Save Sample Details
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleMarkHomogeneous()}
                            isLoading={saving}
                            isDisabled={workflowIsClosed || !settings.sampling.homogeneousProofRequired}
                          >
                            Confirm Scoops Mixed
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => sampleProofFileRef.current?.click()}
                            isLoading={saving}
                            isDisabled={workflowIsClosed || !selectedSample}
                          >
                            Upload Homogenized Sample Photo
                          </Button>
                        </HStack>
                        <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" p={3}>
                          <VStack align="stretch" spacing={1.5}>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                              Required for packet creation
                            </Text>
                            {samplingRequiredChecklist.map((item) => (
                              <HStack key={item.id} spacing={2}>
                                <Badge colorScheme={item.completed ? "green" : "orange"}>
                                  {item.completed ? "Done" : "Missing"}
                                </Badge>
                                <Text fontSize="sm" color="text.secondary">
                                  {item.label}
                                </Text>
                              </HStack>
                            ))}
                          </VStack>
                        </Box>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "seal" ? (
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">4. Seal Evidence</Heading>
                    <Text fontSize="sm" color="text.secondary">
                      Assign and review seals for each bag before decision submission.
                    </Text>
                    {!selectedLot ? (
                      <EmptyWorkState title="No bag selected" description="Select a bag to manage seal flow." />
                    ) : (
                      <>
                        <HStack spacing={3} flexWrap="wrap">
                          <SealScanner
                            onScanned={(sealNo) => void handleSaveSeal(sealNo)}
                            onManualConfirm={(sealNo) => void handleSaveSeal(sealNo)}
                            isDisabled={!settings.seal.sealScanRequired && Boolean(selectedSample?.sealLabel?.sealNo)}
                          />
                          <Button
                            display={desktopPrimaryDisplay}
                            variant="outline"
                            onClick={() => void handleGenerateSealsForAll()}
                            isLoading={saving}
                            isDisabled={!settings.seal.bulkSealGenerationEnabled || readySealLots.length === 0}
                          >
                            Generate Seal Numbers
                          </Button>
                          <Button variant="outline" onClick={() => setSealDownloadDrawerOpen(true)}>
                            Download Seal Stickers
                          </Button>
                        </HStack>
                        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary">
                          Seal scanning accepts barcode readers, phone camera capture, or manual entry. Seal sticker downloads can be tuned for thermal label printers or inkjet printers.
                        </Text>
                        <Badge colorScheme={readySealLots.length > 0 ? "green" : "orange"} alignSelf="start">
                          Ready to generate: {readySealLots.length} bags
                        </Badge>
                        <Text fontSize="sm" color="text.secondary">
                          Bulk generation requires bag proof on eligible bags.
                        </Text>
                        {sealGenerationSummary ? (
                          <VStack align="stretch" spacing={2}>
                            <ExceptionBanner
                              status={sealGenerationSummary.failed.length > 0 ? "warning" : "info"}
                              title={`Generated: ${sealGenerationSummary.generated.length} | Skipped: ${sealGenerationSummary.skipped.length} | Failed: ${sealGenerationSummary.failed.length}`}
                              description={
                                sealGenerationSummary.failed.length > 0
                                  ? `Failed bags: ${sealGenerationSummary.failed.map((entry) => `${entry.lotNumber} (${entry.reason})`).join("; ")}`
                                  : "No API failures. Skipped bags were not eligible for seal generation."
                              }
                            />
                            {sealGenerationSummary.skipped.length > 0 ? (
                              <Text fontSize="sm" color="text.secondary">
                                Skipped bags: {sealGenerationSummary.skipped.map((entry) => `${entry.lotNumber} (${entry.reason})`).join("; ")}
                              </Text>
                            ) : null}
                          </VStack>
                        ) : null}
                        <VStack align="stretch" spacing={3} display={{ base: "flex", xl: "none" }}>
                          {(job.lots ?? []).flatMap((lot) =>
                            (lot.bags?.length ? lot.bags : [{ id: lot.id, bagNumber: 1, grossWeight: lot.grossWeight ?? null, netWeight: lot.netWeight ?? null }]).map((bag) => (
                              <Box
                                key={`${lot.id}-${bag.id}`}
                                borderWidth="1px"
                                borderColor="border.default"
                                borderRadius="lg"
                                bg="bg.surface"
                                p={3}
                              >
                                <VStack align="stretch" spacing={3}>
                                  <HStack justify="space-between" align="start" spacing={3}>
                                    <VStack align="start" spacing={0.5}>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Bag No
                                      </Text>
                                      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                        {lot.lotNumber}
                                      </Text>
                                    </VStack>
                                    <Badge colorScheme={(() => {
                                      const readiness = sealReadinessRows.find((entry) => entry.lotId === lot.id);
                                      return readiness?.eligible ? "green" : "gray";
                                    })()} variant="subtle">
                                      {(() => {
                                        const readiness = sealReadinessRows.find((entry) => entry.lotId === lot.id);
                                        if (!readiness) {
                                          return "Not available";
                                        }
                                        return readiness.eligible ? "Ready" : readiness.reason;
                                      })()}
                                    </Badge>
                                  </HStack>
                                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                                    <Box>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Row
                                      </Text>
                                      <Text fontSize="sm" color="text.primary" mt={1}>
                                        {bag.bagNumber}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Weight
                                      </Text>
                                      <Text fontSize="sm" color="text.primary" mt={1}>
                                        {lot.weightUnit ?? "KG"}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Gross
                                      </Text>
                                      <Text fontSize="sm" color="text.primary" mt={1}>
                                        {bag.grossWeight ?? "Not Available"}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Net
                                      </Text>
                                      <Text fontSize="sm" color="text.primary" mt={1}>
                                        {bag.netWeight ?? "Not Available"}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Seal No
                                      </Text>
                                      <Text fontSize="sm" color="text.primary" mt={1}>
                                        {lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? "Not Available"}
                                      </Text>
                                    </Box>
                                  </SimpleGrid>
                                </VStack>
                              </Box>
                            )),
                          )}
                        </VStack>

                        <EnterpriseStickyTable display={{ base: "none", xl: "block" }}>
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Bag No</Th>
                                <Th>Bag Row</Th>
                                <Th>Weight</Th>
                                <Th>Gross</Th>
                                <Th>Net</Th>
                                <Th>Seal No</Th>
                                <Th>Readiness</Th>
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
                                    <Td>
                                      {(() => {
                                        const readiness = sealReadinessRows.find((entry) => entry.lotId === lot.id);
                                        if (!readiness) {
                                          return "Not Available";
                                        }
                                        if (readiness.eligible) {
                                          return "Ready";
                                        }
                                        return readiness.reason;
                                      })()}
                                    </Td>
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
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">7. Packet Creation</Heading>
                    {workflowIsClosed ? (
                      <VStack align="stretch" spacing={3}>
                        <ExceptionBanner
                          status="info"
                          title="Packet creation complete"
                          description="This job is closed. Packet rows are now read-only for review only."
                        />
                        <HStack spacing={2} wrap="wrap">
                          <WorkflowStateChip status={job.status} />
                          <Badge colorScheme="green" variant="subtle">
                            Done
                          </Badge>
                        </HStack>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">
                              Packet Count
                            </Text>
                            <Text fontWeight="semibold">{packets.length}</Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">
                              Closed At
                            </Text>
                            <Text fontWeight="semibold">
                              {formatDate(
                                workflowPayload.milestones.handedOverToRndAt ??
                                  workflowPayload.milestones.operationsCompletedAt ??
                                  workflowPayload.milestones.adminDecisionAt,
                              )}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">
                              Next Action
                            </Text>
                            <Text fontWeight="semibold">Done</Text>
                          </Box>
                        </SimpleGrid>
                      </VStack>
                    ) : !selectedSample ? (
                      <EmptyWorkState title="Job sample required" description="Start sampling before creating packets." />
                    ) : (
                      <>
                        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">Job Number</Text>
                            <Text fontWeight="semibold">{job.inspectionSerialNumber || job.jobReferenceNumber || "Not Available"}</Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">Contributor Bags</Text>
                            <Text fontWeight="semibold">{job.lots?.length ?? 0} bag(s)</Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">Job Sample ID</Text>
                            <Text fontWeight="semibold">{selectedSample.sampleCode || "Not Available"}</Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">Available Sample Quantity</Text>
                            <Text fontWeight="semibold">
                              {selectedSample.sampleQuantity ?? "Not set"} {selectedSample.sampleUnit ?? ""}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">Container / Seal</Text>
                            <Text fontWeight="semibold">
                              {selectedSample.containerType || "Container not set"} / {selectedSample.sealLabel?.sealNo || jobSealDisplay}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" color="text.muted">Current Stage</Text>
                            <Text fontWeight="semibold">{workflowPayload.workflowStage}</Text>
                          </Box>
                        </SimpleGrid>

                        {packetStageBlockers.length > 0 ? (
                          <VStack align="stretch" spacing={2}>
                            <ExceptionBanner
                              title="Packet blockers"
                              description={packetStageBlockers
                                .map((blocker) =>
                                  getPacketBlockerMessage(blocker, {
                                    lotHasSealNumber: Boolean(selectedLot?.sealNumber),
                                    sampleHasSealEvidence: Boolean(
                                      selectedSample?.sealLabel?.sealNo && selectedSample?.sealLabel?.sealedAt,
                                    ),
                                  }),
                                )
                                .join(" ")}
                              status="warning"
                            />
                            <Button
                              alignSelf="start"
                              size="sm"
                              onClick={() => handleSectionChange("sampling")}
                            >
                              Complete Sampling Now
                            </Button>
                          </VStack>
                        ) : null}
                          <Text fontSize="sm" color="text.secondary">
                          Job sample readiness: {sampleReadiness.isReady ? "Ready for packeting." : sampleReadiness.blockers.map((blocker) => blocker.detail).join(" | ")}
                          </Text>

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
                          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3} alignItems="end">
                            <FormControl maxW="160px">
                              <RequiredFormLabel>Packets to create</RequiredFormLabel>
                              <Input
                                value={packetCount}
                                onChange={(event) => setPacketCount(event.target.value)}
                                aria-label="Packets to create"
                              />
                            </FormControl>
                            <FormControl maxW="160px">
                              <RequiredFormLabel>Default Unit</RequiredFormLabel>
                              <Select value={defaultPacketUnit} onChange={(event) => setDefaultPacketUnit(event.target.value)}>
                                <option value="KG">KG</option>
                                <option value="G">G</option>
                                <option value="PCS">PCS</option>
                              </Select>
                            </FormControl>
                            <Button w="full" onClick={handleAutoCreateDraftRows} isDisabled={workflowIsClosed || packetStageBlockers.length > 0}>
                              Split Weight
                            </Button>
                            <Button w="full" variant="outline" onClick={handleManualAddDraftRow} isDisabled={workflowIsClosed || packetStageBlockers.length > 0}>
                              Add Packet Row
                            </Button>
                          </SimpleGrid>
                          <Text fontSize="sm" color="text.secondary">
                            Split Weight divides the available sample weight evenly across the requested number of draft packets. Drafts do not create records until you click Create Packets.
                          </Text>
                        </VStack>

                        <VStack align="stretch" spacing={3} display={{ base: "flex", xl: "none" }}>
                          {draftPacketRows.length > 0
                            ? draftPacketRows.map((row) => (
                              <Box
                                key={row.id}
                                borderWidth="1px"
                                borderColor="border.default"
                                borderRadius="lg"
                                bg="bg.surface"
                                p={3}
                              >
                                <VStack align="stretch" spacing={3}>
                                  <HStack justify="space-between" align="start" spacing={3}>
                                    <VStack align="start" spacing={0.5}>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Packet
                                      </Text>
                                      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                        {row.packetId}
                                      </Text>
                                    </VStack>
                                    <Badge colorScheme="gray" variant="subtle">
                                      Draft
                                    </Badge>
                                  </HStack>
                                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                                    <FormControl>
                                      <RequiredFormLabel>Packet Weight</RequiredFormLabel>
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
                                    </FormControl>
                                    <FormControl>
                                      <RequiredFormLabel>Unit</RequiredFormLabel>
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
                                    </FormControl>
                                    <FormControl>
                                      <RequiredFormLabel>Packet Use</RequiredFormLabel>
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
                                    </FormControl>
                                    <FormControl>
                                      <FormLabel mb={1}>Notes</FormLabel>
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
                                    </FormControl>
                                  </SimpleGrid>
                                  <HStack justify="space-between" align="center">
                                    <Text fontSize="sm" color="text.secondary">Draft row</Text>
                                      <Button size="sm" variant="outline" onClick={() => handleRemoveDraftRow(row.id)} isDisabled={workflowIsClosed}>
                                        Remove
                                      </Button>
                                  </HStack>
                                </VStack>
                                </Box>
                              ))
                            : packets.map((packet) => (
                              <Box
                                key={packet.id}
                                borderWidth="1px"
                                borderColor="border.default"
                                borderRadius="lg"
                                bg="bg.surface"
                                p={3}
                              >
                                <VStack align="stretch" spacing={3}>
                                  <HStack justify="space-between" align="start" spacing={3}>
                                    <VStack align="start" spacing={0.5}>
                                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                                        Packet
                                      </Text>
                                      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                        {packet.packetCode}
                                      </Text>
                                    </VStack>
                                    <Badge variant="subtle">{packet.packetStatus.replaceAll("_", " ")}</Badge>
                                  </HStack>
                                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                                    <FormControl>
                                      <RequiredFormLabel>Packet Weight</RequiredFormLabel>
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
                                    </FormControl>
                                    <FormControl>
                                      <RequiredFormLabel>Unit</RequiredFormLabel>
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
                                    </FormControl>
                                    <FormControl>
                                      <RequiredFormLabel>Packet Use</RequiredFormLabel>
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
                                    </FormControl>
                                    <FormControl>
                                      <FormLabel mb={1}>Notes</FormLabel>
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
                                    </FormControl>
                                  </SimpleGrid>
                                  <Button size="sm" variant="outline" alignSelf="start" onClick={() => void handleSavePacket(packet.id)} isLoading={saving} isDisabled={workflowIsClosed}>
                                    Save Packet
                                  </Button>
                                </VStack>
                              </Box>
                            ))}
                        </VStack>

                        <EnterpriseStickyTable display={{ base: "none", xl: "block" }}>
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
                                    <Td>
                                      <Button size="xs" variant="outline" onClick={() => handleRemoveDraftRow(row.id)} isDisabled={workflowIsClosed}>
                                        Remove
                                      </Button>
                                    </Td>
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
                                    <Td>
                                      <Button size="xs" variant="outline" onClick={() => void handleSavePacket(packet.id)} isLoading={saving} isDisabled={workflowIsClosed}>
                                        Save Packet
                                      </Button>
                                    </Td>
                                  </Tr>
                                ))}
                            </Tbody>
                          </Table>
                        </EnterpriseStickyTable>
                        {!workflowIsClosed ? (
                          <HStack spacing={3}>
                            <Button variant="outline" onClick={handleSaveDraftPackets} isDisabled={draftPacketRows.length === 0}>
                              Save Draft
                            </Button>
                            <Button display={desktopPrimaryDisplay} onClick={() => void handleCreatePackets()} isLoading={saving} isDisabled={draftPacketRows.length === 0 || packetStageBlockers.length > 0}>
                              Create Packets
                            </Button>
                          </HStack>
                        ) : null}
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : null}

            {activeSection === "handover" ? (
              <Card variant="outline" w="full">
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {activeSectionBlocker}
                    <Heading as="h2" size="sm">8. Submit to R&amp;D</Heading>
                    <Text fontSize="sm" color="text.secondary">
                      This is the terminal operations action. Every packet must carry packet weight, unit, and packet use before submission.
                    </Text>
                    <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                        Packet to R&amp;D relationship
                      </Text>
                      <Text fontSize="sm" color="text.secondary" mt={1}>
                        Each packet creates one initial R&amp;D child row in the queue. Multiple packets therefore create multiple expected child rows. Retests are separate child records and are not duplicate initial children.
                      </Text>
                      <HStack spacing={3} flexWrap="wrap" mt={3}>
                        <Badge colorScheme="purple" variant="subtle">
                          Expected initial child rows: {packets.length}
                        </Badge>
                        <Badge colorScheme="gray" variant="subtle">
                          Retest rows stay grouped under the same packet lineage
                        </Badge>
                      </HStack>
                    </Box>
                    <FormControl maxW={{ base: "full", md: "320px" }} isRequired>
                      <RequiredFormLabel>Hand Over To</RequiredFormLabel>
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
                      display={desktopPrimaryDisplay}
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

          {showDesktopSideRail ? (
            <Box w={{ base: "full", xl: "340px" }} position={{ xl: "sticky" }} top={{ xl: "92px" }}>
              <VStack align="stretch" spacing={4}>
                {settings.ui.showBlockersInline && visibleWorkflowBlockers.length > 0 ? (
                  <ExceptionBanner
                    title="Current blockers"
                    description={visibleWorkflowBlockers.join(" ")}
                    status="warning"
                  />
                ) : null}

                {payload?.decision?.status === "ON_HOLD" || payload?.decision?.status === "REJECTED" ? (
                  <ExceptionBanner
                    title="Decision blocks progression"
                    description="Hold and Reject block downstream sampling and packet work until resolved."
                    status="warning"
                  />
                ) : null}

              </VStack>
            </Box>
          ) : null}
          </Stack>
        </Box>

        <MobileActionRail>
          {mobilePrimaryAction}
          <Button
            variant="outline"
            onClick={() => {
              if (workflowIsClosed && activeSection === "packets") {
                setBatchSummaryOpen(true);
                return;
              }
              handleSectionChange(nextSequentialSection);
            }}
          >
            {workflowIsClosed && activeSection === "packets" ? "Done" : "Next"}
          </Button>
        </MobileActionRail>

        <Drawer
          isOpen={batchSummaryOpen}
          placement="right"
          onClose={() => setBatchSummaryOpen(false)}
          size="xl"
        >
          <DrawerOverlay />
          <DrawerContent {...enterpriseDrawerContentProps}>
            <DrawerCloseButton />
            <DrawerHeader {...enterpriseDrawerHeaderProps}>
              Job Summary
              <Text fontSize="sm" color="text.secondary" mt={1} fontWeight="normal">
                Review the job state without leaving the workflow.
              </Text>
            </DrawerHeader>
            <DrawerBody {...enterpriseDrawerBodyProps}>
              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4} alignItems="start">
                <VStack align="stretch" spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {batchSummaryItems.map((item) => (
                      <Box key={item.label} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={3}>
                        <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                          {item.label}
                        </Text>
                        <Text mt={1} fontSize="sm" fontWeight="semibold" color="text.primary">
                          {item.value}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                  <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={3}>
                    <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                      Review notes
                    </Text>
                    <Text fontSize="sm" color="text.secondary" mt={1}>
                      Use this summary to confirm the current job state before continuing. Bag photos, seal work, and packet work stay inside their own workflow sections.
                    </Text>
                  </Box>
                  {payload?.blockers?.length ? (
                    <ExceptionBanner
                      title="Current blockers"
                      description={payload.blockers.join(" ")}
                      status="warning"
                    />
                  ) : null}
                </VStack>

                <VStack align="stretch" spacing={4}>
                  <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={3}>
                    <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                      Quick links
                    </Text>
                    <HStack mt={3} spacing={2} flexWrap="wrap">
                      <Button size="sm" variant="outline" onClick={() => handleSectionChange("lots")}>
                        Open Bags
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleSectionChange("seal")}>
                        Open Seal
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/documents?job=${job?.inspectionSerialNumber || job?.jobReferenceNumber || job?.id || ""}`)}
                      >
                        Open Documents
                      </Button>
                    </HStack>
                  </Box>

                  <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" overflow="hidden">
                    <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.default">
                      <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                        History
                      </Text>
                      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                        Process timeline
                      </Text>
                    </Box>
                    <Box px={3} py={3}>
                      <HistoryTimeline events={processTimeline} showPanel={false} />
                    </Box>
                  </Box>
                </VStack>
              </SimpleGrid>
            </DrawerBody>
            <DrawerFooter {...enterpriseDrawerFooterProps}>
              <Button variant="outline" onClick={() => setBatchSummaryOpen(false)}>
                Close
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Drawer
          isOpen={lotPhotoDrawerOpen}
          placement="right"
          onClose={closeLotPhotoDrawer}
          size="md"
        >
          <DrawerOverlay />
          <DrawerContent {...enterpriseDrawerContentProps}>
            <DrawerCloseButton />
            <DrawerHeader {...enterpriseDrawerHeaderProps}>
              Lot Photo Uploader
              <Text fontSize="sm" color="text.secondary" mt={1} fontWeight="normal">
                Upload the policy-required images for this lot from one place.
              </Text>
            </DrawerHeader>
            <DrawerBody {...enterpriseDrawerBodyProps}>
              {lotPhotoDrawerLot ? (
                <VStack align="stretch" spacing={4}>
                  <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={3}>
                    <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                      {lotPhotoDrawerLot.lotNumber}
                    </Text>
                    <Text fontSize="sm" color="text.secondary" mt={1}>
                      {lotPhotoRequiredCapturedCount}/{lotPhotoRequiredCategories.length} required photos captured
                      {lotPhotoOptionalCategories.length > 0
                        ? ` · ${lotPhotoOptionalCapturedCount}/${lotPhotoOptionalCategories.length} optional captured`
                        : ""}
                    </Text>
                    <Text fontSize={{ base: "xs", md: "sm" }} color="text.muted" mt={2}>
                      Upload each required image from here. This keeps the bag card readable while still making policy coverage easy to review.
                    </Text>
                  </Box>

                  <VStack align="stretch" spacing={3}>
                    <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                      Required photos
                    </Text>
                    {lotPhotoRequiredCategories.map((category) => {
                      const uploaded = lotPhotoCapturedCategories.has(category);
                      const previewFile = lotPhotoFileByCategory.get(category);
                      const isSealCategory = category === "SEAL_CLOSEUP";
                      return (
                        <Box
                          key={category}
                          borderWidth="1px"
                          borderColor="border.default"
                          borderRadius="lg"
                          bg="bg.surface"
                          p={3}
                        >
                          <HStack justify="space-between" align="start" spacing={3}>
                            <VStack align="start" spacing={1}>
                              <HStack spacing={2} flexWrap="wrap">
                                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                  {getEvidenceCategoryLabel(category)}
                                </Text>
                                <Badge colorScheme={uploaded ? "green" : "orange"} variant="subtle">
                                  {uploaded ? "Captured" : "Missing"}
                                </Badge>
                              </HStack>
                              <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary">
                                Required by lot policy.
                              </Text>
                              {isSealCategory ? (
                                <VStack align="stretch" spacing={2} pt={1}>
                                  <HStack spacing={2} flexWrap="wrap">
                                    <Badge colorScheme={lotSealNumber ? "green" : "orange"} variant="subtle">
                                      {lotSealNumber ? `Seal No: ${lotSealNumber}` : "Seal not assigned"}
                                    </Badge>
                                    {lotSealNumber && sealNumbersLocked ? (
                                      <Badge colorScheme="gray" variant="subtle">
                                        Locked after admin pass
                                      </Badge>
                                    ) : null}
                                    {lotSealNumber ? (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => lotPhotoDrawerLot && openSealEditDrawer(lotPhotoDrawerLot)}>
                                          View seal
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => void handleCopySealNumber(lotSealNumber)}>
                                          Copy seal no
                                        </Button>
                                      </>
                                    ) : null}
                                    {!lotSealNumber ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (lotPhotoDrawerLot) {
                                              void handleAssignSealNumberForLot(lotPhotoDrawerLot, undefined, true);
                                            }
                                          }}
                                          isDisabled={!lotPhotoDrawerLot}
                                        >
                                          Generate seal no
                                        </Button>
                                        {lotPhotoDrawerLot ? (
                                          <SealScanner
                                            onScanned={(sealNumber) => void handleAssignSealNumberForLot(lotPhotoDrawerLot, sealNumber)}
                                            onManualConfirm={(sealNumber) => void handleAssignSealNumberForLot(lotPhotoDrawerLot, sealNumber)}
                                            isDisabled={!lotPhotoDrawerLot}
                                          />
                                        ) : null}
                                      </>
                                    ) : null}
                                  </HStack>
                                  <Text fontSize={{ base: "xs", md: "sm" }} color="text.muted">
                                    Scan any standard barcode seal or generate a new seal number, then attach the seal photo.
                                  </Text>
                                </VStack>
                              ) : null}
                              {previewFile?.storageKey ? (
                                <Image
                                  src={previewFile.storageKey}
                                  alt={`${getEvidenceCategoryLabel(category)} preview`}
                                  mt={2}
                                  borderRadius="md"
                                  borderWidth="1px"
                                  borderColor="border.default"
                                  w="full"
                                  maxH="120px"
                                  objectFit="cover"
                                />
                              ) : null}
                            </VStack>
                            <Button size="sm" variant="outline" onClick={() => handleLaunchLotPhotoUpload(lotPhotoDrawerLot, category)}>
                              {uploaded ? "Replace" : "Upload"}
                            </Button>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>

                  {lotPhotoOptionalCategories.length > 0 ? (
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                        Optional photos
                      </Text>
                    {lotPhotoOptionalCategories.map((category) => {
                      const uploaded = lotPhotoCapturedCategories.has(category);
                      const previewFile = lotPhotoFileByCategory.get(category);
                      return (
                        <Box
                          key={category}
                          borderWidth="1px"
                          borderColor="border.default"
                            borderRadius="lg"
                            bg="bg.surface"
                            p={3}
                          >
                            <HStack justify="space-between" align="start" spacing={3}>
                              <VStack align="start" spacing={1}>
                                <HStack spacing={2} flexWrap="wrap">
                                  <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                    {getEvidenceCategoryLabel(category)}
                                  </Text>
                                  <Badge colorScheme={uploaded ? "green" : "gray"} variant="subtle">
                                    {uploaded ? "Captured" : "Optional"}
                                  </Badge>
                                </HStack>
                                <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary">
                                  Capture if needed for review.
                                </Text>
                                {previewFile?.storageKey ? (
                                  <Image
                                    src={previewFile.storageKey}
                                    alt={`${getEvidenceCategoryLabel(category)} preview`}
                                    mt={2}
                                    borderRadius="md"
                                    borderWidth="1px"
                                    borderColor="border.default"
                                    w="full"
                                    maxH="120px"
                                    objectFit="cover"
                                  />
                                ) : null}
                              </VStack>
                              <Button size="sm" variant="outline" onClick={() => handleLaunchLotPhotoUpload(lotPhotoDrawerLot, category)}>
                                {uploaded ? "Replace" : "Upload"}
                              </Button>
                            </HStack>
                          </Box>
                        );
                      })}
                    </VStack>
                  ) : null}
                </VStack>
              ) : null}
            </DrawerBody>
            <DrawerFooter {...enterpriseDrawerFooterProps}>
              <Button variant="outline" onClick={closeLotPhotoDrawer}>
                Close
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <QuickEditDrawer
          isOpen={sealEditDrawerOpen}
          onClose={closeSealEditDrawer}
          title="Edit seal number"
          onSave={() => void handleSaveSealEdit()}
          isSaving={saving}
          isSaveDisabled={sealNumbersLocked || !sealEditDrawerLot}
          saveLabel="Save seal number"
        >
          <VStack align="stretch" spacing={4}>
            <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={3}>
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                {sealEditDrawerLot?.lotNumber ?? "Selected bag"}
              </Text>
              <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" mt={1}>
                Seal number stays editable until the manager/admin pass is completed.
              </Text>
            </Box>

            <FormControl isDisabled={sealNumbersLocked}>
              <RequiredFormLabel>Seal number</RequiredFormLabel>
              <Input
                value={sealEditValue}
                onChange={(event) => setSealEditValue(event.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="Enter or scan a 16-digit seal number"
                inputMode="numeric"
              />
              <FormHelperText>Use scan, generate, or manual entry. Any standard barcode seal is supported.</FormHelperText>
            </FormControl>

            <HStack spacing={2} flexWrap="wrap">
              {sealEditDrawerLot ? (
                <SealScanner
                  onScanned={(sealNumber) => setSealEditValue(sealNumber)}
                  onManualConfirm={(sealNumber) => setSealEditValue(sealNumber)}
                  isDisabled={sealNumbersLocked}
                />
              ) : null}
              <Button
                variant="outline"
                onClick={() => void handleAssignSealNumberForLot(sealEditDrawerLot!, undefined, true)}
                isDisabled={sealNumbersLocked || !sealEditDrawerLot}
              >
                Generate seal no
              </Button>
            </HStack>

            {sealNumbersLocked ? (
              <ExceptionBanner
                title="Seal is locked"
                description="Manager/admin pass has been completed, so this seal number can no longer be edited."
                status="info"
              />
            ) : null}
          </VStack>
        </QuickEditDrawer>

        <QuickEditDrawer
          isOpen={sealDownloadDrawerOpen}
          onClose={() => setSealDownloadDrawerOpen(false)}
          title="Download seal stickers"
          onSave={() => void handleDownloadSealStickers()}
          isSaving={downloadingSealStickers}
          saveLabel="Download PDF"
        >
          <VStack align="stretch" spacing={4}>
            <Text fontSize="sm" color="text.secondary">
              Configure the sticker sheet for your printer. Barcode labels stay machine-readable for scanner-based seal checks.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel>Barcodes per row</FormLabel>
                <Select value={sealDownloadColumns} onChange={(event) => setSealDownloadColumns(event.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Page size</FormLabel>
                <Select value={sealDownloadPageSize} onChange={(event) => setSealDownloadPageSize(event.target.value)}>
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="A6">A6 / Thermal label</option>
                  <option value="LETTER">Letter</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Printer type</FormLabel>
                <Select
                  value={sealDownloadPrinterType}
                  onChange={(event) => setSealDownloadPrinterType(event.target.value as "THERMAL" | "INKJET" | "OTHER")}
                >
                  <option value="THERMAL">Thermal label printer</option>
                  <option value="INKJET">Inkjet printer</option>
                  <option value="OTHER">Other printer</option>
                </Select>
              </FormControl>
            </SimpleGrid>
          </VStack>
        </QuickEditDrawer>

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
        <input
          ref={sampleProofFileRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUploadHomogenizedSamplePhoto(file);
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
