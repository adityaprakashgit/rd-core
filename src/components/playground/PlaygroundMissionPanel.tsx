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
import { Beaker, Boxes, FlaskConical, Package, Play, Plus, Timer, Wrench } from "lucide-react";
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

type ResultRecord = {
  id: string;
  packetId: string;
  packetCode: string;
  resultNo: number;
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
  results: ResultRecord[];
  reminderEvents: ReminderEvent[];
  selectedProcessTemplateId: string | null;
  onApplyProcessTemplate: (templateId: string) => void;
  processResultSummary: ProcessResultSummary;
  orderedSteps: ExperimentStep[];
  selectedStep: ExperimentStep | null;
  selectedResult: ResultRecord | null;
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
  moveStep: (stepId: string, direction: "UP" | "DOWN") => void;
  deleteStep: (stepId: string) => void;
  startStep: (stepId: string) => void;
  completeStep: (stepId: string) => void;
  onResultDrop: (event: DragEvent<HTMLDivElement>) => void;
  updateStepField: (stepId: string, patch: Partial<ExperimentStep>) => void;
  updateResource: (stepId: string, resourceId: string, patch: Partial<StepResource>) => void;
  addMetric: (resultId: string) => void;
  updateMetric: (resultId: string, measurementId: string, patch: Partial<Measurement>) => void;
  selectFinalResult: (resultId: string) => void;
  setSelection: (selection: Selection) => void;
  getChemicalStockState: (chemical: Chemical) => "In Stock" | "Low Stock" | "Out of Stock";
  getStepRemainingSeconds: (step: ExperimentStep) => number;
  stepStatusLabel: (status: StepStatus) => string;
  onAddStep: (stepMasterId: string) => void;
  onAddChemical: (stepId: string, chemicalId: string) => void;
  onAddAsset: (stepId: string, assetId: string) => void;
  onCreateResult: (packetId: string) => void;
};

export function PlaygroundMissionPanel({
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
  results,
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
  moveStep,
  deleteStep,
  startStep,
  completeStep,
  onResultDrop,
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

  const availableStepTypes = useMemo(() => stepMasters, [stepMasters]);
  const currentProcessTemplate = useMemo(
    () => processTemplates.find((template) => template.id === selectedProcessTemplateId) ?? null,
    [processTemplates, selectedProcessTemplateId]
  );

  return (
    <>
      <Stack spacing={4}>
        <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
          <CardBody p={4}>
            <HStack justify="space-between" align="start" spacing={4} mb={3}>
              <HStack spacing={2}>
                <Icon as={FlaskConical} color="purple.600" />
                <Box>
                  <Text fontWeight="bold" color="text.primary">
                    Process Builder
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    Apply a whole process template or add one step at a time.
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

            <VStack align="stretch" spacing={2.5}>
              {processTemplates.map((template) => (
                <Box
                  key={template.id}
                  p={3}
                  borderWidth="1px"
                  borderColor={selectedProcessTemplateId === template.id ? "brand.300" : "border.default"}
                  borderRadius="lg"
                  bg={selectedProcessTemplateId === template.id ? "bg.rail" : "bg.surface"}
                >
                  <HStack justify="space-between" align="start" spacing={3}>
                    <Box minW={0}>
                      <Text fontWeight="semibold" color="text.primary">
                        {template.name}
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        {template.description}
                      </Text>
                      <Text fontSize="xs" color="text.secondary" mt={1}>
                        {template.stageIds.length} stages · {template.reminderMode}
                      </Text>
                    </Box>
                    <Button size="sm" variant="outline" onClick={() => onApplyProcessTemplate(template.id)} isDisabled={isLocked || !isBuildMode}>
                      Apply
                    </Button>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
          <CardBody p={4}>
            <HStack justify="space-between" align="start" spacing={4} mb={3}>
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
            <VStack align="stretch" spacing={2}>
              {reminderEvents.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  Reminders will appear when steps are completed.
                </Text>
              ) : (
                reminderEvents.slice(0, 4).map((event) => (
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
                ))
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none">
          <CardBody p={4}>
            <HStack justify="space-between" align="start" spacing={4} mb={3}>
              <HStack spacing={2}>
                <Icon as={Package} color="orange.600" />
                <Text fontWeight="bold" color="text.primary">
                  Hydromet Process Result
                </Text>
              </HStack>
              <Badge colorScheme={selectedResult ? "green" : "gray"} variant="subtle">
                {selectedResult ? `Result #${selectedResult.resultNo}` : "No selected result"}
              </Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} spacing={3}>
              {[
                ["Ni Recovery", processResultSummary.niRecovery],
                ["Co Recovery", processResultSummary.coRecovery],
                ["Li Recovery", processResultSummary.liRecovery],
                ["Purity", processResultSummary.purity],
                ["Yield", processResultSummary.yield],
                ["Mass Balance", processResultSummary.massBalance],
              ].map(([label, value]) => (
                <Box key={label} p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                  <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                    {label}
                  </Text>
                  <Text mt={1} fontWeight="semibold" color="text.primary">
                    {value}
                  </Text>
                </Box>
              ))}
              <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
                <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                  Decision
                </Text>
                <Text mt={1} fontWeight="semibold" color="text.primary">
                  {processResultSummary.decision}
                </Text>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>

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
                {acceptedWorkRows.map((row) => (
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
                    <HStack justify="space-between" align="start" spacing={3}>
                      <Box minW={0}>
                        <Text fontWeight="semibold" color="text.primary">
                          Job {row.rndJobNumber}
                        </Text>
                        <Text fontSize="sm" color="text.secondary" noOfLines={2}>
                          Packet {row.packetId} · Sample {row.sampleId} · {row.currentStep}
                        </Text>
                        <Text fontSize="xs" color="text.secondary" mt={1}>
                          {row.parentJobNumber} · {row.assignedUser} · {row.receivedDate}
                        </Text>
                      </Box>
                      <Button size="sm" variant="outline" onClick={() => onOpenMission(row.id)}>
                        {row.primaryAction}
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="lg" bg="bg.surface" shadow="none" onDragOver={(event) => event.preventDefault()} onDrop={onCanvasDrop}>
          <CardBody p={4}>
            <HStack justify="space-between" align="start" spacing={4} mb={4}>
              <HStack spacing={2}>
                <Icon as={FlaskConical} color="purple.600" />
                <Text fontWeight="bold" color="text.primary">
                  Process Control Panel
                </Text>
              </HStack>
              <HStack spacing={2} flexWrap="wrap" justify="end">
                <Button size="sm" variant="outline" onClick={() => setLibraryOpen(true)}>
                  Add Step / Process
                </Button>
                <Button size="sm" variant="outline" onClick={() => setInspectorOpen(true)} isDisabled={!selection}>
                  Inspect
                </Button>
              </HStack>
            </HStack>

            {currentMission ? (
              <Box mb={4} p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.canvas">
                <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
                  <Box>
                    <Text fontSize="xs" color="text.secondary" textTransform="uppercase" fontWeight="semibold">
                      Active Sample Batch
                    </Text>
                    <Text fontWeight="semibold" color="text.primary">
                      Job {currentMission.rndJobNumber}
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      Packet {currentMission.packetId} · Priority {currentMission.priority} · Due {currentMission.dueStatus}
                    </Text>
                  </Box>
                  <Button size="sm" variant="ghost" onClick={() => onOpenMission(currentMission.id)}>
                    Open Work
                  </Button>
                </HStack>
              </Box>
            ) : (
              <Box mb={4} p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
                <Text color="text.secondary">
                  Pick an accepted sample job above to begin the process.
                </Text>
              </Box>
            )}

            <VStack align="stretch" spacing={3}>
              {orderedSteps.length === 0 ? (
                <Box p={6} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg" textAlign="center">
                  <Text color="text.secondary">Add a step or apply a whole process to start the control path.</Text>
                </Box>
              ) : (
                orderedSteps.map((step) => {
                  const chemicalCount = step.resources.filter((resource) => resource.resourceType === "CHEMICAL").length;
                  const assetCount = step.resources.filter((resource) => resource.resourceType === "ASSET").length;
                  const remaining = getStepRemainingSeconds(step);

                  return (
                    <Card
                      key={step.id}
                      variant="outline"
                      borderRadius="lg"
                      borderColor={selection?.type === "STEP" && selection.id === step.id ? "brand.300" : "border.default"}
                      bg={selection?.type === "STEP" && selection.id === step.id ? "bg.rail" : "bg.surface"}
                      shadow="none"
                      onClick={() => setSelection({ type: "STEP", id: step.id })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onStepDrop(event, step.id)}
                      cursor="pointer"
                    >
                      <CardBody p={4}>
                        <HStack justify="space-between" align="start" spacing={4}>
                          <Box>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="purple" variant="subtle" borderRadius="full">
                                #{step.orderNo}
                              </Badge>
                              <Text fontWeight="semibold" color="text.primary">
                                {step.name}
                              </Text>
                              <Badge colorScheme={step.status === "DONE" ? "green" : step.status === "RUNNING" ? "orange" : step.status === "READY" ? "blue" : "gray"} variant="subtle" borderRadius="full">
                                {stepStatusLabel(step.status)}
                              </Badge>
                            </HStack>
                            <HStack mt={2} spacing={2} flexWrap="wrap">
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
                            <HStack flexWrap="wrap" justify="end">
                              <Button size="xs" variant="outline" onClick={() => moveStep(step.id, "UP")} isDisabled={!isBuildMode || isLocked}>
                                Up
                              </Button>
                              <Button size="xs" variant="outline" onClick={() => moveStep(step.id, "DOWN")} isDisabled={!isBuildMode || isLocked}>
                                Down
                              </Button>
                              <Button size="xs" colorScheme="red" variant="outline" onClick={() => deleteStep(step.id)} isDisabled={!isBuildMode || isLocked}>
                                Delete
                              </Button>
                            </HStack>
                            <HStack flexWrap="wrap" justify="end">
                              <Button size="xs" colorScheme="teal" leftIcon={<Play size={14} />} onClick={() => startStep(step.id)} isDisabled={step.status !== "READY" || isLocked}>
                                Start
                              </Button>
                              <Button size="xs" colorScheme="green" leftIcon={<Timer size={14} />} onClick={() => completeStep(step.id)} isDisabled={step.status !== "RUNNING" || isLocked}>
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

            <Divider my={4} />

            <Stack spacing={3}>
              <HStack justify="space-between" align="start" spacing={4}>
                <HStack spacing={2}>
                  <Icon as={Package} color="teal.600" />
                  <Text fontWeight="bold" color="text.primary">
                    Result Capture
                  </Text>
                </HStack>
                <Badge colorScheme={allStepsDone ? "green" : "gray"} variant="subtle">
                  {allStepsDone ? "Ready for result capture" : "Waiting for steps"}
                </Badge>
              </HStack>

              <Text fontSize="sm" color="text.secondary">
                Once the steps are complete, tap a packet to create a result record and keep the process moving.
              </Text>

              <VStack align="stretch" spacing={3}>
                {packets.map((packet) => (
                  <Box
                    key={packet.id}
                    p={3}
                    borderWidth="1px"
                    borderColor="border.default"
                    borderRadius="lg"
                    bg="bg.surface"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={onResultDrop}
                  >
                    <HStack justify="space-between" align="start" spacing={3}>
                      <Box>
                        <Text fontWeight="semibold" color="text.primary">
                          {packet.code}
                        </Text>
                        <Text fontSize="sm" color="text.secondary">
                          Quantity {packet.quantity} · {packet.status}
                        </Text>
                      </Box>
                      <Button size="sm" colorScheme="teal" onClick={() => onCreateResult(packet.id)} isDisabled={isLocked || packet.status !== "READY" || !allStepsDone}>
                        Create Result
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>

              <VStack align="stretch" spacing={3}>
                {results.length === 0 ? (
                  <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="border.default" borderRadius="lg">
                    <Text fontSize="sm" color="text.secondary">
                      No result records created yet.
                    </Text>
                  </Box>
                ) : (
                  results.map((result) => (
                    <Box
                      key={result.id}
                      p={3}
                      borderWidth="1px"
                      borderColor={selection?.type === "TRIAL" && selection.id === result.id ? "brand.300" : "border.default"}
                      borderRadius="lg"
                      bg={selectedResultId === result.id ? "bg.rail" : "bg.surface"}
                    >
                      <HStack justify="space-between" align="start" spacing={3}>
                        <Box onClick={() => setSelection({ type: "TRIAL", id: result.id })} cursor="pointer" minW={0}>
                      <Text fontWeight="semibold" color="text.primary">
                            Result #{result.resultNo}
                          </Text>
                          <Text fontSize="sm" color="text.secondary" noOfLines={1}>
                            {result.packetCode} · {result.measurements.length} metric(s)
                          </Text>
                        </Box>
                        <HStack>
                          <Badge colorScheme={result.status === "Selected" ? "purple" : result.status === "Complete" ? "green" : result.status === "Incomplete" ? "orange" : "gray"} variant="subtle">
                            {result.status}
                          </Badge>
                          <Button size="xs" colorScheme="purple" onClick={() => selectFinalResult(result.id)} isDisabled={isLocked}>
                            Select Result
                          </Button>
                        </HStack>
                      </HStack>
                    </Box>
                  ))
                )}
              </VStack>
            </Stack>
          </CardBody>
        </Card>
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
                  onChange={(event) => updateStepField(selectedStep.id, { ownerRole: event.target.value as ExperimentStep["ownerRole"] })}
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
                  onChange={(event) => updateStepField(selectedStep.id, { reminderRule: event.target.value as ExperimentStep["reminderRule"] })}
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
                Result #{selectedResult.resultNo}
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
