"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Grid,
  Heading,
  HStack,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  Beaker,
  Boxes,
  FlaskConical,
  Lock,
  Package,
  Play,
  Plus,
  Timer,
  Wrench,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

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
  status: StepStatus;
  instructions: string;
  notes: string;
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

type Trial = {
  id: string;
  packetId: string;
  packetCode: string;
  trialNo: number;
  status: TrialStatus;
  measurements: Measurement[];
};

type DragPayload =
  | { kind: "STEP_MASTER"; id: string }
  | { kind: "CHEMICAL"; id: string }
  | { kind: "ASSET"; id: string }
  | { kind: "PACKET"; id: string };

type Selection =
  | { type: "STEP"; id: string }
  | { type: "TRIAL"; id: string }
  | { type: "VALIDATION" }
  | null;

const stepMasters: StepMaster[] = [
  {
    id: "sm-1",
    name: "Heating",
    defaultDurationSeconds: 900,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: true,
  },
  {
    id: "sm-2",
    name: "Stirring",
    defaultDurationSeconds: 1200,
    requiresTimer: true,
    allowsChemicals: false,
    allowsAssets: true,
    requiresAsset: true,
  },
  {
    id: "sm-3",
    name: "Filtration",
    defaultDurationSeconds: 600,
    requiresTimer: false,
    allowsChemicals: false,
    allowsAssets: true,
    requiresAsset: true,
  },
  {
    id: "sm-4",
    name: "Washing",
    defaultDurationSeconds: 500,
    requiresTimer: true,
    allowsChemicals: true,
    allowsAssets: true,
    requiresAsset: false,
  },
  {
    id: "sm-5",
    name: "Drying",
    defaultDurationSeconds: 1000,
    requiresTimer: true,
    allowsChemicals: false,
    allowsAssets: true,
    requiresAsset: true,
  },
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

function encodeDrag(payload: DragPayload) {
  return JSON.stringify(payload);
}

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

function PlaygroundPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [nowTick, setNowTick] = useState(0);
  const [jobId, setJobId] = useState<string>("");
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [savingBoard, setSavingBoard] = useState(false);

  const [playgroundStatus, setPlaygroundStatus] = useState<PlaygroundStatus>("BUILDING");
  const [steps, setSteps] = useState<ExperimentStep[]>([]);
  const [packets, setPackets] = useState<Packet[]>(initialPackets);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const selectedStep = useMemo(() => {
    if (!selection || selection.type !== "STEP") return null;
    return steps.find((step) => step.id === selection.id) ?? null;
  }, [selection, steps]);

  const selectedTrial = useMemo(() => {
    if (!selection || selection.type !== "TRIAL") return null;
    return trials.find((trial) => trial.id === selection.id) ?? null;
  }, [selection, trials]);

  const allStepsDone = useMemo(() => steps.length > 0 && steps.every((s) => s.status === "DONE"), [steps]);

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => a.orderNo - b.orderNo),
    [steps]
  );

  const isLocked = playgroundStatus === "LOCKED";
  const isBuildMode = playgroundStatus === "BUILDING" || playgroundStatus === "READY_TO_RUN";

  const persistBoard = useCallback(
    async (
      nextStatus: PlaygroundStatus,
      action: string,
      nextData?: { steps?: ExperimentStep[]; trials?: Trial[]; packets?: Packet[]; selectedTrialId?: string | null }
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
        toast({ title: "Playground save failed", status: "error" });
      } finally {
        setSavingBoard(false);
      }
    },
    [jobId, packets, selectedTrialId, steps, toast, trials]
  );

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
        let resolvedJobId = searchParams.get("jobId") ?? "";

        if (!resolvedJobId) {
          const jobsRes = await fetch("/api/jobs?view=my");
          if (jobsRes.ok) {
            const jobs = (await jobsRes.json()) as Array<{ id: string }>;
            resolvedJobId = jobs[0]?.id ?? "";
          }
        }

        if (!resolvedJobId) {
          if (active) {
            setLoadingBoard(false);
            toast({ title: "No job found for Playground context", status: "warning" });
          }
          return;
        }

        const res = await fetch(`/api/rd/playground?jobId=${encodeURIComponent(resolvedJobId)}`);
        if (!res.ok) {
          throw new Error("Failed to load playground context");
        }

        const data = (await res.json()) as {
          status?: PlaygroundStatus;
          board?: {
            steps?: ExperimentStep[];
            trials?: Trial[];
            packets?: Packet[];
            selectedTrialId?: string | null;
          };
          packets?: Packet[];
          jobId?: string;
        };

        if (!active) return;

        setJobId(data.jobId ?? resolvedJobId);
        setPlaygroundStatus(data.status ?? "BUILDING");
        setSteps(Array.isArray(data.board?.steps) ? data.board.steps : []);
        setTrials(Array.isArray(data.board?.trials) ? data.board.trials : []);
        setSelectedTrialId(typeof data.board?.selectedTrialId === "string" ? data.board.selectedTrialId : null);
        setPackets(
          Array.isArray(data.board?.packets)
            ? data.board.packets
            : Array.isArray(data.packets) && data.packets.length > 0
              ? data.packets.map((packet) => ({ ...packet, status: "READY" as const }))
              : initialPackets
        );
      } catch {
        if (active) {
          toast({ title: "Failed to load Playground", status: "error" });
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

      const chemicalResources = step.resources.filter((r) => r.resourceType === "CHEMICAL");
      const assetResources = step.resources.filter((r) => r.resourceType === "ASSET");

      if (step.allowsChemicals && step.name === "Washing" && chemicalResources.length === 0) {
        errors.push(`Step ${step.orderNo}: at least one chemical is required for Washing in this MVP policy.`);
      }

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
      void persistBoard("READY_TO_RUN", "PLAYGROUND_VALIDATE_PASS");
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
    if (!isBuildMode || isLocked) return;

    const payload = decodeDrag(event.dataTransfer.getData("text/plain"));
    if (!payload || payload.kind !== "STEP_MASTER") return;

    const stepMaster = stepMasters.find((item) => item.id === payload.id);
    if (!stepMaster) return;

    setSteps((prev) => {
      const nextOrder = prev.length + 1;
      return [
        ...prev,
        {
          id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          stepMasterId: stepMaster.id,
          name: stepMaster.name,
          orderNo: nextOrder,
          durationSeconds: stepMaster.defaultDurationSeconds,
          requiresTimer: stepMaster.requiresTimer,
          allowsChemicals: stepMaster.allowsChemicals,
          allowsAssets: stepMaster.allowsAssets,
          requiresAsset: stepMaster.requiresAsset,
          status: "DRAFT",
          instructions: "",
          notes: "",
          timerStartedAt: null,
          resources: [],
        },
      ];
    });
    void logAction("PLAYGROUND_STEP_ADD", stepMaster.name);
  };

  const onStepDrop = (event: React.DragEvent<HTMLDivElement>, stepId: string) => {
    event.preventDefault();
    if (!isBuildMode || isLocked) return;

    const payload = decodeDrag(event.dataTransfer.getData("text/plain"));
    if (!payload) return;

    if (payload.kind !== "CHEMICAL" && payload.kind !== "ASSET") return;

    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;

        if (payload.kind === "CHEMICAL") {
          if (!step.allowsChemicals) {
            toast({ title: `${step.name} does not allow chemicals.`, status: "error" });
            return step;
          }

          const chemical = chemicalsMaster.find((c) => c.id === payload.id);
          if (!chemical || !chemical.isActive) {
            toast({ title: "Chemical is inactive/invalid.", status: "error" });
            return step;
          }

          const existing = step.resources.some(
            (resource) => resource.resourceType === "CHEMICAL" && resource.resourceId === payload.id
          );
          if (existing) {
            return step;
          }

          void logAction("PLAYGROUND_CHEMICAL_ASSIGN", `${chemical.name} -> ${step.name}`);
          return {
            ...step,
            resources: [
              ...step.resources,
              {
                id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                resourceType: "CHEMICAL",
                resourceId: payload.id,
                quantity: 0,
                unit: chemical.allowedUnits[0],
                usageNotes: "",
              },
            ],
          };
        }

        if (!step.allowsAssets) {
          toast({ title: `${step.name} does not allow assets.`, status: "error" });
          return step;
        }

        const asset = assetsMaster.find((a) => a.id === payload.id);
        if (!asset || !asset.isActive) {
          toast({ title: "Asset is inactive/invalid.", status: "error" });
          return step;
        }

        if (asset.availabilityStatus !== "AVAILABLE") {
          toast({ title: `${asset.name} is not available.`, status: "warning" });
          return step;
        }

        const existing = step.resources.some(
          (resource) => resource.resourceType === "ASSET" && resource.resourceId === payload.id
        );
        if (existing) {
          return step;
        }

        void logAction("PLAYGROUND_ASSET_ASSIGN", `${asset.name} -> ${step.name}`);
        return {
          ...step,
          resources: [
            ...step.resources,
            {
              id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              resourceType: "ASSET",
              resourceId: payload.id,
              usageNotes: "",
            },
          ],
        };
      })
    );
  };

  const moveStep = (stepId: string, direction: "UP" | "DOWN") => {
    if (!isBuildMode || isLocked) return;

    setSteps((prev) => {
      const next = [...prev].sort((a, b) => a.orderNo - b.orderNo);
      const currentIndex = next.findIndex((s) => s.id === stepId);
      if (currentIndex < 0) return prev;

      const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;

      const temp = next[currentIndex];
      next[currentIndex] = next[targetIndex];
      next[targetIndex] = temp;

      return next.map((item, index) => ({ ...item, orderNo: index + 1 }));
    });
    void logAction("PLAYGROUND_STEP_REORDER", direction);
  };

  const deleteStep = (stepId: string) => {
    if (!isBuildMode || isLocked) return;

    setSteps((prev) =>
      prev
        .filter((step) => step.id !== stepId)
        .sort((a, b) => a.orderNo - b.orderNo)
        .map((step, index) => ({ ...step, orderNo: index + 1 }))
    );

    if (selection?.type === "STEP" && selection.id === stepId) {
      setSelection(null);
    }
    void logAction("PLAYGROUND_STEP_DELETE");
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
    void persistBoard("RUNNING", "PLAYGROUND_EXECUTION_START", { steps: nextSteps });
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
        void persistBoard(playgroundStatus, "PLAYGROUND_STEP_START", { steps: nextStepsRef });
      }
    }
  };

  const completeStep = (stepId: string) => {
    if (isLocked) return;

    let blockedByTimer = false;
    let allDone = false;
    let nextStepsRef: ExperimentStep[] | null = null;
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
      }

      nextStepsRef = next;
      return next;
    });

    if (blockedByTimer) {
      toast({ title: "Timer still running", status: "warning" });
      return;
    }

    void logAction("PLAYGROUND_STEP_COMPLETE");
    if (nextStepsRef) {
      void persistBoard(allDone ? "STEPS_COMPLETED" : "RUNNING", "PLAYGROUND_STEP_COMPLETE", { steps: nextStepsRef });
    }
  };

  const onTrialDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (playgroundStatus !== "STEPS_COMPLETED" && playgroundStatus !== "TRIALS_IN_PROGRESS" && playgroundStatus !== "RESULT_SELECTED") {
      toast({ title: "Trials are locked until all steps are complete.", status: "warning" });
      return;
    }

    const payload = decodeDrag(event.dataTransfer.getData("text/plain"));
    if (!payload || payload.kind !== "PACKET") return;

    const packet = packets.find((item) => item.id === payload.id);
    if (!packet || packet.status !== "READY") {
      toast({ title: "Packet unavailable.", status: "error" });
      return;
    }

    const nextPackets = packets.map((item) => (item.id === payload.id ? { ...item, status: "USED" as const } : item));
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
    void logAction("PLAYGROUND_TRIAL_CREATE", packet.code);
    void persistBoard("TRIALS_IN_PROGRESS", "PLAYGROUND_TRIAL_CREATE", { packets: nextPackets, trials: nextTrials });
    toast({ title: "Trial created", status: "success" });
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
            elementCode: "",
            value: "",
            unit: "%",
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

    const nextTrials = trials.map((trial) => ({
      ...trial,
      status: mapTrialStatus(trial.measurements, trial.id === trialId),
    }));

    setSelectedTrialId(trialId);
    setTrials(nextTrials);
    setPlaygroundStatus("RESULT_SELECTED");
    void logAction("PLAYGROUND_RESULT_SELECT", trialId);
    void persistBoard("RESULT_SELECTED", "PLAYGROUND_RESULT_SELECT", { selectedTrialId: trialId, trials: nextTrials });
  };

  const lockExperiment = () => {
    if (isLocked) return;

    const issues: string[] = [];

    if (!allStepsDone) issues.push("All steps must be DONE before lock.");
    if (trials.length === 0) issues.push("At least one trial is required before lock.");
    if (!selectedTrialId) issues.push("Final trial selection is required before lock.");

    const selected = trials.find((trial) => trial.id === selectedTrialId);
    if (selected && selected.status !== "Selected") {
      issues.push("Selected trial state is invalid.");
    }

    if (selected && !isTrialComplete(selected.measurements)) {
      issues.push("Selected trial must have complete measurements.");
    }

    if (issues.length > 0) {
      setValidationErrors(issues);
      setSelection({ type: "VALIDATION" });
      toast({ title: "Lock blocked", description: issues[0], status: "error" });
      return;
    }

    setPlaygroundStatus("LOCKED");
    void logAction("PLAYGROUND_LOCK");
    void persistBoard("LOCKED", "PLAYGROUND_LOCK");
    toast({ title: "Experiment locked", status: "success" });
  };

  const headerPhases: PlaygroundStatus[] = [
    "BUILDING",
    "READY_TO_RUN",
    "RUNNING",
    "STEPS_COMPLETED",
    "TRIALS_IN_PROGRESS",
    "RESULT_SELECTED",
    "LOCKED",
  ];

  const selectedStepChemicals = selectedStep
    ? selectedStep.resources.filter((resource) => resource.resourceType === "CHEMICAL")
    : [];
  const selectedStepAssets = selectedStep
    ? selectedStep.resources.filter((resource) => resource.resourceType === "ASSET")
    : [];

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" align="start" flexWrap="wrap" spacing={4}>
          <VStack align="start" spacing={1}>
            <HStack spacing={2}>
              <Badge colorScheme="orange" variant="subtle" borderRadius="full" px={2.5} py={1}>
                PLAYGROUND
              </Badge>
              <Badge colorScheme={isLocked ? "red" : "green"} variant="subtle" borderRadius="full" px={2.5} py={1}>
                {isLocked ? "LOCKED" : "INDUSTRIAL MODE"}
              </Badge>
              {jobId ? (
                <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
                  JOB {jobId.slice(0, 8)}
                </Badge>
              ) : null}
            </HStack>
            <Heading size="lg" color="gray.900">
              Industrial R&D Execution Board
            </Heading>
          </VStack>

          <HStack spacing={2} wrap="wrap">
            <Button
              variant="outline"
              onClick={() => persistBoard(playgroundStatus, "PLAYGROUND_SAVE_MANUAL")}
              isDisabled={isLocked || !jobId || loadingBoard}
              isLoading={savingBoard}
            >
              Save Draft
            </Button>
            <Button variant="outline" onClick={runBuildValidation} isDisabled={isLocked}>
              Validate
            </Button>
            <Button colorScheme="teal" leftIcon={<Play size={16} />} onClick={startExecution} isDisabled={!isBuildMode || isLocked}>
              Start Execution
            </Button>
            <Button colorScheme="purple" leftIcon={<Package size={16} />} onClick={() => selectedTrialId && selectFinalTrial(selectedTrialId)} isDisabled={!selectedTrialId || isLocked}>
              Confirm Final Trial
            </Button>
            <Button colorScheme="red" leftIcon={<Lock size={16} />} onClick={lockExperiment} isDisabled={isLocked}>
              Lock
            </Button>
          </HStack>
        </HStack>

        {loadingBoard ? (
          <Card variant="outline" borderRadius="xl" bg="white">
            <CardBody p={4}>
              <Text fontSize="sm" color="gray.600">
                Loading playground context...
              </Text>
            </CardBody>
          </Card>
        ) : null}

        <SimpleGrid columns={{ base: 2, md: 4, xl: 7 }} spacing={3}>
          {headerPhases.map((phase) => (
            <Box
              key={phase}
              p={3}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={playgroundStatus === phase ? "teal.400" : "gray.200"}
              bg={playgroundStatus === phase ? "teal.50" : "white"}
            >
              <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
                phase
              </Text>
              <Text mt={1} fontSize="sm" fontWeight="semibold" color="gray.900">
                {phase}
              </Text>
            </Box>
          ))}
        </SimpleGrid>

        <Grid templateColumns={{ base: "1fr", xl: "300px 1fr 360px" }} gap={6}>
          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <HStack mb={4}>
                <Icon as={Boxes} color="teal.600" />
                <Text fontWeight="bold" color="gray.900">
                  Left Rail: Resource Library
                </Text>
              </HStack>

              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold" mb={2}>
                    Step Types
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {stepMasters.map((step) => (
                      <Box
                        key={step.id}
                        p={2.5}
                        borderWidth="1px"
                        borderColor="gray.200"
                        borderRadius="lg"
                        bg="gray.50"
                        cursor={isBuildMode && !isLocked ? "grab" : "not-allowed"}
                        draggable={isBuildMode && !isLocked}
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", encodeDrag({ kind: "STEP_MASTER", id: step.id }))}
                      >
                        <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                          {step.name}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          {step.defaultDurationSeconds}s • {step.requiresTimer ? "Timer" : "No timer"}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>

                <Box>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold" mb={2}>
                    Chemicals
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {chemicalsMaster.map((chemical) => (
                      <Box
                        key={chemical.id}
                        p={2.5}
                        borderWidth="1px"
                        borderColor="gray.200"
                        borderRadius="lg"
                        bg="gray.50"
                        cursor={isBuildMode && !isLocked ? "grab" : "not-allowed"}
                        draggable={isBuildMode && !isLocked}
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", encodeDrag({ kind: "CHEMICAL", id: chemical.id }))}
                      >
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                            {chemical.name}
                          </Text>
                          <Badge colorScheme={getChemicalStockState(chemical) === "Out of Stock" ? "red" : getChemicalStockState(chemical) === "Low Stock" ? "orange" : "green"}>
                            {getChemicalStockState(chemical)}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.600">
                          {chemical.stockQuantity} {chemical.baseUnit} • {chemical.category}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>

                <Box>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold" mb={2}>
                    Assets
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {assetsMaster.map((asset) => (
                      <Box
                        key={asset.id}
                        p={2.5}
                        borderWidth="1px"
                        borderColor="gray.200"
                        borderRadius="lg"
                        bg="gray.50"
                        cursor={isBuildMode && !isLocked ? "grab" : "not-allowed"}
                        draggable={isBuildMode && !isLocked}
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", encodeDrag({ kind: "ASSET", id: asset.id }))}
                      >
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                            {asset.name}
                          </Text>
                          <Badge colorScheme={asset.availabilityStatus === "AVAILABLE" ? "green" : "orange"}>
                            {asset.availabilityStatus}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.600">
                          {asset.code} • {asset.category}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>

                <Box>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold" mb={2}>
                    Packets
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {packets.map((packet) => (
                      <Box
                        key={packet.id}
                        p={2.5}
                        borderWidth="1px"
                        borderColor="gray.200"
                        borderRadius="lg"
                        bg="gray.50"
                        cursor={allStepsDone && !isLocked ? "grab" : "not-allowed"}
                        draggable={allStepsDone && !isLocked && packet.status === "READY"}
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", encodeDrag({ kind: "PACKET", id: packet.id }))}
                      >
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                            {packet.code}
                          </Text>
                          <Badge colorScheme={packet.status === "READY" ? "blue" : "gray"}>{packet.status}</Badge>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              </VStack>
            </CardBody>
          </Card>

          <VStack align="stretch" spacing={4}>
            <Card
              variant="outline"
              borderRadius="2xl"
              bg="white"
              shadow="sm"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onCanvasDrop}
            >
              <CardBody p={5}>
                <HStack justify="space-between" mb={4}>
                  <HStack>
                    <Icon as={FlaskConical} color="purple.600" />
                    <Text fontWeight="bold" color="gray.900">
                      Center: Process Canvas
                    </Text>
                  </HStack>
                  <Badge colorScheme="gray">{orderedSteps.length} step(s)</Badge>
                </HStack>

                <VStack align="stretch" spacing={3} minH="140px">
                  {orderedSteps.length === 0 ? (
                    <Box p={8} borderWidth="1px" borderStyle="dashed" borderColor="gray.300" borderRadius="xl" textAlign="center">
                      <Text color="gray.600">Drag step types here to build process flow.</Text>
                    </Box>
                  ) : (
                    orderedSteps.map((step) => {
                      const chemicalCount = step.resources.filter((r) => r.resourceType === "CHEMICAL").length;
                      const assetCount = step.resources.filter((r) => r.resourceType === "ASSET").length;
                      const remaining = getStepRemainingSeconds(step);

                      return (
                        <Card
                          key={step.id}
                          variant="outline"
                          borderRadius="xl"
                          borderColor={selection?.type === "STEP" && selection.id === step.id ? "teal.400" : "gray.200"}
                          onClick={() => setSelection({ type: "STEP", id: step.id })}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => onStepDrop(event, step.id)}
                          cursor="pointer"
                        >
                          <CardBody p={4}>
                            <HStack justify="space-between" align="start" spacing={4}>
                              <Box>
                                <HStack spacing={2}>
                                  <Badge colorScheme="purple" borderRadius="full">
                                    #{step.orderNo}
                                  </Badge>
                                  <Text fontWeight="bold" color="gray.900">
                                    {step.name}
                                  </Text>
                                  <Badge colorScheme={step.status === "DONE" ? "green" : step.status === "RUNNING" ? "orange" : step.status === "READY" ? "blue" : "gray"}>
                                    {step.status}
                                  </Badge>
                                </HStack>
                                <HStack mt={2} spacing={2}>
                                  <Badge colorScheme="blue" variant="subtle">
                                    {step.durationSeconds}s
                                  </Badge>
                                  <Badge colorScheme="cyan" variant="subtle">
                                    {chemicalCount} chemical(s)
                                  </Badge>
                                  <Badge colorScheme="pink" variant="subtle">
                                    {assetCount} asset(s)
                                  </Badge>
                                  {step.requiresTimer ? (
                                    <Badge colorScheme="orange" variant="subtle">
                                      Timer
                                    </Badge>
                                  ) : null}
                                </HStack>
                                {step.status === "RUNNING" && step.requiresTimer ? (
                                  <Text mt={2} fontSize="xs" color="orange.600" fontWeight="semibold">
                                    Remaining: {remaining}s
                                  </Text>
                                ) : null}
                              </Box>

                              <VStack align="end" spacing={2}>
                                <HStack>
                                  <Button size="xs" onClick={() => moveStep(step.id, "UP")} isDisabled={!isBuildMode || isLocked}>
                                    Up
                                  </Button>
                                  <Button size="xs" onClick={() => moveStep(step.id, "DOWN")} isDisabled={!isBuildMode || isLocked}>
                                    Down
                                  </Button>
                                  <Button size="xs" colorScheme="red" variant="outline" onClick={() => deleteStep(step.id)} isDisabled={!isBuildMode || isLocked}>
                                    Delete
                                  </Button>
                                </HStack>

                                <HStack>
                                  <Button
                                    size="xs"
                                    colorScheme="teal"
                                    leftIcon={<Play size={14} />}
                                    onClick={() => startStep(step.id)}
                                    isDisabled={step.status !== "READY" || isLocked}
                                  >
                                    Start
                                  </Button>
                                  <Button
                                    size="xs"
                                    colorScheme="green"
                                    leftIcon={<Timer size={14} />}
                                    onClick={() => completeStep(step.id)}
                                    isDisabled={step.status !== "RUNNING" || isLocked}
                                  >
                                    Complete
                                  </Button>
                                </HStack>
                              </VStack>
                            </HStack>
                          </CardBody>
                        </Card>
                      );
                    })
                  )}
                </VStack>
              </CardBody>
            </Card>

            <Card
              variant="outline"
              borderRadius="2xl"
              bg="white"
              shadow="sm"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onTrialDrop}
            >
              <CardBody p={5}>
                <HStack justify="space-between" mb={3}>
                  <HStack>
                    <Icon as={Package} color="teal.600" />
                    <Text fontWeight="bold" color="gray.900">
                      Trial Lane
                    </Text>
                  </HStack>
                  <Badge colorScheme={allStepsDone ? "green" : "gray"}>{allStepsDone ? "UNLOCKED" : "LOCKED"}</Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600" mb={4}>
                  Drag packets here after all steps are complete to create trials.
                </Text>

                <VStack align="stretch" spacing={3}>
                  {trials.length === 0 ? (
                    <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="gray.300" borderRadius="xl">
                      <Text fontSize="sm" color="gray.500">No records.</Text>
                    </Box>
                  ) : (
                    trials.map((trial) => (
                      <HStack
                        key={trial.id}
                        p={3}
                        borderWidth="1px"
                        borderColor={selection?.type === "TRIAL" && selection.id === trial.id ? "teal.400" : "gray.200"}
                        borderRadius="xl"
                        justify="space-between"
                        bg={selectedTrialId === trial.id ? "teal.50" : "white"}
                      >
                        <Box onClick={() => setSelection({ type: "TRIAL", id: trial.id })} cursor="pointer">
                          <Text fontWeight="semibold" color="gray.900">
                            Trial #{trial.trialNo}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {trial.packetCode} • {trial.measurements.length} measurement(s)
                          </Text>
                        </Box>
                        <HStack>
                          <Badge colorScheme={trial.status === "Selected" ? "purple" : trial.status === "Complete" ? "green" : trial.status === "Incomplete" ? "orange" : "gray"}>
                            {trial.status}
                          </Badge>
                          <Button size="xs" colorScheme="purple" onClick={() => selectFinalTrial(trial.id)} isDisabled={isLocked}>
                            Select
                          </Button>
                        </HStack>
                      </HStack>
                    ))
                  )}
                </VStack>
              </CardBody>
            </Card>
          </VStack>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <HStack mb={4}>
                <Icon as={Wrench} color="orange.600" />
                <Text fontWeight="bold" color="gray.900">
                  Right Panel: Inspector
                </Text>
              </HStack>

              {!selection ? (
                <Text fontSize="sm" color="gray.600">Select a step or trial to edit details.</Text>
              ) : null}

              {selection?.type === "VALIDATION" ? (
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                    Blocking Validation Issues
                  </Text>
                  {validationErrors.length === 0 ? (
                    <Text fontSize="sm" color="green.600">No issues.</Text>
                  ) : (
                    validationErrors.map((error) => (
                      <Box key={error} p={2.5} bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="lg">
                        <Text fontSize="sm" color="red.700">{error}</Text>
                      </Box>
                    ))
                  )}
                </VStack>
              ) : null}

              {selectedStep ? (
                <VStack align="stretch" spacing={4}>
                  <Box>
                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">Step</Text>
                    <Heading size="sm" color="gray.900" mt={1}>{selectedStep.name}</Heading>
                  </Box>

                  <Box>
                    <Text fontSize="sm" color="gray.700" mb={1}>Duration (seconds)</Text>
                    <Input
                      type="number"
                      value={selectedStep.durationSeconds}
                      onChange={(event) => updateStepField(selectedStep.id, { durationSeconds: Number(event.target.value) || 0 })}
                      isDisabled={!isBuildMode || isLocked}
                    />
                  </Box>

                  <Box>
                    <Text fontSize="sm" color="gray.700" mb={1}>Instructions</Text>
                    <Textarea
                      value={selectedStep.instructions}
                      onChange={(event) => updateStepField(selectedStep.id, { instructions: event.target.value })}
                      isDisabled={!isBuildMode || isLocked}
                    />
                  </Box>

                  <Box>
                    <Text fontSize="sm" color="gray.700" mb={1}>Notes</Text>
                    <Textarea
                      value={selectedStep.notes}
                      onChange={(event) => updateStepField(selectedStep.id, { notes: event.target.value })}
                      isDisabled={!isBuildMode || isLocked}
                    />
                  </Box>

                  <Divider />

                  <Box>
                    <HStack mb={2}>
                      <Icon as={Beaker} boxSize={4} color="blue.600" />
                      <Text fontSize="sm" fontWeight="semibold" color="gray.900">Chemicals</Text>
                    </HStack>
                    <VStack align="stretch" spacing={2}>
                      {selectedStepChemicals.length === 0 ? (
                        <Text fontSize="sm" color="gray.500">No records.</Text>
                      ) : (
                        selectedStepChemicals.map((resource) => {
                          const chemical = chemicalsMaster.find((item) => item.id === resource.resourceId);
                          if (!chemical) return null;

                          return (
                            <Box key={resource.id} p={2.5} borderWidth="1px" borderColor="gray.200" borderRadius="lg">
                              <Text fontSize="sm" fontWeight="semibold" color="gray.900">{chemical.name}</Text>
                              <HStack mt={2} spacing={2}>
                                <Input
                                  type="number"
                                  value={resource.quantity ?? 0}
                                  onChange={(event) =>
                                    updateResource(selectedStep.id, resource.id, {
                                      quantity: Number(event.target.value) || 0,
                                    })
                                  }
                                  isDisabled={!isBuildMode || isLocked}
                                />
                                <Select
                                  value={resource.unit ?? chemical.allowedUnits[0]}
                                  onChange={(event) =>
                                    updateResource(selectedStep.id, resource.id, {
                                      unit: event.target.value,
                                    })
                                  }
                                  isDisabled={!isBuildMode || isLocked}
                                >
                                  {chemical.allowedUnits.map((unit) => (
                                    <option key={unit} value={unit}>{unit}</option>
                                  ))}
                                </Select>
                              </HStack>
                            </Box>
                          );
                        })
                      )}
                    </VStack>
                  </Box>

                  <Box>
                    <HStack mb={2}>
                      <Icon as={Wrench} boxSize={4} color="pink.600" />
                      <Text fontSize="sm" fontWeight="semibold" color="gray.900">Assets</Text>
                    </HStack>
                    <VStack align="stretch" spacing={2}>
                      {selectedStepAssets.length === 0 ? (
                        <Text fontSize="sm" color="gray.500">No records.</Text>
                      ) : (
                        selectedStepAssets.map((resource) => {
                          const asset = assetsMaster.find((item) => item.id === resource.resourceId);
                          if (!asset) return null;
                          return (
                            <Box key={resource.id} p={2.5} borderWidth="1px" borderColor="gray.200" borderRadius="lg">
                              <HStack justify="space-between">
                                <Text fontSize="sm" fontWeight="semibold" color="gray.900">{asset.name}</Text>
                                <Badge colorScheme={asset.availabilityStatus === "AVAILABLE" ? "green" : "orange"}>
                                  {asset.availabilityStatus}
                                </Badge>
                              </HStack>
                            </Box>
                          );
                        })
                      )}
                    </VStack>
                  </Box>
                </VStack>
              ) : null}

              {selectedTrial ? (
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">Trial</Text>
                    <Heading size="sm" color="gray.900" mt={1}>Trial #{selectedTrial.trialNo}</Heading>
                    <Text fontSize="sm" color="gray.600">Packet: {selectedTrial.packetCode}</Text>
                  </Box>

                  <Button leftIcon={<Plus size={14} />} size="sm" onClick={() => addMeasurement(selectedTrial.id)} isDisabled={isLocked}>
                    Add Measurement
                  </Button>

                  <VStack align="stretch" spacing={2}>
                    {selectedTrial.measurements.length === 0 ? (
                      <Text fontSize="sm" color="gray.500">No records.</Text>
                    ) : (
                      selectedTrial.measurements.map((measurement) => (
                        <Box key={measurement.id} p={2.5} borderWidth="1px" borderColor="gray.200" borderRadius="lg">
                          <SimpleGrid columns={2} spacing={2}>
                            <Input
                              placeholder="Element"
                              value={measurement.elementCode}
                              onChange={(event) =>
                                updateMeasurement(selectedTrial.id, measurement.id, {
                                  elementCode: event.target.value.toUpperCase(),
                                })
                              }
                              isDisabled={isLocked}
                            />
                            <Input
                              placeholder="Value"
                              value={measurement.value}
                              onChange={(event) =>
                                updateMeasurement(selectedTrial.id, measurement.id, {
                                  value: event.target.value,
                                })
                              }
                              isDisabled={isLocked}
                            />
                            <Input
                              placeholder="Unit"
                              value={measurement.unit}
                              onChange={(event) =>
                                updateMeasurement(selectedTrial.id, measurement.id, {
                                  unit: event.target.value,
                                })
                              }
                              isDisabled={isLocked}
                            />
                            <Input
                              placeholder="Remarks"
                              value={measurement.remarks}
                              onChange={(event) =>
                                updateMeasurement(selectedTrial.id, measurement.id, {
                                  remarks: event.target.value,
                                })
                              }
                              isDisabled={isLocked}
                            />
                          </SimpleGrid>
                        </Box>
                      ))
                    )}
                  </VStack>
                </VStack>
              ) : null}
            </CardBody>
          </Card>
        </Grid>
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
            <Text color="gray.600">Loading playground...</Text>
          </VStack>
        </ControlTowerLayout>
      }
    >
      <PlaygroundPageContent />
    </Suspense>
  );
}
