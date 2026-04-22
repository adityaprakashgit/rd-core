"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Stack,
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
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  MoreHorizontal,
  Printer,
  Share2,
} from "lucide-react";

import {
  EnterpriseEmptyState,
  EnterpriseStickyTable,
  enterpriseDrawerBodyProps,
  enterpriseDrawerContentProps,
  enterpriseDrawerHeaderProps,
  FilterSearchStrip,
  PageActionBar,
  PageIdentityBar,
} from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import type { NormalizedDocumentStatus } from "@/lib/document-status";

type FilterState = {
  job: string;
  client: string;
  lot: string;
  packet: string;
  dateFrom: string;
  dateTo: string;
  documentType: string;
  status: string;
  missingOnly: boolean;
};

type LotDocumentGroup = {
  key: "inspectionUploads" | "testReports" | "coa" | "packingList" | "dispatchDocuments";
  label: string;
  status: NormalizedDocumentStatus;
  sourceStatus: string | null;
  count: number;
  linkedActionUrl: string | null;
};

type LotRegistrySummary = {
  lotId: string;
  lotNumber: string;
  packetCount: number;
  documentCount: number;
  missingDocuments: number;
  lastUpdated: string;
  actions: {
    workflowUrl: string;
  };
  groups: {
    inspectionUploads: LotDocumentGroup;
    testReports: LotDocumentGroup;
    coa: LotDocumentGroup;
    packingList: LotDocumentGroup;
    dispatchDocuments: LotDocumentGroup;
  };
};

type JobRegistrySummary = {
  jobId: string;
  jobNumber: string;
  client: string;
  lotCount: number;
  documentCount: number;
  missingDocuments: number;
  lastUpdated: string;
  actions: {
    reportsUrl: string;
  };
  groups: {
    testReports: LotDocumentGroup;
    coa: LotDocumentGroup;
  };
  lots: LotRegistrySummary[];
};

type DocumentRegistryResponse = {
  rows: Array<{ id: string }>;
  total: number;
  grouped: {
    jobs: JobRegistrySummary[];
    totalJobs: number;
    totalLots: number;
    totalDocuments: number;
    totalMissingDocuments: number;
  };
};

const initialFilters: FilterState = {
  job: "",
  client: "",
  lot: "",
  packet: "",
  dateFrom: "",
  dateTo: "",
  documentType: "",
  status: "",
  missingOnly: false,
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function buildQuery(filters: FilterState): string {
  const query = new URLSearchParams();
  if (filters.job.trim()) query.set("job", filters.job.trim());
  if (filters.client.trim()) query.set("client", filters.client.trim());
  if (filters.lot.trim()) query.set("lot", filters.lot.trim());
  if (filters.packet.trim()) query.set("packet", filters.packet.trim());
  if (filters.dateFrom.trim()) query.set("dateFrom", filters.dateFrom.trim());
  if (filters.dateTo.trim()) query.set("dateTo", filters.dateTo.trim());
  if (filters.documentType.trim()) query.set("documentType", filters.documentType.trim());
  if (filters.status.trim()) query.set("status", filters.status.trim());
  if (filters.missingOnly) query.set("missingOnly", "1");
  return query.toString();
}

function isUrlAvailable(url: string | null): boolean {
  return Boolean(url && url.trim().length > 0);
}

function GroupActionMenu({
  group,
  onShare,
  onPrint,
  reportsWorkspaceUrl,
}: {
  group: LotDocumentGroup;
  onShare: (url: string) => void;
  onPrint: (url: string) => void;
  reportsWorkspaceUrl?: string;
}) {
  const hasUrl = isUrlAvailable(group.linkedActionUrl);
  const canOpenReportsWorkspace = Boolean(
    reportsWorkspaceUrl &&
      (group.key === "testReports" || group.key === "coa" || group.key === "packingList"),
  );
  const url = group.linkedActionUrl ?? "";
  const statusDisplay = group.status === "Missing" && group.count === 0 ? "Not Generated" : group.status;
  const downloadLabel = group.key === "packingList" ? "Download Packing List PDF" : "Download Report PDF";

  return (
    <HStack spacing={2} justify="space-between" align="center">
      <WorkflowStateChip status={statusDisplay} />
      <Menu>
        <MenuButton
          as={IconButton}
          aria-label={`${group.label} actions`}
          size="xs"
          variant="ghost"
          icon={<MoreHorizontal size={14} />}
          isDisabled={!hasUrl && !canOpenReportsWorkspace}
        />
        <MenuList>
          <MenuItem as="a" href={url} target="_blank" rel="noreferrer" isDisabled={!hasUrl} icon={<ExternalLink size={14} />}>
            View PDF
          </MenuItem>
          <MenuItem as="a" href={url} target="_blank" rel="noreferrer" isDisabled={!hasUrl} icon={<Download size={14} />}>
            {downloadLabel}
          </MenuItem>
          <MenuItem onClick={() => onShare(url)} isDisabled={!hasUrl} icon={<Share2 size={14} />}>
            Share PDF
          </MenuItem>
          <MenuItem onClick={() => onPrint(url)} isDisabled={!hasUrl} icon={<Printer size={14} />}>
            Print PDF
          </MenuItem>
          <MenuItem as="a" href={reportsWorkspaceUrl ?? "#"} isDisabled={!canOpenReportsWorkspace} icon={<ExternalLink size={14} />}>
            Open Reports Workspace
          </MenuItem>
        </MenuList>
      </Menu>
    </HStack>
  );
}

export default function DocumentRegistryPage() {
  const toast = useToast();
  const [draftFilters, setDraftFilters] = useState<FilterState>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters);
  const [jobs, setJobs] = useState<JobRegistrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [mobileDrawerJobId, setMobileDrawerJobId] = useState<string | null>(null);

  const loadRegistry = useCallback(async (filters: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery(filters);
      const response = await fetch(`/api/documents/registry${query ? `?${query}` : ""}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details || "Failed to load document registry.");
      }

      const payload = (await response.json()) as DocumentRegistryResponse;
      const nextJobs = Array.isArray(payload.grouped?.jobs) ? payload.grouped.jobs : [];
      setJobs(nextJobs);
      setExpandedJobs((current) => {
        const next = { ...current };
        for (const job of nextJobs) {
          if (!(job.jobId in next)) {
            next[job.jobId] = false;
          }
        }
        return next;
      });
    } catch (loadError) {
      setJobs([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load document registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegistry(activeFilters);
  }, [activeFilters, loadRegistry]);

  const onSubmitFilters = (event: FormEvent) => {
    event.preventDefault();
    setActiveFilters(draftFilters);
  };

  const filterBadges = useMemo(
    () => [
      activeFilters.job ? `Job: ${activeFilters.job}` : null,
      activeFilters.client ? `Client: ${activeFilters.client}` : null,
      activeFilters.status ? `Status: ${activeFilters.status}` : null,
      activeFilters.missingOnly ? "Missing only" : null,
      activeFilters.lot ? `Bag: ${activeFilters.lot}` : null,
      activeFilters.packet ? `Packet: ${activeFilters.packet}` : null,
      activeFilters.documentType ? `Type: ${activeFilters.documentType}` : null,
      activeFilters.dateFrom ? `From: ${activeFilters.dateFrom}` : null,
      activeFilters.dateTo ? `To: ${activeFilters.dateTo}` : null,
    ].filter((value): value is string => Boolean(value)),
    [activeFilters],
  );

  const toggleExpand = (jobId: string) => {
    setExpandedJobs((current) => ({
      ...current,
      [jobId]: !current[jobId],
    }));
  };

  const handleShare = async (url: string) => {
    try {
      const nav = typeof window !== "undefined" ? window.navigator : null;
      if (!nav) {
        return;
      }

      if (typeof nav.share === "function") {
        await nav.share({ url });
        return;
      }

      if (nav.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(url);
        toast({ title: "Link copied", status: "success" });
      }
    } catch {
      toast({ title: "Share failed", status: "warning" });
    }
  };

  const handlePrint = (url: string) => {
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast({ title: "Popup blocked", description: "Allow popups to print the document.", status: "warning" });
      return;
    }

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        toast({ title: "Print failed", status: "warning" });
      }
    };

    printWindow.onload = triggerPrint;
  };

  const mobileDrawerJob = useMemo(
    () => jobs.find((job) => job.jobId === mobileDrawerJobId) ?? null,
    [jobs, mobileDrawerJobId],
  );

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="Document Registry"
          subtitle="Job-wise document registry with bag inspection context, grouped document actions, and missing-document tracking"
          breadcrumbs={[{ label: "Documents", href: "/documents" }]}
          status={<Badge colorScheme="blue">{jobs.length} Jobs</Badge>}
        />

        <PageActionBar
          secondaryActions={
            <HStack spacing={2}>
              <Button size="sm" variant="outline" onClick={() => void loadRegistry(activeFilters)} isLoading={loading}>
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraftFilters(initialFilters);
                  setActiveFilters(initialFilters);
                }}
              >
                Clear Filters
              </Button>
            </HStack>
          }
          primaryAction={
            <Button as="a" href="/reports" size="sm" variant="outline">
              Open Reports Workspace
            </Button>
          }
        />

        <Stack as="form" onSubmit={onSubmitFilters} spacing={4}>
          <FilterSearchStrip
            filters={
              <HStack spacing={2} flexWrap="wrap">
                {filterBadges.length === 0 ? <Badge variant="subtle">No filters</Badge> : null}
                {filterBadges.map((badge) => (
                  <Badge key={badge} variant="subtle" colorScheme="blue">
                    {badge}
                  </Badge>
                ))}
              </HStack>
            }
            search={<Button type="submit" size="sm" isLoading={loading}>Apply</Button>}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setShowAdvancedFilters((current) => !current)}>
                {showAdvancedFilters ? "Hide advanced" : "Show advanced"}
              </Button>
            }
          />

          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <FormControl>
              <FormLabel>Job Number</FormLabel>
              <Input
                value={draftFilters.job}
                onChange={(event) => setDraftFilters((current) => ({ ...current, job: event.target.value }))}
                placeholder="Job Number"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Client</FormLabel>
              <Input
                value={draftFilters.client}
                onChange={(event) => setDraftFilters((current) => ({ ...current, client: event.target.value }))}
                placeholder="Client"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Status</FormLabel>
              <Select
                value={draftFilters.status}
                onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All</option>
                <option value="Available">Available</option>
                <option value="Active">Active</option>
                <option value="Superseded">Superseded</option>
                <option value="Missing">Missing</option>
                <option value="Current for Dispatch">Current for Dispatch</option>
              </Select>
            </FormControl>
          </Stack>

          <Checkbox
            isChecked={draftFilters.missingOnly}
            onChange={(event) => setDraftFilters((current) => ({ ...current, missingOnly: event.target.checked }))}
          >
            Missing documents only
          </Checkbox>

          {showAdvancedFilters ? (
            <Stack direction={{ base: "column", md: "row" }} spacing={3}>
              <FormControl>
                <FormLabel>Bag Number</FormLabel>
                <Input
                  value={draftFilters.lot}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, lot: event.target.value }))}
                  placeholder="Bag Number"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Packet ID</FormLabel>
                <Input
                  value={draftFilters.packet}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, packet: event.target.value }))}
                  placeholder="Packet ID"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Document Type</FormLabel>
                <Select
                  value={draftFilters.documentType}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, documentType: event.target.value }))}
                >
                  <option value="">All</option>
                  <option value="COA">COA</option>
                  <option value="DISPATCH_DOCUMENT">Packing List</option>
                  <option value="TEST_REPORT">Test Reports</option>
                  <option value="INSPECTION_UPLOAD">Inspection Uploads</option>
                  <option value="PACKET_DOCUMENT">Dispatch Documents</option>
                </Select>
                <FormHelperText>
                  Packing List maps to dispatch documents, and Dispatch Documents maps to packet-level dispatch files.
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>Date From</FormLabel>
                <Input
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Date To</FormLabel>
                <Input
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))}
                />
              </FormControl>
            </Stack>
          ) : null}
        </Stack>

        {error ? <EnterpriseEmptyState title="Document registry unavailable" description={error} /> : null}

        <EnterpriseStickyTable display={{ base: "none", xl: "block" }}>
          <Table size="sm">
              <Thead>
                <Tr>
                  <Th w="52px"> </Th>
                  <Th>Job Number</Th>
                  <Th>Client</Th>
                  <Th isNumeric>Bag Count</Th>
                  <Th isNumeric>Document Count</Th>
                  <Th isNumeric>Missing Documents</Th>
                  <Th>Test Report</Th>
                  <Th>COA</Th>
                  <Th>Last Updated</Th>
                  <Th textAlign="right">Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={10}>
                      <Text py={4} color="text.secondary" textAlign="center">
                        Loading documents...
                      </Text>
                    </Td>
                  </Tr>
                ) : null}

                {!loading && jobs.length === 0 ? (
                  <Tr>
                    <Td colSpan={10}>
                      <Text py={4} color="text.secondary" textAlign="center">
                        No jobs found for current filters.
                      </Text>
                    </Td>
                  </Tr>
                ) : null}

                {!loading
                  ? jobs.map((job) => {
                      const expanded = Boolean(expandedJobs[job.jobId]);
                      return (
                        <Fragment key={job.jobId}>
                          <Tr key={job.jobId}>
                            <Td>
                              <IconButton
                                aria-label={expanded ? "Collapse job" : "Expand job"}
                                size="sm"
                                variant="ghost"
                                icon={expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                onClick={() => toggleExpand(job.jobId)}
                              />
                            </Td>
                            <Td fontWeight="semibold">{job.jobNumber}</Td>
                            <Td>{job.client}</Td>
                            <Td isNumeric>{job.lotCount}</Td>
                            <Td isNumeric>{job.documentCount}</Td>
                            <Td isNumeric>{job.missingDocuments}</Td>
                            <Td>
                              <GroupActionMenu
                                group={job.groups.testReports}
                                onShare={handleShare}
                                onPrint={handlePrint}
                                reportsWorkspaceUrl={job.actions.reportsUrl}
                              />
                            </Td>
                            <Td>
                              <GroupActionMenu
                                group={job.groups.coa}
                                onShare={handleShare}
                                onPrint={handlePrint}
                                reportsWorkspaceUrl={job.actions.reportsUrl}
                              />
                            </Td>
                            <Td>{formatDate(job.lastUpdated)}</Td>
                            <Td>
                              <HStack justify="flex-end" spacing={2}>
                                <Button size="xs" variant="ghost" as="a" href={job.actions.reportsUrl}>
                                  Open Reports Workspace
                                </Button>
                                <Button size="xs" variant="outline" onClick={() => toggleExpand(job.jobId)}>
                                  {expanded ? "Collapse" : "Expand"}
                                </Button>
                              </HStack>
                            </Td>
                          </Tr>

                          {expanded ? (
                            <Tr key={`${job.jobId}-lots`}>
                            <Td colSpan={10} px={0}>
                                <Box borderTopWidth="1px" borderColor="border.default" overflowX="auto">
                                  <Table size="sm" variant="simple">
                                    <Thead>
                                      <Tr>
                                        <Th>Bag Number</Th>
                                        <Th isNumeric>Packet Count</Th>
                                        <Th>Packing List</Th>
                                        <Th>Inspection Uploads</Th>
                                        <Th>Dispatch Documents</Th>
                                        <Th textAlign="right">Action</Th>
                                      </Tr>
                                    </Thead>
                                    <Tbody>
                                      {job.lots.map((lot) => (
                                        <Tr key={lot.lotId}>
                                          <Td fontWeight="medium">{lot.lotNumber}</Td>
                                          <Td isNumeric>{lot.packetCount}</Td>
                                          <Td>
                                            <GroupActionMenu
                                              group={lot.groups.packingList}
                                              onShare={handleShare}
                                              onPrint={handlePrint}
                                              reportsWorkspaceUrl={job.actions.reportsUrl}
                                            />
                                          </Td>
                                          <Td>
                                            <GroupActionMenu group={lot.groups.inspectionUploads} onShare={handleShare} onPrint={handlePrint} />
                                          </Td>
                                          <Td>
                                            <GroupActionMenu group={lot.groups.dispatchDocuments} onShare={handleShare} onPrint={handlePrint} />
                                          </Td>
                                          <Td>
                                            <HStack justify="flex-end" spacing={2}>
                                              <Button size="xs" variant="ghost" as="a" href={lot.actions.workflowUrl}>
                                                Open Bag Workflow
                                              </Button>
                                            </HStack>
                                          </Td>
                                        </Tr>
                                      ))}
                                    </Tbody>
                                  </Table>
                                </Box>
                              </Td>
                            </Tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  : null}
              </Tbody>
          </Table>

          <VStack display={{ base: "flex", xl: "none" }} align="stretch" spacing={2} p={3}>
            {loading ? (
              <Text color="text.secondary" textAlign="center" py={4}>
                Loading documents...
              </Text>
            ) : null}

            {!loading && jobs.length === 0 ? (
              <Text color="text.secondary" textAlign="center" py={4}>
                No jobs found for current filters.
              </Text>
            ) : null}

            {!loading
              ? jobs.map((job) => (
                  <VStack
                    key={job.jobId}
                    align="stretch"
                    spacing={2}
                    borderWidth="1px"
                    borderColor="border.default"
                    borderRadius="lg"
                    p={3}
                    bg="bg.surface"
                  >
                    <VStack align="stretch" spacing={2}>
                      <HStack justify="space-between" align="start">
                        <VStack align="start" spacing={0.5}>
                          <Text fontWeight="semibold" color="text.primary">{job.jobNumber}</Text>
                          <Text fontSize="sm" color="text.secondary">{job.client}</Text>
                        </VStack>
                        <WorkflowStateChip status={job.missingDocuments > 0 ? "MISSING" : "AVAILABLE"} />
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="text.muted">Missing: {job.missingDocuments}</Text>
                        <Text fontSize="xs" color="text.muted">Updated: {formatDate(job.lastUpdated)}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="text.secondary">Test Report</Text>
                        <GroupActionMenu
                          group={job.groups.testReports}
                          onShare={handleShare}
                          onPrint={handlePrint}
                          reportsWorkspaceUrl={job.actions.reportsUrl}
                        />
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="text.secondary">COA</Text>
                        <GroupActionMenu
                          group={job.groups.coa}
                          onShare={handleShare}
                          onPrint={handlePrint}
                          reportsWorkspaceUrl={job.actions.reportsUrl}
                        />
                      </HStack>
                      <Button size="sm" onClick={() => setMobileDrawerJobId(job.jobId)}>
                        Open Bags
                      </Button>
                    </VStack>
                  </VStack>
                ))
              : null}
          </VStack>
        </EnterpriseStickyTable>
      </VStack>

      <Drawer
        isOpen={Boolean(mobileDrawerJob)}
        placement="bottom"
        onClose={() => setMobileDrawerJobId(null)}
        size="full"
      >
        <DrawerOverlay />
        <DrawerContent {...enterpriseDrawerContentProps}>
          <DrawerCloseButton />
          <DrawerHeader {...enterpriseDrawerHeaderProps}>
            <VStack align="start" spacing={0.5}>
              <Text fontSize="sm" color="text.secondary">Bags</Text>
              <Text>{mobileDrawerJob?.jobNumber}</Text>
            </VStack>
          </DrawerHeader>
          <DrawerBody {...enterpriseDrawerBodyProps}>
            <VStack align="stretch" spacing={3}>
              {mobileDrawerJob?.lots.map((lot) => (
                <Box key={lot.lotId} borderWidth="1px" borderColor="border.default" borderRadius="lg" p={3}>
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Text fontWeight="semibold">{lot.lotNumber}</Text>
                      <Badge variant="subtle">{lot.packetCount} packets</Badge>
                    </HStack>

                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.secondary">Inspection Uploads</Text>
                      <GroupActionMenu group={lot.groups.inspectionUploads} onShare={handleShare} onPrint={handlePrint} />
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.secondary">Packing List</Text>
                      <GroupActionMenu
                        group={lot.groups.packingList}
                        onShare={handleShare}
                        onPrint={handlePrint}
                        reportsWorkspaceUrl={mobileDrawerJob?.actions.reportsUrl}
                      />
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.secondary">Dispatch Documents</Text>
                      <GroupActionMenu group={lot.groups.dispatchDocuments} onShare={handleShare} onPrint={handlePrint} />
                    </HStack>

                    <Button size="sm" variant="ghost" as="a" href={lot.actions.workflowUrl}>
                      Open Bag Workflow
                    </Button>
                  </VStack>
                </Box>
              ))}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </ControlTowerLayout>
  );
}
