"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { Beaker, Boxes, Clock3, FlaskConical, Package, Play, Plus, Timer, Wrench } from "lucide-react";
import type { DragEvent } from "react";

import { QuickEditDrawer } from "@/components/enterprise/EnterprisePatterns";

type StepStatus = "DRAFT" | "READY" | "RUNNING" | "DONE";

type Selection = { type: "STEP"; id: string } | { type: "TRIAL"; id: string } | { type: "VALIDATION" } | null;

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
  resourceType: "CHEMICAL" | "ASSET";
  resourceId: string;
  quantity?: number;
  unit?: string;
  usageNotes?: string;
};

type PlaygroundStep = {
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
  status: "Draft" | "Incomplete" | "Complete" | "Selected";
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

type PlaygroundMissionPanelProps = {
  playgroundStatus: "BUILDING" | "READY_TO_RUN" | "RUNNING" | "STEPS_COMPLETED" | "TRIALS_IN_PROGRESS" | "RESULT_SELECTED" | "LOCKED";
  acceptedWorkRows: AcceptedWorkRow[];
  selectedAcceptedWork: AcceptedWorkRow | null;
  onOpenMission: (jobId: string) => void;
  loadingAcceptedWork: boolean;
  acceptedWorkError: string | null;
  acceptedWorkSummary?: {
    total: number;
    pendingIntake: number;
    readyForSetup: number;
    inTesting: number;
    awaitingReview: number;
    completed: number;
  } | null;
  onRetryAcceptedWork?: () => void;
  stepMasters: StepMaster[];
  processTemplates: ProcessTemplate[];
  chemicalsMaster: Chemical[];
  assetsMaster: Asset[];
  packets: Packet[];
  reminderEvents: ReminderEvent[];
  selectedProcessTemplateId: string | null;
  onApplyProcessTemplate: (templateId: string) => void;
  processResultSummary: ProcessResultSummary;
  orderedSteps: PlaygroundStep[];
  selectedStep: PlaygroundStep | null;
  selectedResult: Trial | null;
  selectedStepChemicals: StepResource[];
  selectedStepAssets: StepResource[];
  selection: Selection;
  selectedResultId: string | null;
  validationErrors: string[];
  isBuildMode: boolean;
  isLocked: boolean;
  allStepsDone: boolean;
  onCanvasDrop: (event: DragEvent<HTMLDivElement>) => void;
  onStepDrop: (event: DragEvent<HTMLDivElement>, stepId: string) => void;
  startStep: (stepId: string) => void;
  completeStep: (stepId: string) => void;
  updateStepField: (stepId: string, patch: Partial<PlaygroundStep>) => void;
  updateResource: (stepId: string, resourceId: string, patch: Partial<StepResource>) => void;
  addMetric: (resultId: string) => void;
  updateMetric: (resultId: string, measurementId: string, patch: Partial<Measurement>) => void;
  selectFinalResult: (resultId: string) => void;
  setSelection: (selection: Selection) => void;
  getChemicalStockState: (chemical: Chemical) => "In Stock" | "Low Stock" | "Out of Stock";
  getStepRemainingSeconds: (step: PlaygroundStep) => number;
  stepStatusLabel: (status: StepStatus) => string;
  onAddStep: (stepMasterId: string) => void;
  onAddChemical: (stepId: string, chemicalId: string) => void;
  onAddAsset: (stepId: string, assetId: string) => void;
  onCreateResult: (packetId: string) => void;
};

export function PlaygroundMissionPanel({
  playgroundStatus,
  acceptedWorkRows,
  selectedAcceptedWork,
  onOpenMission,
  loadingAcceptedWork,
  acceptedWorkError,
  acceptedWorkSummary,
  onRetryAcceptedWork,
  stepMasters,
  processTemplates,
  chemicalsMaster,
  assetsMaster,
  packets,
  reminderEvents,
  selectedProcessTemplateId,
  onApplyProcessTemplate,
  processResultSummary,
  orderedSteps,
  selectedStep,
  selectedResult,
  selectedStepChemicals,
  selectedStepAssets,
  selection,
  selectedResultId,
  validationErrors,
  isBuildMode,
  isLocked,
  allStepsDone,
  onCanvasDrop,
  onStepDrop,
  startStep,
  completeStep,
  updateStepField,
  updateResource,
  addMetric,
  updateMetric,
  selectFinalResult,
  setSelection,
  getChemicalStockState,
  getStepRemainingSeconds,
  stepStatusLabel,
  onAddStep,
  onAddChemical,
  onAddAsset,
  onCreateResult,
}: PlaygroundMissionPanelProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const currentMission = selectedAcceptedWork;
  const showBuildView = playgroundStatus === "BUILDING";
  const showValidateView = playgroundStatus === "READY_TO_RUN";
  const showRunView = playgroundStatus === "RUNNING";
  const showCaptureView = playgroundStatus === "STEPS_COMPLETED" || playgroundStatus === "TRIALS_IN_PROGRESS";
  const showReviewView = playgroundStatus === "RESULT_SELECTED";
  const showArchiveView = playgroundStatus === "LOCKED";
  const availableStepTypes = useMemo(() => stepMasters, [stepMasters]);
  const currentProcessTemplate = useMemo(
    () => processTemplates.find((template) => template.id === selectedProcessTemplateId) ?? null,
    [processTemplates, selectedProcessTemplateId]
  );
  const activeRunStep = useMemo(
    () =>
      selectedStep ??
      orderedSteps.find((step) => step.status === "RUNNING") ??
      orderedSteps.find((step) => step.status === "READY") ??
      orderedSteps[0] ??
      null,
    [orderedSteps, selectedStep]
  );
  const runningStep = useMemo(
    () => orderedSteps.find((step) => step.status === "RUNNING" && step.requiresTimer) ?? orderedSteps.find((step) => step.requiresTimer) ?? null,
    [orderedSteps]
  );
  const activePacket = useMemo(() => {
    if (!currentMission) return null;
    return packets.find((packet) => packet.code === currentMission.packetId) ?? packets[0] ?? null;
  }, [currentMission, packets]);
  const acceptedWorkQueue: AcceptedWorkRow[] = acceptedWorkRows;
  const renderAcceptedWorkRow = (row: AcceptedWorkRow) => (
    <Box
      key={row.id}
      p={3}
      borderWidth="1px"
      borderColor={selectedAcceptedWork?.id === row.id ? "brand.300" : "border.default"}
      borderRadius="lg"
      bg={selectedAcceptedWork?.id === row.id ? "bg.rail" : "bg.surface"}
      cursor="pointer"
      onClick={() => onOpenMission(row.id)}
    >
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3} alignItems="center">
        <Box minW={0}>
          <Text fontWeight="semibold" color="text.primary">
            Job {row.rndJobNumber}
          </Text>
          <Text fontSize="xs" color="text.secondary">
            {row.parentJobNumber}
          </Text>
        </Box>
        <Box minW={0}>
          <Text fontWeight="semibold" color="text.primary">
            {row.sampleId}
          </Text>
          <Text fontSize="xs" color="text.secondary" noOfLines={1}>
            Packet {row.packetId} · {row.packetWeight}
          </Text>
        </Box>
        <Box minW={0}>
          <Text fontWeight="semibold" color="text.primary">
            {row.currentStep}
          </Text>
          <Text fontSize="xs" color="text.secondary">
            {row.assignedUser} · {row.receivedDate}
          </Text>
        </Box>
        <Button size="sm" variant="outline" justifySelf={{ base: "start", md: "end" }} onClick={() => onOpenMission(row.id)}>
          {row.primaryAction}
        </Button>
      </SimpleGrid>
    </Box>
  );
  const formatDuration = (totalSeconds: number) => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  };

  return (
    <>
      <Stack spacing={4}>
        {showBuildView ? (
          <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
            <CardBody p={4}>
              <HStack justify="space-between" align="start" spacing={4} mb={3}>
                <HStack spacing={2}>
                  <Icon as={FlaskConical} color="purple.600" />
                  <Box>
                    <Text fontWeight="bold" color="text.primary">
                      Build process
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      Choose one template and apply it to this sample job.
                    </Text>
                  </Box>
                </HStack>
                {currentProcessTemplate ? (
                  <Badge colorScheme="purple" variant="subtle">
                    {currentProcessTemplate.name}
                  </Badge>
                ) : (
                  <Badge colorScheme="gray" variant="subtle">
                    No template applied
                  </Badge>
                )}
              </HStack>

              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                  <VStack align="stretch" spacing={3}>
                    <Box>
                      <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                        Process template
                      </Text>
                      <Select
                        mt={2}
                        value={selectedProcessTemplateId ?? ""}
                        onChange={(event) => onApplyProcessTemplate(event.target.value)}
                        isDisabled={isLocked || !isBuildMode}
                      >
                        <option value="" disabled>
                          Choose a template
                        </option>
                        {processTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </Select>
                    </Box>
                    <Text fontSize="sm" color="text.secondary">
                      {currentProcessTemplate?.description ?? "Select a template to preload the process steps."}
                    </Text>
                    <Button
                      size="sm"
                      colorScheme="teal"
                      alignSelf="start"
                      onClick={() => currentProcessTemplate && onApplyProcessTemplate(currentProcessTemplate.id)}
                      isDisabled={isLocked || !isBuildMode || !currentProcessTemplate}
                    >
                      Apply Template
                    </Button>
                  </VStack>
                </Box>
                <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                  <VStack align="stretch" spacing={2}>
                    <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                      Process summary
                    </Text>
                    <Text fontWeight="semibold" color="text.primary">
                      {currentProcessTemplate ? currentProcessTemplate.name : "No template applied"}
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      {currentProcessTemplate
                        ? `${currentProcessTemplate.stageIds.length} steps · ${currentProcessTemplate.reminderMode}`
                        : "Choose one template to configure the process like a job creation form."}
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      Build the sample process first, then validate and move into run mode.
                    </Text>
                  </VStack>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        ) : null}

        {showValidateView ? (
          <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
            <CardBody p={4}>
              <HStack justify="space-between" align="start" spacing={4} mb={3}>
                <HStack spacing={2}>
                  <Icon as={Boxes} color="blue.600" />
                  <Box>
                    <Text fontWeight="bold" color="text.primary">
                      Validate Process
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      Review blockers and confirm the process is ready to run.
                    </Text>
                  </Box>
                </HStack>
                <Badge colorScheme={validationErrors.length === 0 ? "green" : "orange"} variant="subtle">
                  {validationErrors.length === 0 ? "No blockers" : `${validationErrors.length} blocker(s)`}
                </Badge>
              </HStack>
              {validationErrors.length === 0 ? (
                <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
                  <Text fontSize="sm" color="text.secondary">
                    The process is ready to run. Use the primary action above to start processing.
                  </Text>
                </Box>
              ) : (
                <VStack align="stretch" spacing={2}>
                  {validationErrors.map((error) => (
                    <Box key={error} p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                      <Text fontSize="sm" color="text.primary">
                        {error}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>
        ) : null}

        {!currentMission ? (
          <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
            <CardBody p={4}>
              <HStack justify="space-between" align="start" spacing={4} mb={3}>
                <HStack spacing={2}>
                  <Icon as={Boxes} color="teal.600" />
                  <Text fontWeight="bold" color="text.primary">
                    Accepted Sample Work
                  </Text>
                </HStack>
                <Badge colorScheme="gray" variant="subtle">
                  {acceptedWorkRows.length} available
                </Badge>
              </HStack>
              {acceptedWorkSummary ? (
                <Text fontSize="xs" color="text.secondary" mb={3}>
                  Intake {acceptedWorkSummary.pendingIntake} · Setup {acceptedWorkSummary.readyForSetup} · Testing {acceptedWorkSummary.inTesting} · Review {acceptedWorkSummary.awaitingReview}
                </Text>
              ) : null}

              {loadingAcceptedWork ? (
                <Text fontSize="sm" color="text.secondary">
                  Loading accepted jobs and packets...
                </Text>
              ) : acceptedWorkError ? (
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="sm" color="red.600">
                    {acceptedWorkError}
                  </Text>
                  {onRetryAcceptedWork ? (
                    <Button size="sm" variant="outline" onClick={onRetryAcceptedWork}>
                      Retry load
                    </Button>
                  ) : null}
                </VStack>
              ) : acceptedWorkRows.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  No accepted R&amp;D work is available right now.
                </Text>
              ) : (
                <VStack align="stretch" spacing={3}>
                  <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3}>
                      <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                        Job
                      </Text>
                      <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                        Sample
                      </Text>
                      <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                        Current step
                      </Text>
                      <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                        Action
                      </Text>
                    </SimpleGrid>
                  </Box>
                  {acceptedWorkQueue.map(renderAcceptedWorkRow)}
                </VStack>
              )}
            </CardBody>
          </Card>
        ) : null}

        {showRunView || showCaptureView || showReviewView || showArchiveView ? (
          <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none" onDragOver={(event) => event.preventDefault()} onDrop={onCanvasDrop}>
            <CardBody p={4}>
              <HStack justify="space-between" align="start" spacing={4} mb={4}>
                <HStack spacing={2}>
                  <Icon as={FlaskConical} color="purple.600" />
                  <Text fontWeight="bold" color="text.primary">
                    {showRunView
                      ? "Run process"
                      : showCaptureView
                        ? "Capture results"
                        : showReviewView
                          ? "Review release"
                          : "Archive"}
                  </Text>
                </HStack>
                <HStack spacing={2} flexWrap="wrap" justify="end">
                  <Button size="sm" variant="outline" onClick={() => setInspectorOpen(true)} isDisabled={!selection}>
                    Inspect
                  </Button>
                </HStack>
              </HStack>

              {showRunView && runningStep ? (
                <Box mb={4} p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                  <HStack spacing={3} align="start">
                    <Icon as={Clock3} color="orange.500" />
                    <Box minW={0}>
                      <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                        Run clock
                      </Text>
                      <Text fontWeight="semibold" color="text.primary">
                        {runningStep.status === "RUNNING" ? `${formatDuration(getStepRemainingSeconds(runningStep))} remaining` : formatDuration(runningStep.durationSeconds)}
                      </Text>
                      <Text fontSize="sm" color="text.secondary" noOfLines={1}>
                        #{runningStep.orderNo} · {runningStep.name}
                      </Text>
                    </Box>
                  </HStack>
                </Box>
              ) : null}

            {!currentMission ? (
              <Box mb={4} p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
                <Text color="text.secondary">
                  Open an accepted sample job above to begin. The process builder and task surface will appear after a job is loaded.
                </Text>
              </Box>
            ) : null}

            {showRunView ? (
              <VStack align="stretch" spacing={3}>
                {orderedSteps.length > 0 ? (
                  <HStack spacing={2} flexWrap="wrap" align="start">
                    {orderedSteps.map((step) => (
                      <Button
                        key={step.id}
                        size="sm"
                        variant={activeRunStep?.id === step.id ? "solid" : "outline"}
                        colorScheme={activeRunStep?.id === step.id ? "blue" : "gray"}
                        onClick={() => setSelection({ type: "STEP", id: step.id })}
                      >
                        #{step.orderNo} {step.name}
                      </Button>
                    ))}
                  </HStack>
                ) : (
                  <Box p={6} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg" textAlign="center">
                    <Text color="text.secondary">No process steps are available yet.</Text>
                  </Box>
                )}

                {activeRunStep ? (
                  <Card
                    variant="outline"
                    borderRadius="lg"
                    borderColor={selection?.type === "STEP" && selection.id === activeRunStep.id ? "brand.300" : "border.default"}
                    bg={selection?.type === "STEP" && selection.id === activeRunStep.id ? "bg.rail" : "bg.surface"}
                    shadow="none"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onStepDrop(event, activeRunStep.id)}
                    cursor="pointer"
                    onClick={() => setSelection({ type: "STEP", id: activeRunStep.id })}
                  >
                    <CardBody p={4}>
                      <HStack justify="space-between" align="start" spacing={4}>
                        <Box minW={0}>
                          <HStack spacing={2} flexWrap="wrap">
                            <Badge colorScheme="purple" variant="subtle" borderRadius="full">
                              #{activeRunStep.orderNo}
                            </Badge>
                            <Text fontWeight="semibold" color="text.primary">
                              {activeRunStep.name}
                            </Text>
                            <Badge
                              colorScheme={activeRunStep.status === "DONE" ? "green" : activeRunStep.status === "RUNNING" ? "orange" : activeRunStep.status === "READY" ? "blue" : "gray"}
                              variant="subtle"
                              borderRadius="full"
                            >
                              {stepStatusLabel(activeRunStep.status)}
                            </Badge>
                          </HStack>
                          <HStack mt={2} spacing={2} flexWrap="wrap">
                            <Badge colorScheme={activeRunStep.requiresTimer ? "orange" : "blue"} variant="subtle">
                              {activeRunStep.requiresTimer
                                ? activeRunStep.status === "RUNNING"
                                  ? `Clock ${formatDuration(getStepRemainingSeconds(activeRunStep))}`
                                  : `Timer ${formatDuration(activeRunStep.durationSeconds)}`
                                : formatDuration(activeRunStep.durationSeconds)}
                            </Badge>
                            <Badge colorScheme="cyan" variant="subtle">
                              {activeRunStep.resources.filter((resource) => resource.resourceType === "CHEMICAL").length} chemical(s)
                            </Badge>
                            <Badge colorScheme="pink" variant="subtle">
                              {activeRunStep.resources.filter((resource) => resource.resourceType === "ASSET").length} asset(s)
                            </Badge>
                          </HStack>
                          {activeRunStep.status === "RUNNING" && activeRunStep.requiresTimer ? (
                            <Text mt={2} fontSize="xs" color="orange.600" fontWeight="semibold">
                              Clock running: {formatDuration(getStepRemainingSeconds(activeRunStep))} remaining
                            </Text>
                          ) : null}
                        </Box>

                        <VStack align="end" spacing={2}>
                          <HStack flexWrap="wrap" justify="end">
                            <Button size="xs" colorScheme="teal" leftIcon={<Play size={14} />} onClick={() => startStep(activeRunStep.id)} isDisabled={activeRunStep.status !== "READY" || isLocked}>
                              Start
                            </Button>
                            <Button size="xs" colorScheme="green" leftIcon={<Timer size={14} />} onClick={() => completeStep(activeRunStep.id)} isDisabled={activeRunStep.status !== "RUNNING" || isLocked}>
                              Complete
                            </Button>
                          </HStack>
                        </VStack>
                      </HStack>
                    </CardBody>
                  </Card>
                ) : null}

                {orderedSteps.length > 1 ? (
                  <Text fontSize="sm" color="text.secondary">
                    {orderedSteps.length - 1} more step(s) are queued behind the active one.
                  </Text>
                ) : null}
              </VStack>
            ) : null}

            {showCaptureView ? (
              <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
                <CardBody p={4}>
                  <HStack justify="space-between" align="start" spacing={4} mb={4}>
                    <HStack spacing={2}>
                      <Icon as={Package} color="teal.600" />
                      <Box>
                        <Text fontWeight="bold" color="text.primary">
                          Capture results
                        </Text>
                        <Text fontSize="sm" color="text.secondary">
                          Create the result record for the active packet, then add metrics and select the final result.
                        </Text>
                      </Box>
                    </HStack>
                    <Badge colorScheme={allStepsDone ? "green" : "gray"} variant="subtle">
                      {allStepsDone ? "Ready for result capture" : "Waiting for steps"}
                    </Badge>
                  </HStack>

                  <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                    <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                      <VStack align="stretch" spacing={3}>
                        <Box>
                          <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                            Result packet
                          </Text>
                          <Text mt={1} fontWeight="semibold" color="text.primary">
                            {activePacket ? activePacket.code : "No packet loaded"}
                          </Text>
                          <Text fontSize="sm" color="text.secondary">
                            {activePacket ? `Quantity ${activePacket.quantity} · ${activePacket.status}` : "Load the accepted sample work to begin capture."}
                          </Text>
                        </Box>

                        <Box>
                          <Text fontSize="sm" color="text.secondary">
                            {activePacket && activePacket.status === "USED"
                              ? "This packet already has a result record."
                              : "Use this packet to create the result record once the process is complete."}
                          </Text>
                        </Box>

                        {activePacket && activePacket.status !== "USED" ? (
                          <Button colorScheme="teal" alignSelf="start" onClick={() => onCreateResult(activePacket.id)} isDisabled={isLocked || !allStepsDone}>
                            Create Result
                          </Button>
                        ) : (
                          <Badge colorScheme="green" variant="subtle" alignSelf="start">
                            Result created
                          </Badge>
                        )}
                      </VStack>
                    </Box>

                    <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                      <VStack align="stretch" spacing={3}>
                        <Box>
                          <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                            Result summary
                          </Text>
                          <Text mt={1} fontWeight="semibold" color="text.primary">
                            {selectedResult ? `Result #${selectedResult.trialNo}` : "No result selected"}
                          </Text>
                          <Text fontSize="sm" color="text.secondary">
                            {selectedResult ? `${selectedResult.packetCode} · ${selectedResult.measurements.length} metric(s)` : "Select the result record to add metrics and release it."}
                          </Text>
                        </Box>

                        {selectedResult ? (
                          <>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme={selectedResult.status === "Selected" ? "purple" : selectedResult.status === "Complete" ? "green" : selectedResult.status === "Incomplete" ? "orange" : "gray"} variant="subtle">
                                {selectedResult.status}
                              </Badge>
                              <Badge colorScheme="gray" variant="subtle">
                                {selectedResult.measurements.length} metric(s)
                              </Badge>
                            </HStack>

                            <Text fontSize="sm" color="text.secondary">
                              Add one or more metrics for Ni, Co, Li, purity, yield, mass balance, or decision. Open the inspector to edit the fields.
                            </Text>

                            <HStack spacing={2} flexWrap="wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  addMetric(selectedResult.id);
                                  setSelection({ type: "TRIAL", id: selectedResult.id });
                                  setInspectorOpen(true);
                                }}
                                isDisabled={isLocked}
                              >
                                Add Metric
                              </Button>
                              <Button size="sm" colorScheme="purple" onClick={() => selectFinalResult(selectedResult.id)} isDisabled={isLocked || !selectedResult.measurements.length || selectedResultId === selectedResult.id}>
                                {selectedResultId === selectedResult.id ? "Selected for release" : "Select Result"}
                              </Button>
                            </HStack>
                          </>
                        ) : (
                          <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
                            <Text fontSize="sm" color="text.secondary">
                              No result record has been selected yet.
                            </Text>
                          </Box>
                        )}
                      </VStack>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>
            ) : null}

            {showReviewView ? (
              <Stack spacing={3}>
                <HStack justify="space-between" align="start" spacing={4}>
                  <HStack spacing={2}>
                    <Icon as={Package} color="purple.600" />
                    <Text fontWeight="bold" color="text.primary">
                      Review release
                    </Text>
                  </HStack>
                  <Badge colorScheme={selectedResult ? "green" : "gray"} variant="subtle">
                    {selectedResult ? `Result #${selectedResult.trialNo}` : "No selected result"}
                  </Badge>
                </HStack>

                {selectedResult ? (
                  <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                    <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                      Selected result for release
                    </Text>
                    <Text fontSize="sm" color="text.secondary" mt={1}>
                      {selectedResult.packetCode} · {selectedResult.measurements.length} metric(s)
                    </Text>
                    <HStack mt={3} spacing={2} flexWrap="wrap">
                      {[
                        ["Ni", processResultSummary.niRecovery],
                        ["Co", processResultSummary.coRecovery],
                        ["Li", processResultSummary.liRecovery],
                        ["Purity", processResultSummary.purity],
                        ["Yield", processResultSummary.yield],
                        ["Balance", processResultSummary.massBalance],
                        ["Decision", processResultSummary.decision],
                      ].map(([label, value]) => (
                        <Badge key={label} variant="subtle" colorScheme="gray" borderRadius="full" px={2.5} py={1}>
                          {label}: {value}
                        </Badge>
                      ))}
                    </HStack>
                    <Button mt={4} colorScheme="purple" onClick={() => selectedResult && selectFinalResult(selectedResult.id)} isDisabled={isLocked || !selectedResult || !selectedResult.measurements.length}>
                      Release Record
                    </Button>
                  </Box>
                ) : (
                  <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
                    <Text fontSize="sm" color="text.secondary">
                      Select a complete result to review it for release.
                    </Text>
                  </Box>
                )}
              </Stack>
            ) : null}

            {showArchiveView ? (
              <Stack spacing={3}>
                <HStack justify="space-between" align="start" spacing={4}>
                  <HStack spacing={2}>
                    <Icon as={Package} color="gray.600" />
                    <Text fontWeight="bold" color="text.primary">
                      Archive
                    </Text>
                  </HStack>
                  <Badge colorScheme="gray" variant="subtle">
                    Locked
                  </Badge>
                </HStack>
                <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                  <Text fontSize="sm" color="text.secondary">
                    The record is locked and read-only. Use the selected result and audit trail for reference.
                  </Text>
                </Box>
              </Stack>
            ) : null}

            {(showRunView || showCaptureView || showReviewView) && reminderEvents.length > 0 ? (
              <>
                <Divider my={4} />
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between" align="start" spacing={4}>
                    <HStack spacing={2}>
                      <Icon as={Boxes} color="teal.600" />
                      <Text fontWeight="bold" color="text.primary">
                        Completion Reminders
                      </Text>
                    </HStack>
                    <Badge colorScheme="gray" variant="subtle">
                      {reminderEvents.length} queued
                    </Badge>
                  </HStack>
                  {reminderEvents.slice(0, 4).map((event) => (
                    <Box key={event.id} p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                      <HStack justify="space-between" align="start" spacing={3}>
                        <Box minW={0}>
                          <Text fontWeight="semibold" color="text.primary">
                            {event.title}
                          </Text>
                          <Text fontSize="sm" color="text.secondary">
                            {event.subtitle}
                          </Text>
                        </Box>
                        <Text fontSize="xs" color="text.secondary">
                          {event.at}
                        </Text>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
      </Stack>

      <QuickEditDrawer
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Add Step / Process"
        onSave={() => setLibraryOpen(false)}
        saveLabel="Done"
        size="full"
      >
        <VStack align="stretch" spacing={4}>
          <Box>
            <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold" mb={2}>
              Process Stages
            </Text>
            <VStack align="stretch" spacing={2}>
              {availableStepTypes.map((step) => (
                <Box key={step.id} p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                  <HStack justify="space-between" align="start" spacing={3}>
                    <Box>
                      <Text fontWeight="semibold" color="text.primary">
                        {step.name}
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        {step.defaultDurationSeconds}s · {step.requiresTimer ? "Timer" : "No timer"} · {step.ownerRole}
                      </Text>
                      <Text fontSize="xs" color="text.secondary">
                        Reminder: {step.reminderRule.replaceAll("_", " ").toLowerCase()}
                      </Text>
                    </Box>
                    <Button size="sm" onClick={() => onAddStep(step.id)} isDisabled={isLocked || !isBuildMode}>
                      Add
                    </Button>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </Box>

          <Divider />

          {selectedStep ? (
            <Box>
              <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold" mb={2}>
                Select Resources for {selectedStep.name}
              </Text>
              <Stack spacing={3}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="text.primary" mb={2}>
                    Chemicals
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {chemicalsMaster.map((chemical) => (
                      <Box key={chemical.id} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                        <HStack justify="space-between" spacing={3}>
                          <Box minW={0}>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary" noOfLines={1}>
                              {chemical.name}
                            </Text>
                            <Text fontSize="xs" color="text.secondary">
                              {chemical.stockQuantity} {chemical.baseUnit} · {getChemicalStockState(chemical)}
                            </Text>
                          </Box>
                          <Button size="sm" variant="outline" onClick={() => onAddChemical(selectedStep.id, chemical.id)} isDisabled={isLocked || !isBuildMode}>
                            Add
                          </Button>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="text.primary" mb={2}>
                    Assets
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {assetsMaster.map((asset) => (
                      <Box key={asset.id} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                        <HStack justify="space-between" spacing={3}>
                          <Box minW={0}>
                            <Text fontSize="sm" fontWeight="semibold" color="text.primary" noOfLines={1}>
                              {asset.name}
                            </Text>
                            <Text fontSize="xs" color="text.secondary">
                              {asset.code} · {asset.availabilityStatus}
                            </Text>
                          </Box>
                          <Button size="sm" variant="outline" onClick={() => onAddAsset(selectedStep.id, asset.id)} isDisabled={isLocked || !isBuildMode}>
                            Add
                          </Button>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              </Stack>
            </Box>
          ) : (
            <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
              <Text fontSize="sm" color="text.secondary">
                Select a step on the process board to see the selectable resources.
              </Text>
            </Box>
          )}
        </VStack>
      </QuickEditDrawer>

      <QuickEditDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="Inspector"
        onSave={() => setInspectorOpen(false)}
        saveLabel="Done"
        size="full"
      >
        {!selection ? (
          <Text fontSize="sm" color="text.secondary">
            Select a step, result, or blocker to inspect details.
          </Text>
        ) : null}

        {selection?.type === "VALIDATION" ? (
          <VStack align="stretch" spacing={2}>
            <Text fontSize="sm" fontWeight="semibold" color="text.primary">
              Blocking Validation Issues
            </Text>
            {validationErrors.length === 0 ? (
              <Text fontSize="sm" color="green.600">
                No issues.
              </Text>
            ) : (
              validationErrors.map((error) => (
                <Box key={error} p={2.5} bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="lg">
                  <Text fontSize="sm" color="red.700">
                    {error}
                  </Text>
                </Box>
              ))
            )}
          </VStack>
        ) : null}

        {selectedStep ? (
          <VStack align="stretch" spacing={4}>
            <Box>
              <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                Step
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="text.primary" mt={1}>
                {selectedStep.name}
              </Text>
            </Box>

            <Box>
              <Text fontSize="sm" color="text.secondary" mb={1}>
                Duration (seconds)
              </Text>
              <Input
                type="number"
                value={selectedStep.durationSeconds}
                onChange={(event) => updateStepField(selectedStep.id, { durationSeconds: Number(event.target.value) || 0 })}
                isDisabled={!isBuildMode || isLocked}
              />
            </Box>

            <SimpleGrid columns={2} spacing={3}>
              <Box>
                <Text fontSize="sm" color="text.secondary" mb={1}>
                  Owner role
                </Text>
                <Select
                  value={selectedStep.ownerRole}
                  onChange={(event) => updateStepField(selectedStep.id, { ownerRole: event.target.value as PlaygroundStep["ownerRole"] })}
                  isDisabled={!isBuildMode || isLocked}
                >
                  <option value="TECHNICIAN">Technician</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="SUPERVISOR">Supervisor</option>
                </Select>
              </Box>
              <Box>
                <Text fontSize="sm" color="text.secondary" mb={1}>
                  Reminder rule
                </Text>
                <Select
                  value={selectedStep.reminderRule}
                  onChange={(event) => updateStepField(selectedStep.id, { reminderRule: event.target.value as PlaygroundStep["reminderRule"] })}
                  isDisabled={!isBuildMode || isLocked}
                >
                  <option value="NEXT_OWNER">Next owner</option>
                  <option value="OWNER">Owner only</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="NONE">None</option>
                </Select>
              </Box>
            </SimpleGrid>

            <Box>
              <Text fontSize="sm" color="text.secondary" mb={1}>
                Due minutes
              </Text>
              <Input
                type="number"
                value={selectedStep.dueMinutes}
                onChange={(event) => updateStepField(selectedStep.id, { dueMinutes: Number(event.target.value) || 0 })}
                isDisabled={!isBuildMode || isLocked}
              />
            </Box>

            <Box>
              <Text fontSize="sm" color="text.secondary" mb={1}>
                Instructions
              </Text>
              <Textarea
                value={selectedStep.instructions}
                onChange={(event) => updateStepField(selectedStep.id, { instructions: event.target.value })}
                isDisabled={!isBuildMode || isLocked}
              />
            </Box>

            <Box>
              <Text fontSize="sm" color="text.secondary" mb={1}>
                Notes
              </Text>
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
                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                  Chemicals
                </Text>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {selectedStepChemicals.length === 0 ? (
                  <Text fontSize="sm" color="text.secondary">
                    No records.
                  </Text>
                ) : (
                  selectedStepChemicals.map((resource) => {
                    const chemical = chemicalsMaster.find((item) => item.id === resource.resourceId);
                    if (!chemical) return null;

                    return (
                      <Box key={resource.id} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                        <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                          {chemical.name}
                        </Text>
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
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
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
                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                  Assets
                </Text>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {selectedStepAssets.length === 0 ? (
                  <Text fontSize="sm" color="text.secondary">
                    No records.
                  </Text>
                ) : (
                  selectedStepAssets.map((resource) => {
                    const asset = assetsMaster.find((item) => item.id === resource.resourceId);
                    if (!asset) return null;
                    return (
                      <Box key={resource.id} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                            {asset.name}
                          </Text>
                          <Badge colorScheme={asset.availabilityStatus === "AVAILABLE" ? "green" : "orange"} variant="subtle">
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

        {selectedResult ? (
          <VStack align="stretch" spacing={3}>
            <Box>
              <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                Result Record
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="text.primary" mt={1}>
                Result #{selectedResult.trialNo}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                Packet: {selectedResult.packetCode}
              </Text>
            </Box>

            <Button leftIcon={<Plus size={14} />} size="sm" onClick={() => addMetric(selectedResult.id)} isDisabled={isLocked}>
              Add Result Metric
            </Button>

            <VStack align="stretch" spacing={2}>
              {selectedResult.measurements.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  No records.
                </Text>
              ) : (
                selectedResult.measurements.map((measurement) => (
                  <Box key={measurement.id} p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                    <SimpleGrid columns={2} spacing={2}>
                      <Select
                        value={measurement.elementCode}
                          onChange={(event) =>
                          updateMetric(selectedResult.id, measurement.id, {
                            elementCode: event.target.value,
                          })
                        }
                        isDisabled={isLocked}
                      >
                        {[
                          ["NI_RECOVERY", "Ni Recovery"],
                          ["CO_RECOVERY", "Co Recovery"],
                          ["LI_RECOVERY", "Li Recovery"],
                          ["PURITY", "Purity"],
                          ["YIELD", "Yield"],
                          ["MASS_BALANCE", "Mass Balance"],
                          ["DECISION", "Decision"],
                        ].map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        placeholder="Value"
                        value={measurement.value}
                          onChange={(event) =>
                          updateMetric(selectedResult.id, measurement.id, {
                            value: event.target.value,
                          })
                        }
                        isDisabled={isLocked}
                      />
                      <Input
                        placeholder="Unit"
                        value={measurement.unit}
                          onChange={(event) =>
                          updateMetric(selectedResult.id, measurement.id, {
                            unit: event.target.value,
                          })
                        }
                        isDisabled={isLocked}
                      />
                      <Input
                        placeholder="Remarks"
                        value={measurement.remarks}
                          onChange={(event) =>
                          updateMetric(selectedResult.id, measurement.id, {
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
      </QuickEditDrawer>
    </>
  );
}
