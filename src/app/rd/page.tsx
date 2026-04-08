"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { ArrowRight, CheckCircle2, Clock3, MapPin, PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/Card";
import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { MasterAutocomplete } from "@/components/forms/MasterAutocomplete";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { isLotReadyForNextStage } from "@/lib/intake-workflow";
import { getJobWorkflowPresentation } from "@/lib/workflow-stage";
import type { InspectionJob } from "@/types/inspection";

type ClientMasterOption = {
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  gstOrId?: string | null;
};

type ItemMasterOption = {
  itemName: string;
  materialType?: "INHOUSE" | "TRADED" | string | null;
  description?: string | null;
  uom?: string | null;
};

type WarehouseMasterOption = {
  warehouseName: string;
  description?: string | null;
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

function countCompletedLots(job: InspectionJob) {
  return (job.lots ?? []).filter((lot) => isLotReadyForNextStage(lot)).length;
}

function formatMaterialTypeLabel(value: string | null | undefined) {
  if (value === "INHOUSE") {
    return "In-house";
  }
  if (value === "TRADED") {
    return "Traded";
  }
  return "Not set";
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

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  async function fetchJobs() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs?view=${viewMode}`);
      if (!response.ok) {
        throw new Error("The intake feed could not be loaded.");
      }
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "The intake feed could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchReferenceData() {
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
  }

  useEffect(() => {
    void fetchJobs();
    void fetchReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  useEffect(() => {
    const selectedItem = items.find((item) => item.itemName.toLowerCase() === materialCategory.trim().toLowerCase()) ?? null;
    if (selectedItem?.materialType === "INHOUSE" || selectedItem?.materialType === "TRADED") {
      setMaterialType(selectedItem.materialType);
    }
  }, [items, materialCategory]);

  const pendingJobs = useMemo(
    () => jobs.filter((job) => countCompletedLots(job) < (job.lots?.length ?? 0) || (job.lots?.length ?? 0) === 0),
    [jobs],
  );

  const nextJob = pendingJobs[0] ?? jobs[0] ?? null;

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: client.clientName,
        description: client.shipToAddress || client.billToAddress,
      })),
    [clients],
  );

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.itemName,
        description: [formatMaterialTypeLabel(item.materialType), item.description].filter(Boolean).join(" • "),
      })),
    [items],
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: warehouse.warehouseName,
        description: warehouse.description || undefined,
      })),
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

      if (!response.ok) {
        throw await response.json();
      }

      await fetchReferenceData();
      setSourceName(name);
      toast({
        title: "Customer added",
        description: `${name} is now available in the master list.`,
        status: "success",
      });
    } catch (createError: unknown) {
      toast({
        title: "Could not add customer",
        description: getErrorDetails(createError, "Unable to add the customer master."),
        status: "error",
      });
    } finally {
      setAddingClient(false);
    }
  }

  async function addItemMaster(name: string) {
    if (!materialType) {
      toast({
        title: "Select material type first",
        description: "Choose in-house or traded before adding a new material.",
        status: "warning",
      });
      return;
    }

    setAddingItem(true);
    try {
      const response = await fetch("/api/masters/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: name, materialType }),
      });

      if (!response.ok) {
        throw await response.json();
      }

      await fetchReferenceData();
      setMaterialCategory(name);
      toast({
        title: "Material added",
        description: `${name} is now available in the material master.`,
        status: "success",
      });
    } catch (createError: unknown) {
      toast({
        title: "Could not add material",
        description: getErrorDetails(createError, "Unable to add the material master."),
        status: "error",
      });
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

      if (!response.ok) {
        throw await response.json();
      }

      await fetchReferenceData();
      setSourceLocation(name);
      toast({
        title: "Warehouse added",
        description: `${name} is now available in the warehouse master.`,
        status: "success",
      });
    } catch (createError: unknown) {
      toast({
        title: "Could not add warehouse",
        description: getErrorDetails(createError, "Unable to add the warehouse master."),
        status: "error",
      });
    } finally {
      setAddingWarehouse(false);
    }
  }

  async function createJob() {
    if (!sourceName.trim() || !materialCategory.trim() || !materialType) {
      toast({
        title: "Missing fields",
        description: "Customer, material, and material type are required.",
        status: "warning",
      });
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
        }),
      });

      if (!response.ok) {
        throw await response.json();
      }

      const job = await response.json();
      toast({
        title: "Job created",
        description: job.inspectionSerialNumber || job.jobReferenceNumber,
        status: "success",
      });
      setSourceName("");
      setMaterialCategory("");
      setMaterialType("");
      setSourceLocation("");
      router.push(`/userinsp/job/${job.id}?view=${viewMode}`);
    } catch (createError: unknown) {
      toast({
        title: "Create job failed",
        description: getErrorDetails(createError, "Unable to create the job."),
        status: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Stack direction={{ base: "column", xl: "row" }} justify="space-between" spacing={4}>
          <Box>
            <HStack spacing={2} mb={2} flexWrap="wrap">
              <Badge colorScheme="brand">JOB INTAKE</Badge>
              <Badge colorScheme="gray" variant="subtle">
                MASTER-LED
              </Badge>
            </HStack>
            <Heading size="lg">Job Intake and Lot Traceability</Heading>
          </Box>

          {nextJob ? (
            <Card bg="bg.rail">
              <VStack align="stretch" spacing={2} minW={{ xl: "320px" }}>
                <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                  Continue pending job
                </Text>
                <Text fontWeight="bold">{nextJob.inspectionSerialNumber}</Text>
                <Text color="text.secondary" fontSize="sm">
                  {nextJob.clientName}
                </Text>
                <Button
                  rightIcon={<ArrowRight size={16} />}
                  onClick={() => router.push(`/userinsp/job/${nextJob.id}?view=${viewMode}`)}
                >
                  Continue
                </Button>
              </VStack>
            </Card>
          ) : null}
        </Stack>

        <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5}>
          <Box gridColumn={{ xl: "span 1" }}>
            <Card>
              <VStack align="stretch" spacing={4}>
                <HStack spacing={3}>
                  <Box p={3} borderRadius="2xl" bg="brand.50" color="brand.600">
                    <PackagePlus size={20} />
                  </Box>
                  <Box>
                    <Heading size="md">Create job</Heading>
                  </Box>
                </HStack>

                <MasterAutocomplete
                  label="Customer"
                  isRequired
                  value={sourceName}
                  options={clientOptions}
                  placeholder="Type customer name"
                  helperText={referenceError ? "Master list unavailable. You can still type and add new records." : "Type at least 3 characters to add a new customer if no match exists."}
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
                  helperText="Pick an existing material or add a new one after 3 characters."
                  isAdding={addingItem}
                  addLabel={(value) => `Add "${value}" as new material`}
                  onChange={setMaterialCategory}
                  onAdd={addItemMaster}
                />

                <FormControl isRequired>
                  <FormLabel>Material type</FormLabel>
                  <HStack spacing={3} flexWrap="wrap">
                    {MATERIAL_TYPE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={materialType === option.value ? "solid" : "outline"}
                        colorScheme={materialType === option.value ? "teal" : "gray"}
                        onClick={() => setMaterialType(option.value)}
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
                  helperText="Location now comes from warehouse masters."
                  isAdding={addingWarehouse}
                  addLabel={(value) => `Add "${value}" as new warehouse`}
                  onChange={setSourceLocation}
                  onAdd={addWarehouseMaster}
                />

                <Button onClick={createJob} isLoading={creating}>
                  Create job
                </Button>
              </VStack>
            </Card>
          </Box>

          <Box gridColumn={{ xl: "span 2" }}>
            {loading ? <PageSkeleton cards={4} rows={2} /> : null}
            {!loading && error ? (
              <InlineErrorState title="Intake feed unavailable" description={error} onRetry={() => void fetchJobs()} />
            ) : null}

            {!loading && !error ? (
              jobs.length === 0 ? (
                <EmptyWorkState
                  title="No intake jobs yet"
                  description="Create the first intake job to start building lots and traceability."
                />
              ) : (
                <VStack align="stretch" spacing={4}>
                  {jobs.map((job) => {
                    const completedLots = countCompletedLots(job);
                    const totalLots = job.lots?.length ?? 0;
                    const presentation = getJobWorkflowPresentation(job);
                    const targetHref = `/userinsp/job/${job.id}?view=${viewMode}`;

                    return (
                      <Card key={job.id}>
                        <Stack direction={{ base: "column", md: "row" }} justify="space-between" spacing={4}>
                          <Box flex="1">
                            <HStack spacing={2} flexWrap="wrap">
                              <Badge colorScheme="brand">{job.inspectionSerialNumber}</Badge>
                              <Badge colorScheme={presentation.tone} variant="subtle">
                                {presentation.label}
                              </Badge>
                              {job.materialType ? (
                                <Badge colorScheme={job.materialType === "INHOUSE" ? "green" : "purple"} variant="subtle">
                                  {formatMaterialTypeLabel(job.materialType)}
                                </Badge>
                              ) : null}
                            </HStack>
                            <Heading size="md" mt={3}>
                              {job.clientName}
                            </Heading>
                            <Text color="text.secondary" mt={1}>
                              {job.commodity}
                            </Text>
                          </Box>

                          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} minW={{ md: "380px" }}>
                            <Box>
                              <HStack spacing={2} color="text.secondary">
                                <PackagePlus size={14} />
                                <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">Lots</Text>
                              </HStack>
                              <Text fontWeight="bold" mt={1}>{totalLots}</Text>
                            </Box>
                            <Box>
                              <HStack spacing={2} color="text.secondary">
                                <CheckCircle2 size={14} />
                                <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">Ready</Text>
                              </HStack>
                              <Text fontWeight="bold" mt={1}>{completedLots}</Text>
                            </Box>
                            <Box>
                              <HStack spacing={2} color="text.secondary">
                                <MapPin size={14} />
                                <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">Warehouse</Text>
                              </HStack>
                              <Text fontWeight="bold" mt={1}>{job.plantLocation || "Not set"}</Text>
                            </Box>
                            <Box>
                              <HStack spacing={2} color="text.secondary">
                                <Clock3 size={14} />
                                <Text fontSize="xs" textTransform="uppercase" fontWeight="bold">Updated</Text>
                              </HStack>
                              <Text fontWeight="bold" mt={1}>{formatDate(job.updatedAt)}</Text>
                            </Box>
                          </SimpleGrid>
                        </Stack>

                        <HStack spacing={3} mt={5} flexWrap="wrap">
                          <Button onClick={() => router.push(targetHref)}>Open job</Button>
                          <Button variant="outline" onClick={() => router.push(targetHref)}>
                            {totalLots === 0 ? "Add first lot" : "Continue intake"}
                          </Button>
                        </HStack>
                      </Card>
                    );
                  })}
                </VStack>
              )
            ) : null}
          </Box>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
