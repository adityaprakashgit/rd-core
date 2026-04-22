"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { ArrowLeft, Camera, ChevronDown, ChevronRight, PackagePlus, ScanFace } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint } from "@/components/enterprise/AsyncState";
import { MobileActionRail, WorkbenchPageTemplate } from "@/components/enterprise/PageTemplates";
import { DetailTabsLayout, HistoryTimeline, LinkedRecordsPanel } from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStepTracker } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { getStoredAuth } from "@/lib/auth-client";
import { LotIntakeWizard } from "@/components/inspection/LotIntakeWizard";
import { LotEditModal } from "@/components/inspection/LotEditModal";
import {
  getLotMediaFiles,
  getLotModeLabel,
  getLotPhotoCompletion,
  getLotQuantitySummary,
  REQUIRED_LOT_MEDIA_CATEGORIES,
} from "@/lib/intake-workflow";
import {
  getInspectionQueueEvidenceFiles,
  getLotAuditPreview,
  getLotInspectionIssueSummary,
  getLotInspectionStatusPresentation,
  getNextInspectionLot,
  sortInspectionLotsForQueue,
  summarizeInspectionLots,
} from "@/lib/inspection-workspace";
import { buildWorkflowSteps, getJobWorkflowPresentation, getWorkflowStepRoute } from "@/lib/workflow-stage";
import type { AuditLog, InspectionJob, InspectionLot } from "@/types/inspection";

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function JobIntakeWorkspace({
  jobsEndpoint,
  backHref,
  lotHref,
  viewVariant = "workbench",
}: {
  jobsEndpoint: string;
  backHref: string;
  lotHref: (jobId: string, lotId: string) => string;
  viewVariant?: "queue" | "workbench";
}) {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [editLotId, setEditLotId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function fetchData(preferredLotId?: string, options?: { initial?: boolean }) {
    const isInitial = options?.initial ?? false;
    if (isInitial) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const [jobsResponse, logsResponse] = await Promise.all([
        fetch(jobsEndpoint),
        fetch(`/api/inspection/audit?jobId=${jobId}`),
      ]);

      if (!jobsResponse.ok) {
        throw new Error("The intake workspace could not be loaded.");
      }

      const nextJobs = await jobsResponse.json();
      const nextLogs = logsResponse.ok ? await logsResponse.json() : [];
      const items = Array.isArray(nextJobs) ? nextJobs : [];
      setJobs(items);
      setLogs(Array.isArray(nextLogs) ? nextLogs : []);

      const currentJob = items.find((item: InspectionJob) => item.id === jobId) ?? null;
      const defaultLot = getNextInspectionLot(currentJob) ?? currentJob?.lots?.[0] ?? null;
      const nextSelectedLot = preferredLotId
        ? currentJob?.lots?.find((lot: InspectionLot) => lot.id === preferredLotId) ?? null
        : currentJob?.lots?.find((lot: InspectionLot) => lot.id === selectedLotId) ?? null;

      setSelectedLotId(nextSelectedLot?.id ?? defaultLot?.id ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "The intake workspace could not be loaded.");
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void fetchData(undefined, { initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, jobsEndpoint]);

  useEffect(() => {
    setIsAdmin(getStoredAuth()?.role === "ADMIN");
  }, []);

  const job = useMemo(() => jobs.find((entry) => entry.id === jobId) ?? null, [jobs, jobId]);
  const orderedLots = useMemo(() => sortInspectionLotsForQueue(job?.lots ?? []), [job]);
  const selectedLot = useMemo(
    () => orderedLots.find((lot) => lot.id === selectedLotId) ?? orderedLots[0] ?? null,
    [orderedLots, selectedLotId],
  );
  const intakeSummary = useMemo(
    () => (job ? summarizeInspectionLots(job) : { total: 0, ready: 0, inProgress: 0, onHold: 0, rejected: 0, pending: 0 }),
    [job],
  );
  const nextLot = useMemo(() => getNextInspectionLot(job), [job]);
  const workflowSteps = useMemo(() => (job ? buildWorkflowSteps(job) : []), [job]);
  const presentation = useMemo(() => (job ? getJobWorkflowPresentation(job) : null), [job]);
  const selectedLotPhotos = useMemo(() => getLotMediaFiles(selectedLot), [selectedLot]);
  const currentJobId = job?.id ?? "";

  const renderQueueLotCard = (lot: InspectionLot) => {
    const lotStatus = getLotInspectionStatusPresentation(lot);
    const photoCompletion = getLotPhotoCompletion(lot);
    const issueSummary = getLotInspectionIssueSummary(lot);
    const evidenceFiles = getInspectionQueueEvidenceFiles(lot).slice(0, 3);
    const lotLogs = getLotAuditPreview(logs, lot.id, 3);
    const isExpanded = selectedLotId === lot.id;
    const assigneeName = lot.assignedTo?.profile?.displayName ?? "Unassigned";

    return (
      <Card
        key={lot.id}
        bg={isExpanded ? "brand.50" : undefined}
        borderColor={isExpanded ? "brand.200" : undefined}
      >
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" align="start" flexWrap="wrap" spacing={3}>
            <Box flex="1" minW={{ base: "full", md: "0" }}>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="brand" variant={isExpanded ? "solid" : "subtle"}>
                  {lot.lotNumber}
                </Badge>
                <Badge colorScheme={lotStatus.tone} variant="subtle">
                  {lotStatus.label}
                </Badge>
                {issueSummary.issueCount > 0 ? (
                  <Badge colorScheme={issueSummary.tone} variant="subtle">
                    {issueSummary.issueCount} issue{issueSummary.issueCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </HStack>
              <Text fontWeight="semibold" color="text.primary" mt={3}>
                {lot.materialName || "Material pending"}
              </Text>
              <Text fontSize="sm" color="text.secondary" mt={1}>
                {getLotModeLabel(lot)} • {getLotQuantitySummary(lot)}
              </Text>
            </Box>

            <HStack spacing={3} flexWrap="wrap" align="start">
              <Button size="sm" onClick={() => router.push(lotHref(currentJobId, lot.id))}>
                Open inspection
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditLotId(lot.id)}>
                Edit bag
              </Button>
              <Button
                size="sm"
                variant="outline"
                rightIcon={isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                onClick={() => setSelectedLotId((current) => (current === lot.id ? null : lot.id))}
              >
                {isExpanded ? "Hide details" : "Show details"}
              </Button>
            </HStack>
          </HStack>

          <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3}>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                Required proof
              </Text>
              <Text fontWeight="semibold" mt={1}>
                {photoCompletion.requiredCompleted}/{photoCompletion.requiredTotal}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                Assigned
              </Text>
              <Text fontWeight="semibold" mt={1}>
                {assigneeName}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                Quantity
              </Text>
              <Text fontWeight="semibold" mt={1}>
                {getLotQuantitySummary(lot)}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                Inspection
              </Text>
              <Text fontWeight="semibold" mt={1}>
                {lotStatus.label}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                Decision
              </Text>
              <Text fontWeight="semibold" mt={1}>
                {lot.inspection?.decisionStatus?.replaceAll("_", " ").toLowerCase() ?? "Pending"}
              </Text>
            </Box>
          </SimpleGrid>

          {isExpanded ? (
            <>
              <Divider />
              <Grid templateColumns={{ base: "1fr", xl: "minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.9fr)" }} gap={4}>
                <GridItem>
                  <Card bg="bg.rail">
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                        Evidence snapshot
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        {photoCompletion.totalCompleted}/{photoCompletion.totalTarget} proof item{photoCompletion.totalTarget === 1 ? "" : "s"} captured.
                      </Text>
                      {evidenceFiles.length > 0 ? (
                        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
                          {evidenceFiles.map((file) => (
                            <Box key={file.id}>
                              <Image
                                src={file.storageKey}
                                alt={file.category}
                                borderRadius="xl"
                                objectFit="cover"
                                h="124px"
                                w="100%"
                                bg="bg.canvas"
                              />
                              <Text fontSize="xs" color="text.secondary" mt={2}>
                                {file.category.replaceAll("_", " ")}
                              </Text>
                            </Box>
                          ))}
                        </SimpleGrid>
                      ) : (
                        <Text fontSize="sm" color="text.secondary">
                          No proof uploaded yet. Open the lot to capture inspection media inline.
                        </Text>
                      )}
                    </VStack>
                  </Card>
                </GridItem>

                <GridItem>
                  <Card bg="bg.rail">
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                        Issues and risk
                      </Text>
                      <Badge alignSelf="start" colorScheme={issueSummary.tone} variant="subtle">
                        {issueSummary.summary}
                      </Badge>
                      {issueSummary.flags.length ? (
                        <SimpleGrid columns={{ base: 1, md: 2, xl: 1 }} spacing={2}>
                          {issueSummary.flags.map((flag) => (
                            <Badge key={flag} colorScheme={issueSummary.tone} variant="outline" px={3} py={1.5}>
                              {flag}
                            </Badge>
                          ))}
                        </SimpleGrid>
                      ) : (
                        <Text fontSize="sm" color="text.secondary">
                          No risk flags on this lot.
                        </Text>
                      )}
                      {lot.inspection?.overallRemark ? (
                        <Box>
                          <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                            Latest remark
                          </Text>
                          <Text fontSize="sm" color="text.secondary" mt={2}>
                            {lot.inspection.overallRemark}
                          </Text>
                        </Box>
                      ) : null}
                    </VStack>
                  </Card>
                </GridItem>

                <GridItem>
                  <Card bg="bg.rail">
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                        Recent activity
                      </Text>
                      {lotLogs.length > 0 ? (
                        <VStack align="stretch" spacing={3}>
                          {lotLogs.map((log) => (
                            <Box key={log.id}>
                              <HStack justify="space-between" align="start" spacing={3}>
                                <Text fontWeight="semibold" fontSize="sm" color="text.primary">
                                  {log.entity ? `${log.entity} · ${log.action}` : log.action}
                                </Text>
                                <Text fontSize="xs" color="text.secondary" whiteSpace="nowrap">
                                  {formatDate(log.createdAt)}
                                </Text>
                              </HStack>
                              <Text fontSize="sm" color="text.secondary" mt={1}>
                                {log.notes || "System trace entry"}
                              </Text>
                            </Box>
                          ))}
                        </VStack>
                      ) : (
                        <Text fontSize="sm" color="text.secondary">
                          No lot-specific activity entries have been recorded yet.
                        </Text>
                      )}
                    </VStack>
                  </Card>
                </GridItem>
              </Grid>
            </>
          ) : null}
        </VStack>
      </Card>
    );
  };

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={4} rows={2} />
      </ControlTowerLayout>
    );
  }

  if (!job) {
    return (
      <ControlTowerLayout>
        {error ? (
          <InlineErrorState title="Job unavailable" description={error} onRetry={() => void fetchData(undefined, { initial: true })} />
        ) : (
          <EmptyWorkState title="Job not found" description="The requested job is not available in this workspace." />
        )}
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" align="start" flexWrap="wrap" spacing={4}>
          <HStack spacing={3} align="start">
            <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => router.push(backHref)}>
              Back
            </Button>
            <Box>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="brand">{job.inspectionSerialNumber || job.jobReferenceNumber}</Badge>
                <Badge colorScheme={presentation?.tone ?? "gray"} variant="subtle">
                  {presentation?.label ?? job.status}
                </Badge>
              </HStack>
              <Heading size="lg" mt={2}>
                {job.clientName}
              </Heading>
              <Text color="text.secondary" mt={1}>
                {job.commodity}
                {job.plantLocation ? ` • ${job.plantLocation}` : ""}
              </Text>
            </Box>
          </HStack>

          <HStack spacing={3} flexWrap="wrap">
            {isRefreshing ? (
              <HStack spacing={1}>
                <Spinner size="xs" color="text.secondary" />
                <Text fontSize="sm" color="text.secondary">Updating...</Text>
              </HStack>
            ) : null}
            <Button leftIcon={<PackagePlus size={16} />} onClick={onOpen}>
              Add Bag
            </Button>
            <Button
              leftIcon={<ScanFace size={16} />}
              variant="outline"
              onClick={() => nextLot && router.push(lotHref(job.id, nextLot.id))}
              isDisabled={!nextLot}
            >
              {nextLot ? "Open next bag inspection" : "Open first bag"}
            </Button>
          </HStack>
        </HStack>

        <Card>
          <VStack align="stretch" spacing={4}>
            <WorkflowStepTracker
              title="Bag inspection progress"
              steps={workflowSteps.map((step) => ({
                ...step,
                onClick: () => router.push(getWorkflowStepRoute(job.id, step.id)),
              }))}
              compact
            />
            <SimpleGrid display={{ base: "none", lg: "grid" }} columns={{ base: 2, lg: 6 }} spacing={4}>
              <SectionHint label="Total bags" value={String(intakeSummary.total)} />
              <SectionHint label="Ready now" value={String(intakeSummary.ready)} />
              <SectionHint label="In progress" value={String(intakeSummary.inProgress)} />
              <SectionHint label="On hold" value={String(intakeSummary.onHold)} />
              <SectionHint label="Rejected" value={String(intakeSummary.rejected)} />
              <SectionHint label="Remaining" value={String(intakeSummary.pending)} />
            </SimpleGrid>
          </VStack>
        </Card>

        <DetailTabsLayout
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: job.lots?.length ? (
                viewVariant === "queue" ? (
                  <VStack align="stretch" spacing={4}>
                    {orderedLots.map((lot) => renderQueueLotCard(lot))}
                  </VStack>
                ) : (
                  <WorkbenchPageTemplate
                    rightLabel="Linked Bag View"
                    left={
                      <VStack align="stretch" spacing={4}>
                        {orderedLots.map((lot) => {
                          const lotStatus = getLotInspectionStatusPresentation(lot);
                          const photoCompletion = getLotPhotoCompletion(lot);
                          const isSelected = selectedLot?.id === lot.id;

                          return (
                            <Card
                              key={lot.id}
                              bg={isSelected ? "brand.50" : undefined}
                              borderColor={isSelected ? "brand.200" : undefined}
                            >
                              <VStack align="stretch" spacing={4}>
                                <HStack justify="space-between" align="start">
                                  <Box>
                                    <HStack spacing={2} flexWrap="wrap">
                                      <Badge colorScheme="brand" variant={isSelected ? "solid" : "subtle"}>
                                        {lot.lotNumber}
                                      </Badge>
                                      <Badge colorScheme={lotStatus.tone} variant="subtle">
                                        {lotStatus.label}
                                      </Badge>
                                    </HStack>
                                    <Text fontWeight="semibold" color="text.primary" mt={3}>
                                      {lot.materialName || "Material pending"}
                                    </Text>
                                    <Text fontSize="sm" color="text.secondary" mt={1}>
                                      {getLotModeLabel(lot)} • {getLotQuantitySummary(lot)}
                                    </Text>
                                  </Box>
                                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight size={14} />} onClick={() => setSelectedLotId(lot.id)}>
                                    View
                                  </Button>
                                </HStack>

                                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                                  <Box>
                                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                                      Photos
                                    </Text>
                                    <Text fontWeight="semibold" mt={1}>
                                      {photoCompletion.requiredCompleted}/{photoCompletion.requiredTotal}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                                      Mode
                                    </Text>
                                    <Text fontWeight="semibold" mt={1}>
                                      {getLotModeLabel(lot)}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                                      Quantity / Weight
                                    </Text>
                                    <Text fontWeight="semibold" mt={1}>
                                      {getLotQuantitySummary(lot)}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                                      Inspection
                                    </Text>
                                    <Text fontWeight="semibold" mt={1}>
                                      {lotStatus.label}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                                      Updated
                                    </Text>
                                    <Text fontWeight="semibold" mt={1}>
                                      {formatDate(lot.updatedAt ?? lot.createdAt)}
                                    </Text>
                                  </Box>
                                </SimpleGrid>

                                <HStack spacing={3} flexWrap="wrap">
                                  <Button size="sm" onClick={() => router.push(lotHref(job.id, lot.id))}>
                                    Open inspection
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditLotId(lot.id)}>
                                    Edit bag
                                  </Button>
                                  <Button size="sm" variant="outline" leftIcon={<Camera size={14} />} onClick={() => router.push(lotHref(job.id, lot.id))}>
                                    Review proof
                                  </Button>
                                  <Badge colorScheme={lotStatus.tone} px={3} py={1.5}>
                                    {lotStatus.label}
                                  </Badge>
                                </HStack>
                              </VStack>
                            </Card>
                          );
                        })}
                      </VStack>
                    }
                    right={
                      selectedLot ? (
                        <LinkedRecordsPanel
                          items={[
                            { label: "Job Number", value: job.inspectionSerialNumber || job.jobReferenceNumber || "Job" },
                            { label: "Bag Number", value: selectedLot.lotNumber, href: lotHref(job.id, selectedLot.id) },
                            { label: "Sample", value: selectedLot.sample?.sampleCode || "Pending" },
                            { label: "Packet", value: selectedLot.sample?.packets?.[0]?.packetCode || "Pending" },
                            { label: "Documents", value: `${job.reportSnapshots?.length ?? 0}` },
                            { label: "Bag Workflow", value: "Open", href: lotHref(job.id, selectedLot.id) },
                          ]}
                        />
                      ) : (
                        <EmptyWorkState title="Select a bag" description="Choose a bag card to review its linked records." />
                      )
                    }
                  />
                )
              ) : (
                  <EmptyWorkState
                  title="No bags registered yet"
                  description="Create the first bag to start this inspection queue."
                  action={<Button onClick={onOpen}>Add first bag</Button>}
                />
              ),
            },
            {
              id: "sample-details",
              label: "Sample Details",
              content: (
                <VStack align="stretch" spacing={3}>
                  {orderedLots.map((lot) => {
                    const sampleState = lot.sample?.sampleStatus ?? "PENDING";
                    return (
                      <Card key={lot.id}>
                        <HStack justify="space-between" spacing={4} flexWrap="wrap">
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="semibold">{lot.lotNumber}</Text>
                            <Text fontSize="sm" color="text.secondary">{lot.materialName || "Material pending"}</Text>
                          </VStack>
                          <HStack spacing={2}>
                            <Badge colorScheme="blue" variant="subtle">{sampleState.replaceAll("_", " ")}</Badge>
                            <Badge colorScheme={getLotInspectionStatusPresentation(lot).tone} variant="subtle">
                              {getLotInspectionStatusPresentation(lot).label}
                            </Badge>
                          </HStack>
                        </HStack>
                      </Card>
                    );
                  })}
                </VStack>
              ),
            },
            {
              id: "photos-uploads",
              label: "Photos / Uploads",
              content: selectedLot ? (
                <Card>
                  <VStack align="stretch" spacing={3}>
                    <Text fontSize="sm" color="text.secondary">
                      {selectedLot.lotNumber} evidence status
                    </Text>
                    {REQUIRED_LOT_MEDIA_CATEGORIES.map((category) => {
                      const media = selectedLotPhotos.find((item) => item.category === category);
                      return (
                        <HStack key={category} justify="space-between">
                          <Text>{category.replaceAll("_", " ")}</Text>
                          <Badge colorScheme={media ? "green" : "orange"}>{media ? "Uploaded" : "Missing"}</Badge>
                        </HStack>
                      );
                    })}
                  </VStack>
                </Card>
              ) : (
                <EmptyWorkState title="No lot selected" description="Choose a lot from Overview to inspect uploads." />
              ),
            },
            {
              id: "linked-job",
              label: "Linked Job",
              content: (
                <LinkedRecordsPanel
                  items={[
                    { label: "Job Number", value: job.inspectionSerialNumber || job.jobReferenceNumber || "Job" },
                    { label: "Client", value: job.clientName },
                    { label: "Bag Count", value: String(job.lots?.length ?? 0) },
                    { label: "Current Stage", value: presentation?.label ?? job.status },
                  ]}
                />
              ),
            },
            {
              id: "notes",
              label: "Notes",
              content: (
                <VStack align="stretch" spacing={3}>
                  {orderedLots.map((lot) => (
                    <Card key={lot.id}>
                      <Text fontWeight="semibold">{lot.lotNumber}</Text>
                      <Text fontSize="sm" color="text.secondary" mt={1}>
                        {lot.inspection?.overallRemark || lot.remarks || "No notes captured yet."}
                      </Text>
                    </Card>
                  ))}
                </VStack>
              ),
            },
            {
              id: "history",
              label: "History",
              content: (
                <VStack align="stretch" spacing={4}>
                  <HistoryTimeline
                    events={(isAdmin ? logs : logs.slice(0, 12)).map((log) => ({
                      id: log.id,
                      title: log.entity ? `${log.entity} · ${log.action}` : log.action,
                      subtitle: log.notes || "System trace entry",
                      at: formatDate(log.createdAt),
                    }))}
                  />
                </VStack>
              ),
            },
          ]}
          rightRail={
            <VStack align="stretch" spacing={4}>
              {selectedLot ? (
                <LinkedRecordsPanel
                  items={[
                    { label: "Job Number", value: job.inspectionSerialNumber || job.jobReferenceNumber || "Job" },
                    { label: "Bag Number", value: selectedLot.lotNumber, href: lotHref(job.id, selectedLot.id) },
                    { label: "Current Stage", value: presentation?.label ?? job.status },
                    { label: "Sample", value: selectedLot.sample?.sampleCode || "Not Available" },
                    { label: "Packet", value: selectedLot.sample?.packets?.[0]?.packetCode || "Not Available" },
                    { label: "Bag Workflow", value: "Open", href: lotHref(job.id, selectedLot.id) },
                  ]}
                />
              ) : (
                  <EmptyWorkState title="Select a bag" description="Choose a bag to view linked records." />
              )}
              <HistoryTimeline
                events={logs.slice(0, 5).map((log) => ({
                  id: `rail-${log.id}`,
                  title: log.entity ? `${log.entity} · ${log.action}` : log.action,
                  subtitle: log.notes || "System trace entry",
                  at: formatDate(log.createdAt),
                }))}
              />
            </VStack>
          }
        />
        <MobileActionRail>
          <Button leftIcon={<PackagePlus size={16} />} onClick={onOpen}>
            Add Bag
          </Button>
          <Button
            variant="outline"
            onClick={() => nextLot && router.push(lotHref(job.id, nextLot.id))}
            isDisabled={!nextLot}
          >
            {nextLot ? "Open next bag inspection" : "Open first bag"}
          </Button>
        </MobileActionRail>
      </VStack>

      <LotIntakeWizard
        jobId={job.id}
        isOpen={isOpen}
        materialCategory={job.commodity}
        onClose={onClose}
        onSaved={async (lotId) => {
          await fetchData(lotId, { initial: false });
          toast({
            title: "Intake queue updated",
            description: "The new lot is ready for review or continuation.",
            status: "success",
          });
        }}
      />

      {editLotId ? (
        <LotEditModal
          isOpen={true}
          lot={orderedLots.find((l) => l.id === editLotId)!}
          onClose={() => setEditLotId(null)}
          onSaved={async () => {
            await fetchData(editLotId, { initial: false });
          }}
        />
      ) : null}
    </ControlTowerLayout>
  );
}
