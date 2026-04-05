"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { normalizeRole } from "@/lib/role";
import {
  getDefaultReportPreferences,
  getReportDocumentTypeLabel,
  REPORT_DOCUMENT_TYPES,
  REPORT_PREFERENCES_STORAGE_KEY,
  sanitizeReportPreferences,
  type ReportPreferences,
} from "@/lib/report-preferences";

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

function getStatusColor(status: string): string {
  switch (status) {
    case "LOCKED":
      return "green";
    case "QA":
      return "blue";
    case "IN_PROGRESS":
      return "orange";
    default:
      return "gray";
  }
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
  const [generating, setGenerating] = useState<"packing" | "stickers" | null>(null);
  const [sealLotId, setSealLotId] = useState("");
  const [sealInput, setSealInput] = useState("");
  const [sealBusy, setSealBusy] = useState<"generate" | "assign" | null>(null);
  const [masterBusy, setMasterBusy] = useState<"load" | null>(null);
  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [transporters, setTransporters] = useState<TransporterMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedTransporterName, setSelectedTransporterName] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [reportPreferences, setReportPreferences] = useState<ReportPreferences>(() =>
    getDefaultReportPreferences("Inspection Control Tower")
  );
  const [selectedDocumentType, setSelectedDocumentType] = useState<ReportPreferences["defaultDocumentType"]>("EXPORT");

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
    let active = true;

    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        const isAdmin = normalizeRole(sessionRole) === "ADMIN";
        const endpoint = isAdmin && viewMode === "all" ? "/api/jobs?view=all" : "/api/jobs/my";
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error("Failed to load jobs.");
        }

        const data: JobSummary[] = await response.json();
        if (!active) {
          return;
        }

        const nextJobs = Array.isArray(data) ? data : [];
        setJobs(nextJobs);
        setSelectedJobId((current) => current || nextJobs[0]?.id || "");
      } catch (error) {
        if (active) {
          setJobs([]);
          setSelectedJobId("");
          const message = error instanceof Error ? error.message : "Failed to load jobs.";
          toast({ title: "Jobs unavailable", description: message, status: "error" });
        }
      } finally {
        if (active) {
          setLoadingJobs(false);
        }
      }
    };

    if (sessionRole !== null) {
      void loadJobs();
    }

    return () => {
      active = false;
    };
  }, [sessionRole, toast, viewMode]);

  useEffect(() => {
    const baseCompanyName = "Inspection Control Tower";
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(REPORT_PREFERENCES_STORAGE_KEY) : null;
    const nextPreferences = stored
      ? (() => {
          try {
            return sanitizeReportPreferences(JSON.parse(stored), baseCompanyName);
          } catch {
            return getDefaultReportPreferences(baseCompanyName);
          }
        })()
      : getDefaultReportPreferences(baseCompanyName);
    setReportPreferences(nextPreferences);
    setSelectedDocumentType(nextPreferences.defaultDocumentType);
  }, []);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    let active = true;

    const loadLots = async () => {
      if (!selectedJobId) {
        setLots([]);
        return;
      }

      setLoadingLots(true);
      try {
        const response = await fetch(`/api/inspection/lots?jobId=${encodeURIComponent(selectedJobId)}`);
        if (!response.ok) {
          throw new Error("Failed to load lot rows.");
        }

        const data: LotRow[] = await response.json();
        if (active) {
          setLots(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setLots([]);
          const message = error instanceof Error ? error.message : "Failed to load lot rows.";
          toast({ title: "Lots unavailable", description: message, status: "error" });
        }
      } finally {
        if (active) {
          setLoadingLots(false);
        }
      }
    };

    void loadLots();

    return () => {
      active = false;
    };
  }, [selectedJobId, toast]);

  const totals = useMemo(() => {
    return lots.reduce(
      (acc, lot) => {
        acc.totalBags += 1;
        acc.totalGross += lot.grossWeight ?? 0;
        acc.totalNet += lot.netWeight ?? 0;
        acc.totalTare += lot.tareWeight ?? 0;
        return acc;
      },
      { totalBags: 0, totalGross: 0, totalNet: 0, totalTare: 0 }
    );
  }, [lots]);

  useEffect(() => {
    const nextTarget = lots.find((lot) => !lot.sealNumber) ?? lots[0];
    if (nextTarget && !sealLotId) {
      setSealLotId(nextTarget.id);
    }
  }, [lots, sealLotId]);

  useEffect(() => {
    setSealInput("");
    setSealLotId("");
  }, [selectedJobId]);

  const loadDispatchMasters = useCallback(async () => {
    setMasterBusy("load");
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
      toast({ title: "Master load failed", description: message, status: "error" });
    } finally {
      setMasterBusy(null);
    }
  }, [toast]);

  useEffect(() => {
    void loadDispatchMasters();
  }, [loadDispatchMasters]);

  useEffect(() => {
    if (!selectedJob) {
      return;
    }

    setSelectedClientName((current) => current || selectedJob.clientName || "");
    setSelectedItemName((current) => current || selectedJob.commodity || "");
  }, [selectedJob]);

  useEffect(() => {
    const selectedClient = clients.find((entry) => entry.clientName === selectedClientName) ?? null;
    if (selectedClient) {
      setBillToAddress(selectedClient.billToAddress);
      setShipToAddress(selectedClient.shipToAddress);
    } else if (selectedJob) {
      setBillToAddress(selectedJob.clientName);
      setShipToAddress(selectedJob.clientName);
    }
  }, [clients, selectedClientName, selectedJob]);


  const handleDownload = useCallback(
    async (kind: "packing" | "stickers") => {
      if (!selectedJobId) {
        toast({ title: "Select a job first", status: "warning" });
        return;
      }

      setGenerating(kind);
      try {
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
                    reportPreferences,
                    billTo: billToAddress.trim() || selectedJob?.clientName,
                    shipTo: shipToAddress.trim() || selectedJob?.plantLocation || selectedJob?.clientName,
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
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `${kind === "packing" ? `${selectedDocumentType}_Packing_List` : "Stickers"}_${selectedJob?.jobReferenceNumber ?? selectedJobId}.pdf`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Report generation failed.";
        toast({ title: "Generation failed", description: message, status: "error" });
      } finally {
        setGenerating(null);
      }
    },
    [
      billToAddress,
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
      transporters,
      vehicleNo,
      reportPreferences,
    ]
  );

  const handleGenerateSeal = useCallback(async () => {
    if (!selectedJobId) {
      toast({ title: "Select a job first", status: "warning" });
      return;
    }

    setSealBusy("generate");
    try {
      const response = await fetch("/api/seal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.details ?? "Seal generation failed.");
      }

      const data: { sealNumber?: string } = await response.json();
      if (!data.sealNumber) {
        throw new Error("Seal generation failed.");
      }

      setSealInput(data.sealNumber);
      toast({ title: "Seal generated", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Seal generation failed.";
      toast({ title: "Seal generation failed", description: message, status: "error" });
    } finally {
      setSealBusy(null);
    }
  }, [selectedJobId, toast]);

  const handleAssignSeal = useCallback(
    async (auto: boolean) => {
      if (!sealLotId) {
        toast({ title: "Select a lot", status: "warning" });
        return;
      }

      if (!auto && sealInput.trim().length === 0) {
        toast({ title: "Enter a seal number", status: "warning" });
        return;
      }

      setSealBusy("assign");
      try {
        const response = await fetch(`/api/lots/${sealLotId}/seal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(auto ? { auto: true } : { sealNumber: sealInput.trim() }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.details ?? "Seal assignment failed.");
        }

        toast({ title: "Seal assigned", status: "success" });
        const refreshed = await fetch(`/api/inspection/lots?jobId=${encodeURIComponent(selectedJobId)}`);
        if (refreshed.ok) {
          const data: LotRow[] = await refreshed.json();
          setLots(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Seal assignment failed.";
        toast({ title: "Seal assignment failed", description: message, status: "error" });
      } finally {
        setSealBusy(null);
      }
    },
    [sealInput, sealLotId, selectedJobId, toast]
  );

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack spacing={2} mb={2} flexWrap="wrap">
            <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
              PACKING LIST
            </Badge>
            <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={2.5} py={1}>
              TEXT-ONLY PDF
            </Badge>
          </HStack>
          <Heading size="lg" color="gray.900">
            Reports
          </Heading>
          <Text color="gray.600" mt={2} maxW="3xl">
            Generate packing and sticker reports.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          {[
            { label: "Total Bags", value: totals.totalBags },
            { label: "Total Gross", value: formatWeight(totals.totalGross) },
            { label: "Total Net", value: formatWeight(totals.totalNet) },
            { label: "Tare Total", value: formatWeight(totals.totalTare) },
          ].map((item) => (
            <Card key={item.label} variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <Text fontSize="sm" color="gray.500">
                  {item.label}
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color="gray.900" mt={2}>
                  {item.value}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        <Stack direction={{ base: "column", lg: "row" }} spacing={4} align="stretch">
          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm" flex={1}>
            <CardBody p={6}>
              <HStack justify="space-between" align="start" flexWrap="wrap" spacing={3}>
                <Box>
                  <Heading size="md" color="gray.900">
                    Packing List Table
                  </Heading>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Lot-level weights and seal identifiers are generated from the compliance data model.
                  </Text>
                </Box>
                <Badge colorScheme={getStatusColor(selectedJob?.status ?? "PENDING")} variant="subtle" borderRadius="full" px={3} py={1}>
                  {selectedJob?.status ?? "NO JOB"}
                </Badge>
              </HStack>

              <HStack mt={5} spacing={3} flexWrap="wrap">
                <Select
                  maxW={{ base: "full", md: "56" }}
                  borderRadius="xl"
                  value={selectedDocumentType}
                  onChange={(event) =>
                    setSelectedDocumentType(event.target.value as ReportPreferences["defaultDocumentType"])
                  }
                >
                  {REPORT_DOCUMENT_TYPES.map((documentType) => (
                    <option key={documentType} value={documentType}>
                      {getReportDocumentTypeLabel(documentType)} Format
                    </option>
                  ))}
                </Select>
                <Select
                  maxW={{ base: "full", md: "72" }}
                  value={selectedJobId}
                  onChange={(event) => setSelectedJobId(event.target.value)}
                  borderRadius="xl"
                  isDisabled={loadingJobs}
                >
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.inspectionSerialNumber} - {job.clientName}
                    </option>
                  ))}
                </Select>
                <Button
                  colorScheme="teal"
                  borderRadius="xl"
                  onClick={() => void handleDownload("packing")}
                  isLoading={generating === "packing"}
                  isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                >
                  Download Packing List
                </Button>
                <Button
                  variant="outline"
                  borderRadius="xl"
                  onClick={() => void handleDownload("stickers")}
                  isLoading={generating === "stickers"}
                  isDisabled={loadingJobs || !selectedJobId || loadingLots || lots.length === 0}
                >
                  Download Stickers
                </Button>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={5}>
                <FormControl>
                  <FormLabel fontSize="sm">Client Master</FormLabel>
                  <Select
                    borderRadius="xl"
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
                  <FormLabel fontSize="sm">Item Name Master</FormLabel>
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
                  <FormLabel fontSize="sm">Bill To</FormLabel>
                  <Input borderRadius="xl" value={billToAddress} onChange={(event) => setBillToAddress(event.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Ship To</FormLabel>
                  <Input borderRadius="xl" value={shipToAddress} onChange={(event) => setShipToAddress(event.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Transporter Master</FormLabel>
                  <Select
                    borderRadius="xl"
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
                  <FormLabel fontSize="sm">Vehicle No (manual every time)</FormLabel>
                  <Input
                    borderRadius="xl"
                    value={vehicleNo}
                    onChange={(event) => setVehicleNo(event.target.value.toUpperCase())}
                    placeholder="Enter vehicle number"
                  />
                </FormControl>
              </SimpleGrid>
              <Text mt={3} fontSize="sm" color="gray.500">
                Manage client, transporter, and item records from Master.
              </Text>

              <Box mt={5} borderWidth="1px" borderColor="gray.200" borderRadius="2xl" overflowX="auto">
                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Lot Number</Th>
                        <Th>Seal Number</Th>
                        <Th isNumeric>Gross Weight</Th>
                        <Th isNumeric>Tare Weight</Th>
                        <Th isNumeric>Net Weight</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {loadingLots ? (
                        <Tr>
                          <Td colSpan={5}>
                            <HStack py={6} justify="center">
                              <Spinner size="sm" />
                              <Text fontSize="sm" color="gray.600">
                                Loading lots...
                              </Text>
                            </HStack>
                          </Td>
                        </Tr>
                      ) : lots.length > 0 ? (
                        lots.map((lot) => (
                          <Tr key={lot.lotNumber}>
                            <Td fontWeight="semibold">{lot.lotNumber}</Td>
                            <Td>{lot.sealNumber ?? "—"}</Td>
                            <Td isNumeric>{formatWeight(lot.grossWeight)}</Td>
                            <Td isNumeric>{formatWeight(lot.tareWeight)}</Td>
                            <Td isNumeric>{formatWeight(lot.netWeight)}</Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={5}>
                            <Text py={6} color="gray.500" textAlign="center">
                              No records.
                            </Text>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mt={5}>
                <Card variant="outline" borderRadius="xl">
                  <CardBody p={4}>
                    <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                      Total Bags
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" mt={1}>
                      {totals.totalBags}
                    </Text>
                  </CardBody>
                </Card>
                <Card variant="outline" borderRadius="xl">
                  <CardBody p={4}>
                    <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                      Total Gross
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" mt={1}>
                      {formatWeight(totals.totalGross)}
                    </Text>
                  </CardBody>
                </Card>
                <Card variant="outline" borderRadius="xl">
                  <CardBody p={4}>
                    <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                      Total Net
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" mt={1}>
                      {formatWeight(totals.totalNet)}
                    </Text>
                  </CardBody>
                </Card>
              </SimpleGrid>
            </CardBody>
          </Card>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm" w={{ base: "full", lg: "sm" }}>
            <CardBody p={6}>
              <Heading size="md" color="gray.900">
                Traceability Control
              </Heading>
              <Text fontSize="sm" color="gray.600" mt={2}>
                Seal assignment, photo capture, and report generation are enforced by backend validation.
              </Text>

              <VStack align="stretch" spacing={3} mt={5}>
                <Box p={4} borderWidth="1px" borderColor="gray.200" borderRadius="xl" bg="gray.50">
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                    Selected Job
                  </Text>
                  <Text fontWeight="semibold" color="gray.900" mt={1}>
                    {selectedJob?.inspectionSerialNumber ?? "—"}
                  </Text>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    {selectedJob?.clientName ?? "No record selected"}
                  </Text>
                </Box>
                <Box p={4} borderWidth="1px" borderColor="gray.200" borderRadius="xl">
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                    Seal Coverage
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="gray.900" mt={1}>
                    {lots.filter((lot) => Boolean(lot.sealNumber)).length}/{lots.length}
                  </Text>
                </Box>
                <Box p={4} borderWidth="1px" borderColor="gray.200" borderRadius="xl">
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                    Data Mode
                  </Text>
                  <Text fontWeight="semibold" color="gray.900" mt={1}>
                    Text-only packing list
                  </Text>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Barcode rendering is isolated to sticker PDF output.
                  </Text>
                </Box>
                <Box p={4} borderWidth="1px" borderColor="gray.200" borderRadius="xl">
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                    Seal Assignment
                  </Text>
                  <Stack spacing={3} mt={3}>
                    <Select
                      size="sm"
                      borderRadius="xl"
                      value={sealLotId}
                      onChange={(event) => setSealLotId(event.target.value)}
                    >
                      {lots.map((lot) => (
                        <option key={lot.lotNumber} value={lot.id}>
                          {lot.lotNumber}
                        </option>
                      ))}
                    </Select>
                    <Input
                      size="sm"
                      borderRadius="xl"
                      placeholder="Manual seal number"
                      value={sealInput}
                      onChange={(event) => setSealInput(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      borderRadius="xl"
                      onClick={() => void handleGenerateSeal()}
                      isLoading={sealBusy === "generate"}
                      isDisabled={loadingJobs || !selectedJobId}
                    >
                      Generate Seal
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="teal"
                      borderRadius="xl"
                      onClick={() => void handleAssignSeal(false)}
                      isLoading={sealBusy === "assign"}
                      isDisabled={loadingJobs || !sealLotId}
                    >
                      Assign Seal
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      borderRadius="xl"
                      onClick={() => void handleAssignSeal(true)}
                      isLoading={sealBusy === "assign"}
                      isDisabled={loadingJobs || !sealLotId}
                    >
                      Auto Assign Seal
                    </Button>
                  </Stack>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        </Stack>
      </VStack>
    </ControlTowerLayout>
  );
}
