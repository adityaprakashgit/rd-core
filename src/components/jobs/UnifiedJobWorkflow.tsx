"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
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

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import {
  EnterpriseStickyTable,
  ExceptionBanner,
  LinkedRecordsPanel,
  PageActionBar,
  PageIdentityBar,
  QuickEditDrawer,
} from "@/components/enterprise/EnterprisePatterns";
import { SealScanner } from "@/components/inspection/SealScanner";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { canApproveFinalDecision, type ModuleWorkflowPolicy } from "@/lib/module-workflow-policy";
import type { InspectionJob, InspectionLot, PublicUser } from "@/types/inspection";

type ClientOption = {
  id: string;
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  gstOrId?: string | null;
  contactPerson?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  sameAsBilling?: boolean;
};

type ItemOption = {
  id: string;
  itemName: string;
  materialType?: string | null;
  description?: string | null;
};

type ContainerTypeOption = {
  id: string;
  name: string;
};

type WorkflowPayload = {
  job: InspectionJob;
  settings: ModuleWorkflowPolicy;
  clients: ClientOption[];
  items: ItemOption[];
  containerTypes: ContainerTypeOption[];
  workflowStage: string;
  nextAction: string;
  blockers: string[];
  images: Array<{ id: string; category: string; fileName?: string | null }>;
  decision: { status: string; note?: string | null } | null;
  sample: InspectionLot["sample"] | null;
  sealMapping: { lotId: string | null; lotNumber: string | null; sealNumber: string | null; status: string | null };
  packets: NonNullable<NonNullable<InspectionLot["sample"]>["packets"]>;
  assignment: { createdBy: string | null; assignedTo: string | null; deadline: string | Date | null };
  history: Array<{ id: string; label: string; timestamp: string | Date; actor: string }>;
};

type SessionUser = {
  role: PublicUser["role"];
  email?: string | null;
  profile?: PublicUser["profile"];
};

const imageCategoryMap: Record<string, string> = {
  "Bag photo with visible LOT no": "BAG_WITH_LOT_NO",
  "Material in bag": "MATERIAL_VISIBLE",
  "During Sampling Photo": "SAMPLING_IN_PROGRESS",
  "Sample Completion": "SEALED_BAG",
  "Seal on bag": "SEAL_CLOSEUP",
  "Bag condition": "BAG_CONDITION",
  "Whole Job bag palletized and packed": "LOT_OVERVIEW",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not Available";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not Available" : parsed.toLocaleString();
}

function buildAutoLotNumber(settings: ModuleWorkflowPolicy["workflow"], lots: InspectionLot[]) {
  const prefix = settings.lotNumberPrefix?.trim() || "LOT";
  const width = Math.max(settings.lotNumberSequenceFormat?.length ?? 4, 4);
  const next = String(lots.length + 1).padStart(width, "0");
  return `${prefix}-${next}`;
}

export function UnifiedJobWorkflow() {
  const { jobId } = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WorkflowPayload | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedImageLabel, setSelectedImageLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    clientId: "",
    clientName: "",
    commodity: "",
    plantLocation: "",
    deadline: "",
  });
  const [clientForm, setClientForm] = useState({
    clientName: "",
    billToAddress: "",
    shipToAddress: "",
    gstOrId: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    sameAsBilling: true,
  });
  const [lotForm, setLotForm] = useState({
    lotNumber: "",
    quantityMode: "SINGLE_PIECE",
    materialName: "",
    totalBags: "1",
    weightUnit: "KG",
  });
  const [sampleForm, setSampleForm] = useState({
    sampleCode: "",
    sampleType: "",
    samplingMethod: "",
    sampleQuantity: "",
    sampleUnit: "KG",
    containerType: "",
    remarks: "",
  });
  const [packetCount, setPacketCount] = useState("1");
  const [packetDrafts, setPacketDrafts] = useState<Record<string, { packetWeight: string; packetUnit: string }>>({});

  const fetchWorkflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workflowRes, sessionRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/workflow`),
        fetch("/api/session/me"),
      ]);
      if (!workflowRes.ok || !sessionRes.ok) {
        throw new Error("Unified job workflow could not be loaded.");
      }
      const workflowPayload = (await workflowRes.json()) as WorkflowPayload;
      const sessionPayload = (await sessionRes.json()) as SessionUser;
      setPayload(workflowPayload);
      setCurrentUser(sessionPayload);

      const preferredLotId = searchParams.get("lotId");
      const firstLotId = workflowPayload.job.lots?.[0]?.id ?? null;
      const nextLotId =
        preferredLotId && workflowPayload.job.lots?.some((lot) => lot.id === preferredLotId) ? preferredLotId : firstLotId;
      setSelectedLotId(nextLotId);
      setJobForm({
        clientId: workflowPayload.job.clientId ?? "",
        clientName: workflowPayload.job.clientName,
        commodity: workflowPayload.job.commodity,
        plantLocation: workflowPayload.job.plantLocation ?? "",
        deadline:
          typeof workflowPayload.job.deadline === "string" && workflowPayload.job.deadline
            ? workflowPayload.job.deadline.slice(0, 10)
            : "",
      });
      setLotForm((current) => ({
        ...current,
        lotNumber:
          workflowPayload.settings.workflow.autoLotNumbering
            ? buildAutoLotNumber(workflowPayload.settings.workflow, workflowPayload.job.lots ?? [])
            : current.lotNumber,
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unified job workflow could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [jobId, searchParams]);

  useEffect(() => {
    void fetchWorkflow();
  }, [fetchWorkflow]);

  const job = payload?.job ?? null;
  const settings = payload?.settings ?? null;
  const clients = payload?.clients ?? [];
  const items = payload?.items ?? [];
  const containerTypes = payload?.containerTypes ?? [];
  const selectedLot = useMemo(
    () => job?.lots?.find((lot) => lot.id === selectedLotId) ?? job?.lots?.[0] ?? null,
    [job?.lots, selectedLotId],
  );
  const selectedSample = selectedLot?.sample ?? null;
  const packets = useMemo(() => selectedSample?.packets ?? [], [selectedSample?.packets]);

  useEffect(() => {
    if (!selectedSample) {
      setSampleForm({
        sampleCode: "",
        sampleType: "",
        samplingMethod: "",
        sampleQuantity: "",
        sampleUnit: "KG",
        containerType: "",
        remarks: "",
      });
      return;
    }
    setSampleForm({
      sampleCode: selectedSample.sampleCode ?? "",
      sampleType: selectedSample.sampleType ?? "",
      samplingMethod: selectedSample.samplingMethod ?? "",
      sampleQuantity:
        selectedSample.sampleQuantity !== null && selectedSample.sampleQuantity !== undefined
          ? String(selectedSample.sampleQuantity)
          : "",
      sampleUnit: selectedSample.sampleUnit ?? "KG",
      containerType: selectedSample.containerType ?? "",
      remarks: selectedSample.remarks ?? "",
    });
  }, [selectedSample]);

  useEffect(() => {
    const nextDrafts: Record<string, { packetWeight: string; packetUnit: string }> = {};
    for (const packet of packets) {
      nextDrafts[packet.id] = {
        packetWeight:
          packet.packetWeight !== null && packet.packetWeight !== undefined
            ? String(packet.packetWeight)
            : packet.packetQuantity !== null && packet.packetQuantity !== undefined
              ? String(packet.packetQuantity)
              : "",
        packetUnit: packet.packetUnit ?? "KG",
      };
    }
    setPacketDrafts(nextDrafts);
  }, [packets]);

  const handleSaveJobBasics = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobForm),
      });
      if (!response.ok) {
        throw new Error("Job basics could not be saved.");
      }
      await fetchWorkflow();
      toast({ title: "Job basics saved", status: "success" });
    } catch (saveError) {
      toast({ title: "Save failed", description: saveError instanceof Error ? saveError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/masters/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientForm,
          shipToAddress: clientForm.sameAsBilling ? clientForm.billToAddress : clientForm.shipToAddress,
        }),
      });
      if (!response.ok) {
        throw new Error("Client could not be created.");
      }
      const created = (await response.json()) as ClientOption;
      await fetchWorkflow();
      setClientDrawerOpen(false);
      setJobForm((current) => ({ ...current, clientId: created.id, clientName: created.clientName }));
      toast({ title: "Client created", status: "success" });
    } catch (createError) {
      toast({ title: "Client create failed", description: createError instanceof Error ? createError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLot = async () => {
    if (!selectedLot && settings?.workflow.autoLotNumbering && job) {
      setLotForm((current) => ({
        ...current,
        lotNumber: buildAutoLotNumber(settings.workflow, job.lots ?? []),
      }));
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotNumber: lotForm.lotNumber,
          materialName: lotForm.materialName,
          quantityMode: lotForm.quantityMode,
          totalBags: Number(lotForm.totalBags),
          weightUnit: lotForm.weightUnit,
        }),
      });
      if (!response.ok) {
        throw new Error("Lot could not be created.");
      }
      await fetchWorkflow();
      setLotForm({
        lotNumber: settings ? buildAutoLotNumber(settings.workflow, (job?.lots ?? []).concat()) : "",
        quantityMode: "SINGLE_PIECE",
        materialName: "",
        totalBags: "1",
        weightUnit: "KG",
      });
      toast({ title: "Lot created", status: "success" });
    } catch (createError) {
      toast({ title: "Lot create failed", description: createError instanceof Error ? createError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!selectedLot || !selectedImageLabel) {
      return;
    }
    setSaving(true);
    try {
      const category = imageCategoryMap[selectedImageLabel] ?? selectedImageLabel.toUpperCase().replaceAll(" ", "_");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lotId", selectedLot.id);
      formData.append("category", category);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error("Image upload failed.");
      }
      await fetchWorkflow();
      toast({ title: "Image uploaded", status: "success" });
    } catch (uploadError) {
      toast({ title: "Upload failed", description: uploadError instanceof Error ? uploadError.message : "Upload failed.", status: "error" });
    } finally {
      setSaving(false);
      setSelectedImageLabel(null);
    }
  };

  const ensureInspectionRecord = async () => {
    if (!selectedLot) {
      return;
    }
    const response = await fetch("/api/inspection/execution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: selectedLot.id }),
    });
    if (!response.ok) {
      throw new Error("Inspection record could not be initialized.");
    }
  };

  const handleDecision = async (decision: "PENDING" | "READY_FOR_SAMPLING" | "ON_HOLD" | "REJECTED") => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      await ensureInspectionRecord();
      const overallRemark =
        decision === "ON_HOLD" || decision === "REJECTED"
          ? "Decision requires review note."
          : decision === "PENDING"
            ? "Ready for Decision"
            : "Approved for Sampling";
      const response = await fetch("/api/inspection/execution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          decisionStatus: decision,
          overallRemark,
        }),
      });
      if (!response.ok) {
        throw new Error("Decision update failed.");
      }
      await fetchWorkflow();
      toast({ title: "Decision updated", status: "success" });
    } catch (decisionError) {
      toast({ title: "Decision failed", description: decisionError instanceof Error ? decisionError.message : "Decision failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartSampling = async () => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          ...(settings?.workflow.autoSampleIdGeneration ? {} : { sampleCode: sampleForm.sampleCode }),
        }),
      });
      if (!response.ok) {
        throw new Error("Sampling could not be started.");
      }
      await fetchWorkflow();
      toast({ title: "Sampling started", status: "success" });
    } catch (sampleError) {
      toast({ title: "Sampling failed", description: sampleError instanceof Error ? sampleError.message : "Sampling failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSample = async () => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          ...(settings?.workflow.autoSampleIdGeneration ? {} : { sampleCode: sampleForm.sampleCode }),
          sampleType: sampleForm.sampleType,
          samplingMethod: sampleForm.samplingMethod,
          sampleQuantity: sampleForm.sampleQuantity,
          sampleUnit: sampleForm.sampleUnit,
          containerType: sampleForm.containerType,
          remarks: sampleForm.remarks,
        }),
      });
      if (!response.ok) {
        throw new Error("Sample details could not be saved.");
      }
      await fetchWorkflow();
      toast({ title: "Sample details saved", status: "success" });
    } catch (sampleError) {
      toast({ title: "Save failed", description: sampleError instanceof Error ? sampleError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkHomogeneous = async () => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId: selectedLot.id, markHomogenized: true }),
      });
      if (!response.ok) {
        throw new Error("Homogeneous proof could not be marked.");
      }
      await fetchWorkflow();
      toast({ title: "Homogeneous proof saved", status: "success" });
    } catch (sampleError) {
      toast({ title: "Update failed", description: sampleError instanceof Error ? sampleError.message : "Update failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeal = async (sealNo: string) => {
    if (!selectedLot) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/inspection/sample-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: selectedLot.id,
          sealNo,
          sealAuto: false,
          markSealed: true,
        }),
      });
      if (!response.ok) {
        throw new Error("Seal could not be saved.");
      }
      await fetchWorkflow();
      toast({ title: "Seal saved", status: "success" });
    } catch (sealError) {
      toast({ title: "Seal failed", description: sealError instanceof Error ? sealError.message : "Seal failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSealsForAll = async () => {
    if (!job?.lots?.length) {
      return;
    }
    setSaving(true);
    try {
      for (const lot of job.lots) {
        if (lot.sealNumber) {
          continue;
        }
        const response = await fetch(`/api/lots/${lot.id}/seal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto: true }),
        });
        if (!response.ok) {
          throw new Error(`Seal generation failed for ${lot.lotNumber}.`);
        }
      }
      await fetchWorkflow();
      toast({ title: "Seal numbers generated", status: "success" });
    } catch (sealError) {
      toast({ title: "Bulk generation failed", description: sealError instanceof Error ? sealError.message : "Generation failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePackets = async () => {
    if (!selectedSample) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/rd/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: selectedSample.id, count: Number(packetCount) }),
      });
      if (!response.ok) {
        throw new Error("Packets could not be created.");
      }
      await fetchWorkflow();
      toast({ title: "Packets created", status: "success" });
    } catch (packetError) {
      toast({ title: "Packet create failed", description: packetError instanceof Error ? packetError.message : "Create failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePacket = async (packetId: string) => {
    const draft = packetDrafts[packetId];
    if (!draft) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/rd/packet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetId,
          packetWeight: draft.packetWeight,
          packetQuantity: draft.packetWeight,
          packetUnit: draft.packetUnit,
        }),
      });
      if (!response.ok) {
        throw new Error("Packet could not be updated.");
      }
      await fetchWorkflow();
      toast({ title: "Packet updated", status: "success" });
    } catch (packetError) {
      toast({ title: "Packet save failed", description: packetError instanceof Error ? packetError.message : "Save failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitToRnd = async () => {
    if (!packets.length) {
      return;
    }
    setSaving(true);
    try {
      for (const packet of packets) {
        const draft = packetDrafts[packet.id];
        if (!draft?.packetWeight || !draft?.packetUnit) {
          throw new Error("Every packet requires packet weight and packet unit before Submit to R&D.");
        }
        const response = await fetch("/api/rd/packet", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packetId: packet.id,
            packetWeight: draft.packetWeight,
            packetQuantity: draft.packetWeight,
            packetUnit: draft.packetUnit,
            markSubmittedToRnd: true,
          }),
        });
        if (!response.ok) {
          throw new Error(`Submit to R&D failed for ${packet.packetCode}.`);
        }
      }
      await fetchWorkflow();
      toast({ title: "Submitted to R&D", status: "success" });
    } catch (submitError) {
      toast({ title: "Submit failed", description: submitError instanceof Error ? submitError.message : "Submit failed.", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={4} rows={4} />
      </ControlTowerLayout>
    );
  }

  if (error || !job || !settings) {
    return (
      <ControlTowerLayout>
        <InlineErrorState title="Workflow unavailable" description={error ?? "Workflow unavailable"} onRetry={() => void fetchWorkflow()} />
      </ControlTowerLayout>
    );
  }

  const nextPrimaryAction = payload?.nextAction ?? "Add Lot";

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={5}>
        <PageIdentityBar
          title="Job Workflow"
          subtitle="One guided workflow from Job Basics to Submit to R&D."
          breadcrumbs={[
            { label: "Jobs", href: "/jobs" },
            { label: job.inspectionSerialNumber || job.jobReferenceNumber || "Job" },
            { label: "Workflow" },
          ]}
          status={
            <HStack spacing={2}>
              <Badge colorScheme="blue" variant="subtle">{job.status}</Badge>
              <Badge colorScheme="gray" variant="subtle">Current CTA: {nextPrimaryAction}</Badge>
            </HStack>
          }
        />

        <PageActionBar
          primaryAction={
            <Button onClick={() => {
              if (nextPrimaryAction === "Add Lot") {
                void handleCreateLot();
              } else if (nextPrimaryAction === "Submit for Decision") {
                void handleDecision("PENDING");
              } else if (nextPrimaryAction === "Start Sampling") {
                void handleStartSampling();
              } else if (nextPrimaryAction === "Mark Homogeneous Proof") {
                void handleMarkHomogeneous();
              } else if (nextPrimaryAction === "Create Packets") {
                void handleCreatePackets();
              } else {
                void handleSubmitToRnd();
              }
            }} isLoading={saving}>
              {nextPrimaryAction}
            </Button>
          }
          secondaryActions={<Text fontSize="sm" color="text.secondary">Unified execution flow with canonical routes and explicit lot linkage.</Text>}
        />

        <Stack direction={{ base: "column", xl: "row" }} spacing={5} align="start">
          <VStack align="stretch" spacing={4} flex="1">
            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">1. Job Basics</Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Client Name</FormLabel>
                      <Select
                        value={jobForm.clientId}
                        onChange={(event) => {
                          const selectedClient = clients.find((client) => client.id === event.target.value);
                          setJobForm((current) => ({
                            ...current,
                            clientId: event.target.value,
                            clientName: selectedClient?.clientName ?? current.clientName,
                          }));
                        }}
                      >
                        <option value="">Select client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>{client.clientName}</option>
                        ))}
                      </Select>
                      <Button mt={2} size="sm" variant="outline" onClick={() => setClientDrawerOpen(true)}>
                        Add New Client
                      </Button>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Item</FormLabel>
                      <Select
                        value={jobForm.commodity}
                        onChange={(event) => setJobForm((current) => ({ ...current, commodity: event.target.value }))}
                      >
                        <option value="">Select item</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.itemName}>{item.itemName}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Assigned user</FormLabel>
                      <Input value={job.assignedTo?.profile?.displayName ?? "Current user"} isReadOnly />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Deadline</FormLabel>
                      <Input type="date" value={jobForm.deadline} onChange={(event) => setJobForm((current) => ({ ...current, deadline: event.target.value }))} />
                    </FormControl>
                  </SimpleGrid>
                  <Button alignSelf="start" onClick={() => void handleSaveJobBasics()} isLoading={saving}>Save Job</Button>
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">2. Lots</Heading>
                  <HStack spacing={2} flexWrap="wrap">
                    {(job.lots ?? []).map((lot) => (
                      <Button key={lot.id} size="sm" variant={selectedLot?.id === lot.id ? "solid" : "outline"} onClick={() => setSelectedLotId(lot.id)}>
                        {lot.lotNumber}
                      </Button>
                    ))}
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Lot Number</FormLabel>
                      <Input
                        value={lotForm.lotNumber}
                        onChange={(event) => setLotForm((current) => ({ ...current, lotNumber: event.target.value }))}
                        isReadOnly={settings.workflow.autoLotNumbering}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Quantity Mode</FormLabel>
                      <Select value={lotForm.quantityMode} onChange={(event) => setLotForm((current) => ({ ...current, quantityMode: event.target.value }))}>
                        <option value="SINGLE_PIECE">Single piece</option>
                        <option value="MULTI_WEIGHT">Multi-weight</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Material Name</FormLabel>
                      <Input value={lotForm.materialName} onChange={(event) => setLotForm((current) => ({ ...current, materialName: event.target.value }))} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>{lotForm.quantityMode === "MULTI_WEIGHT" ? "Bag Rows" : "Total Bags"}</FormLabel>
                      <Input value={lotForm.totalBags} onChange={(event) => setLotForm((current) => ({ ...current, totalBags: event.target.value }))} />
                    </FormControl>
                  </SimpleGrid>
                  {lotForm.quantityMode === "MULTI_WEIGHT" ? (
                    <Text fontSize="sm" color="text.secondary">Multi-weight lots capture gross/net/tare per bag row. Lot-level summary is derived.</Text>
                  ) : null}
                  <Button alignSelf="start" onClick={() => void handleCreateLot()} isLoading={saving}>Add Lot</Button>
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">3. Images</Heading>
                  {!selectedLot ? (
                    <EmptyWorkState title="No lot selected" description="Select a lot to capture required images." />
                  ) : (
                    <EnterpriseStickyTable>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Image Category</Th>
                            <Th>Status</Th>
                            <Th>Action</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {settings.images.requiredImageCategories.map((label) => {
                            const uploadCategory = imageCategoryMap[label] ?? label.toUpperCase().replaceAll(" ", "_");
                            const exists = selectedLot.mediaFiles?.some((file) => file.category === uploadCategory);
                            return (
                              <Tr key={label}>
                                <Td>{label}</Td>
                                <Td>
                                  <Badge colorScheme={exists ? "green" : "orange"}>{exists ? "Uploaded" : "Missing"}</Badge>
                                </Td>
                                <Td>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedImageLabel(label);
                                      fileRef.current?.click();
                                    }}
                                  >
                                    Upload Images
                                  </Button>
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </EnterpriseStickyTable>
                  )}
                  {settings.images.imageTimestampRequired ? (
                    <Text fontSize="sm" color="text.secondary">Timestamp overlay is enabled for image capture in this company configuration.</Text>
                  ) : null}
                  {settings.ui.showOptionalImageSection && settings.images.optionalImageCategories.length > 0 ? (
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" color="text.primary" mb={2}>
                        Optional Images
                      </Text>
                      <VStack align="stretch" spacing={1}>
                        {settings.images.optionalImageCategories.map((label) => (
                          <Text key={label} fontSize="sm" color="text.secondary">
                            {label}
                          </Text>
                        ))}
                      </VStack>
                    </Box>
                  ) : null}
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">4. Final Decision</Heading>
                  {!selectedLot ? (
                    <EmptyWorkState title="No lot selected" description="Select a lot to submit or approve the decision." />
                  ) : (
                    <>
                      <Text fontSize="sm" color="text.secondary">
                        Operations submit lots for decision. Final Pass, Hold, and Reject are controlled by the configured approver policy.
                      </Text>
                      <HStack spacing={3} flexWrap="wrap">
                        <Button variant="outline" onClick={() => void handleDecision("PENDING")} isLoading={saving}>
                          Submit for Decision
                        </Button>
                        {canApproveFinalDecision(currentUser?.role, settings.workflow.finalDecisionApproverPolicy) ? (
                          <>
                            <Button onClick={() => void handleDecision("READY_FOR_SAMPLING")} isLoading={saving}>Pass</Button>
                            <Button colorScheme="yellow" onClick={() => void handleDecision("ON_HOLD")} isLoading={saving}>Hold</Button>
                            <Button colorScheme="red" onClick={() => void handleDecision("REJECTED")} isLoading={saving}>Reject</Button>
                          </>
                        ) : null}
                      </HStack>
                      <Text fontSize="sm" color="text.secondary">
                        Current Decision: {selectedLot.inspection?.decisionStatus?.replaceAll("_", " ") ?? "PENDING"}
                      </Text>
                    </>
                  )}
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">5. Sampling</Heading>
                  {!selectedLot ? (
                    <EmptyWorkState title="No lot selected" description="Select a lot to manage sample details." />
                  ) : (
                    <>
                      {!selectedSample ? (
                        <Button alignSelf="start" onClick={() => void handleStartSampling()} isLoading={saving}>Start Sampling</Button>
                      ) : null}
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <FormControl>
                          <FormLabel>Sample ID</FormLabel>
                          <Input
                            value={
                              selectedSample?.sampleCode ??
                              (settings.workflow.autoSampleIdGeneration ? "Auto generated after start" : sampleForm.sampleCode)
                            }
                            isReadOnly={settings.workflow.autoSampleIdGeneration || Boolean(selectedSample?.sampleCode)}
                            onChange={(event) => setSampleForm((current) => ({ ...current, sampleCode: event.target.value }))}
                            placeholder={settings.workflow.autoSampleIdGeneration ? "Auto generated after start" : "Enter Sample ID"}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Container Type</FormLabel>
                          <Select value={sampleForm.containerType} onChange={(event) => setSampleForm((current) => ({ ...current, containerType: event.target.value }))}>
                            <option value="">Select container</option>
                            {containerTypes.map((containerType) => (
                              <option key={containerType.id} value={containerType.name}>{containerType.name}</option>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl>
                          <FormLabel>Sample Type</FormLabel>
                          <Input value={sampleForm.sampleType} onChange={(event) => setSampleForm((current) => ({ ...current, sampleType: event.target.value }))} />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Sampling Method</FormLabel>
                          <Input value={sampleForm.samplingMethod} onChange={(event) => setSampleForm((current) => ({ ...current, samplingMethod: event.target.value }))} />
                        </FormControl>
                      </SimpleGrid>
                      <HStack spacing={3} flexWrap="wrap">
                        <Button onClick={() => void handleSaveSample()} isLoading={saving}>Save Sampling</Button>
                        <Button
                          variant="outline"
                          onClick={() => void handleMarkHomogeneous()}
                          isLoading={saving}
                          isDisabled={!settings.sampling.homogeneousProofRequired}
                        >
                          Mark Homogeneous Proof
                        </Button>
                      </HStack>
                    </>
                  )}
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">6. Seal</Heading>
                  {!selectedLot ? (
                    <EmptyWorkState title="No lot selected" description="Select a lot to manage seal flow." />
                  ) : (
                    <>
                      <HStack spacing={3} flexWrap="wrap">
                        <SealScanner onScanned={(sealNo) => void handleSaveSeal(sealNo)} onManualConfirm={(sealNo) => void handleSaveSeal(sealNo)} isDisabled={!settings.seal.sealScanRequired && Boolean(selectedSample?.sealLabel?.sealNo)} />
                        <Button
                          variant="outline"
                          onClick={() => void handleGenerateSealsForAll()}
                          isLoading={saving}
                          isDisabled={!settings.seal.bulkSealGenerationEnabled}
                        >
                          Generate Seal Numbers
                        </Button>
                      </HStack>
                      <EnterpriseStickyTable>
                        <Table size="sm">
                          <Thead>
                            <Tr>
                              <Th>Lot No</Th>
                              <Th>Bag No</Th>
                              <Th>Weight</Th>
                              <Th>Gross</Th>
                              <Th>Net</Th>
                              <Th>Seal No</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {(job.lots ?? []).flatMap((lot) =>
                              (lot.bags?.length ? lot.bags : [{ id: lot.id, bagNumber: 1, grossWeight: lot.grossWeight ?? null, netWeight: lot.netWeight ?? null }]).map((bag) => (
                                <Tr key={`${lot.id}-${bag.id}`}>
                                  <Td>{lot.lotNumber}</Td>
                                  <Td>{bag.bagNumber}</Td>
                                  <Td>{lot.weightUnit ?? "KG"}</Td>
                                  <Td>{bag.grossWeight ?? "Not Available"}</Td>
                                  <Td>{bag.netWeight ?? "Not Available"}</Td>
                                  <Td>{lot.sample?.sealLabel?.sealNo ?? lot.sealNumber ?? "Not Available"}</Td>
                                </Tr>
                              )),
                            )}
                          </Tbody>
                        </Table>
                      </EnterpriseStickyTable>
                    </>
                  )}
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">7. Packets</Heading>
                  {!selectedSample ? (
                    <EmptyWorkState title="Sample required" description="Start sampling before creating packets." />
                  ) : (
                    <>
                      <HStack spacing={3}>
                        <Input maxW="120px" value={packetCount} onChange={(event) => setPacketCount(event.target.value)} />
                        <Button onClick={() => void handleCreatePackets()} isLoading={saving}>Create Packets</Button>
                      </HStack>
                      <EnterpriseStickyTable>
                        <Table size="sm">
                          <Thead>
                            <Tr>
                              <Th>Packet</Th>
                              <Th>Weight</Th>
                              <Th>Unit</Th>
                              <Th>Status</Th>
                              <Th>Action</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {packets.map((packet) => (
                              <Tr key={packet.id}>
                                <Td>{packet.packetCode}</Td>
                                <Td>
                                  <Input
                                    size="sm"
                                    value={packetDrafts[packet.id]?.packetWeight ?? ""}
                                    onChange={(event) =>
                                      setPacketDrafts((current) => ({
                                        ...current,
                                        [packet.id]: { ...current[packet.id], packetWeight: event.target.value },
                                      }))
                                    }
                                  />
                                </Td>
                                <Td>
                                  <Select
                                    size="sm"
                                    value={packetDrafts[packet.id]?.packetUnit ?? "KG"}
                                    onChange={(event) =>
                                      setPacketDrafts((current) => ({
                                        ...current,
                                        [packet.id]: { ...current[packet.id], packetUnit: event.target.value },
                                      }))
                                    }
                                  >
                                    <option value="KG">KG</option>
                                    <option value="G">G</option>
                                    <option value="PCS">PCS</option>
                                  </Select>
                                </Td>
                                <Td><Badge variant="subtle">{packet.packetStatus.replaceAll("_", " ")}</Badge></Td>
                                <Td><Button size="xs" variant="outline" onClick={() => void handleSavePacket(packet.id)} isLoading={saving}>Save Packet</Button></Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </EnterpriseStickyTable>
                    </>
                  )}
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="md">8. Submit to R&amp;D</Heading>
                  <Text fontSize="sm" color="text.secondary">
                    This is the terminal operations action. Every packet must carry packet weight and packet unit before submission.
                  </Text>
                  <Button alignSelf="start" onClick={() => void handleSubmitToRnd()} isLoading={saving} isDisabled={!packets.length}>
                    Submit to R&amp;D
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </VStack>

          <Box w={{ base: "full", xl: "340px" }} position={{ xl: "sticky" }} top={{ xl: "92px" }}>
            <VStack align="stretch" spacing={4}>
              <LinkedRecordsPanel
                items={[
                  { label: "Job Number", value: job.inspectionSerialNumber || job.jobReferenceNumber || "Not Available" },
                  { label: "Client", value: job.clientName || "Not Available" },
                  { label: "Item", value: job.commodity || "Not Available" },
                  { label: "Assigned User", value: job.assignedTo?.profile?.displayName || "Not Available" },
                  { label: "Deadline", value: formatDate(job.deadline) },
                  { label: "Lot Summary", value: `${job.lots?.length ?? 0} lot(s)` },
                  { label: "Sample ID", value: selectedSample?.sampleCode || "Not Available" },
                  { label: "Packet Count", value: `${packets.length}` },
                  { label: "Documents", value: `${job.reportSnapshots?.length ?? 0}`, href: `/documents?job=${job.inspectionSerialNumber || job.jobReferenceNumber || job.id}` },
                  { label: "History", value: "Open", href: `/traceability/lots/${selectedLot?.id ?? ""}` },
                ]}
              />

              {settings.ui.showBlockersInline && (payload?.blockers?.length ?? 0) > 0 ? (
                <ExceptionBanner
                  title="Current blockers"
                  description={payload?.blockers?.join(" ") ?? ""}
                  status="warning"
                />
              ) : null}

              {selectedLot?.inspection?.decisionStatus === "ON_HOLD" || selectedLot?.inspection?.decisionStatus === "REJECTED" ? (
                <ExceptionBanner
                  title="Decision blocks progression"
                  description="Hold and Reject block downstream sampling and packet work until resolved."
                  status="warning"
                />
              ) : null}
            </VStack>
          </Box>
        </Stack>

        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUploadImage(file);
            }
            event.currentTarget.value = "";
          }}
        />

        <QuickEditDrawer
          isOpen={clientDrawerOpen}
          onClose={() => setClientDrawerOpen(false)}
          title="Add New Client"
          onSave={() => void handleCreateClient()}
          isSaving={saving}
          saveLabel="Create Client"
        >
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel>Client Name</FormLabel>
              <Input value={clientForm.clientName} onChange={(event) => setClientForm((current) => ({ ...current, clientName: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Billing Address</FormLabel>
              <Input value={clientForm.billToAddress} onChange={(event) => setClientForm((current) => ({ ...current, billToAddress: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>GST Number</FormLabel>
              <Input value={clientForm.gstOrId} onChange={(event) => setClientForm((current) => ({ ...current, gstOrId: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Contact Person</FormLabel>
              <Input value={clientForm.contactPerson} onChange={(event) => setClientForm((current) => ({ ...current, contactPerson: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Contact Number</FormLabel>
              <Input value={clientForm.contactNumber} onChange={(event) => setClientForm((current) => ({ ...current, contactNumber: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input value={clientForm.email} onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Shipping Address</FormLabel>
              <Input
                value={clientForm.shipToAddress}
                onChange={(event) => setClientForm((current) => ({ ...current, shipToAddress: event.target.value }))}
                isDisabled={clientForm.sameAsBilling}
                placeholder={clientForm.sameAsBilling ? "Same as Billing" : ""}
              />
            </FormControl>
            <Button variant="outline" onClick={() => setClientForm((current) => ({ ...current, sameAsBilling: !current.sameAsBilling }))}>
              {clientForm.sameAsBilling ? "Same as Billing: On" : "Same as Billing: Off"}
            </Button>
          </VStack>
        </QuickEditDrawer>
      </VStack>
    </ControlTowerLayout>
  );
}
