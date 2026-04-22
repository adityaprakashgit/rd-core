"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  Tab,
  TabList,
  Tabs,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Lock, Package, Play } from "lucide-react";
import { PageActionBar, PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import { ProcessFlowLayout } from "@/components/enterprise/PageTemplates";
import { PlaygroundMissionPanel } from "@/components/playground/PlaygroundMissionPanel";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useRouter, useSearchParams } from "next/navigation";

type PlaygroundStatus =
  | "BUILDING"
  | "READY_TO_RUN"
  | "RUNNING"
  | "STEPS_COMPLETED"
  | "TRIALS_IN_PROGRESS"
  | "RESULT_SELECTED"
  | "LOCKED";

type StepStatus = "DRAFT" | "READY" | "RUNNING" | "DONE";

type ResourceType = "CHEMICAL" | "ASSET";

type TrialStatus = "Draft" | "Incomplete" | "Complete" | "Selected";

type StepMaster = {
  id: string;
  name: string;
  defaultDurationSeconds: number;
  requiresTimer: boolean;
  allowsChemicals: boolean;
  allowsAssets: boolean;
  requiresAsset: boolean;
  ownerRole: "TECHNICIAN" | "REVIEWER" | "SUPERVISOR";
  reminderRule: "NEXT_OWNER" | "OWNER" | "SUPERVISOR" | "NONE";
};

type ProcessTemplate = {
  id: string;
  name: string;
  description: string;
  stageIds: string[];
  reminderMode: string;
};

type Chemical = {
  id: string;
  name: string;
  code: string;
  category: string;
  baseUnit: "ml" | "g";
  allowedUnits: string[];
  stockQuantity: number;
  reorderThreshold: number;
  isActive: boolean;
};

type Asset = {
  id: string;
  name: string;
  code: string;
  category: string;
  availabilityStatus: "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "UNAVAILABLE";
  isActive: boolean;
};

type Packet = {
  id: string;
  code: string;
  quantity: number;
  status: "READY" | "USED";
};

type StepResource = {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  quantity?: number;
  unit?: string;
  usageNotes?: string;
};

type ExperimentStep = {
  id: string;
  stepMasterId: string;
  name: string;
  orderNo: number;
  durationSeconds: number;
  requiresTimer: boolean;
  allowsChemicals: boolean;
  allowsAssets: boolean;
  requiresAsset: boolean;
  ownerRole: "TECHNICIAN" | "REVIEWER" | "SUPERVISOR";
  reminderRule: "NEXT_OWNER" | "OWNER" | "SUPERVISOR" | "NONE";
  status: StepStatus;
  instructions: string;
  notes: string;
  dueMinutes: number;
  timerStartedAt: number | null;
  resources: StepResource[];
};

type Measurement = {
  id: string;
  elementCode: string;
  value: string;
  unit: string;
  remarks: string;
};

type ReminderEvent = {
  id: string;
  title: string;
  subtitle: string;
  at: string;
};

type ResultMetric = {
  code: string;
  label: string;
  unit: string;
};

type ProcessResultSummary = {
  niRecovery: string;
  coRecovery: string;
  liRecovery: string;
  purity: string;
  yield: string;
  massBalance: string;
  decision: string;
};

type Trial = {
  id: string;
  packetId: string;
  packetCode: string;
  trialNo: number;
  status: TrialStatus;
  measurements: Measurement[];
};

type AcceptedWorkRow = {
  id: string;
  rndJobNumber: string;
  parentJobNumber: string;
  sampleId: string;
  packetId: string;
  childRole: string;
  packetWeight: string;
  packetUse: string;
  receivedDate: string;
  assignedUser: string;
  priority: string;
  dueStatus: string;
  currentStep: string;
  primaryAction: string;
  bucket: "PENDING_INTAKE" | "READY_FOR_SETUP" | "IN_TESTING" | "AWAITING_REVIEW" | "COMPLETED";
};

type AcceptedWorkSummary = {
  total: number;
  pendingIntake: number;
  readyForSetup: number;
  inTesting: number;
  awaitingReview: number;
  completed: number;
};

type Selection =
  | { type: "STEP"; id: string }
  | { type: "TRIAL"; id: string }
  | { type: "VALIDATION" }
  | null;

type DragPayload =
  | { kind: "STEP_MASTER"; id: string }
  | { kind: "CHEMICAL"; id: string }
  | { kind: "ASSET"; id: string }
  | { kind: "PACKET"; id: string };

const processStepMasters: StepMaster[] = [
  {
    id: "sample-intake",
    name: "Sample Intake & Custody",
    defaultDurationSeconds: 600,
    requiresTimer: false,
    allowsChemicals: false,
    allowsAssets: false,
    requiresAsset: false,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "sample-characterization",
    name: "Sample Characterization",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: false,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "pre-treatment",
    name: "Pre-treatment",
    defaultDurationSeconds: 600,
    requiresTimer: false,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "OWNER",
  },
  {
    id: "leaching",
    name: "Leaching",
    defaultDurationSeconds: 1200,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "solid-liquid-separation",
    name: "Solid-Liquid Separation",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: false,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "impurity-removal",
    name: "Impurity Removal",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "ni-co-separation",
    name: "Ni / Co Separation",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "SUPERVISOR",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "li-recovery",
    name: "Lithium Recovery",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "purification",
    name: "Purification & Polishing",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "SUPERVISOR",
    reminderRule: "OWNER",
  },
  {
    id: "concentration",
    name: "Concentration / Crystallization",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: false,
    allowsAssets: true,
    requiresAsset: true,
    ownerRole: "TECHNICIAN",
    reminderRule: "NEXT_OWNER",
  },
  {
    id: "quality-check",
    name: "Product Quality Check",
    defaultDurationSeconds: 600,
    requiresTimer: false,
    allowsChemicals: false,
    allowsAssets: false,
    requiresAsset: false,
    ownerRole: "REVIEWER",
    reminderRule: "SUPERVISOR",
  },
  {
    id: "release",
    name: "Release / Archive",
    defaultDurationSeconds: 300,
    requiresTimer: false,
    allowsChemicals: false,
    allowsAssets: false,
    requiresAsset: false,
    ownerRole: "REVIEWER",
    reminderRule: "NONE",
  },
];

const wholeProcessTemplates: ProcessTemplate[] = [
  {
    id: "hydromet-ni-co-li",
    name: "Hydromet Ni / Co / Li Path",
    description: "Full controlled preparation, extraction, separation, quality, and release sequence.",
    stageIds: processStepMasters.map((step) => step.id),
    reminderMode: "Notify the next owner on every step completion.",
  },
  {
    id: "sample-process-control",
    name: "Sample Process Control",
    description: "Intake, prep, preflight, processing, review, and release in a compact control path.",
    stageIds: [
      "sample-intake",
      "sample-characterization",
      "pre-treatment",
      "quality-check",
      "release",
    ],
    reminderMode: "Notify the owner and supervisor when a step finishes.",
  },
];

const hydrometResultMetrics: ResultMetric[] = [
  { code: "NI_RECOVERY", label: "Ni Recovery", unit: "%" },
  { code: "CO_RECOVERY", label: "Co Recovery", unit: "%" },
  { code: "LI_RECOVERY", label: "Li Recovery", unit: "%" },
  { code: "PURITY", label: "Purity", unit: "%" },
  { code: "YIELD", label: "Yield", unit: "%" },
  { code: "MASS_BALANCE", label: "Mass Balance", unit: "%" },
  { code: "DECISION", label: "Decision", unit: "text" },
];

const chemicalsMaster: Chemical[] = [
  {
    id: "ch-1",
    name: "Sulfuric Acid",
    code: "CHEM-SA",
    category: "Acids",
    baseUnit: "ml",
    allowedUnits: ["ml", "l"],
    stockQuantity: 4200,
    reorderThreshold: 1000,
    isActive: true,
  },
  {
    id: "ch-2",
    name: "Distilled Water",
    code: "CHEM-DW",
    category: "Solvents",
    baseUnit: "ml",
    allowedUnits: ["ml", "l"],
    stockQuantity: 15000,
    reorderThreshold: 2000,
    isActive: true,
  },
  {
    id: "ch-3",
    name: "Indicator Solution",
    code: "CHEM-IND",
    category: "Indicators",
    baseUnit: "ml",
    allowedUnits: ["ml"],
    stockQuantity: 120,
    reorderThreshold: 150,
    isActive: true,
  },
];

const assetsMaster: Asset[] = [
  {
    id: "as-1",
    name: "Reactor 01",
    code: "AST-R01",
    category: "Reaction",
    availabilityStatus: "AVAILABLE",
    isActive: true,
  },
  {
    id: "as-2",
    name: "Stirrer 02",
    code: "AST-ST02",
    category: "Mixing",
    availabilityStatus: "AVAILABLE",
    isActive: true,
  },
  {
    id: "as-3",
    name: "Filtration Unit",
    code: "AST-FU1",
    category: "Filtration",
    availabilityStatus: "MAINTENANCE",
    isActive: true,
  },
];

const initialPackets: Packet[] = [
  { id: "pk-1", code: "PKT-001", quantity: 1, status: "READY" },
  { id: "pk-2", code: "PKT-002", quantity: 1, status: "READY" },
  { id: "pk-3", code: "PKT-003", quantity: 1, status: "READY" },
];

function decodeDrag(raw: string): DragPayload | null {
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getChemicalStockState(chemical: Chemical) {
  if (chemical.stockQuantity <= 0) return "Out of Stock";
  if (chemical.stockQuantity <= chemical.reorderThreshold) return "Low Stock";
  return "In Stock";
}

function unitToBaseFactor(baseUnit: "ml" | "g", unit: string) {
  if (baseUnit === "ml") {
    if (unit === "ml") return 1;
    if (unit === "l") return 1000;
    if (unit === "oz") return 29.5735;
    return null;
  }
  if (baseUnit === "g") {
    if (unit === "mg") return 0.001;
    if (unit === "g") return 1;
    if (unit === "kg") return 1000;
    return null;
  }
  return null;
}

function mapTrialStatus(measurements: Measurement[], selected: boolean): TrialStatus {
  if (selected) return "Selected";
  if (measurements.length === 0) return "Draft";
  const hasMissing = measurements.some((m) => !m.elementCode.trim() || !m.value.trim() || !m.unit.trim());
  return hasMissing ? "Incomplete" : "Complete";
}

function isTrialComplete(measurements: Measurement[]) {
  if (measurements.length === 0) return false;
  return measurements.every((m) => m.elementCode.trim() && m.value.trim() && m.unit.trim());
}

function stepStatusLabel(status: ExperimentStep["status"]) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "READY":
      return "Ready";
    case "RUNNING":
      return "Running";
    case "DONE":
      return "Done";
    default:
      return status;
  }
}

const PLAYGROUND_PHASE_LABELS: Record<PlaygroundStatus, string> = {
  BUILDING: "Building process",
  READY_TO_RUN: "Ready to run",
  RUNNING: "Running",
  STEPS_COMPLETED: "Steps complete",
  TRIALS_IN_PROGRESS: "Result capture",
  RESULT_SELECTED: "Ready to release",
  LOCKED: "Archived",
};

const PLAYGROUND_FLOW_STEP_LABELS = [
  "Build process",
  "Validate",
  "Run process",
  "Capture results",
  "Review release",
  "Archive",
] as const;

const PLAYGROUND_FLOW_STEP_STATUSES: PlaygroundStatus[] = [
  "BUILDING",
  "READY_TO_RUN",
  "RUNNING",
  "TRIALS_IN_PROGRESS",
  "RESULT_SELECTED",
  "LOCKED",
];

const PLAYGROUND_FLOW_STEP_INDEX: Record<PlaygroundStatus, number> = {
  BUILDING: 0,
  READY_TO_RUN: 1,
  RUNNING: 2,
  STEPS_COMPLETED: 3,
  TRIALS_IN_PROGRESS: 4,
  RESULT_SELECTED: 5,
  LOCKED: 5,
};

function buildHydrometResultSummary(trial: Trial | null): ProcessResultSummary {
  const metrics = new Map(
    (trial?.measurements ?? []).map((measurement) => [measurement.elementCode.trim().toUpperCase(), measurement.value.trim()])
  );

  return {
    niRecovery: metrics.get("NI_RECOVERY") ?? "-",
    coRecovery: metrics.get("CO_RECOVERY") ?? "-",
    liRecovery: metrics.get("LI_RECOVERY") ?? "-",
    purity: metrics.get("PURITY") ?? "-",
    yield: metrics.get("YIELD") ?? "-",
    massBalance: metrics.get("MASS_BALANCE") ?? "-",
    decision: metrics.get("DECISION") ?? "-",
  };
}

function buildReminderEvent(step: ExperimentStep, nextStep: ExperimentStep | null): ReminderEvent {
  return {
    id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: `${step.name} completed`,
    subtitle: nextStep
      ? `Notify ${nextStep.ownerRole.toLowerCase()} to begin ${nextStep.name}.`
      : "Notify reviewer to release the completed sample record.",
    at: new Date().toLocaleString(),
  };
}

function normalizeStep(step: Partial<ExperimentStep>, index: number): ExperimentStep {
  const stepMaster = processStepMasters.find((item) => item.id === step.stepMasterId) ?? null;
  const durationSeconds = step.durationSeconds ?? stepMaster?.defaultDurationSeconds ?? 600;
  return {
    id: step.id ?? `step-${Date.now()}-${index}`,
    stepMasterId: step.stepMasterId ?? stepMaster?.id ?? "sample-intake",
    name: step.name ?? stepMaster?.name ?? "Sample Step",
    orderNo: step.orderNo ?? index + 1,
    durationSeconds,
    requiresTimer: step.requiresTimer ?? stepMaster?.requiresTimer ?? false,
    allowsChemicals: step.allowsChemicals ?? stepMaster?.allowsChemicals ?? false,
    allowsAssets: step.allowsAssets ?? stepMaster?.allowsAssets ?? false,
    requiresAsset: step.requiresAsset ?? stepMaster?.requiresAsset ?? false,
    ownerRole: step.ownerRole ?? stepMaster?.ownerRole ?? "TECHNICIAN",
    reminderRule: step.reminderRule ?? stepMaster?.reminderRule ?? "NEXT_OWNER",
    status: step.status ?? "DRAFT",
    instructions: step.instructions ?? "",
    notes: step.notes ?? "",
    dueMinutes: step.dueMinutes ?? Math.max(15, Math.round(durationSeconds / 60)),
    timerStartedAt: step.timerStartedAt ?? null,
    resources: Array.isArray(step.resources) ? step.resources : [],
  };
}

function normalizeMeasurement(measurement: Partial<Measurement>, index: number): Measurement {
  return {
    id: measurement.id ?? `ms-${Date.now()}-${index}`,
    elementCode: measurement.elementCode ?? hydrometResultMetrics[0].code,
    value: measurement.value ?? "",
    unit: measurement.unit ?? hydrometResultMetrics[0].unit,
    remarks: measurement.remarks ?? "",
  };
}

function normalizeTrial(trial: Partial<Trial>, index: number): Trial {
  const measurements = Array.isArray(trial.measurements)
    ? trial.measurements.map((measurement, measurementIndex) => normalizeMeasurement(measurement, measurementIndex))
    : [];

  return {
    id: trial.id ?? `trial-${Date.now()}-${index}`,
    packetId: trial.packetId ?? "",
    packetCode: trial.packetCode ?? "",
    trialNo: trial.trialNo ?? index + 1,
    status: trial.status ?? "Draft",
    measurements,
  };
}

function PlaygroundPageContent() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [nowTick, setNowTick] = useState(0);
  const [jobId, setJobId] = useState<string>("");
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [savingBoard, setSavingBoard] = useState(false);
  const [loadingAcceptedWork, setLoadingAcceptedWork] = useState(true);
  const [acceptedWork, setAcceptedWork] = useState<AcceptedWorkRow[]>([]);
  const [acceptedWorkSummary, setAcceptedWorkSummary] = useState<AcceptedWorkSummary | null>(null);
  const [acceptedWorkError, setAcceptedWorkError] = useState<string | null>(null);
  const [activeFlowStepIndex, setActiveFlowStepIndex] = useState(0);

  const [playgroundStatus, setPlaygroundStatus] = useState<PlaygroundStatus>("BUILDING");
  const [steps, setSteps] = useState<ExperimentStep[]>([]);
  const [packets, setPackets] = useState<Packet[]>(initialPackets);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string | null>(null);
  const [reminderEvents, setReminderEvents] = useState<ReminderEvent[]>([]);

  const selectedStep = useMemo(() => {
    if (!selection || selection.type !== "STEP") return null;
    return steps.find((step) => step.id === selection.id) ?? null;
  }, [selection, steps]);

  const selectedTrial = useMemo(() => {
    if (!selection || selection.type !== "TRIAL") return null;
    return trials.find((trial) => trial.id === selection.id) ?? null;
  }, [selection, trials]);

  const processResultSummary = useMemo(() => buildHydrometResultSummary(selectedTrial ?? trials.find((trial) => trial.id === selectedTrialId) ?? trials[0] ?? null), [selectedTrial, selectedTrialId, trials]);

  const selectedAcceptedWork = useMemo(
    () => acceptedWork.find((row) => row.id === jobId) ?? null,
    [acceptedWork, jobId],
  );
  const activeFlowStatus = useMemo(
    () => PLAYGROUND_FLOW_STEP_STATUSES[activeFlowStepIndex] ?? playgroundStatus,
    [activeFlowStepIndex, playgroundStatus],
  );

  const allStepsDone = useMemo(() => steps.length > 0 && steps.every((s) => s.status === "DONE"), [steps]);

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => a.orderNo - b.orderNo),
    [steps]
  );

  const isLocked = playgroundStatus === "LOCKED";
  const isBuildMode = playgroundStatus === "BUILDING" || playgroundStatus === "READY_TO_RUN";

  useEffect(() => {
    setActiveFlowStepIndex(PLAYGROUND_FLOW_STEP_INDEX[playgroundStatus]);
  }, [playgroundStatus]);

  const persistBoard = useCallback(
    async (
      nextStatus: PlaygroundStatus,
      action: string,
      nextData?: {
        steps?: ExperimentStep[];
        trials?: Trial[];
        packets?: Packet[];
        selectedTrialId?: string | null;
        selectedProcessTemplateId?: string | null;
        reminders?: ReminderEvent[];
      }
    ) => {
      if (!jobId) return;

      const payload = {
        jobId,
        status: nextStatus,
        action,
        board: {
          steps: nextData?.steps ?? steps,
          trials: nextData?.trials ?? trials,
          packets: nextData?.packets ?? packets,
          selectedTrialId: nextData?.selectedTrialId ?? selectedTrialId,
          selectedProcessTemplateId: nextData?.selectedProcessTemplateId ?? selectedProcessTemplateId,
          reminders: nextData?.reminders ?? reminderEvents,
        },
      };

      setSavingBoard(true);
      try {
        const res = await fetch("/api/rd/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error("Persist failed");
        }
      } catch {
        toast({ title: "Workspace save failed", status: "error" });
      } finally {
        setSavingBoard(false);
      }
    },
    [jobId, packets, reminderEvents, selectedProcessTemplateId, selectedTrialId, steps, toast, trials]
  );

  const loadAcceptedWork = useCallback(async () => {
    setLoadingAcceptedWork(true);
    setAcceptedWorkError(null);
    try {
      const res = await fetch("/api/rnd/jobs");
      if (!res.ok) {
        throw new Error("Failed to load accepted work queue");
      }
      const payload = (await res.json()) as {
        rows?: Array<Record<string, unknown>>;
        summary?: AcceptedWorkSummary;
      };
      const mapped: AcceptedWorkRow[] = (payload.rows ?? [])
        .map((row) => ({
          id: String(row.id ?? ""),
          rndJobNumber: String(row.rndJobNumber ?? "-"),
          parentJobNumber: String((row.parentJob as { inspectionSerialNumber?: string } | null)?.inspectionSerialNumber ?? "-"),
          sampleId: String((row.sample as { sampleCode?: string } | null)?.sampleCode ?? "-"),
          packetId: String((row.packet as { packetCode?: string } | null)?.packetCode ?? "-"),
          childRole: String(row.previousRndJobId ? "Retest child" : "Initial child from packet"),
          packetWeight: (() => {
            const packet = row.packet as { packetWeight?: number | null; packetUnit?: string | null } | null;
            return packet?.packetWeight ? `${packet.packetWeight} ${packet.packetUnit ?? ""}`.trim() : "-";
          })(),
          packetUse: String(row.packetUse ?? "-"),
          receivedDate: new Date(String(row.receivedAt ?? "")).toLocaleDateString(),
          assignedUser: String((row.assignedTo as { profile?: { displayName?: string } } | null)?.profile?.displayName ?? "Unassigned"),
          priority: String(row.priority ?? "MEDIUM"),
          dueStatus: String(row.dueStatus ?? "ON_TRACK"),
          currentStep: String(row.currentStep ?? "-"),
          primaryAction: String(row.primaryAction ?? "Open Work"),
          bucket: String(row.bucket ?? "PENDING_INTAKE") as AcceptedWorkRow["bucket"],
        }))
        .filter((row) => row.bucket !== "COMPLETED");
      setAcceptedWork(mapped);
      setAcceptedWorkSummary(payload.summary ?? null);
    } catch (error) {
      setAcceptedWorkError(error instanceof Error ? error.message : "Failed to load accepted work queue");
    } finally {
      setLoadingAcceptedWork(false);
    }
  }, []);

  useEffect(() => {
    void loadAcceptedWork();
  }, [loadAcceptedWork]);

  const logAction = useCallback(
    async (action: string, notes?: string) => {
      if (!jobId) return;
      try {
        await fetch("/api/inspection/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            action,
            entity: "PLAYGROUND",
            notes: notes ?? null,
          }),
        });
      } catch {
        // Ignore audit logging failures on client to keep UX responsive.
      }
    },
    [jobId]
  );

  useEffect(() => {
    if (!steps.some((step) => step.status === "RUNNING" && step.requiresTimer)) {
      return;
    }

    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [steps]);

  useEffect(() => {
    let active = true;

    const loadPlayground = async () => {
      try {
        setLoadingBoard(true);
        const resolvedJobId = searchParams.get("jobId") ?? "";

        if (!resolvedJobId) {
          if (active) {
            setJobId("");
            setPlaygroundStatus("BUILDING");
            setSteps([]);
            setTrials([]);
            setSelectedTrialId(null);
            setSelectedProcessTemplateId(null);
            setReminderEvents([]);
            setSelection(null);
            setValidationErrors([]);
            setPackets([]);
            setLoadingBoard(false);
          }
          return;
        }

        const res = await fetch(`/api/rd/playground?jobId=${encodeURIComponent(resolvedJobId)}`);
        if (!res.ok) {
        throw new Error("Failed to load sample process context");
        }

        const data = (await res.json()) as {
          status?: PlaygroundStatus;
          board?: {
            steps?: ExperimentStep[];
            trials?: Trial[];
            packets?: Packet[];
            selectedTrialId?: string | null;
            selectedProcessTemplateId?: string | null;
            reminders?: ReminderEvent[];
          };
          packets?: Packet[];
          jobId?: string;
        };

        if (!active) return;

        setJobId(data.jobId ?? resolvedJobId);
        setPlaygroundStatus(data.status ?? "BUILDING");
        setSteps(Array.isArray(data.board?.steps) ? data.board.steps.map((step, index) => normalizeStep(step, index)) : []);
        setTrials(Array.isArray(data.board?.trials) ? data.board.trials.map((trial, index) => normalizeTrial(trial, index)) : []);
        setSelectedTrialId(typeof data.board?.selectedTrialId === "string" ? data.board.selectedTrialId : null);
        setSelectedProcessTemplateId(typeof data.board?.selectedProcessTemplateId === "string" ? data.board.selectedProcessTemplateId : null);
        setReminderEvents(Array.isArray(data.board?.reminders) ? data.board.reminders : []);
        setPackets(
          Array.isArray(data.board?.packets)
            ? data.board.packets
            : Array.isArray(data.packets) && data.packets.length > 0
              ? data.packets.map((packet) => ({ ...packet, status: "READY" as const }))
              : initialPackets
        );
      } catch {
        if (active) {
          toast({ title: "Failed to load sample process", status: "error" });
        }
      } finally {
        if (active) {
          setLoadingBoard(false);
        }
      }
    };

    void loadPlayground();
    return () => {
      active = false;
    };
  }, [searchParams, toast]);

  const addStepFromMaster = (stepMasterId: string) => {
    if (!isBuildMode || isLocked) return false;

    const stepMaster = processStepMasters.find((item) => item.id === stepMasterId);
    if (!stepMaster) return false;

    setSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        stepMasterId: stepMaster.id,
        name: stepMaster.name,
        orderNo: prev.length + 1,
        durationSeconds: stepMaster.defaultDurationSeconds,
        requiresTimer: stepMaster.requiresTimer,
        allowsChemicals: stepMaster.allowsChemicals,
        allowsAssets: stepMaster.allowsAssets,
        requiresAsset: stepMaster.requiresAsset,
        ownerRole: stepMaster.ownerRole,
        reminderRule: stepMaster.reminderRule,
        status: "DRAFT",
        instructions: "",
        notes: "",
        dueMinutes: Math.max(15, Math.round(stepMaster.defaultDurationSeconds / 60)),
        timerStartedAt: null,
        resources: [],
      },
    ]);
    void logAction("PLAYGROUND_STEP_ADD", stepMaster.name);
    return true;
  };

  const applyWholeProcessTemplate = useCallback(
    (templateId: string) => {
      if (!isBuildMode || isLocked) return false;

      const template = wholeProcessTemplates.find((item) => item.id === templateId);
      if (!template) return false;

      const nextSteps: ExperimentStep[] = template.stageIds.flatMap((stageId, index) => {
        const stepMaster = processStepMasters.find((item) => item.id === stageId);
        if (!stepMaster) return [];

        return [
          {
            id: `step-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
            stepMasterId: stepMaster.id,
            name: stepMaster.name,
            orderNo: index + 1,
            durationSeconds: stepMaster.defaultDurationSeconds,
            requiresTimer: stepMaster.requiresTimer,
            allowsChemicals: stepMaster.allowsChemicals,
            allowsAssets: stepMaster.allowsAssets,
            requiresAsset: stepMaster.requiresAsset,
            ownerRole: stepMaster.ownerRole,
            reminderRule: stepMaster.reminderRule,
            status: "DRAFT" as StepStatus,
            instructions: "",
            notes: "",
            dueMinutes: Math.max(15, Math.round(stepMaster.defaultDurationSeconds / 60)),
            timerStartedAt: null,
            resources: [],
          } satisfies ExperimentStep,
        ];
      });

      setSteps(nextSteps);
      setSelectedProcessTemplateId(template.id);
      setReminderEvents([]);
      setSelection(null);
      setValidationErrors([]);
      setPlaygroundStatus("BUILDING");
      void logAction("PLAYGROUND_PROCESS_TEMPLATE_APPLY", template.name);
      void persistBoard("BUILDING", "PLAYGROUND_PROCESS_TEMPLATE_APPLY", {
        steps: nextSteps,
        selectedProcessTemplateId: template.id,
        reminders: [],
      });
      toast({ title: "Whole process applied", status: "success" });
      return true;
    },
    [isBuildMode, isLocked, logAction, persistBoard, toast]
  );

  const addChemicalToStep = (stepId: string, chemicalId: string) => {
    if (!isBuildMode || isLocked) return false;

    const chemical = chemicalsMaster.find((item) => item.id === chemicalId);
    if (!chemical || !chemical.isActive) {
      toast({ title: "Chemical is inactive/invalid.", status: "error" });
      return false;
    }

    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        if (!step.allowsChemicals) {
          toast({ title: `${step.name} does not allow chemicals.`, status: "error" });
          return step;
        }

        const existing = step.resources.some(
          (resource) => resource.resourceType === "CHEMICAL" && resource.resourceId === chemicalId
        );
        if (existing) return step;

        void logAction("PLAYGROUND_CHEMICAL_ASSIGN", `${chemical.name} -> ${step.name}`);
        return {
          ...step,
          resources: [
            ...step.resources,
            {
              id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              resourceType: "CHEMICAL",
              resourceId: chemical.id,
              quantity: 0,
              unit: chemical.allowedUnits[0],
              usageNotes: "",
            },
          ],
        };
      })
    );
    return true;
  };

  const addAssetToStep = (stepId: string, assetId: string) => {
    if (!isBuildMode || isLocked) return false;

    const asset = assetsMaster.find((item) => item.id === assetId);
    if (!asset || !asset.isActive) {
      toast({ title: "Asset is inactive/invalid.", status: "error" });
      return false;
    }

    if (asset.availabilityStatus !== "AVAILABLE") {
      toast({ title: `${asset.name} is not available.`, status: "warning" });
      return false;
    }

    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        if (!step.allowsAssets) {
          toast({ title: `${step.name} does not allow assets.`, status: "error" });
          return step;
        }

        const existing = step.resources.some(
          (resource) => resource.resourceType === "ASSET" && resource.resourceId === assetId
        );
        if (existing) return step;

        void logAction("PLAYGROUND_ASSET_ASSIGN", `${asset.name} -> ${step.name}`);
        return {
          ...step,
          resources: [
            ...step.resources,
            {
              id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              resourceType: "ASSET",
              resourceId: asset.id,
              usageNotes: "",
            },
          ],
        };
      })
    );
    return true;
  };

  const createTrialFromPacket = useCallback(
    (packetId: string) => {
      if (playgroundStatus !== "STEPS_COMPLETED" && playgroundStatus !== "TRIALS_IN_PROGRESS" && playgroundStatus !== "RESULT_SELECTED") {
        toast({ title: "Result capture is locked until all steps are complete.", status: "warning" });
        return false;
      }

      const packet = packets.find((item) => item.id === packetId);
      if (!packet || packet.status !== "READY") {
        toast({ title: "Packet unavailable.", status: "error" });
        return false;
      }

      const nextPackets = packets.map((item) => (item.id === packetId ? { ...item, status: "USED" as const } : item));
      const nextTrial: Trial = {
        id: `trial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        packetId: packet.id,
        packetCode: packet.code,
        trialNo: trials.length + 1,
        status: "Draft",
        measurements: [],
      };
      const nextTrials = [...trials, nextTrial];

      setPackets(nextPackets);
      setTrials(nextTrials);

      setPlaygroundStatus("TRIALS_IN_PROGRESS");
      void logAction("PLAYGROUND_RESULT_CREATE", packet.code);
      void persistBoard("TRIALS_IN_PROGRESS", "PLAYGROUND_TRIAL_CREATE", {
        packets: nextPackets,
        trials: nextTrials,
        selectedProcessTemplateId,
        reminders: reminderEvents,
      });
      toast({ title: "Result record created", status: "success" });
      return true;
    },
    [packets, persistBoard, playgroundStatus, reminderEvents, selectedProcessTemplateId, toast, trials, logAction]
  );

  const runBuildValidation = () => {
    const errors: string[] = [];

    if (steps.length === 0) {
      errors.push("At least one step is required.");
    }

    const orderNos = steps.map((s) => s.orderNo).sort((a, b) => a - b);
    for (let i = 0; i < orderNos.length; i += 1) {
      if (orderNos[i] !== i + 1) {
        errors.push("Step order must be continuous and start from 1.");
        break;
      }
    }

    steps.forEach((step) => {
      if (step.requiresTimer && step.durationSeconds <= 0) {
        errors.push(`Step ${step.orderNo}: duration must be greater than 0.`);
      }

      if (step.dueMinutes <= 0) {
        errors.push(`Step ${step.orderNo}: due minutes must be greater than 0.`);
      }

      const chemicalResources = step.resources.filter((r) => r.resourceType === "CHEMICAL");
      const assetResources = step.resources.filter((r) => r.resourceType === "ASSET");

      if (step.requiresAsset && assetResources.length === 0) {
        errors.push(`Step ${step.orderNo}: asset assignment is mandatory.`);
      }

      chemicalResources.forEach((resource) => {
        const quantity = resource.quantity ?? 0;
        if (quantity <= 0) {
          errors.push(`Step ${step.orderNo}: chemical quantity must be greater than 0.`);
          return;
        }

        const chemical = chemicalsMaster.find((c) => c.id === resource.resourceId);
        if (!chemical) {
          errors.push(`Step ${step.orderNo}: invalid chemical reference.`);
          return;
        }

        if (!resource.unit || !chemical.allowedUnits.includes(resource.unit)) {
          errors.push(`Step ${step.orderNo}: invalid unit for ${chemical.name}.`);
          return;
        }

        const factor = unitToBaseFactor(chemical.baseUnit, resource.unit);
        if (!factor) {
          errors.push(`Step ${step.orderNo}: unsupported conversion for ${chemical.name}.`);
          return;
        }

        const requestedBase = quantity * factor;
        if (requestedBase > chemical.stockQuantity) {
          errors.push(`Step ${step.orderNo}: insufficient stock for ${chemical.name}.`);
        }
      });

      assetResources.forEach((resource) => {
        const asset = assetsMaster.find((a) => a.id === resource.resourceId);
        if (!asset || !asset.isActive) {
          errors.push(`Step ${step.orderNo}: invalid/inactive asset.`);
          return;
        }
        if (asset.availabilityStatus !== "AVAILABLE") {
          errors.push(`Step ${step.orderNo}: ${asset.name} is not available.`);
        }
      });
    });

    setValidationErrors(errors);
    setSelection({ type: "VALIDATION" });

    if (errors.length === 0) {
      setPlaygroundStatus("READY_TO_RUN");
      void logAction("PLAYGROUND_VALIDATE_PASS");
      void persistBoard("READY_TO_RUN", "PLAYGROUND_VALIDATE_PASS", {
        selectedProcessTemplateId,
        reminders: reminderEvents,
      });
      toast({ title: "Build valid", status: "success" });
      return true;
    }

    void logAction("PLAYGROUND_VALIDATE_FAIL", `${errors.length} issue(s)`);
    toast({
      title: "Validation blocked",
      description: `${errors.length} issue(s) must be resolved before execution.`,
      status: "warning",
    });
    return false;
  };

  const onCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payload = decodeDrag(event.dataTransfer.getData("text/plain"));
    if (!payload || payload.kind !== "STEP_MASTER") return;
    void addStepFromMaster(payload.id);
  };

  const onStepDrop = (event: React.DragEvent<HTMLDivElement>, stepId: string) => {
    event.preventDefault();
    const payload = decodeDrag(event.dataTransfer.getData("text/plain"));
    if (!payload) return;
    if (payload.kind === "CHEMICAL") {
      void addChemicalToStep(stepId, payload.id);
      return;
    }

    if (payload.kind === "ASSET") {
      void addAssetToStep(stepId, payload.id);
    }
  };

  const startExecution = () => {
    if (!runBuildValidation()) return;

    const nextSteps = [...steps]
      .sort((a, b) => a.orderNo - b.orderNo)
      .map((step, index) => ({
        ...step,
        status: (index === 0 ? "READY" : "DRAFT") as StepStatus,
        timerStartedAt: null,
      }));

    setSteps(nextSteps);
    setPlaygroundStatus("RUNNING");
    void logAction("PLAYGROUND_EXECUTION_START");
    void persistBoard("RUNNING", "PLAYGROUND_EXECUTION_START", {
      steps: nextSteps,
      selectedProcessTemplateId,
      reminders: reminderEvents,
    });
    toast({ title: "Execution started", status: "success" });
  };

  const getStepRemainingSeconds = (step: ExperimentStep) => {
    if (!step.timerStartedAt || !step.requiresTimer) return step.durationSeconds;
    const elapsed = Math.floor((nowTick - step.timerStartedAt) / 1000);
    const remaining = step.durationSeconds - elapsed;
    return remaining > 0 ? remaining : 0;
  };

  const startStep = (stepId: string) => {
    if (isLocked) return;
    setNowTick(Date.now());

    let started = false;
    let startedStepName = "";
    let nextStepsRef: ExperimentStep[] | null = null;
    setSteps((prev) => {
      const runningExists = prev.some((s) => s.status === "RUNNING");
      if (runningExists) return prev;

      const next = prev.map((step) => {
        if (step.id !== stepId) return step;
        if (step.status !== "READY") return step;
        started = true;
        startedStepName = step.name;
        return {
          ...step,
          status: "RUNNING" as StepStatus,
          timerStartedAt: step.requiresTimer ? Date.now() : null,
        };
      });
      nextStepsRef = next;
      return next;
    });

    if (started) {
      void logAction("PLAYGROUND_STEP_START", startedStepName);
      if (nextStepsRef) {
        void persistBoard(playgroundStatus, "PLAYGROUND_STEP_START", {
          steps: nextStepsRef,
          selectedProcessTemplateId,
          reminders: reminderEvents,
        });
      }
    }
  };

  const completeStep = (stepId: string) => {
    if (isLocked) return;

    let blockedByTimer = false;
    let allDone = false;
    let nextStepsRef: ExperimentStep[] | null = null;
    let reminderRef: ReminderEvent | null = null;
    let nextReminderEvents: ReminderEvent[] = reminderEvents;
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.orderNo - b.orderNo);
      const step = sorted.find((item) => item.id === stepId);
      if (!step || step.status !== "RUNNING") return prev;

      const remaining = getStepRemainingSeconds(step);
      if (step.requiresTimer && remaining > 0) {
        blockedByTimer = true;
        return prev;
      }

      const doneOrder = step.orderNo;

      const next = sorted.map((item) => {
        if (item.id === stepId) {
          return { ...item, status: "DONE" as StepStatus, timerStartedAt: null };
        }

        if (item.orderNo === doneOrder + 1 && item.status === "DRAFT") {
          return { ...item, status: "READY" as StepStatus };
        }

        return item;
      });

      const nowAllDone = next.every((item) => item.status === "DONE");
      if (nowAllDone) {
        allDone = true;
        setPlaygroundStatus("STEPS_COMPLETED");
        const completedStep = next.find((item) => item.id === stepId) ?? step;
        reminderRef = buildReminderEvent(completedStep, null);
      } else {
        const completedStep = next.find((item) => item.id === stepId) ?? step;
        const nextStep = next.find((item) => item.orderNo === doneOrder + 1) ?? null;
        reminderRef = buildReminderEvent(completedStep, nextStep);
      }

      nextStepsRef = next;
      return next;
    });

    if (blockedByTimer) {
      toast({ title: "Timer still running", status: "warning" });
      return;
    }

    void logAction("PLAYGROUND_STEP_COMPLETE");
    if (reminderRef !== null) {
      const reminder: ReminderEvent = reminderRef;
      nextReminderEvents = [reminder, ...reminderEvents].slice(0, 12);
      setReminderEvents(nextReminderEvents);
      toast({ title: reminder.title, description: reminder.subtitle, status: "info" });
    }
    if (nextStepsRef) {
      void persistBoard(allDone ? "STEPS_COMPLETED" : "RUNNING", "PLAYGROUND_STEP_COMPLETE", {
        steps: nextStepsRef,
        selectedProcessTemplateId,
        reminders: nextReminderEvents,
      });
    }
  };

  const updateStepField = (stepId: string, patch: Partial<ExperimentStep>) => {
    if (!isBuildMode || isLocked) return;
    setSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
  };

  const updateResource = (
    stepId: string,
    resourceId: string,
    patch: Partial<StepResource>
  ) => {
    if (!isBuildMode || isLocked) return;

    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          resources: step.resources.map((resource) =>
            resource.id === resourceId ? { ...resource, ...patch } : resource
          ),
        };
      })
    );
  };

  const addMeasurement = (trialId: string) => {
    if (isLocked) return;
    setTrials((prev) =>
      prev.map((trial) => {
        if (trial.id !== trialId) return trial;
        const nextMeasurements = [
          ...trial.measurements,
          {
            id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            elementCode: hydrometResultMetrics[0].code,
            value: "",
            unit: hydrometResultMetrics[0].unit,
            remarks: "",
          },
        ];
        return {
          ...trial,
          measurements: nextMeasurements,
          status: mapTrialStatus(nextMeasurements, selectedTrialId === trial.id),
        };
      })
    );
  };

  const updateMeasurement = (
    trialId: string,
    measurementId: string,
    patch: Partial<Measurement>
  ) => {
    if (isLocked) return;

    let duplicate = false;
    setTrials((prev) =>
      prev.map((trial) => {
        if (trial.id !== trialId) return trial;

        const nextMeasurements = trial.measurements.map((measurement) =>
          measurement.id === measurementId ? { ...measurement, ...patch } : measurement
        );

        const seen = new Set<string>();
        for (const item of nextMeasurements) {
          const normalized = item.elementCode.trim().toUpperCase();
          if (!normalized) continue;
          if (seen.has(normalized)) {
            duplicate = true;
            break;
          }
          seen.add(normalized);
        }

        return {
          ...trial,
          measurements: nextMeasurements,
          status: mapTrialStatus(nextMeasurements, selectedTrialId === trial.id),
        };
      })
    );

    if (duplicate) {
      toast({ title: "Duplicate measurement element in this trial.", status: "error" });
    }
  };

  const selectFinalTrial = (trialId: string) => {
    if (isLocked) return;

    const selected = trials.find((trial) => trial.id === trialId);
    if (!selected) {
      toast({ title: "Result not found", status: "error" });
      return;
    }

    if (!isTrialComplete(selected.measurements)) {
      setValidationErrors(["Add at least one complete metric before selecting the final result."]);
      setSelection({ type: "VALIDATION" });
      toast({ title: "Result cannot be selected yet", description: "Add complete metrics first.", status: "warning" });
      return;
    }

    const nextTrials = trials.map((trial) => ({
      ...trial,
      status: mapTrialStatus(trial.measurements, trial.id === trialId),
    }));

    setSelectedTrialId(trialId);
    setTrials(nextTrials);
    setPlaygroundStatus("RESULT_SELECTED");
      void logAction("PLAYGROUND_RESULT_SELECT", trialId);
    void persistBoard("RESULT_SELECTED", "PLAYGROUND_RESULT_SELECT", {
      selectedTrialId: trialId,
      trials: nextTrials,
      selectedProcessTemplateId,
      reminders: reminderEvents,
    });
  };

  const lockExperiment = () => {
    if (isLocked) return;

    const issues: string[] = [];

    if (!allStepsDone) issues.push("All steps must be DONE before lock.");
    if (trials.length === 0) issues.push("At least one result record is required before release.");
    if (!selectedTrialId) issues.push("Final result selection is required before release.");

    const selected = trials.find((trial) => trial.id === selectedTrialId);
    if (selected && selected.status !== "Selected") {
      issues.push("Selected result state is invalid.");
    }

    if (selected && !isTrialComplete(selected.measurements)) {
      issues.push("Selected result must have complete metrics.");
    }

    if (issues.length > 0) {
      setValidationErrors(issues);
      setSelection({ type: "VALIDATION" });
      toast({ title: "Lock blocked", description: issues[0], status: "error" });
      return;
    }

    setPlaygroundStatus("LOCKED");
    void logAction("PLAYGROUND_LOCK");
    void persistBoard("LOCKED", "PLAYGROUND_LOCK", {
      selectedProcessTemplateId,
      reminders: reminderEvents,
    });
    toast({ title: "Experiment locked", status: "success" });
  };

  const openMission = useCallback(
    (missionId: string) => {
      router.push(`/playground?jobId=${encodeURIComponent(missionId)}`);
    },
    [router]
  );

  const pagePrimaryAction = !jobId ? (
    <Button colorScheme="teal" leftIcon={<Package size={16} />} onClick={() => openMission(acceptedWork[0]?.id ?? "")} isDisabled={acceptedWork.length === 0 || loadingAcceptedWork}>
      Open Work
    </Button>
  ) : activeFlowStatus === "BUILDING" ? (
    <Button colorScheme="teal" leftIcon={<Package size={16} />} onClick={runBuildValidation} isDisabled={isLocked || loadingBoard}>
      Validate Process
    </Button>
  ) : activeFlowStatus === "READY_TO_RUN" ? (
    <Button colorScheme="teal" leftIcon={<Play size={16} />} onClick={startExecution} isDisabled={!isBuildMode || isLocked || loadingBoard}>
      Start Processing
    </Button>
  ) : activeFlowStatus === "TRIALS_IN_PROGRESS" ? (
    <Button colorScheme="purple" leftIcon={<Package size={16} />} onClick={() => selectedTrialId && selectFinalTrial(selectedTrialId)} isDisabled={!selectedTrialId || isLocked || loadingBoard}>
      Review Results
    </Button>
  ) : activeFlowStatus === "RESULT_SELECTED" ? (
    <Button colorScheme="red" leftIcon={<Lock size={16} />} onClick={lockExperiment} isDisabled={isLocked || loadingBoard}>
      Release Record
    </Button>
  ) : (
    <Button colorScheme="red" leftIcon={<Lock size={16} />} onClick={lockExperiment} isDisabled={isLocked || loadingBoard}>
      Release Record
    </Button>
  );

  const pageSecondaryActions = !jobId ? (
    <HStack spacing={2} wrap="wrap">
      <Button variant="outline" onClick={() => void loadAcceptedWork()} isDisabled={loadingAcceptedWork}>
        Refresh Queue
      </Button>
    </HStack>
  ) : activeFlowStatus === "BUILDING" ? (
    <HStack spacing={2} wrap="wrap">
      <Button
        variant="outline"
        onClick={() => persistBoard(playgroundStatus, "PLAYGROUND_SAVE_MANUAL", { selectedProcessTemplateId, reminders: reminderEvents })}
        isDisabled={isLocked || !jobId || loadingBoard}
        isLoading={savingBoard}
      >
        Save Process
      </Button>
      <Button variant="outline" onClick={() => setSelection({ type: "VALIDATION" })} isDisabled={isLocked || validationErrors.length === 0}>
        Review Blockers
      </Button>
    </HStack>
  ) : activeFlowStatus === "READY_TO_RUN" ? (
    <HStack spacing={2} wrap="wrap">
      <Button
        variant="outline"
        onClick={() => persistBoard(playgroundStatus, "PLAYGROUND_SAVE_MANUAL", { selectedProcessTemplateId, reminders: reminderEvents })}
        isDisabled={isLocked || !jobId || loadingBoard}
        isLoading={savingBoard}
      >
        Save Process
      </Button>
      <Button variant="outline" onClick={() => setSelection({ type: "VALIDATION" })} isDisabled={isLocked || validationErrors.length === 0}>
        Review Blockers
      </Button>
    </HStack>
  ) : activeFlowStatus === "RUNNING" ? (
    <HStack spacing={2} wrap="wrap">
      <Button variant="outline" onClick={() => setSelection({ type: "STEP", id: selectedStep?.id ?? orderedSteps[0]?.id ?? "" })} isDisabled={isLocked || orderedSteps.length === 0}>
        Inspect Step
      </Button>
      <Button
        variant="outline"
        onClick={() => persistBoard(playgroundStatus, "PLAYGROUND_SAVE_MANUAL", { selectedProcessTemplateId, reminders: reminderEvents })}
        isDisabled={isLocked || !jobId || loadingBoard}
        isLoading={savingBoard}
      >
        Save Progress
      </Button>
    </HStack>
  ) : activeFlowStatus === "TRIALS_IN_PROGRESS" ? (
    <HStack spacing={2} wrap="wrap">
      <Button
        variant="outline"
        onClick={() => persistBoard(playgroundStatus, "PLAYGROUND_SAVE_MANUAL", { selectedProcessTemplateId, reminders: reminderEvents })}
        isDisabled={isLocked || !jobId || loadingBoard}
        isLoading={savingBoard}
      >
        Save Result
      </Button>
      <Button variant="outline" onClick={() => setSelection({ type: "TRIAL", id: selectedTrialId ?? trials[0]?.id ?? "" })} isDisabled={isLocked || trials.length === 0}>
        Review Result
      </Button>
    </HStack>
  ) : activeFlowStatus === "RESULT_SELECTED" ? (
    <HStack spacing={2} wrap="wrap">
      <Button
        variant="outline"
        onClick={() => persistBoard(playgroundStatus, "PLAYGROUND_SAVE_MANUAL", { selectedProcessTemplateId, reminders: reminderEvents })}
        isDisabled={isLocked || !jobId || loadingBoard}
        isLoading={savingBoard}
      >
        Save Release
      </Button>
      <Button variant="outline" onClick={() => setSelection({ type: "TRIAL", id: selectedTrialId ?? trials[0]?.id ?? "" })} isDisabled={isLocked || trials.length === 0}>
        Inspect Result
      </Button>
    </HStack>
  ) : (
    <HStack spacing={2} wrap="wrap" />
  );

  const selectedStepChemicals = selectedStep
    ? selectedStep.resources.filter((resource) => resource.resourceType === "CHEMICAL")
    : [];
  const selectedStepAssets = selectedStep
    ? selectedStep.resources.filter((resource) => resource.resourceType === "ASSET")
    : [];
  const currentMission = selectedAcceptedWork;
  const activePacket = currentMission ? packets.find((packet) => packet.code === currentMission.packetId) ?? packets[0] ?? null : null;
  const phaseContext = !jobId ? (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Accepted Sample Work
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Queue
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {loadingAcceptedWork ? "Loading queue" : `${acceptedWork.length} in queue`}
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Open a job from the queue
        </Text>
      </Box>
    </VStack>
  ) : activeFlowStatus === "BUILDING" ? (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Build process
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Process template
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {selectedProcessTemplateId ? wholeProcessTemplates.find((template) => template.id === selectedProcessTemplateId)?.name ?? "Applied template" : "None applied"}
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Apply a template or add steps, then validate
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Blockers
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {validationErrors.length > 0 ? `${validationErrors.length} blocker(s)` : "No blockers detected"}
        </Text>
      </Box>
    </VStack>
  ) : activeFlowStatus === "READY_TO_RUN" ? (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Validate
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Process template
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {selectedProcessTemplateId ? wholeProcessTemplates.find((template) => template.id === selectedProcessTemplateId)?.name ?? "Applied template" : "None applied"}
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Review blockers and start processing
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Blockers
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {validationErrors.length > 0 ? `${validationErrors.length} blocker(s)` : "No blockers detected"}
        </Text>
      </Box>
    </VStack>
  ) : activeFlowStatus === "RUNNING" ? (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Run process
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current step
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {selectedStep ? `#${selectedStep.orderNo} · ${selectedStep.name} · ${stepStatusLabel(selectedStep.status)}` : "Select a step to inspect"}
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Start or complete the active step
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Completion reminders
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {reminderEvents.length} queued
        </Text>
      </Box>
    </VStack>
  ) : activeFlowStatus === "TRIALS_IN_PROGRESS" ? (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Capture results
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Active packet
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {activePacket ? `${activePacket.code} · ${activePacket.status}` : "No packet loaded"}
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Create one result, then add metrics
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Result selection
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {selectedTrial ? `Result #${selectedTrial.trialNo} selected` : `${trials.length} result record(s)`} 
        </Text>
      </Box>
    </VStack>
  ) : activeFlowStatus === "RESULT_SELECTED" ? (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Review release
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Selected result
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {selectedTrial ? `Result #${selectedTrial.trialNo} · ${selectedTrial.packetCode}` : "No result selected"}
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Release the selected record
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Metrics
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          {selectedTrial ? `${selectedTrial.measurements.length} metric(s)` : "No metrics selected"}
        </Text>
      </Box>
    </VStack>
  ) : (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Current phase
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="text.primary">
          Archived
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Status
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          Locked and read only
        </Text>
      </Box>
      <Box>
        <Text fontSize={{ base: "xs", md: "sm" }} color="text.secondary" textTransform="uppercase" fontWeight="semibold">
          Next action
        </Text>
        <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.primary">
          View the locked record
        </Text>
      </Box>
    </VStack>
  );
  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <PageIdentityBar
          title="Sample Process Control"
          subtitle="Open an accepted sample job, apply a process, validate it, run the steps, then capture and release the result."
          status={
            <HStack spacing={2} flexWrap="wrap">
              <Badge variant="subtle" colorScheme="purple" borderRadius="full" px={2.5} py={1}>
                {PLAYGROUND_PHASE_LABELS[playgroundStatus]}
              </Badge>
              <Badge variant="subtle" colorScheme={isLocked ? "red" : "green"} borderRadius="full" px={2.5} py={1}>
                {isLocked ? "Read only" : "Editable"}
              </Badge>
              {jobId ? (
                <Badge variant="subtle" colorScheme="blue" borderRadius="full" px={2.5} py={1}>
                  Job loaded
                </Badge>
              ) : null}
              <Badge variant="subtle" colorScheme="gray" borderRadius="full" px={2.5} py={1}>
                {loadingAcceptedWork ? "Loading queue" : `${acceptedWork.length} in queue`}
              </Badge>
            </HStack>
          }
        />

        <PageActionBar primaryAction={pagePrimaryAction} secondaryActions={pageSecondaryActions} />

        <ProcessFlowLayout
          header={
            loadingBoard ? (
              <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
                <CardBody p={4}>
                  <Text fontSize={{ base: "sm", md: "md" }} color="text.secondary">
                    Loading sample process context...
                  </Text>
              </CardBody>
            </Card>
          ) : null
          }
          tracker={
            <VStack align="stretch" spacing={3}>
              <Tabs
                variant="line-enterprise"
                index={activeFlowStepIndex}
                onChange={setActiveFlowStepIndex}
                isLazy
              >
                <TabList overflowX="auto" overflowY="hidden">
                  {PLAYGROUND_FLOW_STEP_LABELS.map((label) => (
                    <Tab key={label} whiteSpace="nowrap" fontSize={{ base: "sm", md: "md" }}>
                      {label}
                    </Tab>
                  ))}
                </TabList>
              </Tabs>
            </VStack>
          }
          activeStep={
            <PlaygroundMissionPanel
              playgroundStatus={activeFlowStatus}
              acceptedWorkRows={acceptedWork}
              selectedAcceptedWork={selectedAcceptedWork}
              onOpenMission={openMission}
              loadingAcceptedWork={loadingAcceptedWork}
              acceptedWorkError={acceptedWorkError}
              acceptedWorkSummary={acceptedWorkSummary}
              onRetryAcceptedWork={() => void loadAcceptedWork()}
              stepMasters={processStepMasters}
              processTemplates={wholeProcessTemplates}
              chemicalsMaster={chemicalsMaster}
              assetsMaster={assetsMaster}
              packets={packets}
              reminderEvents={reminderEvents}
              selectedProcessTemplateId={selectedProcessTemplateId}
              onApplyProcessTemplate={applyWholeProcessTemplate}
              processResultSummary={processResultSummary}
              orderedSteps={orderedSteps}
              selectedStep={selectedStep}
              selectedResult={selectedTrial}
              selectedStepChemicals={selectedStepChemicals}
              selectedStepAssets={selectedStepAssets}
              selection={selection}
              selectedResultId={selectedTrialId}
              validationErrors={validationErrors}
              isBuildMode={isBuildMode}
              isLocked={isLocked}
              allStepsDone={allStepsDone}
              onCanvasDrop={onCanvasDrop}
              onStepDrop={onStepDrop}
              startStep={startStep}
              completeStep={completeStep}
              updateStepField={updateStepField}
              updateResource={updateResource}
              addMetric={addMeasurement}
              updateMetric={updateMeasurement}
              selectFinalResult={selectFinalTrial}
              setSelection={setSelection}
              getChemicalStockState={getChemicalStockState}
              getStepRemainingSeconds={getStepRemainingSeconds}
              stepStatusLabel={stepStatusLabel}
              onAddStep={addStepFromMaster}
              onAddChemical={addChemicalToStep}
              onAddAsset={addAssetToStep}
              onCreateResult={createTrialFromPacket}
            />
          }
          context={phaseContext}
        />
      </VStack>
    </ControlTowerLayout>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <ControlTowerLayout>
          <VStack align="stretch" spacing={6}>
              <Text color="gray.600">Loading sample process...</Text>
          </VStack>
        </ControlTowerLayout>
      }
    >
      <PlaygroundPageContent />
    </Suspense>
  );
}
