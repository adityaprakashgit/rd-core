"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { ArrowLeft, Camera, ChevronDown, ChevronRight, PackagePlus, ScanFace } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EmptyWorkState, InlineErrorState, PageSkeleton, SectionHint } from "@/components/enterprise/AsyncState";
import { WorkbenchPageTemplate } from "@/components/enterprise/PageTemplates";
import { WorkflowStepTracker } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { getStoredAuth } from "@/lib/auth-client";
import { AuditTrail } from "@/components/inspection/AuditTrail";
import { LotIntakeWizard } from "@/components/inspection/LotIntakeWizard";
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
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function fetchData(preferredLotId?: string) {
    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
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

          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
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
          <InlineErrorState title="Job unavailable" description={error} onRetry={() => void fetchData()} />
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
                <Badge colorScheme="gray" variant="subtle">
                  {intakeSummary.ready}/{intakeSummary.total} ready for sampling
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
            <Button leftIcon={<PackagePlus size={16} />} onClick={onOpen}>
              Add Lot
            </Button>
            <Button
              leftIcon={<ScanFace size={16} />}
              variant="outline"
              onClick={() => nextLot && router.push(lotHref(job.id, nextLot.id))}
              isDisabled={!nextLot}
            >
              {nextLot ? "Open next inspection" : "Open first lot"}
            </Button>
          </HStack>
        </HStack>

        <Card>
          <VStack align="stretch" spacing={4}>
            <WorkflowStepTracker
              title="Inspection progress"
              steps={workflowSteps.map((step) => ({
                ...step,
                onClick: () => router.push(getWorkflowStepRoute(job.id, step.id)),
              }))}
              compact
            />
            <SimpleGrid columns={{ base: 2, lg: 6 }} spacing={4}>
              <SectionHint label="Total lots" value={String(intakeSummary.total)} />
              <SectionHint label="Ready now" value={String(intakeSummary.ready)} />
              <SectionHint label="In progress" value={String(intakeSummary.inProgress)} />
              <SectionHint label="On hold" value={String(intakeSummary.onHold)} />
              <SectionHint label="Rejected" value={String(intakeSummary.rejected)} />
              <SectionHint label="Remaining" value={String(intakeSummary.pending)} />
            </SimpleGrid>
          </VStack>
        </Card>

        {job.lots?.length ? (
          viewVariant === "queue" ? (
            <VStack align="stretch" spacing={4}>
              {orderedLots.map((lot) => renderQueueLotCard(lot))}
            </VStack>
          ) : (
            <WorkbenchPageTemplate
              rightLabel="Selected lot"
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
                            <Text fontSize="sm" color="text.secondary">
                              Required
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
                  <VStack align="stretch" spacing={4}>
                    <Card bg="bg.rail">
                      <VStack align="stretch" spacing={4}>
                        <HStack justify="space-between" align="start">
                          <Box>
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="brand">{selectedLot.lotNumber}</Badge>
                              <Badge colorScheme={getLotInspectionStatusPresentation(selectedLot).tone} variant="subtle">
                                {getLotInspectionStatusPresentation(selectedLot).label}
                              </Badge>
                            </HStack>
                            <Heading size="md" mt={3}>
                              {selectedLot.materialName || "Material pending"}
                            </Heading>
                            <Text fontSize="sm" color="text.secondary" mt={1}>
                              {getLotModeLabel(selectedLot)} • {getLotQuantitySummary(selectedLot)}
                            </Text>
                          </Box>
                          <Button size="sm" variant="outline" onClick={() => router.push(lotHref(job.id, selectedLot.id))}>
                            Open lot
                          </Button>
                        </HStack>

                        <SimpleGrid columns={{ base: 2, md: 4, xl: 2 }} spacing={3}>
                          <SectionHint label="Required photos" value={`${getLotPhotoCompletion(selectedLot).requiredCompleted}/${getLotPhotoCompletion(selectedLot).requiredTotal}`} />
                          <SectionHint label="Optional photos" value={`${getLotPhotoCompletion(selectedLot).optionalCompleted}/${getLotPhotoCompletion(selectedLot).optionalTotal}`} />
                          <SectionHint label="Created" value={formatDate(selectedLot.createdAt)} />
                          <SectionHint label="Inspection" value={getLotInspectionStatusPresentation(selectedLot).summary} />
                        </SimpleGrid>
                      </VStack>
                    </Card>

                    <Card>
                      <VStack align="stretch" spacing={3}>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                          Lot evidence
                        </Text>
                        {REQUIRED_LOT_MEDIA_CATEGORIES.map((category) => {
                          const media = selectedLotPhotos.find((item) => item.category === category) ?? null;
                          return (
                            <Box key={category}>
                              <HStack justify="space-between" align="center">
                                <Text fontWeight="semibold">{category.replaceAll("_", " ")}</Text>
                                <Badge colorScheme={media ? "green" : "orange"} variant="subtle">
                                  {media ? "Done" : "Pending"}
                                </Badge>
                              </HStack>
                              {media ? (
                                <Image
                                  src={media.storageKey}
                                  alt={category}
                                  borderRadius="xl"
                                  mt={3}
                                  objectFit="cover"
                                  h="144px"
                                  w="100%"
                                  bg="bg.rail"
                                />
                              ) : (
                                <Text fontSize="sm" color="text.secondary" mt={2}>
                                  Capture still pending in the inspection flow.
                                </Text>
                              )}
                              <Divider mt={4} />
                            </Box>
                          );
                        })}
                      </VStack>
                    </Card>

                    {isAdmin ? (
                      <Card>
                        <Accordion allowToggle defaultIndex={[]}>
                          <AccordionItem border="none">
                            <AccordionButton px={0}>
                              <Box flex="1" textAlign="left">
                                <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                                  Audit trail
                                </Text>
                              </Box>
                              <AccordionIcon />
                            </AccordionButton>
                            <AccordionPanel px={0} pb={0}>
                              <AuditTrail logs={logs.slice(0, 8)} />
                            </AccordionPanel>
                          </AccordionItem>
                        </Accordion>
                      </Card>
                    ) : null}
                  </VStack>
                ) : (
                  <EmptyWorkState
                    title="Select a lot"
                    description="Choose a lot card to open its guided inspection workflow."
                  />
                )
              }
            />
          )
        ) : (
          <EmptyWorkState
            title="No lots registered yet"
            description="Create the first lot to start this inspection queue."
            action={<Button onClick={onOpen}>Add first lot</Button>}
          />
        )}

        {viewVariant === "queue" && isAdmin && logs.length > 0 ? (
          <Card>
            <Accordion allowToggle defaultIndex={[]}>
              <AccordionItem border="none">
                <AccordionButton px={0}>
                  <Box flex="1" textAlign="left">
                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                      Recent job activity
                    </Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={0} pb={0}>
                  <AuditTrail logs={logs.slice(0, 6)} />
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Card>
        ) : null}
      </VStack>

      <LotIntakeWizard
        jobId={job.id}
        isOpen={isOpen}
        materialCategory={job.commodity}
        onClose={onClose}
        onSaved={async (lotId) => {
          await fetchData(lotId);
          toast({
            title: "Intake queue updated",
            description: "The new lot is ready for review or continuation.",
            status: "success",
          });
        }}
      />
    </ControlTowerLayout>
  );
}
