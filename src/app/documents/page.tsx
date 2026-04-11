"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Link,
  Select,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";

import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import {
  EnterpriseEmptyState,
  EnterpriseStickyTable,
  FilterSearchStrip,
  PageActionBar,
  PageIdentityBar,
} from "@/components/enterprise/EnterprisePatterns";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

type DocumentRow = {
  id: string;
  documentType: "COA" | "DISPATCH_DOCUMENT" | "TEST_REPORT" | "INSPECTION_UPLOAD" | "PACKET_DOCUMENT";
  documentLabel: string;
  jobId: string;
  jobNumber: string;
  lotId: string | null;
  lotNumber: string | null;
  packetId: string | null;
  packetCode: string | null;
  status: string;
  generatedAt: string;
  linkedActionUrl: string | null;
  source: "REPORT_SNAPSHOT" | "MEDIA_FILE" | "SAMPLE_MEDIA" | "PACKET_MEDIA";
};

type DocumentRegistryResponse = {
  rows: DocumentRow[];
  total: number;
};

type FilterState = {
  lot: string;
  packet: string;
  job: string;
  dateFrom: string;
  dateTo: string;
  documentType: string;
  status: string;
};

const initialFilters: FilterState = {
  lot: "",
  packet: "",
  job: "",
  dateFrom: "",
  dateTo: "",
  documentType: "",
  status: "",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function buildQuery(filters: FilterState): string {
  const query = new URLSearchParams();
  if (filters.lot.trim()) query.set("lot", filters.lot.trim());
  if (filters.packet.trim()) query.set("packet", filters.packet.trim());
  if (filters.job.trim()) query.set("job", filters.job.trim());
  if (filters.dateFrom.trim()) query.set("dateFrom", filters.dateFrom.trim());
  if (filters.dateTo.trim()) query.set("dateTo", filters.dateTo.trim());
  if (filters.documentType.trim()) query.set("documentType", filters.documentType.trim());
  if (filters.status.trim()) query.set("status", filters.status.trim());
  return query.toString();
}

function getPrimaryDownloadLabel(documentType: DocumentRow["documentType"]): string {
  if (documentType === "DISPATCH_DOCUMENT" || documentType === "PACKET_DOCUMENT") {
    return "Download Packing List PDF";
  }
  return "Download Report PDF";
}

export default function DocumentRegistryPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async (activeFilters: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery(activeFilters);
      const response = await fetch(`/api/documents/registry${query ? `?${query}` : ""}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { details?: string } | null;
        throw new Error(payload?.details || "Failed to load document registry.");
      }
      const payload = await response.json() as DocumentRegistryResponse;
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load document registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows(filters);
  }, [filters, loadRows]);

  const filterBadges = useMemo(
    () => [
      filters.job ? `Job: ${filters.job}` : null,
      filters.lot ? `Lot: ${filters.lot}` : null,
      filters.packet ? `Packet: ${filters.packet}` : null,
      filters.documentType ? `Type: ${filters.documentType}` : null,
      filters.status ? `Status: ${filters.status}` : null,
      filters.dateFrom ? `From: ${filters.dateFrom}` : null,
      filters.dateTo ? `To: ${filters.dateTo}` : null,
    ].filter((value): value is string => Boolean(value)),
    [filters]
  );

  const onSubmitFilters = (event: FormEvent) => {
    event.preventDefault();
    void loadRows(filters);
  };

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={5}>
        <PageIdentityBar
          title="Document Registry"
          subtitle="COA, dispatch documents, test reports, inspection uploads, and packet documents"
          breadcrumbs={[{ label: "Documents", href: "/documents" }]}
          status={<Badge colorScheme="blue">{rows.length} Records</Badge>}
        />

        <PageActionBar
          secondaryActions={
            <HStack spacing={2}>
              <Button size="sm" variant="outline" onClick={() => void loadRows(filters)} isLoading={loading}>
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFilters(initialFilters)}>
                Clear Filters
              </Button>
            </HStack>
          }
          primaryAction={
            <Button as={Link} href="/reports" size="sm">
              View PDF
            </Button>
          }
        />

        <Stack as="form" onSubmit={onSubmitFilters} spacing={4}>
          <FilterSearchStrip
            filters={
              <HStack spacing={2} flexWrap="wrap">
                {filterBadges.length === 0 ? <Badge variant="subtle">No filters</Badge> : null}
                {filterBadges.map((badge) => (
                  <Badge key={badge} variant="subtle" colorScheme="blue">{badge}</Badge>
                ))}
              </HStack>
            }
            search={<Button type="submit" size="sm" isLoading={loading}>Apply</Button>}
          />

          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <FormControl>
              <FormLabel>Job Number</FormLabel>
              <Input value={filters.job} onChange={(event) => setFilters((current) => ({ ...current, job: event.target.value }))} placeholder="Job Number" />
            </FormControl>
            <FormControl>
              <FormLabel>Lot Number</FormLabel>
              <Input value={filters.lot} onChange={(event) => setFilters((current) => ({ ...current, lot: event.target.value }))} placeholder="Lot Number" />
            </FormControl>
            <FormControl>
              <FormLabel>Packet ID</FormLabel>
              <Input value={filters.packet} onChange={(event) => setFilters((current) => ({ ...current, packet: event.target.value }))} placeholder="Packet ID" />
            </FormControl>
          </Stack>

          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <FormControl>
              <FormLabel>Date From</FormLabel>
              <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Date To</FormLabel>
              <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Document Type</FormLabel>
              <Select value={filters.documentType} onChange={(event) => setFilters((current) => ({ ...current, documentType: event.target.value }))}>
                <option value="">All</option>
                <option value="COA">COA</option>
                <option value="DISPATCH_DOCUMENT">Dispatch documents</option>
                <option value="TEST_REPORT">Test reports</option>
                <option value="INSPECTION_UPLOAD">Inspection uploads</option>
                <option value="PACKET_DOCUMENT">Packet documents</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Status</FormLabel>
              <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">All</option>
                <option value="Available">Available</option>
                <option value="Active Report">Active Report</option>
                <option value="Active COA">Active COA</option>
                <option value="Previous Report">Previous Report</option>
                <option value="Superseded">Superseded</option>
                <option value="Current for Dispatch">Current for Dispatch</option>
                <option value="BLOCKED">Blocked</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="USED">Used</option>
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {error ? <EnterpriseEmptyState title="Document registry unavailable" description={error} /> : null}

        <EnterpriseStickyTable>
          <Box p={3}>
            {loading ? <Text color="text.secondary">Loading documents...</Text> : null}
            {!loading ? (
              <EnterpriseDataTable
                rows={rows}
                rowKey={(row) => row.id}
                columns={[
                  { id: "docType", header: "Document Type", render: (row) => row.documentLabel },
                  { id: "job", header: "Job Number", render: (row) => row.jobNumber },
                  { id: "lot", header: "Lot Number", render: (row) => row.lotNumber ?? "—" },
                  { id: "packet", header: "Packet ID", render: (row) => row.packetCode ?? "—" },
                  { id: "status", header: "Status", render: (row) => row.status },
                  { id: "created", header: "Generated/Uploaded At", render: (row) => formatDate(row.generatedAt) },
                  {
                    id: "action",
                    header: "Linked Action",
                    render: (row) => (
                      <HStack spacing={2} flexWrap="wrap">
                        {row.linkedActionUrl ? (
                          <>
                            <Button as={Link} href={row.linkedActionUrl} target="_blank" size="xs" variant="outline">
                              View PDF
                            </Button>
                            <Button as={Link} href={row.linkedActionUrl} target="_blank" size="xs" variant="outline">
                              {getPrimaryDownloadLabel(row.documentType)}
                            </Button>
                            <Button as={Link} href={row.linkedActionUrl} target="_blank" size="xs" variant="outline">
                              Share PDF
                            </Button>
                            <Button as={Link} href={row.linkedActionUrl} target="_blank" size="xs" variant="outline">
                              Print PDF
                            </Button>
                          </>
                        ) : (
                          <Badge colorScheme="gray" variant="subtle">Not Available</Badge>
                        )}
                      </HStack>
                    ),
                  },
                ]}
                emptyLabel="No documents found for current filters."
              />
            ) : null}
          </Box>
        </EnterpriseStickyTable>
      </VStack>
    </ControlTowerLayout>
  );
}
