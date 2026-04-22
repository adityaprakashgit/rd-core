"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import {
  enterpriseModalBodyProps,
  enterpriseModalContentProps,
  enterpriseModalFooterProps,
  enterpriseModalHeaderProps,
  EnterpriseRailPanel,
  EnterpriseSummaryStrip,
} from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import { FilterRail, ProcessFlowLayout } from "@/components/enterprise/PageTemplates";
import { WorkflowStepTracker, type WorkflowStep } from "@/components/enterprise/WorkflowStepTracker";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import {
  getReportDocumentTypeLabel,
  REPORT_DOCUMENT_TYPES,
  type ReportPreferences,
} from "@/lib/report-preferences";
import { normalizeRole } from "@/lib/role";

type JobSummary = {
  id: string;
  jobReferenceNumber: string;
  inspectionSerialNumber: string;
  clientName: string;
  commodity: string;
  plantLocation?: string | null;
  status: string;
  lots: Array<{
    id: string;
    lotNumber: string;
    totalBags: number;
  }>;
};

type LotRow = {
  id: string;
  lotNumber: string;
  sealNumber: string | null;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
};

type ClientMasterOption = {
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  gstOrId: string | null;
};

type TransporterMasterOption = {
  transporterName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstOrId: string | null;
};

type ItemMasterOption = {
  itemName: string;
  description: string | null;
  uom: string | null;
};

function formatWeight(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
}

export default function ReportsPage() {
  const toast = useToast();
  const { viewMode } = useWorkspaceView();
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingLots, setLoadingLots] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [lotsError, setLotsError] = useState<string | null>(null);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastPreviewKind, setLastPreviewKind] = useState<"packing" | "stickers" | null>(null);
  const [generating, setGenerating] = useState<"packing" | "stickers" | null>(null);
  const [activeStep, setActiveStep] = useState<"setup" | "review" | "preview">("setup");
  const [masterBusy, setMasterBusy] = useState<"load" | null>(null);
  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [transporters, setTransporters] = useState<TransporterMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedTransporterName, setSelectedTransporterName] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [ewayBillDetails, setEwayBillDetails] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [previewing, setPreviewing] = useState<"packing" | "stickers" | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{
    kind: "packing" | "stickers";
    fileName: string;
    url: string;
  } | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<ReportPreferences["defaultDocumentType"]>("EXPORT");
  const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setJobsError(null);
    try {
      const isAdmin = normalizeRole(sessionRole) === "ADMIN";
      const endpoint = isAdmin && viewMode === "all" ? "/api/jobs?view=all" : "/api/jobs?view=my";
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Failed to load jobs.");
      }

      const data: JobSummary[] = await response.json();
      const nextJobs = Array.isArray(data) ? data : [];
      setJobs(nextJobs);
      setSelectedJobId((current) => {
        if (current && nextJobs.some((job) => job.id === current)) {
          return current;
        }
        return nextJobs[0]?.id ?? "";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load jobs.";
      setJobs([]);
      setSelectedJobId("");
      setJobsError(message);
      toast({ title: "Jobs unavailable", description: message, status: "error" });
    } finally {
      setLoadingJobs(false);
    }
  }, [sessionRole, toast, viewMode]);

  const loadLots = useCallback(async () => {
    if (!selectedJobId) {
      setLots([]);
      setLotsError(null);
      return;
    }

    setLoadingLots(true);
    setLotsError(null);
    try {
      const response = await fetch(`/api/inspection/lots?jobId=${encodeURIComponent(selectedJobId)}`);
      if (!response.ok) {
        throw new Error("Failed to load lot rows.");
      }

      const data: LotRow[] = await response.json();
      setLots(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load lot rows.";
      setLots([]);
      setLotsError(message);
      toast({ title: "Bags unavailable", description: message, status: "error" });
    } finally {
      setLoadingLots(false);
    }
  }, [selectedJobId, toast]);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/session/me");
        if (!response.ok) {
          return;
        }

        const data: { role: string } = await response.json();
        if (active) {
          setSessionRole(data.role);
        }
      } catch {
        if (active) {
          setSessionRole(null);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (sessionRole !== null) {
      void loadJobs();
    }
  }, [loadJobs, sessionRole]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  useEffect(() => {
    setPdfPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setIsPreviewModalOpen(false);
  }, [selectedJobId]);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
    };
  }, [pdfPreview]);

  const loadDispatchMasters = useCallback(async () => {
    setMasterBusy("load");
    setMasterError(null);
    try {
      const response = await fetch("/api/masters/dispatch-options");
      if (!response.ok) {
        throw new Error("Failed to load dispatch master options.");
      }

      const data: {
        clients?: ClientMasterOption[];
        transporters?: TransporterMasterOption[];
        items?: ItemMasterOption[];
      } = await response.json();

      setClients(Array.isArray(data.clients) ? data.clients : []);
      setTransporters(Array.isArray(data.transporters) ? data.transporters : []);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dispatch master options.";
      setMasterError(message);
      toast({ title: "Master load failed", description: message, status: "error" });
    } finally {
      setMasterBusy(null);
    }
  }, [toast]);

  useEffect(() => {
    void loadDispatchMasters();
  }, [loadDispatchMasters]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    if (!selectedJob) {
      return;
    }

    setSelectedClientName((current) => current || selectedJob.clientName || "");
    setSelectedItemName((current) => current || selectedJob.commodity || "");
    setInvoiceNumber("");
    setLrNumber("");
    setTransporterId("");
    setEwayBillDetails("");
    setVehicleNo("");
  }, [selectedJob]);

  useEffect(() => {
    const selectedClient = clients.find((entry) => entry.clientName === selectedClientName) ?? null;
    if (selectedClient) {
      setBillToAddress(selectedClient.billToAddress);
      setShipToAddress(selectedClient.shipToAddress);
    } else if (selectedJob) {
      setBillToAddress(selectedJob.clientName);
      setShipToAddress(selectedJob.plantLocation || selectedJob.clientName);
    }
  }, [clients, selectedClientName, selectedJob]);

  const totals = useMemo(
    () =>
      lots.reduce(
        (acc, lot) => {
          acc.totalLots += 1;
          acc.totalGross += lot.grossWeight ?? 0;
          acc.totalNet += lot.netWeight ?? 0;
          acc.totalTare += lot.tareWeight ?? 0;
          if (lot.sealNumber) {
            acc.sealedLots += 1;
          }
          return acc;
        },
        { totalLots: 0, sealedLots: 0, totalGross: 0, totalNet: 0, totalTare: 0 }
      ),
    [lots]
  );

  const flowSteps = useMemo<WorkflowStep[]>(
    () => [
      {
        id: "setup",
        label: "Select Job & Dispatch Details",
        state: activeStep === "setup" ? "current" : "completed",
        onClick: () => setActiveStep("setup"),
      },
      {
        id: "review",
        label: "Review Bag Weights & Seals",
        state: activeStep === "review" ? "current" : activeStep === "preview" ? "completed" : "next",
        onClick: () => setActiveStep("review"),
      },
      {
        id: "preview",
        label: "Preview & Download",
        state: activeStep === "preview" ? "current" : "upcoming",
        onClick: () => setActiveStep("preview"),
      },
    ],
    [activeStep]
  );

  const lotColumns = useMemo(
    () => [
      { id: "lotNumber", header: "Bag", render: (lot: LotRow) => <Text fontWeight="semibold">{lot.lotNumber}</Text> },
      {
        id: "sealNumber",
        header: "Seal",
        render: (lot: LotRow) =>
          lot.sealNumber ? (
            <HStack spacing={2}>
              <WorkflowStateChip status="READY" />
              <Text>{lot.sealNumber}</Text>
            </HStack>
          ) : (
            <HStack spacing={2}>
              <WorkflowStateChip status="MEDIA_PENDING" />
              <Text>Not recorded yet</Text>
            </HStack>
          ),
      },
      { id: "grossWeight", header: "Gross", isNumeric: true, render: (lot: LotRow) => formatWeight(lot.grossWeight) },
      { id: "tareWeight", header: "Tare", isNumeric: true, render: (lot: LotRow) => formatWeight(lot.tareWeight) },
      { id: "netWeight", header: "Net", isNumeric: true, render: (lot: LotRow) => formatWeight(lot.netWeight) },
    ],
    []
  );

  const handlePreviewDocument = useCallback(
    async (kind: "packing" | "stickers") => {
      setLastPreviewKind(kind);
      setPreviewError(null);
      if (!selectedJobId) {
        setPreviewError("Select a job before generating documents.");
        toast({ title: "Select a job first", status: "warning" });
        return;
      }

      setGenerating(kind);
      setPreviewing(kind);
      try {
        if (kind === "packing" && invoiceNumber.trim().length === 0) {
          throw new Error("Invoice number is required for every packing list.");
        }

        if (kind === "packing" && vehicleNo.trim().length === 0) {
          throw new Error("Vehicle number is required for every packing list.");
        }

        const selectedTransporter = transporters.find(
          (entry) => entry.transporterName === selectedTransporterName
        ) ?? null;

        const response = await fetch(
          kind === "packing" ? "/api/report/packing-list" : "/api/report/stickers",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              kind === "packing"
                ? {
                    jobId: selectedJobId,
                    documentType: selectedDocumentType,
                    billTo: billToAddress.trim() || selectedJob?.clientName,
                    shipTo: shipToAddress.trim() || selectedJob?.plantLocation || selectedJob?.clientName,
                    invoiceNumber: invoiceNumber.trim(),
                    lrNumber: lrNumber.trim(),
                    transporterId: transporterId.trim(),
                    ewayBillDetails: ewayBillDetails.trim(),
                    transporterName: selectedTransporter?.transporterName ?? undefined,
                    vehicleNo: vehicleNo.trim(),
                    itemName: selectedItemName.trim() || selectedJob?.commodity,
                  }
                : { jobId: selectedJobId }
            ),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.details ?? "Report generation failed.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const fileName = `${kind === "packing" ? `${selectedDocumentType}_Packing_List` : "Stickers"}_${selectedJob?.jobReferenceNumber ?? selectedJobId}.pdf`;
        setPdfPreview((current) => {
          if (current?.url) {
            URL.revokeObjectURL(current.url);
          }
          return { kind, fileName, url: objectUrl };
        });
        setIsPreviewModalOpen(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Report generation failed.";
        setPreviewError(message);
        toast({ title: "Generation failed", description: message, status: "error" });
      } finally {
        setGenerating(null);
        setPreviewing(null);
      }
    },
    [
      billToAddress,
      ewayBillDetails,
      invoiceNumber,
      lrNumber,
      selectedDocumentType,
      selectedItemName,
      selectedJob?.clientName,
      selectedJob?.commodity,
      selectedJob?.jobReferenceNumber,
      selectedJob?.plantLocation,
      selectedJobId,
      selectedTransporterName,
      shipToAddress,
      toast,
      transporterId,
      transporters,
      vehicleNo,
    ]
  );

  const handleDownloadPreview = useCallback(() => {
    if (!pdfPreview) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = pdfPreview.url;
    anchor.download = pdfPreview.fileName;
    anchor.click();
  }, [pdfPreview]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewModalOpen(false);
  }, []);

  const handlePrintPreview = useCallback(() => {
    previewFrameRef.current?.contentWindow?.print();
  }, []);

  const handleSharePreview = useCallback(async () => {
    if (!pdfPreview || !supportsShare) {
      return;
    }
    try {
      const response = await fetch(pdfPreview.url);
      const blob = await response.blob();
      const file = new File([blob], pdfPreview.fileName, { type: "application/pdf" });
      await navigator.share({
        title: pdfPreview.fileName,
        files: [file],
      });
    } catch {
      // noop: share is optional
    }
  }, [pdfPreview, supportsShare]);

  if (loadingJobs && jobs.length === 0) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={4} rows={3} />
      </ControlTowerLayout>
    );
  }

  if (!loadingJobs && jobsError && jobs.length === 0) {
    return (
      <ControlTowerLayout>
        <InlineErrorState
          title="Documents workspace unavailable"
          description={jobsError}
          onRetry={() => void loadJobs()}
        />
      </ControlTowerLayout>
    );
  }

  if (!loadingJobs && jobs.length === 0) {
    return (
      <ControlTowerLayout>
          <EmptyWorkState
          title="No jobs are ready for documents"
          description="Once a job reaches the reporting stage, you can preview and download packing lists and stickers here."
          action={
            <Button as="a" href="/operations" variant="outline">
              Open operations queue
            </Button>
          }
        />
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack spacing={2} mb={2} flexWrap="wrap">
            <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={2.5} py={1}>
              DOCUMENT WORKFLOW
            </Badge>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={1}>
              PREVIEW BEFORE DOWNLOAD
            </Badge>
            <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
              BRANDING: COMPANY PROFILE DEFAULTS
            </Badge>
          </HStack>
          <Heading size="lg" color="text.primary">
            Documents & Reports
          </Heading>
          <Text mt={1} fontSize={{ base: "sm", md: "md" }} color="text.secondary">
            Generated PDFs use saved Company Profile branding by default unless explicit request overrides are provided.
          </Text>
        </Box>

        <ProcessFlowLayout
          contextLabel="Document Readiness"
          tracker={<WorkflowStepTracker steps={flowSteps} title="Document Workflow" compact />}
          activeStep={
            <VStack align="stretch" spacing={4}>
              {activeStep === "setup" ? (
                <Card variant="outline" borderRadius="lg">
                <CardBody p={6}>
                  <HStack justify="space-between" align="start" flexWrap="wrap" spacing={3}>
                    <Box>
                      <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                        Step 1
                      </Text>
                      <Heading size="md" color="text.primary" mt={1}>
                        Select job and dispatch details
                      </Heading>
                    </Box>
                    <WorkflowStateChip status={selectedJob?.status ?? "PENDING"} />
                  </HStack>

                  <Box mt={5}>
                    <FilterRail>
                      <Select
                        maxW={{ base: "full", md: "72" }}
                        value={selectedJobId}
                        onChange={(event) => setSelectedJobId(event.target.value)}
                        borderRadius="lg"
                        isDisabled={loadingJobs}
                      >
                        {jobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.inspectionSerialNumber} - {job.clientName}
                          </option>
                        ))}
                      </Select>
                      <Select
                        maxW={{ base: "full", md: "56" }}
                        borderRadius="lg"
                        value={selectedDocumentType}
                        onChange={(event) =>
                          setSelectedDocumentType(event.target.value as ReportPreferences["defaultDocumentType"])
                        }
                      >
                        {REPORT_DOCUMENT_TYPES.map((documentType) => (
                          <option key={documentType} value={documentType}>
                            {getReportDocumentTypeLabel(documentType)}
                          </option>
                        ))}
                      </Select>
                      <Button
                        borderRadius="lg"
                        onClick={() => void handlePreviewDocument("packing")}
                        isLoading={generating === "packing"}
                        isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                      >
                        View Packing List PDF
                      </Button>
                      <Button
                        variant="outline"
                        borderRadius="lg"
                        onClick={() => void handlePreviewDocument("stickers")}
                        isLoading={generating === "stickers"}
                        isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                      >
                        View Sticker PDF
                      </Button>
                    </FilterRail>
                  </Box>

                  {previewError ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize={{ base: "sm", md: "md" }} color="red.700">{previewError}</Text>
                      <HStack spacing={2} mt={2}>
                        {lastPreviewKind ? (
                          <Button size="xs" variant="ghost" onClick={() => void handlePreviewDocument(lastPreviewKind)}>
                            Retry {lastPreviewKind === "packing" ? "packing list preview" : "sticker preview"}
                          </Button>
                        ) : null}
                        <Button size="xs" variant="ghost" onClick={() => setPreviewError(null)}>
                          Clear
                        </Button>
                      </HStack>
                    </Box>
                  ) : null}

                  {masterError ? (
                    <Box mt={3} borderRadius="lg" bg="red.50" borderWidth="1px" borderColor="red.200" p={3}>
                      <Text fontSize={{ base: "sm", md: "md" }} color="red.700">{masterError}</Text>
                      <HStack spacing={2} mt={2}>
                        <Button size="xs" variant="ghost" onClick={() => void loadDispatchMasters()} isLoading={masterBusy === "load"}>
                          Retry master load
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setMasterError(null)}>
                          Clear
                        </Button>
                      </HStack>
                    </Box>
                  ) : null}

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={5}>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Client</FormLabel>
                      <Select
                        borderRadius="lg"
                        value={selectedClientName}
                        onChange={(event) => setSelectedClientName(event.target.value)}
                        isDisabled={masterBusy === "load"}
                      >
                        <option value="">Select client</option>
                        {clients.map((entry) => (
                          <option key={entry.clientName} value={entry.clientName}>
                            {entry.clientName}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Item</FormLabel>
                      <Select
                        borderRadius="xl"
                        value={selectedItemName}
                        onChange={(event) => setSelectedItemName(event.target.value)}
                        isDisabled={masterBusy === "load"}
                      >
                        <option value="">Select item</option>
                        {items.map((entry) => (
                          <option key={entry.itemName} value={entry.itemName}>
                            {entry.itemName}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Bill to</FormLabel>
                      <Input borderRadius="lg" value={billToAddress} onChange={(event) => setBillToAddress(event.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Ship to</FormLabel>
                      <Input borderRadius="lg" value={shipToAddress} onChange={(event) => setShipToAddress(event.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Transporter</FormLabel>
                      <Select
                        borderRadius="lg"
                        value={selectedTransporterName}
                        onChange={(event) => setSelectedTransporterName(event.target.value)}
                        isDisabled={masterBusy === "load"}
                      >
                        <option value="">Select transporter</option>
                        {transporters.map((entry) => (
                          <option key={entry.transporterName} value={entry.transporterName}>
                            {entry.transporterName}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Invoice no</FormLabel>
                      <Input
                        borderRadius="lg"
                        value={invoiceNumber}
                        onChange={(event) => setInvoiceNumber(event.target.value)}
                        placeholder="Enter invoice number from ERP/accounting software"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>LR no</FormLabel>
                      <Input
                        borderRadius="lg"
                        value={lrNumber}
                        onChange={(event) => setLrNumber(event.target.value)}
                        placeholder="Enter LR number"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Transporter ID</FormLabel>
                      <Input
                        borderRadius="lg"
                        value={transporterId}
                        onChange={(event) => setTransporterId(event.target.value)}
                        placeholder="Enter transporter ID"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>E-way bill details</FormLabel>
                      <Input
                        borderRadius="lg"
                        value={ewayBillDetails}
                        onChange={(event) => setEwayBillDetails(event.target.value)}
                        placeholder="Enter E-way bill no and details"
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Vehicle number</FormLabel>
                      <Input
                        borderRadius="xl"
                        value={vehicleNo}
                        onChange={(event) => setVehicleNo(event.target.value.toUpperCase())}
                        placeholder="Enter vehicle number"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <Text fontSize={{ base: "sm", md: "md" }} color="text.muted" mt={3}>
                    Vehicle number is required for packing list preview. Sticker preview can be generated without it.
                  </Text>
                  <HStack mt={5} justify="flex-end">
                    <Button
                      w={{ base: "full", sm: "auto" }}
                      rightIcon={<ChevronRight size={16} />}
                      onClick={() => setActiveStep("review")}
                      isDisabled={loadingLots}
                    >
                      Continue to bag review
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
              ) : null}

              {activeStep === "review" ? (
                <Card variant="outline" borderRadius="lg">
                <CardBody p={6}>
                  <Stack
                    direction={{ base: "column", md: "row" }}
                    justify="space-between"
                    align={{ base: "start", md: "center" }}
                    spacing={3}
                    mb={5}
                  >
                    <Box>
                      <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                        Step 2
                      </Text>
                      <Heading size="md" color="text.primary" mt={1}>
                        Review bag data
                      </Heading>
                    </Box>
                    <Button as="a" href="/master" variant="outline" borderRadius="lg">
                      Open master data
                    </Button>
                  </Stack>

                  {lotsError ? (
                    <InlineErrorState
                      title="Bag review is unavailable"
                      description={lotsError}
                      onRetry={() => void loadLots()}
                    />
                  ) : loadingLots ? (
                    <PageSkeleton cards={3} rows={1} />
                  ) : lots.length === 0 ? (
                    <EmptyWorkState
                      title="No bag rows available"
                      description="The selected job does not have completed lot records ready for document generation yet."
                    />
                  ) : (
                    <VStack align="stretch" spacing={4}>
                      <EnterpriseDataTable
                        rows={lots}
                        columns={lotColumns}
                        rowKey={(lot) => lot.id}
                        filters={[
                          { id: "lots", label: "Bags", value: String(totals.totalLots) },
                          { id: "sealed", label: "Sealed", value: `${totals.sealedLots}/${totals.totalLots}` },
                        ]}
                        emptyLabel="No bag records available."
                        recordCard={{
                          title: (lot) => lot.lotNumber,
                          subtitle: (lot) => `Seal: ${lot.sealNumber ?? "Not recorded yet"}`,
                          fields: [
                            { id: "gross", label: "Gross", render: (lot) => formatWeight(lot.grossWeight) },
                            { id: "tare", label: "Tare", render: (lot) => formatWeight(lot.tareWeight) },
                            { id: "net", label: "Net", render: (lot) => formatWeight(lot.netWeight) },
                          ],
                        }}
                      />

                      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                        {[
                          { label: "Total gross", value: formatWeight(totals.totalGross) },
                          { label: "Total tare", value: formatWeight(totals.totalTare) },
                          { label: "Total net", value: formatWeight(totals.totalNet) },
                        ].map((item) => (
                          <Box key={item.label} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" p={3}>
                              <Text fontSize={{ base: "xs", md: "sm" }} color="text.muted" textTransform="uppercase" letterSpacing="wide">
                                {item.label}
                              </Text>
                              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold" mt={1} color="text.primary">
                                {item.value}
                              </Text>
                          </Box>
                        ))}
                      </SimpleGrid>
                    </VStack>
                  )}
                  <Stack mt={5} direction={{ base: "column", sm: "row" }} justify="space-between" spacing={3}>
                    <Button w={{ base: "full", sm: "auto" }} variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={() => setActiveStep("setup")}>
                      Back to details
                    </Button>
                    <Button w={{ base: "full", sm: "auto" }} rightIcon={<ChevronRight size={16} />} onClick={() => setActiveStep("preview")}>
                      Continue to preview
                    </Button>
                  </Stack>
                </CardBody>
              </Card>
              ) : null}

              {activeStep === "preview" ? (
                <Card variant="outline" borderRadius="lg">
                <CardBody p={6}>
                  <Text fontSize={{ base: "xs", md: "sm" }} textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
                    Step 3
                  </Text>
                  <Heading size="md" color="text.primary" mt={1}>
                    Preview and download
                  </Heading>
                  <HStack spacing={3} mt={4} flexWrap="wrap">
                    <Button
                      onClick={() => void handlePreviewDocument("packing")}
                      isLoading={generating === "packing"}
                      isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                    >
                      View Packing List PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handlePreviewDocument("stickers")}
                      isLoading={generating === "stickers"}
                      isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                    >
                      View Sticker PDF
                    </Button>
                    {pdfPreview ? (
                      <WorkflowStateChip status="PREVIEW_READY" />
                    ) : (
                      <WorkflowStateChip status="PREVIEW_PENDING" />
                    )}
                  </HStack>
                  <HStack mt={5}>
                    <Button w={{ base: "full", sm: "auto" }} variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={() => setActiveStep("review")}>
                      Back to bag review
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
              ) : null}
            </VStack>
          }
          context={
            <VStack align="stretch" spacing={4}>
              <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.rail">
                <Text fontSize={{ base: "xs", md: "sm" }} color="text.muted" textTransform="uppercase" letterSpacing="wide">
                  Active job
                </Text>
                <Text fontWeight="semibold" color="text.primary" mt={1}>
                  {selectedJob?.inspectionSerialNumber ?? "—"}
                </Text>
              </Box>

              <EnterpriseSummaryStrip
                items={[
                  { label: "Document type", value: getReportDocumentTypeLabel(selectedDocumentType) },
                  { label: "Item", value: selectedItemName || selectedJob?.commodity || "Not selected" },
                  { label: "Invoice no", value: invoiceNumber || "Not entered" },
                  { label: "LR no", value: lrNumber || "Not entered" },
                  { label: "Transporter ID", value: transporterId || "Not entered" },
                  { label: "E-way bill", value: ewayBillDetails || "Not entered" },
                  { label: "Transporter", value: selectedTransporterName || "Not selected" },
                  { label: "Vehicle number", value: vehicleNo || "Required for packing list preview" },
                  { label: "Preview state", value: pdfPreview ? "Ready to download" : "No preview generated", tone: pdfPreview ? "success" : "warning" },
                ]}
              />

              <EnterpriseSummaryStrip
                items={[
                  { label: "Job selected", value: selectedJobId ? "Complete" : "Missing", tone: selectedJobId ? "success" : "warning" },
                  { label: "Bag data loaded", value: lots.length > 0 ? "Complete" : "Missing", tone: lots.length > 0 ? "success" : "warning" },
                  { label: "Invoice entered", value: invoiceNumber.trim() ? "Complete" : "Missing", tone: invoiceNumber.trim() ? "success" : "warning" },
                  { label: "Vehicle entered", value: vehicleNo.trim() ? "Complete" : "Missing", tone: vehicleNo.trim() ? "success" : "warning" },
                  {
                    label: "Bag seals",
                    value: totals.sealedLots === totals.totalLots ? "Complete" : "Missing seals",
                    tone: totals.sealedLots === totals.totalLots ? "success" : "warning",
                  },
                ]}
              />

              <EnterpriseRailPanel title="Route ownership" description="Document actions stay with operations and master data while the preview remains in this workspace.">
                <HStack spacing={3}>
                  <Button as="a" href="/operations" size="sm" variant="outline">
                    Open operations
                  </Button>
                  <Button as="a" href="/master" size="sm" variant="ghost">
                    Open masters
                  </Button>
                </HStack>
              </EnterpriseRailPanel>
            </VStack>
          }
          mobileActions={
            <Stack direction={{ base: "column", sm: "row" }} spacing={3} align="stretch">
              {activeStep !== "setup" ? (
                <Button
                  variant="outline"
                  leftIcon={<ChevronLeft size={16} />}
                  onClick={() => setActiveStep(activeStep === "preview" ? "review" : "setup")}
                >
                  Back
                </Button>
              ) : null}
              {activeStep !== "preview" ? (
                <Button
                  rightIcon={<ChevronRight size={16} />}
                  onClick={() => setActiveStep(activeStep === "setup" ? "review" : "preview")}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={() => void handlePreviewDocument("packing")}
                  isLoading={generating === "packing"}
                  isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                >
                  View Packing List PDF
                </Button>
              )}
            </Stack>
          }
        />
      </VStack>

      <Modal isOpen={isPreviewModalOpen && Boolean(pdfPreview)} onClose={handleClosePreview} size="full" motionPreset="slideInBottom">
        <ModalOverlay bg="blackAlpha.600" />
        <ModalContent {...enterpriseModalContentProps}>
          <ModalHeader {...enterpriseModalHeaderProps}>
            <Stack spacing={1}>
              <Heading size="sm" color="text.primary">
                {pdfPreview?.kind === "stickers" ? "Sticker preview" : "Packing list preview"}
              </Heading>
            </Stack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody {...enterpriseModalBodyProps} bg="bg.canvas" p={{ base: 0, md: 4 }}>
            {pdfPreview ? (
              <Box
                as="iframe"
                ref={previewFrameRef}
                title={pdfPreview.fileName}
                src={pdfPreview.url}
                w="full"
                h={{ base: "calc(100vh - 180px)", md: "calc(100vh - 220px)" }}
                border="0"
                bg="white"
              />
            ) : null}
          </ModalBody>
          <ModalFooter {...enterpriseModalFooterProps} gap={3}>
            <Button variant="outline" onClick={handleClosePreview}>
              Back to workflow
            </Button>
            <Button variant="outline" onClick={handlePrintPreview}>
              Print PDF
            </Button>
            <Button variant="outline" onClick={() => void handleSharePreview()} isDisabled={!supportsShare}>
              Share PDF
            </Button>
            <Button onClick={handleDownloadPreview} isLoading={previewing !== null}>
              Download {pdfPreview?.kind === "stickers" ? "Sticker PDF" : "Packing List PDF"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ControlTowerLayout>
  );
}
