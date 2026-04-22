"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  OrderedList,
  Select,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import {
  enterpriseModalBodyProps,
  enterpriseModalContentProps,
  enterpriseModalFooterProps,
  enterpriseModalHeaderProps,
  FilterSearchStrip,
  PageActionBar,
  PageIdentityBar,
  QuickEditDrawer,
} from "@/components/enterprise/EnterprisePatterns";
import { MasterAutocomplete } from "@/components/forms/MasterAutocomplete";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { normalizeRole } from "@/lib/role";
import { getJobWorkflowPresentation } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

type ClientMasterOption = {
  id?: string;
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  contactPerson?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  gstOrId?: string | null;
  sameAsBilling?: boolean;
};

type ItemMasterOption = {
  id?: string;
  itemName: string;
  materialType?: "INHOUSE" | "TRADED" | string | null;
  description?: string | null;
};

type WarehouseMasterOption = {
  warehouseName: string;
  description?: string | null;
};

type DuplicateCandidate = {
  id: string;
  inspectionSerialNumber: string;
  status: string;
  createdAt: string;
};

type DuplicateWarningPayload = {
  details: string;
  duplicateWindowHours: number;
  canOverrideDuplicate: boolean;
  duplicateCandidates: DuplicateCandidate[];
};

const MATERIAL_TYPE_OPTIONS = [
  { value: "INHOUSE", label: "In-house material" },
  { value: "TRADED", label: "Traded material" },
] as const;

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function getAging(updatedAt: string | Date) {
  const ms = Date.now() - Number(new Date(updatedAt));
  const hours = Math.max(Math.floor(ms / (1000 * 60 * 60)), 0);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getErrorDetails(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "details" in error) {
    return String((error as { details?: unknown }).details ?? fallback);
  }
  return fallback;
}

export default function RdPage() {
  const router = useRouter();
  const toast = useToast();
  const { viewMode } = useWorkspaceView();
  const createDrawer = useDisclosure();

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");

  const [creating, setCreating] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [materialCategory, setMaterialCategory] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [materialType, setMaterialType] = useState<"" | "INHOUSE" | "TRADED">("");
  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseMasterOption[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [addingWarehouse, setAddingWarehouse] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarningPayload | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [sendingDuplicateEscalation, setSendingDuplicateEscalation] = useState(false);
  const [sessionRole, setSessionRole] = useState<string | null>(null);

  const isAdminUser = normalizeRole(sessionRole) === "ADMIN";

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs?view=${viewMode}`);
      if (!response.ok) {
        throw new Error("Job registry could not be loaded.");
      }
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Job registry could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  const fetchReferenceData = useCallback(async () => {
    setReferenceError(null);
    try {
      const [clientResponse, itemResponse, warehouseResponse] = await Promise.all([
        fetch("/api/masters/clients"),
        fetch("/api/masters/items"),
        fetch("/api/masters/warehouses"),
      ]);
      if (!clientResponse.ok || !itemResponse.ok || !warehouseResponse.ok) {
        throw new Error("Master options could not be loaded.");
      }
      const [clientData, itemData, warehouseData] = await Promise.all([
        clientResponse.json() as Promise<ClientMasterOption[]>,
        itemResponse.json() as Promise<ItemMasterOption[]>,
        warehouseResponse.json() as Promise<WarehouseMasterOption[]>,
      ]);
      setClients(Array.isArray(clientData) ? clientData : []);
      setItems(Array.isArray(itemData) ? itemData : []);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
    } catch (fetchError) {
      setReferenceError(fetchError instanceof Error ? fetchError.message : "Master options could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    void fetchReferenceData();
  }, [fetchJobs, fetchReferenceData]);

  useEffect(() => {
    let active = true;
    async function loadSessionRole() {
      try {
        const response = await fetch("/api/session/me");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { role?: string | null };
        if (active) {
          setSessionRole(payload.role ?? null);
        }
      } catch {
        if (active) {
          setSessionRole(null);
        }
      }
    }
    void loadSessionRole();
    return () => {
      active = false;
    };
  }, []);

  async function handleDeleteJob(jobId: string) {
    const confirmed = window.confirm(
      "Delete this job from active workflow? The job will be archived and removed from active queues.",
    );
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch(`/api/jobs/${jobId}/archive`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string } | null;
      throw new Error(payload?.details || "Job could not be deleted.");
      }
      toast({ title: "Job deleted", description: "The job has been archived.", status: "success" });
      await fetchJobs();
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description: deleteError instanceof Error ? deleteError.message : "Delete failed.",
        status: "error",
      });
    }
  }

  useEffect(() => {
    const selectedItem = items.find((item) => item.itemName.toLowerCase() === materialCategory.trim().toLowerCase()) ?? null;
    if (selectedItem?.materialType === "INHOUSE" || selectedItem?.materialType === "TRADED") {
      setMaterialType(selectedItem.materialType);
    }
  }, [items, materialCategory]);

  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.clientName, description: client.shipToAddress || client.billToAddress })),
    [clients],
  );
  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.itemName,
        description: [item.materialType ?? "Not set", item.description].filter(Boolean).join(" • "),
      })),
    [items],
  );
  const warehouseOptions = useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.warehouseName, description: warehouse.description || undefined })),
    [warehouses],
  );

  async function addClientMaster(name: string) {
    setAddingClient(true);
    try {
      const response = await fetch("/api/masters/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: name }),
      });
      if (!response.ok) throw await response.json();
      await fetchReferenceData();
      setSourceName(name);
      toast({ title: "Customer added", status: "success" });
    } catch (createError: unknown) {
      toast({ title: "Could not add customer", description: getErrorDetails(createError, "Unable to add customer."), status: "error" });
    } finally {
      setAddingClient(false);
    }
  }

  async function addItemMaster(name: string) {
    if (!materialType) {
      toast({ title: "Select material type first", status: "warning" });
      return;
    }
    setAddingItem(true);
    try {
      const response = await fetch("/api/masters/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: name, materialType }),
      });
      if (!response.ok) throw await response.json();
      await fetchReferenceData();
      setMaterialCategory(name);
      toast({ title: "Material added", status: "success" });
    } catch (createError: unknown) {
      toast({ title: "Could not add material", description: getErrorDetails(createError, "Unable to add material."), status: "error" });
    } finally {
      setAddingItem(false);
    }
  }

  async function addWarehouseMaster(name: string) {
    setAddingWarehouse(true);
    try {
      const response = await fetch("/api/masters/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseName: name }),
      });
      if (!response.ok) throw await response.json();
      await fetchReferenceData();
      setSourceLocation(name);
      toast({ title: "Warehouse added", status: "success" });
    } catch (createError: unknown) {
      toast({ title: "Could not add warehouse", description: getErrorDetails(createError, "Unable to add warehouse."), status: "error" });
    } finally {
      setAddingWarehouse(false);
    }
  }

  async function submitJobCreate(input?: { overrideDuplicate?: boolean; overrideReason?: string }) {
    if (!sourceName.trim() || !materialCategory.trim() || !materialType) {
      toast({ title: "Missing fields", description: "Customer, material, and material type are required.", status: "warning" });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: sourceName.trim(),
          materialCategory: materialCategory.trim(),
          materialType,
          sourceLocation: sourceLocation.trim() || undefined,
          overrideDuplicate: input?.overrideDuplicate ?? false,
          overrideReason: input?.overrideReason ?? undefined,
        }),
      });

      if (response.status === 409) {
        const warning = await response.json() as {
          details?: string;
          duplicateWindowHours?: number;
          canOverrideDuplicate?: boolean;
          duplicateCandidates?: DuplicateCandidate[];
        };
        setDuplicateWarning({
          details: warning.details ?? "Potential duplicate jobs found.",
          duplicateWindowHours: warning.duplicateWindowHours ?? 24,
          canOverrideDuplicate: warning.canOverrideDuplicate === true,
          duplicateCandidates: Array.isArray(warning.duplicateCandidates) ? warning.duplicateCandidates : [],
        });
        setOverrideReason("");
        toast({ title: "Potential duplicate detected", status: "warning" });
        return;
      }

      if (!response.ok) throw await response.json();
      const job = await response.json();
      toast({ title: "Job created", description: job.inspectionSerialNumber || job.jobReferenceNumber, status: "success" });
      setSourceName("");
      setMaterialCategory("");
      setMaterialType("");
      setSourceLocation("");
      setDuplicateWarning(null);
      setOverrideReason("");
      createDrawer.onClose();
      await fetchJobs();
      router.push(`/jobs/${job.id}/workflow`);
    } catch (createError: unknown) {
      toast({ title: "Create job failed", description: getErrorDetails(createError, "Unable to create job."), status: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function sendDuplicateEscalation() {
    if (!duplicateWarning) {
      return;
    }
    setSendingDuplicateEscalation(true);
    try {
      const response = await fetch("/api/workflow/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DUPLICATE_JOB",
          severity: "MEDIUM",
          title: `Duplicate warning: ${sourceName.trim()} / ${materialCategory.trim()}`,
          overrideReason: overrideReason.trim() || undefined,
          detailsJson: {
            duplicateWindowHours: duplicateWarning.duplicateWindowHours,
            duplicateCandidates: duplicateWarning.duplicateCandidates,
            sourceName: sourceName.trim(),
            materialCategory: materialCategory.trim(),
            sourceLocation: sourceLocation.trim() || null,
          },
        }),
      });
      if (!response.ok) throw await response.json();
      toast({ title: "Escalation queued", status: "success" });
      setDuplicateWarning(null);
    } catch (submitError: unknown) {
      toast({ title: "Escalation failed", description: getErrorDetails(submitError, "Unable to create escalation."), status: "error" });
    } finally {
      setSendingDuplicateEscalation(false);
    }
  }

  const stageOptions = useMemo(() => {
    const labels = new Set<string>();
    jobs.forEach((job) => labels.add(getJobWorkflowPresentation(job).label));
    return ["All", ...Array.from(labels)];
  }, [jobs]);

  const filteredRows = useMemo(
    () =>
      jobs
        .filter((job) => {
          const presentation = getJobWorkflowPresentation(job);
          const matchesStage = stage === "all" || presentation.label.toLowerCase() === stage;
          const text = [job.inspectionSerialNumber, job.clientName, job.commodity, job.plantLocation ?? ""].join(" ").toLowerCase();
          return matchesStage && (!search || text.includes(search.toLowerCase()));
        })
        .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt))),
    [jobs, search, stage],
  );
  const isCreateJobSaveDisabled = creating || !sourceName.trim() || !materialCategory.trim() || !materialType;

  return (
    <>
      <ControlTowerLayout>
        <VStack align="stretch" spacing={4}>
          <PageIdentityBar
            title="Job Registry"
            subtitle="Table-first job operations with explicit lot linkage."
            status={<Badge colorScheme="brand" variant="subtle">{viewMode === "all" ? "Company View" : "My View"}</Badge>}
          />

          <PageActionBar
            primaryAction={<Button onClick={createDrawer.onOpen}>Create Job</Button>}
            secondaryActions={<Text fontSize={{ base: "sm", md: "md" }} color="text.secondary">Bag-centric enterprise registry</Text>}
          />

          <FilterSearchStrip
            filters={
              <Select value={stage} onChange={(event) => setStage(event.target.value)} maxW="220px" size="sm">
                {stageOptions.map((option) => (
                  <option key={option} value={option.toLowerCase()}>
                    {option === "All" ? "All stages" : option}
                  </option>
                ))}
              </Select>
            }
            search={<Input size="sm" maxW={{ base: "full", lg: "320px" }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job, customer, source, material" />}
            actions={<Button size="sm" variant="outline" onClick={() => { setSearch(""); setStage("all"); }}>Clear</Button>}
          />

          {loading ? <PageSkeleton cards={2} rows={2} /> : null}
          {!loading && error ? <InlineErrorState title="Job registry unavailable" description={error} onRetry={() => void fetchJobs()} /> : null}
          {!loading && !error ? (
            filteredRows.length === 0 ? (
              <EmptyWorkState title="No jobs found" description="Create a job or change filters." />
            ) : (
              <EnterpriseDataTable
                rows={filteredRows}
                rowKey={(row) => row.id}
                columns={[
                  {
                    id: "job-id",
                    header: "Job Number",
                    render: (row) => row.inspectionSerialNumber || row.jobReferenceNumber || "—",
                  },
                  { id: "customer", header: "Customer / Source", render: (row) => row.plantLocation ? `${row.clientName} • ${row.plantLocation}` : row.clientName },
                  { id: "lots", header: "Number of Bags", render: (row) => String(row.lots?.length ?? 0) },
                  {
                    id: "stage",
                    header: "Current Stage",
                    render: (row) => {
                      const presentation = getJobWorkflowPresentation(row);
                      return <WorkflowStateChip status={presentation.label} />;
                    },
                  },
                  {
                    id: "pending-action",
                    header: "Pending Action",
                    render: (row) => getJobWorkflowPresentation(row).nextAction,
                  },
                  { id: "owner", header: "Owner", render: (row) => row.assignedTo?.profile?.displayName || "Unassigned" },
                  { id: "updated", header: "Last Updated", render: (row) => formatDate(row.updatedAt) },
                  { id: "aging", header: "Aging / SLA", render: (row) => getAging(row.updatedAt) },
                ]}
                rowActions={[
                  { id: "open", label: "Open Job Workflow", onClick: (row) => router.push(`/jobs/${row.id}/workflow`) },
                  {
                    id: "open-inspection",
                    label: "Open Bag Inspection Queue",
                    onClick: (row) => router.push(`/jobs/${row.id}/workflow?section=images`),
                  },
                  ...(isAdminUser
                    ? [
                        {
                          id: "delete-job",
                    label: "Delete Job",
                          onClick: (row: InspectionJob) => void handleDeleteJob(row.id),
                        },
                      ]
                    : []),
                ]}
              />
            )
          ) : null}
        </VStack>
      </ControlTowerLayout>

      <QuickEditDrawer
        isOpen={createDrawer.isOpen}
        onClose={createDrawer.onClose}
        title="Create Job"
        onSave={() => void submitJobCreate()}
        isSaving={creating}
        isSaveDisabled={isCreateJobSaveDisabled}
        saveLabel="Create Job"
      >
        <VStack align="stretch" spacing={4}>
          <MasterAutocomplete
            label="Customer"
            isRequired
            value={sourceName}
            options={clientOptions}
            placeholder="Type customer name"
            helperText={referenceError ? "Master list unavailable. You can still type and add." : "Type at least 3 characters to add new customer."}
            isAdding={addingClient}
            addLabel={(value) => `Add "${value}" as new customer`}
            onChange={setSourceName}
            onAdd={addClientMaster}
          />

          <MasterAutocomplete
            label="Material"
            isRequired
            value={materialCategory}
            options={itemOptions}
            placeholder="Type material name"
            helperText="Pick existing material or add a new one."
            isAdding={addingItem}
            addLabel={(value) => `Add "${value}" as new material`}
            onChange={setMaterialCategory}
            onAdd={addItemMaster}
          />

          <FormControl isRequired>
            <FormLabel>Material type</FormLabel>
            <HStack spacing={2} flexWrap="wrap">
              {MATERIAL_TYPE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={materialType === option.value ? "solid" : "outline"}
                  onClick={() => setMaterialType(option.value)}
                  size="sm"
                >
                  {option.label}
                </Button>
              ))}
            </HStack>
          </FormControl>

          <MasterAutocomplete
            label="Warehouse"
            value={sourceLocation}
            options={warehouseOptions}
            placeholder="Select or type warehouse"
            helperText="Location comes from warehouse masters."
            isAdding={addingWarehouse}
            addLabel={(value) => `Add "${value}" as new warehouse`}
            onChange={setSourceLocation}
            onAdd={addWarehouseMaster}
          />
        </VStack>
      </QuickEditDrawer>

      <Modal isOpen={duplicateWarning !== null} onClose={() => setDuplicateWarning(null)} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent {...enterpriseModalContentProps}>
          <ModalHeader {...enterpriseModalHeaderProps}>Potential duplicate job</ModalHeader>
          <ModalCloseButton />
          <ModalBody {...enterpriseModalBodyProps}>
            <VStack align="stretch" spacing={3}>
              <Text color="text.secondary">{duplicateWarning?.details}</Text>
              <Text fontSize={{ base: "sm", md: "md" }} color="text.secondary">Duplicate window: last {duplicateWarning?.duplicateWindowHours ?? 24} hours.</Text>
              <OrderedList spacing={1} ml={4}>
                {(duplicateWarning?.duplicateCandidates ?? []).map((candidate) => (
                  <ListItem key={candidate.id} fontSize={{ base: "sm", md: "md" }}>
                    {candidate.inspectionSerialNumber} ({candidate.status}) <Text as="span" color="text.secondary">{formatDate(candidate.createdAt)}</Text>
                  </ListItem>
                ))}
              </OrderedList>
              <FormControl isRequired={Boolean(duplicateWarning?.canOverrideDuplicate)}>
                <FormLabel>Reason</FormLabel>
                <Input
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder={duplicateWarning?.canOverrideDuplicate ? "Required for override" : "Optional reason for escalation"}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter {...enterpriseModalFooterProps}>
            <HStack spacing={2}>
              <Button variant="ghost" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
              {duplicateWarning?.canOverrideDuplicate ? (
                <Button onClick={() => void submitJobCreate({ overrideDuplicate: true, overrideReason: overrideReason.trim() })} isLoading={creating}>
                  Create with Override
                </Button>
              ) : (
                <Button onClick={() => void sendDuplicateEscalation()} isLoading={sendingDuplicateEscalation}>
                  Send Escalation
                </Button>
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
