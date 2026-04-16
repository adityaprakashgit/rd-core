"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Image,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  PauseCircle,
  ShieldAlert,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint, TopErrorBanner } from "@/components/enterprise/AsyncState";
import { ProcessFlowLayout } from "@/components/enterprise/PageTemplates";
import { WorkflowStepTracker, type WorkflowStep } from "@/components/enterprise/WorkflowStepTracker";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  deriveInspectionAssessment,
  getSuggestedIssueCategoriesFromResponses,
  INSPECTION_ISSUE_CATEGORIES,
  isExceptionResponse,
} from "@/lib/inspection-checklist";
import {
  buildAssessmentResponses,
  getDecisionEnablement,
  getIssueDraftValidationErrors,
  getLotInspectionStatusPresentation,
  type InspectionIssueDraft,
  type InspectionResponseDraftMap,
} from "@/lib/inspection-workspace";
import { captureScrollY, logSaveUxEvent, restoreScrollY } from "@/lib/ui-save-debug";
import type {
  InspectionChecklistItem,
  InspectionDecisionStatus,
  InspectionIssue,
  InspectionMediaCategory,
  InspectionMediaFile,
  LotInspectionRecord,
} from "@/types/inspection";

type InspectionAssessment = ReturnType<typeof deriveInspectionAssessment>;

type InspectionExecutionPayload = {
  lot: {
    id: string;
    jobId: string;
    lotNumber: string;
    materialName?: string | null;
    materialCategory?: string | null;
    totalBags: number;
    bagCount?: number | null;
    pieceCount?: number | null;
    weightUnit?: string | null;
    remarks?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    job: {
      id: string;
      clientName: string;
      commodity: string;
      status: string;
    };
  };
  checklistItems: InspectionChecklistItem[];
  inspection: LotInspectionRecord | null;
  assessment: InspectionAssessment | null;
  suggestedIssueCategories: string[];
};

const LOT_OVERVIEW_CATEGORY: InspectionMediaCategory = "LOT_OVERVIEW";
const REVIEW_STEP_INDEX = 1;

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildResponseDrafts(
  checklistItems: InspectionChecklistItem[],
  responses: LotInspectionRecord["responses"] | undefined,
): InspectionResponseDraftMap {
  const responseByItemId = new Map((responses ?? []).map((response) => [response.checklistItemMasterId, response]));
  return checklistItems.reduce<InspectionResponseDraftMap>((acc, item) => {
    const response = responseByItemId.get(item.id);
    acc[item.id] = {
      responseValue: response?.responseValue ?? "",
      responseText: response?.responseText ?? "",
    };
    return acc;
  }, {});
}

function getDecisionTone(status: InspectionDecisionStatus | string | undefined) {
  switch (status) {
    case "READY_FOR_SAMPLING":
      return { colorScheme: "green", label: "Ready for sampling", icon: ShieldCheck };
    case "ON_HOLD":
      return { colorScheme: "orange", label: "On hold", icon: PauseCircle };
    case "REJECTED":
      return { colorScheme: "red", label: "Rejected", icon: ShieldAlert };
    default:
      return { colorScheme: "gray", label: "Inspection pending", icon: ClipboardList };
  }
}

function getSeverityColor(value: string) {
  if (value === "CRITICAL") {
    return "red";
  }
  if (value === "MODERATE") {
    return "orange";
  }
  return "yellow";
}

function mapServerIssuesToDrafts(issues: LotInspectionRecord["issues"] | undefined): InspectionIssueDraft[] {
  return (issues ?? []).map((issue) => ({
    issueCategory: issue.issueCategory,
    severity: issue.severity,
    description: issue.description,
    status: issue.status,
  }));
}

function mergeIncompleteIssueDrafts(
  serverIssues: InspectionIssueDraft[],
  localIssues: InspectionIssueDraft[],
): InspectionIssueDraft[] {
  const incompleteLocalIssues = localIssues.filter((issue) => getIssueDraftValidationErrors([issue]).length > 0);
  if (incompleteLocalIssues.length === 0) {
    return serverIssues;
  }

  const serialized = new Set(serverIssues.map((issue) => `${issue.issueCategory}|${issue.severity}|${issue.description}|${issue.status}`));
  return [
    ...serverIssues,
    ...incompleteLocalIssues.filter((issue) => !serialized.has(`${issue.issueCategory}|${issue.severity}|${issue.description}|${issue.status}`)),
  ];
}

function toAssessmentIssues(issues: InspectionIssueDraft[], inspectionId: string) {
  return issues.map((issue, index) => ({
    id: `draft-issue-${index}`,
    inspectionId,
    issueCategory: issue.issueCategory,
    severity: issue.severity,
    description: issue.description,
    status: issue.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })) as InspectionIssue[];
}

export function LotInspectionWorkspace({
  backHref,
}: {
  backHref: (jobId: string, viewMode: string) => string;
}) {
  const { jobId, lotId } = useParams<{ jobId: string; lotId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { viewMode } = useWorkspaceView();

  const [loading, setLoading] = useState(true);
  const [isRefreshingWorkspace, setIsRefreshingWorkspace] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InspectionExecutionPayload | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<InspectionResponseDraftMap>({});
  const [issueDrafts, setIssueDrafts] = useState<InspectionIssueDraft[]>([]);
  const [overallRemark, setOverallRemark] = useState("");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});

  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const exceptionSummaryRef = useRef<HTMLDivElement | null>(null);
  const previousExceptionCountRef = useRef(0);

  async function loadWorkspace(options?: { preserveIncompleteIssues?: boolean; initial?: boolean; silent?: boolean; keepScrollY?: number | null }) {
    const isInitial = options?.initial ?? false;
    const isSilent = options?.silent ?? false;
    const keepScrollY = options?.keepScrollY ?? (!isInitial && isSilent ? captureScrollY() : null);
    if (isInitial) {
      setLoading(true);
    } else if (!isSilent) {
      setIsRefreshingWorkspace(true);
    }
    setLoadError(null);
    setSurfaceError(null);

    try {
      const inspectionRes = await fetch(`/api/inspection/execution?lotId=${lotId}&jobId=${jobId}`);

      if (!inspectionRes.ok) {
        const errorPayload = await inspectionRes.json().catch(() => null);
        throw new Error(errorPayload?.details ?? "Failed to load inspection workspace.");
      }

      const inspectionPayload = (await inspectionRes.json()) as InspectionExecutionPayload;
      const nextIssueDrafts = mapServerIssuesToDrafts(inspectionPayload.inspection?.issues);

      setPayload(inspectionPayload);
      setResponseDrafts(buildResponseDrafts(inspectionPayload.checklistItems, inspectionPayload.inspection?.responses));
      setIssueDrafts(
        options?.preserveIncompleteIssues
          ? mergeIncompleteIssueDrafts(nextIssueDrafts, issueDrafts)
          : nextIssueDrafts,
      );
      setOverallRemark(inspectionPayload.inspection?.overallRemark ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load inspection workspace.";
      setLoadError(message);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else if (!isSilent) {
        setIsRefreshingWorkspace(false);
      }
      restoreScrollY(keepScrollY);
    }
  }

  useEffect(() => {
    void loadWorkspace({ initial: true });
  }, [lotId]);

  const checklistItems = payload?.checklistItems ?? [];
  const assessmentResponses = buildAssessmentResponses(checklistItems, responseDrafts, isExceptionResponse);
  const mediaFiles = payload?.inspection?.mediaFiles ?? [];
  const mediaByCategory = new Map(mediaFiles.map((file) => [file.category, file] as const));
  const lotOverviewMedia = mediaByCategory.get(LOT_OVERVIEW_CATEGORY) as InspectionMediaFile | undefined;
  const hasLotOverviewPhoto = Boolean(lotOverviewMedia);
  const localAssessment = payload
    ? deriveInspectionAssessment({
        items: checklistItems,
        responses: assessmentResponses,
        issues: toAssessmentIssues(issueDrafts, payload.inspection?.id ?? "draft"),
        mediaCategories: mediaFiles.map((file) => file.category),
      })
    : null;
  const suggestedIssueCategories = payload
    ? getSuggestedIssueCategoriesFromResponses(checklistItems, assessmentResponses)
    : [];
  const lotStatus = getLotInspectionStatusPresentation(payload?.lot ?? null);
  const decisionEnablement = localAssessment
    ? getDecisionEnablement({
        assessment: localAssessment,
        issues: issueDrafts,
        overallRemark,
      })
    : { passErrors: [], holdErrors: [], rejectErrors: [] };
  const isReviewStep = currentSectionIndex === REVIEW_STEP_INDEX;
  const currentStepLabel = isReviewStep ? "Review & Decision" : "Lot Overview Photo";

  function openSampleManagement() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("stage", "sample");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  useEffect(() => {
    if (!payload) {
      return;
    }

    if (payload.inspection?.decisionStatus && payload.inspection.decisionStatus !== "PENDING") {
      setCurrentSectionIndex(REVIEW_STEP_INDEX);
      return;
    }

    setCurrentSectionIndex((current) => Math.min(current, REVIEW_STEP_INDEX));
  }, [payload?.inspection?.id]);

  useEffect(() => {
    if (issueDrafts.length > 0 || suggestedIssueCategories.length === 0) {
      return;
    }

    setIssueDrafts(
      suggestedIssueCategories.map((category) => ({
        issueCategory: category,
        severity: "MODERATE",
        description: "",
        status: "OPEN",
      })),
    );
  }, [issueDrafts.length, suggestedIssueCategories.join("|")]);

  useEffect(() => {
    const nextExceptionCount = localAssessment?.exceptionItems.length ?? 0;
    if (nextExceptionCount > previousExceptionCountRef.current) {
      requestAnimationFrame(() => {
        exceptionSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    previousExceptionCountRef.current = nextExceptionCount;
  }, [localAssessment?.exceptionItems.length]);

  function addIssue() {
    setIssueDrafts((current) => [
      ...current,
      {
        issueCategory: suggestedIssueCategories.find(
          (category) => !current.some((issue) => issue.issueCategory === category),
        ) ?? "Other",
        severity: "MODERATE",
        description: "",
        status: "OPEN",
      },
    ]);
  }

  function updateIssue(index: number, patch: Partial<InspectionIssueDraft>) {
    setIssueDrafts((current) =>
      current.map((issue, issueIndex) => (issueIndex === index ? { ...issue, ...patch } : issue)),
    );
  }

  function removeIssue(index: number) {
    setIssueDrafts((current) => current.filter((_, issueIndex) => issueIndex !== index));
  }

  async function startInspection() {
    setStarting(true);
    logSaveUxEvent("save_started", { source: "LotInspection:startInspection" });
    try {
      const response = await fetch("/api/inspection/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, lotId, caller: "LotInspectionWorkspace" }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.details ?? "Failed to start inspection.");
      }

      toast({ title: "Inspection started", status: "success" });
      setSurfaceError(null);
      await loadWorkspace({ initial: false, silent: true });
      logSaveUxEvent("save_success", { source: "LotInspection:startInspection" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start inspection.";
      setSurfaceError(message);
      logSaveUxEvent("save_failed", { source: "LotInspection:startInspection", message });
      toast({ title: "Inspection start failed", description: message, status: "error" });
    } finally {
      setStarting(false);
    }
  }

  async function saveInspection(decisionStatus?: InspectionDecisionStatus) {
    if (!payload) {
      return;
    }

    setSaving(true);
    logSaveUxEvent("save_started", { source: "LotInspection:saveInspection", decisionStatus: decisionStatus ?? "PENDING" });
    try {
      const response = await fetch("/api/inspection/execution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotId,
          caller: "LotInspectionWorkspace",
          responses: checklistItems.map((item) => ({
            checklistItemMasterId: item.id,
            responseValue: responseDrafts[item.id]?.responseValue ?? "",
            responseText: responseDrafts[item.id]?.responseText ?? "",
          })),
          issues: issueDrafts,
          overallRemark,
          ...(decisionStatus ? { decisionStatus } : {}),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.details ?? "Failed to save inspection.");
      }

      const nextPayload = (await response.json()) as InspectionExecutionPayload;
      const serverIssues = mapServerIssuesToDrafts(nextPayload.inspection?.issues);

      setPayload(nextPayload);
      setResponseDrafts(buildResponseDrafts(nextPayload.checklistItems, nextPayload.inspection?.responses));
      setIssueDrafts(decisionStatus ? serverIssues : mergeIncompleteIssueDrafts(serverIssues, issueDrafts));
      setOverallRemark(nextPayload.inspection?.overallRemark ?? "");
      if (decisionStatus) {
        setCurrentSectionIndex(REVIEW_STEP_INDEX);
      }

      toast({
        title: decisionStatus ? getDecisionTone(decisionStatus).label : "Inspection progress saved",
        status: "success",
      });
      logSaveUxEvent("save_success", { source: "LotInspection:saveInspection", decisionStatus: decisionStatus ?? "PENDING" });
      setSurfaceError(null);
      if (decisionStatus === "READY_FOR_SAMPLING") {
        openSampleManagement();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save inspection.";
      setSurfaceError(message);
      logSaveUxEvent("save_failed", { source: "LotInspection:saveInspection", decisionStatus: decisionStatus ?? "PENDING", message });
      toast({ title: "Inspection save failed", description: message, status: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(category: InspectionMediaCategory, file: File) {
    if (!payload?.inspection?.id) {
      setSurfaceError("Start the inspection first.");
      toast({ title: "Start the inspection first", status: "warning" });
      return;
    }

    setUploadingCategory(category);
    logSaveUxEvent("save_started", { source: "LotInspection:uploadMedia", category });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lotId", lotId);
      formData.append("inspectionId", payload.inspection.id);
      formData.append("category", category);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.details ?? "Failed to upload media.");
      }

      toast({ title: `${category.replaceAll("_", " ").toLowerCase()} uploaded`, status: "success" });
      setEvidenceErrors((prev) => ({ ...prev, [category]: "" }));
      setSurfaceError(null);
      await loadWorkspace({ preserveIncompleteIssues: true, initial: false, silent: true });
      logSaveUxEvent("save_success", { source: "LotInspection:uploadMedia", category });
      if (category === LOT_OVERVIEW_CATEGORY) {
        setCurrentSectionIndex(REVIEW_STEP_INDEX);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload media.";
      setEvidenceErrors((prev) => ({ ...prev, [category]: message }));
      setSurfaceError(message);
      logSaveUxEvent("save_failed", { source: "LotInspection:uploadMedia", category, message });
      toast({ title: "Upload failed", description: message, status: "error" });
    } finally {
      setUploadingCategory(null);
    }
  }

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
        <InlineErrorState title="Inspection workspace unavailable" description={loadError} onRetry={() => void loadWorkspace({ initial: true })} />
      </ControlTowerLayout>
    );
  }

  if (!payload) {
    return (
      <ControlTowerLayout>
        <EmptyWorkState title="Lot inspection not found" description="The requested lot could not be loaded." />
      </ControlTowerLayout>
    );
  }

  const inspectionCompleted = Boolean(payload.inspection?.decisionStatus && payload.inspection.decisionStatus !== "PENDING");
  const stepTracker: WorkflowStep[] = [
    {
      id: "lot-overview",
      label: "Lot overview",
      state: inspectionCompleted || hasLotOverviewPhoto ? "completed" : isReviewStep ? "upcoming" : "current",
      timestamp: hasLotOverviewPhoto ? "Photo captured" : "Required",
    },
    {
      id: "review",
      label: "Review & Decision",
      state: inspectionCompleted ? "completed" : isReviewStep ? "current" : hasLotOverviewPhoto ? "next" : "upcoming",
      timestamp: `${issueDrafts.length} issue${issueDrafts.length === 1 ? "" : "s"}`,
    },
  ];
  const recommendationTone = getDecisionTone(localAssessment?.recommendedDecision);
  const reviewErrors = Array.from(
    new Set([
      ...decisionEnablement.passErrors,
      ...decisionEnablement.holdErrors,
      ...decisionEnablement.rejectErrors,
    ]),
  );

  function renderIssueEditor() {
    const issueValidationErrors = getIssueDraftValidationErrors(issueDrafts);

    return (
      <Card variant="outline" borderRadius="xl" ref={exceptionSummaryRef}>
        <CardBody p={6}>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between" align="start">
              <Box>
                <Text fontSize="xl" fontWeight="bold">Exception Summary</Text>
                <Text fontSize="sm" color="text.secondary">
                  Capture only real inspection issues that justify a hold or rejection.
                </Text>
              </Box>
              <Button size="sm" variant="outline" onClick={addIssue}>
                Add issue
              </Button>
            </HStack>

            {suggestedIssueCategories.length > 0 ? (
              <HStack spacing={2} flexWrap="wrap">
                {suggestedIssueCategories.map((category) => (
                  <Badge key={category} colorScheme="orange" variant="subtle" borderRadius="full" px={3} py={1}>
                    Suggested: {category}
                  </Badge>
                ))}
              </HStack>
            ) : null}

            {issueDrafts.length === 0 ? (
              <Box borderRadius="xl" bg="bg.rail" p={4}>
                <Text fontSize="sm" color="text.secondary">
                  No issue records yet. Add one only if the lot should be held or rejected.
                </Text>
              </Box>
            ) : null}

            {issueDrafts.map((issue, index) => (
              <Box key={`${issue.issueCategory}-${index}`} borderWidth="1px" borderColor="border.default" borderRadius="xl" p={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="semibold">Issue {index + 1}</Text>
                    <Button size="xs" variant="ghost" colorScheme="red" onClick={() => removeIssue(index)}>
                      Remove
                    </Button>
                  </HStack>

                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Category</FormLabel>
                    <Select
                      value={issue.issueCategory}
                      onChange={(event) => updateIssue(index, { issueCategory: event.target.value })}
                    >
                      <option value="">Select issue category</option>
                      {INSPECTION_ISSUE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Severity</FormLabel>
                    <HStack spacing={2} flexWrap="wrap">
                      {["MINOR", "MODERATE", "CRITICAL"].map((option) => (
                        <Button
                          key={option}
                          size="sm"
                          variant={issue.severity === option ? "solid" : "outline"}
                          colorScheme={issue.severity === option ? getSeverityColor(option) : "gray"}
                          onClick={() => updateIssue(index, { severity: option })}
                        >
                          {option.charAt(0) + option.slice(1).toLowerCase()}
                        </Button>
                      ))}
                    </HStack>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Description</FormLabel>
                    <Textarea
                      value={issue.description}
                      onChange={(event) => updateIssue(index, { description: event.target.value })}
                      placeholder="Describe what failed, how much is affected, and what review is needed."
                      rows={3}
                    />
                  </FormControl>
                </VStack>
              </Box>
            ))}

            {issueValidationErrors.length > 0 ? (
              <Box borderRadius="lg" bg="bg.rail" borderWidth="1px" borderColor="border.default" p={3}>
                <HStack align="start" spacing={2}>
                  <Icon as={AlertTriangle} boxSize={4} color="orange.600" mt={0.5} />
                  <Text fontSize="sm" color="text.primary">{issueValidationErrors[0]}</Text>
                </HStack>
              </Box>
            ) : null}
          </VStack>
        </CardBody>
      </Card>
    );
  }

  function renderReviewPanel() {
    return (
      <VStack align="stretch" spacing={4}>
        <Card variant="outline" borderRadius="xl">
          <CardBody p={6}>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between" align="start" flexWrap="wrap">
                <Box>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                    Review
                  </Text>
                  <Text fontSize="xl" fontWeight="bold" mt={1}>Decision and closeout</Text>
                </Box>
                <Badge colorScheme={recommendationTone.colorScheme} variant="subtle" borderRadius="full" px={3} py={1}>
                  Recommended: {recommendationTone.label}
                </Badge>
              </HStack>

              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                <SectionHint label="Lot overview" value={hasLotOverviewPhoto ? "Captured" : "Pending"} />
                <SectionHint label="Missing media" value={String(localAssessment?.missingRequiredMedia.length ?? 0)} />
                <SectionHint label="Issues" value={String(issueDrafts.length)} />
                <SectionHint label="Sampling" value={payload?.inspection?.decisionStatus === "READY_FOR_SAMPLING" ? "Open" : "Blocked"} />
              </SimpleGrid>

              <Box borderRadius="lg" bg="bg.rail" borderWidth="1px" borderColor="border.default" p={4}>
                <HStack align="start" spacing={3}>
                  <Icon as={recommendationTone.icon} boxSize={5} color={`${recommendationTone.colorScheme}.600`} mt={0.5} />
                  <VStack align="stretch" spacing={1}>
                    <Text fontWeight="semibold" color="text.primary">
                      System recommendation: {recommendationTone.label}
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      {recommendationTone.label === "Ready for sampling"
                        ? "The lot overview proof is captured and there are no blocking issues."
                        : recommendationTone.label === "On hold"
                          ? "A missing photo or non-final issue still needs review."
                          : recommendationTone.label === "Rejected"
                            ? "A critical issue blocks this lot from sampling."
                            : "Capture the lot overview photo, then choose pass, hold, or reject."}
                    </Text>
                  </VStack>
                </HStack>
              </Box>

              <FormControl>
                <FormLabel fontSize="sm" mb={1}>Inspection remark</FormLabel>
                <Textarea
                  value={overallRemark}
                  onChange={(event) => setOverallRemark(event.target.value)}
                  placeholder="Summarize the inspection outcome, review needs, or rejection rationale."
                  rows={4}
                />
              </FormControl>

              {reviewErrors.length > 0 ? (
                <Box borderRadius="lg" bg="bg.rail" borderWidth="1px" borderColor="border.default" p={3}>
                  <HStack align="start" spacing={2}>
                    <Icon as={AlertTriangle} boxSize={4} color="orange.600" mt={0.5} />
                    <Text fontSize="sm" color="text.primary">
                      {reviewErrors[0]}
                    </Text>
                  </HStack>
                </Box>
              ) : null}
            </VStack>
          </CardBody>
        </Card>

        {renderIssueEditor()}
      </VStack>
    );
  }

  function renderLotOverviewPanel() {
    const uploadError = evidenceErrors[LOT_OVERVIEW_CATEGORY] || null;

    return (
      <Card variant="outline" borderRadius="xl">
        <CardBody p={6}>
          <VStack align="stretch" spacing={5}>
            <HStack justify="space-between" align="start" flexWrap="wrap">
              <Box>
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                  Step 1
                </Text>
                <Text fontSize="xl" fontWeight="bold" mt={1}>Capture lot overview</Text>
                <Text fontSize="sm" color="text.secondary" mt={1}>
                  One clear lot overview photo is enough for the guided inspection flow.
                </Text>
              </Box>
              <Badge colorScheme={hasLotOverviewPhoto ? "green" : "orange"} variant="subtle" borderRadius="full" px={3} py={1}>
                {hasLotOverviewPhoto ? "Photo captured" : "Photo pending"}
              </Badge>
            </HStack>

            <Input
              type="file"
              accept="image/*"
              capture="environment"
              display="none"
              ref={(node) => {
                fileInputsRef.current[`${LOT_OVERVIEW_CATEGORY}:camera`] = node;
              }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadMedia(LOT_OVERVIEW_CATEGORY, file);
                }
                event.target.value = "";
              }}
            />
            <Input
              type="file"
              accept="image/*"
              display="none"
              ref={(node) => {
                fileInputsRef.current[`${LOT_OVERVIEW_CATEGORY}:device`] = node;
              }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadMedia(LOT_OVERVIEW_CATEGORY, file);
                }
                event.target.value = "";
              }}
            />

            <Box
              as="button"
              type="button"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor={uploadError ? "red.300" : hasLotOverviewPhoto ? "green.300" : "orange.300"}
              bg="bg.rail"
              borderRadius="lg"
              overflow="hidden"
              cursor="pointer"
              onClick={() => fileInputsRef.current[`${LOT_OVERVIEW_CATEGORY}:camera`]?.click()}
            >
              {lotOverviewMedia ? (
                <Image
                  src={lotOverviewMedia.storageKey}
                  alt="Lot overview"
                  h={{ base: "220px", md: "320px" }}
                  w="100%"
                  objectFit="cover"
                />
              ) : (
                <VStack spacing={3} py={{ base: 14, md: 20 }} px={6}>
                  <Icon as={Camera} boxSize={10} color="orange.500" />
                  <Text fontSize="lg" fontWeight="semibold">Tap to add lot overview photo</Text>
                  <Text fontSize="sm" color="text.secondary" textAlign="center" maxW="md">
                    Keep the full lot or bag stack visible in one frame so the operator can move straight to review.
                  </Text>
                </VStack>
              )}
            </Box>

            {uploadError ? (
              <Box borderRadius="xl" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                <HStack align="start" spacing={2}>
                  <Icon as={AlertTriangle} boxSize={4} color="red.600" mt={0.5} />
                  <Text fontSize="sm" color="red.700">{uploadError}</Text>
                </HStack>
              </Box>
            ) : null}

            <HStack spacing={3} flexWrap="wrap">
              <Button
                size="lg"
                leftIcon={hasLotOverviewPhoto ? <Camera size={16} /> : <Upload size={16} />}
                onClick={() => fileInputsRef.current[`${LOT_OVERVIEW_CATEGORY}:camera`]?.click()}
                isLoading={uploadingCategory === LOT_OVERVIEW_CATEGORY}
              >
                {hasLotOverviewPhoto ? "Retake photo" : "Capture lot overview"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => fileInputsRef.current[`${LOT_OVERVIEW_CATEGORY}:device`]?.click()}
                isLoading={uploadingCategory === LOT_OVERVIEW_CATEGORY}
              >
                Upload from device
              </Button>
              {lotOverviewMedia?.storageKey ? (
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.open(lotOverviewMedia.storageKey, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  View photo
                </Button>
              ) : null}
              <Button
                size="lg"
                variant="outline"
                display={{ base: "none", lg: "inline-flex" }}
                rightIcon={<ChevronRight size={16} />}
                onClick={() => setCurrentSectionIndex(REVIEW_STEP_INDEX)}
              >
                Review decision
              </Button>
            </HStack>

            <Box borderRadius="xl" bg="bg.rail" p={4}>
              <Text fontSize="sm" color="text.secondary">
                The photo uploads immediately after selection. There is no extra save step for inspection proof.
              </Text>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  function renderSamplingPanel() {
    if (payload?.inspection?.decisionStatus !== "READY_FOR_SAMPLING") {
      return null;
    }

    return (
      <Card variant="outline" borderRadius="xl">
        <CardBody p={6}>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between" align="start">
              <Box>
                <Text fontSize="xl" fontWeight="bold">Sampling unlocked</Text>
                <Text fontSize="sm" color="text.secondary">
                  Inspection is complete. Continue in Sample Management for sample creation, proof, homogenization, and sealing.
                </Text>
              </Box>
              <Badge colorScheme="green" variant="subtle" borderRadius="full" px={3} py={1}>
                Ready
              </Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <SectionHint label="Sample record" value="Next" />
              <SectionHint label="Proof capture" value="Next" />
              <SectionHint label="Homogenize and seal" value="Next" />
            </SimpleGrid>
            <Button
              alignSelf="start"
              size="lg"
              leftIcon={<FlaskConical size={18} />}
              colorScheme="green"
              onClick={openSampleManagement}
            >
              Open Sample Management
            </Button>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        {surfaceError ? (
          <TopErrorBanner title="Action blocked" description={surfaceError} onDismiss={() => setSurfaceError(null)} />
        ) : null}

        <HStack justify="space-between" align={{ base: "start", md: "center" }} flexWrap="wrap" spacing={3}>
          <HStack spacing={3} align="start">
            <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => router.push(backHref(jobId, viewMode))}>
              Back to Job
            </Button>
            <Box>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="teal" variant="solid" borderRadius="full" px={3} py={1}>
                  {payload.lot.lotNumber}
                </Badge>
                <Badge colorScheme={lotStatus.tone} variant="subtle" borderRadius="full" px={3} py={1}>
                  {lotStatus.label}
                </Badge>
                {localAssessment?.recommendedDecision && localAssessment.recommendedDecision !== "PENDING" ? (
                  <Badge colorScheme={recommendationTone.colorScheme} variant="subtle" borderRadius="full" px={3} py={1}>
                    Suggested: {recommendationTone.label}
                  </Badge>
                ) : null}
              </HStack>
              <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={2}>
                Guided Lot Inspection
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {payload.lot.job.clientName} • {payload.lot.materialName || payload.lot.job.commodity}
              </Text>
              {isRefreshingWorkspace ? (
                <HStack spacing={1} mt={1}>
                  <Spinner size="xs" color="text.secondary" />
                  <Text fontSize="sm" color="text.secondary">Updating...</Text>
                </HStack>
              ) : null}
            </Box>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <Card variant="outline" borderRadius="xl">
            <CardBody>
              <Text fontSize="sm" color="text.secondary">Inspection state</Text>
              <Text fontSize="xl" fontWeight="bold">{payload.inspection ? "Active" : "Not started"}</Text>
              <Text fontSize="sm" color="text.secondary">Start, capture, then review</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="xl">
            <CardBody>
              <Text fontSize="sm" color="text.secondary">Lot overview photo</Text>
              <Text fontSize="xl" fontWeight="bold">{hasLotOverviewPhoto ? "Done" : "Pending"}</Text>
              <Text fontSize="sm" color="text.secondary">Only required inspection proof</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="xl">
            <CardBody>
              <Text fontSize="sm" color="text.secondary">Issues captured</Text>
              <Text fontSize="xl" fontWeight="bold">{issueDrafts.length}</Text>
              <Text fontSize="sm" color="text.secondary">Add only when hold or reject is needed</Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="xl">
            <CardBody>
              <Text fontSize="sm" color="text.secondary">Sampling gate</Text>
              <Text fontSize="xl" fontWeight="bold">{payload.inspection?.decisionStatus === "READY_FOR_SAMPLING" ? "Open" : "Blocked"}</Text>
              <Text fontSize="sm" color="text.secondary">Opens after pass approval</Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        <ProcessFlowLayout
          contextLabel="Readiness and Actions"
          tracker={<WorkflowStepTracker steps={stepTracker} title="Inspection Flow" compact />}
          activeStep={
            <VStack align="stretch" spacing={4}>
              {!payload.inspection ? (
                <Card variant="outline" borderRadius="xl">
                  <CardBody p={6}>
                    <VStack align="stretch" spacing={4}>
                      <Text fontSize="lg" fontWeight="bold">Lot ready for inspection</Text>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <SectionHint label="Lot" value={payload.lot.lotNumber} />
                        <SectionHint label="Material" value={payload.lot.materialName || payload.lot.job.commodity} />
                        <SectionHint label="Bags" value={String(payload.lot.totalBags)} />
                        <SectionHint label="Current status" value={lotStatus.label} />
                      </SimpleGrid>
                      <Button leftIcon={<ClipboardList size={16} />} onClick={() => void startInspection()} isLoading={starting} alignSelf="start">
                        Start Inspection
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              ) : null}

              {payload.inspection && !isReviewStep ? renderLotOverviewPanel() : null}
              {payload.inspection && isReviewStep ? renderReviewPanel() : null}
              {renderSamplingPanel()}
            </VStack>
          }
          context={
            <VStack align="stretch" spacing={4}>
              <Card variant="outline" borderRadius="xl">
                <CardBody p={5}>
                  <VStack align="stretch" spacing={3}>
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                      Lot Snapshot
                    </Text>
                    <SectionHint label="Material" value={payload.lot.materialName || payload.lot.job.commodity} />
                    <SectionHint label="Bag count" value={String(payload.lot.totalBags)} />
                    <SectionHint label="Lot status" value={lotStatus.label} />
                    <SectionHint label="Started" value={formatDate(payload.inspection?.startedAt ?? null)} />
                    <SectionHint label="Completed" value={formatDate(payload.inspection?.completedAt ?? null)} />
                  </VStack>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl">
                <CardBody p={5}>
                  <VStack align="stretch" spacing={3}>
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                      Validation Criteria
                    </Text>
                    <SectionHint label="Recommendation" value={recommendationTone.label} />
                    <SectionHint label="Lot overview photo" value={hasLotOverviewPhoto ? "Captured" : "Required"} />
                    <SectionHint label="Missing media" value={String(localAssessment?.missingRequiredMedia.length ?? 0)} />
                    <SectionHint label="Hold / reject issues" value={issueDrafts.length > 0 ? "Recorded" : "Only if needed"} />
                    <SectionHint label="Pass result" value="Opens sampling" />
                  </VStack>
                </CardBody>
              </Card>

              {payload.inspection && isReviewStep ? (
                <Card variant="outline" borderRadius="xl" display={{ base: "none", xl: "block" }}>
                  <CardBody p={5}>
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                        Decision Actions
                      </Text>
                      <HStack spacing={3} align="stretch">
                        <Button
                          flex="1"
                          variant="outline"
                          leftIcon={<ChevronLeft size={16} />}
                          onClick={() => setCurrentSectionIndex(0)}
                        >
                          Back
                        </Button>
                        <Button flex="1" variant="ghost" onClick={() => void saveInspection()} isLoading={saving}>
                          Save progress
                        </Button>
                      </HStack>
                      <Button
                        leftIcon={<CheckCircle2 size={16} />}
                        colorScheme="green"
                        onClick={() => void saveInspection("READY_FOR_SAMPLING")}
                        isLoading={saving}
                        isDisabled={decisionEnablement.passErrors.length > 0}
                      >
                        Pass
                      </Button>
                      <Button
                        leftIcon={<PauseCircle size={16} />}
                        colorScheme="orange"
                        variant="outline"
                        onClick={() => void saveInspection("ON_HOLD")}
                        isLoading={saving}
                        isDisabled={decisionEnablement.holdErrors.length > 0}
                      >
                        Hold
                      </Button>
                      <Button
                        leftIcon={<XCircle size={16} />}
                        colorScheme="red"
                        variant="outline"
                        onClick={() => void saveInspection("REJECTED")}
                        isLoading={saving}
                        isDisabled={decisionEnablement.rejectErrors.length > 0}
                      >
                        Reject
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              ) : (
                <Card variant="outline" borderRadius="xl" display={{ base: "none", xl: "block" }}>
                  <CardBody p={5}>
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                        Next Step
                      </Text>
                      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                        {currentStepLabel}
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        Capture one lot overview photo, then move to review to pass, hold, or reject the lot.
                      </Text>
                      <HStack spacing={3} align="stretch">
                        <Button flex="1" variant="outline" onClick={() => void saveInspection()} isLoading={saving}>
                          Save
                        </Button>
                        <Button
                          flex="1"
                          rightIcon={<ChevronRight size={16} />}
                          onClick={() => setCurrentSectionIndex(REVIEW_STEP_INDEX)}
                        >
                          Review
                        </Button>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              )}
            </VStack>
          }
          mobileActions={
            !payload.inspection ? (
              <Button leftIcon={<ClipboardList size={16} />} onClick={() => void startInspection()} isLoading={starting}>
                Start inspection
              </Button>
            ) : isReviewStep ? (
              <VStack align="stretch" spacing={3}>
                <HStack spacing={3} align="stretch" flexWrap={{ base: "wrap", sm: "nowrap" }}>
                  <Button
                    flex="1"
                    variant="outline"
                    leftIcon={<ChevronLeft size={16} />}
                    onClick={() => setCurrentSectionIndex(0)}
                  >
                    Back
                  </Button>
                  <Button flex="1" variant="outline" onClick={() => void saveInspection()} isLoading={saving}>
                    Save
                  </Button>
                </HStack>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
                  <Button
                    colorScheme="green"
                    onClick={() => void saveInspection("READY_FOR_SAMPLING")}
                    isLoading={saving}
                    isDisabled={decisionEnablement.passErrors.length > 0}
                  >
                    Pass
                  </Button>
                  <Button
                    colorScheme="orange"
                    variant="outline"
                    onClick={() => void saveInspection("ON_HOLD")}
                    isLoading={saving}
                    isDisabled={decisionEnablement.holdErrors.length > 0}
                  >
                    Hold
                  </Button>
                  <Button
                    colorScheme="red"
                    variant="outline"
                    onClick={() => void saveInspection("REJECTED")}
                    isLoading={saving}
                    isDisabled={decisionEnablement.rejectErrors.length > 0}
                  >
                    Reject
                  </Button>
                </SimpleGrid>
              </VStack>
            ) : (
              <HStack spacing={3} align="stretch" flexWrap={{ base: "wrap", sm: "nowrap" }}>
                <Button flex="1" variant="outline" onClick={() => void saveInspection()} isLoading={saving}>
                  Save
                </Button>
                <Button
                  flex="1"
                  rightIcon={<ChevronRight size={16} />}
                  onClick={() => setCurrentSectionIndex(REVIEW_STEP_INDEX)}
                >
                  Review
                </Button>
              </HStack>
            )
          }
        />
      </VStack>
    </ControlTowerLayout>
  );
}
