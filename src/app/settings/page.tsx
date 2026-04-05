"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Switch,
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
import { Building2, Save, ShieldCheck, UserCog, Workflow } from "lucide-react";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  getDefaultReportPreferences,
  getReportDocumentTypeLabel,
  REPORT_DOCUMENT_TYPES,
  REPORT_PREFERENCES_STORAGE_KEY,
  sanitizeReportPreferences,
  type ReportPreferences,
} from "@/lib/report-preferences";

type MasterTab = "CLIENT" | "ITEM" | "TRANSPORTER";

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

export default function SettingsPageRoute() {
  const toast = useToast();
  const [companyName, setCompanyName] = useState("Aditya Test");
  const [location, setLocation] = useState("Industrial Park, Plot 24");
  const [defaultView, setDefaultView] = useState("my");
  const [samplingRequired, setSamplingRequired] = useState(true);
  const [qaGateEnabled, setQaGateEnabled] = useState(true);
  const [lockStrictMode, setLockStrictMode] = useState(true);
  const [activeMasterTab, setActiveMasterTab] = useState<MasterTab>("CLIENT");
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);
  const [reportPreferences, setReportPreferences] = useState<ReportPreferences>(() =>
    getDefaultReportPreferences(companyName)
  );
  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [transporters, setTransporters] = useState<TransporterMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [clientForm, setClientForm] = useState({
    clientName: "",
    billToAddress: "",
    shipToAddress: "",
    gstOrId: "",
  });
  const [transporterForm, setTransporterForm] = useState({
    transporterName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    gstOrId: "",
  });
  const [itemForm, setItemForm] = useState({
    itemName: "",
    description: "",
    uom: "",
  });

  const loadMasters = useCallback(async () => {
    setMasterLoading(true);
    try {
      const response = await fetch("/api/masters/dispatch-options");
      if (!response.ok) {
        throw new Error("Failed to load master data.");
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
      const message = error instanceof Error ? error.message : "Failed to load master data.";
      toast({ title: "Master load failed", description: message, status: "error" });
    } finally {
      setMasterLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    const defaults = getDefaultReportPreferences(companyName);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(REPORT_PREFERENCES_STORAGE_KEY) : null;
    if (!stored) {
      setReportPreferences(defaults);
      return;
    }

    try {
      setReportPreferences(sanitizeReportPreferences(JSON.parse(stored), companyName));
    } catch {
      setReportPreferences(defaults);
    }
  }, [companyName]);

  const activeRows = useMemo(() => {
    if (activeMasterTab === "CLIENT") return clients.length;
    if (activeMasterTab === "TRANSPORTER") return transporters.length;
    return items.length;
  }, [activeMasterTab, clients.length, items.length, transporters.length]);

  const saveActiveMaster = async () => {
    setMasterSaving(true);
    try {
      if (activeMasterTab === "CLIENT") {
        if (!clientForm.clientName.trim() || !clientForm.billToAddress.trim() || !clientForm.shipToAddress.trim()) {
          throw new Error("Client name, bill-to, and ship-to are required.");
        }
        const response = await fetch("/api/masters/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: clientForm.clientName.trim(),
            billToAddress: clientForm.billToAddress.trim(),
            shipToAddress: clientForm.shipToAddress.trim(),
            gstOrId: clientForm.gstOrId.trim() || undefined,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to save client.");
        }
        setClientForm({ clientName: "", billToAddress: "", shipToAddress: "", gstOrId: "" });
      } else if (activeMasterTab === "TRANSPORTER") {
        if (!transporterForm.transporterName.trim()) {
          throw new Error("Transporter name is required.");
        }
        const response = await fetch("/api/masters/transporters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transporterName: transporterForm.transporterName.trim(),
            contactPerson: transporterForm.contactPerson.trim() || undefined,
            phone: transporterForm.phone.trim() || undefined,
            email: transporterForm.email.trim() || undefined,
            address: transporterForm.address.trim() || undefined,
            gstOrId: transporterForm.gstOrId.trim() || undefined,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to save transporter.");
        }
        setTransporterForm({
          transporterName: "",
          contactPerson: "",
          phone: "",
          email: "",
          address: "",
          gstOrId: "",
        });
      } else {
        if (!itemForm.itemName.trim()) {
          throw new Error("Item name is required.");
        }
        const response = await fetch("/api/masters/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: itemForm.itemName.trim(),
            description: itemForm.description.trim() || undefined,
            uom: itemForm.uom.trim() || undefined,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to save item.");
        }
        setItemForm({ itemName: "", description: "", uom: "" });
      }

      toast({ title: "Master saved", status: "success" });
      await loadMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save master.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setMasterSaving(false);
    }
  };

  const saveBasics = () => {
    try {
      const normalized = sanitizeReportPreferences(reportPreferences, companyName);
      window.localStorage.setItem(REPORT_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      toast({ title: "Report preferences could not be saved", status: "warning" });
    }
    toast({ title: "Settings saved", status: "success" });
  };

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack spacing={2}>
            <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
              SETTINGS
            </Badge>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={1}>
              BASIC CONFIG
            </Badge>
          </HStack>
          <Heading size="lg" color="gray.900" mt={2}>
            Settings
          </Heading>
          <Text color="gray.600" mt={2}>
            Workspace configuration.
          </Text>
        </Box>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack mb={4}>
              <Box p={2.5} bg="teal.50" color="teal.600" borderRadius="xl">
                <Building2 size={18} />
              </Box>
              <Box>
                <Heading size="sm" color="gray.900">
                  Company Profile
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Basic organization information used across dashboards and reports.
                </Text>
              </Box>
            </HStack>

            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel>Company Name</FormLabel>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Primary Location</FormLabel>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </FormControl>
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack mb={4}>
              <Box p={2.5} bg="blue.50" color="blue.600" borderRadius="xl">
                <ShieldCheck size={18} />
              </Box>
              <Box>
                <Heading size="sm" color="gray.900">
                  Report & Print Preferences
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Set default print type and branding for PDF/XLSX generation.
                </Text>
              </Box>
            </HStack>

            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel>Default Report Type</FormLabel>
                <Select
                  value={reportPreferences.defaultDocumentType}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      defaultDocumentType: event.target.value as ReportPreferences["defaultDocumentType"],
                    }))
                  }
                >
                  {REPORT_DOCUMENT_TYPES.map((documentType) => (
                    <option key={documentType} value={documentType}>
                      {getReportDocumentTypeLabel(documentType)}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Brand Display Name</FormLabel>
                <Input
                  value={reportPreferences.branding.companyName}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, companyName: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Brand Address</FormLabel>
                <Input
                  value={reportPreferences.branding.companyAddress}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, companyAddress: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Contact Line</FormLabel>
                <Input
                  value={reportPreferences.branding.companyContact}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, companyContact: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>GST / Tax ID</FormLabel>
                <Input
                  value={reportPreferences.branding.taxId}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, taxId: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Logo URL (optional)</FormLabel>
                <Input
                  value={reportPreferences.branding.logoUrl}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, logoUrl: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Footer Note (optional)</FormLabel>
                <Input
                  value={reportPreferences.branding.footerNote}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, footerNote: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Authorized Signatory Name</FormLabel>
                <Input
                  value={reportPreferences.branding.authorizedSignatoryName}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, authorizedSignatoryName: event.target.value },
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Authorized Signatory Title</FormLabel>
                <Input
                  value={reportPreferences.branding.authorizedSignatoryTitle}
                  onChange={(event) =>
                    setReportPreferences((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, authorizedSignatoryTitle: event.target.value },
                    }))
                  }
                />
              </FormControl>
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack mb={4}>
              <Box p={2.5} bg="purple.50" color="purple.600" borderRadius="xl">
                <UserCog size={18} />
              </Box>
              <Box>
                <Heading size="sm" color="gray.900">
                  User Defaults
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Default view and basic preference configuration.
                </Text>
              </Box>
            </HStack>

            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel>Default Inspection View</FormLabel>
                <Select value={defaultView} onChange={(e) => setDefaultView(e.target.value)}>
                  <option value="my">My Tasks</option>
                  <option value="all">Company View</option>
                </Select>
              </FormControl>
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack mb={4}>
              <Box p={2.5} bg="orange.50" color="orange.600" borderRadius="xl">
                <Workflow size={18} />
              </Box>
              <Box>
                <Heading size="sm" color="gray.900">
                  Workflow Basics
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Lightweight control toggles for inspection and R&D flow governance.
                </Text>
              </Box>
            </HStack>

            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <Text color="gray.800">Sampling mandatory before homogeneous sample</Text>
                <Switch colorScheme="teal" isChecked={samplingRequired} onChange={(e) => setSamplingRequired(e.target.checked)} />
              </HStack>
              <Divider />
              <HStack justify="space-between">
                <Text color="gray.800">QA gate required before lock</Text>
                <Switch colorScheme="teal" isChecked={qaGateEnabled} onChange={(e) => setQaGateEnabled(e.target.checked)} />
              </HStack>
              <Divider />
              <HStack justify="space-between">
                <Text color="gray.800">Strict lock mode (no post-lock mutation)</Text>
                <Switch colorScheme="teal" isChecked={lockStrictMode} onChange={(e) => setLockStrictMode(e.target.checked)} />
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack mb={3}>
              <Box p={2.5} bg="green.50" color="green.600" borderRadius="xl">
                <ShieldCheck size={18} />
              </Box>
              <Box>
                <Heading size="sm" color="gray.900">
                  Master Data Management
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Client, transporter, and item records.
                </Text>
              </Box>
            </HStack>

            <HStack spacing={2} mb={4} flexWrap="wrap">
              {(["CLIENT", "TRANSPORTER", "ITEM"] as MasterTab[]).map((tab) => (
                <Button
                  key={tab}
                  size="sm"
                  variant={activeMasterTab === tab ? "solid" : "outline"}
                  colorScheme={activeMasterTab === tab ? "teal" : "gray"}
                  onClick={() => setActiveMasterTab(tab)}
                >
                  {tab === "CLIENT" ? "Clients" : tab === "TRANSPORTER" ? "Transporters" : "Items"}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => void loadMasters()} isLoading={masterLoading}>
                Refresh Data
              </Button>
              <Button size="sm" variant="outline" onClick={() => (window.location.href = "/masterplayground")}>
                Open Playground
              </Button>
            </HStack>

            <VStack align="stretch" spacing={3}>
              {activeMasterTab === "CLIENT" ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Client Name</FormLabel>
                    <Input value={clientForm.clientName} onChange={(e) => setClientForm((prev) => ({ ...prev, clientName: e.target.value }))} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Bill To</FormLabel>
                    <Input value={clientForm.billToAddress} onChange={(e) => setClientForm((prev) => ({ ...prev, billToAddress: e.target.value }))} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Ship To</FormLabel>
                    <Input value={clientForm.shipToAddress} onChange={(e) => setClientForm((prev) => ({ ...prev, shipToAddress: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>GST / ID</FormLabel>
                    <Input value={clientForm.gstOrId} onChange={(e) => setClientForm((prev) => ({ ...prev, gstOrId: e.target.value }))} />
                  </FormControl>
                </>
              ) : null}

              {activeMasterTab === "TRANSPORTER" ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Transporter Name</FormLabel>
                    <Input value={transporterForm.transporterName} onChange={(e) => setTransporterForm((prev) => ({ ...prev, transporterName: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Contact Person</FormLabel>
                    <Input value={transporterForm.contactPerson} onChange={(e) => setTransporterForm((prev) => ({ ...prev, contactPerson: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Phone</FormLabel>
                    <Input value={transporterForm.phone} onChange={(e) => setTransporterForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input value={transporterForm.email} onChange={(e) => setTransporterForm((prev) => ({ ...prev, email: e.target.value }))} />
                  </FormControl>
                </>
              ) : null}

              {activeMasterTab === "ITEM" ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Item Name</FormLabel>
                    <Input value={itemForm.itemName} onChange={(e) => setItemForm((prev) => ({ ...prev, itemName: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Input value={itemForm.description} onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>UOM</FormLabel>
                    <Input value={itemForm.uom} onChange={(e) => setItemForm((prev) => ({ ...prev, uom: e.target.value }))} />
                  </FormControl>
                </>
              ) : null}
            </VStack>

            <HStack justify="space-between" mt={4}>
              <Text fontSize="sm" color="gray.600">
                {masterLoading ? "Loading..." : `${activeRows} record(s)`}
              </Text>
              <Button size="sm" colorScheme="teal" onClick={() => void saveActiveMaster()} isLoading={masterSaving}>
                Save {activeMasterTab === "CLIENT" ? "Client" : activeMasterTab === "TRANSPORTER" ? "Transporter" : "Item"}
              </Button>
            </HStack>

            <TableContainer mt={4} borderWidth="1px" borderColor="gray.200" borderRadius="xl">
              <Table size="sm">
                <Thead bg="gray.50">
                  {activeMasterTab === "CLIENT" ? (
                    <Tr>
                      <Th>Client</Th>
                      <Th>GST / ID</Th>
                    </Tr>
                  ) : null}
                  {activeMasterTab === "TRANSPORTER" ? (
                    <Tr>
                      <Th>Transporter</Th>
                      <Th>Phone</Th>
                    </Tr>
                  ) : null}
                  {activeMasterTab === "ITEM" ? (
                    <Tr>
                      <Th>Item</Th>
                      <Th>UOM</Th>
                    </Tr>
                  ) : null}
                </Thead>
                <Tbody>
                  {activeMasterTab === "CLIENT"
                    ? clients.map((row) => (
                        <Tr key={row.clientName}>
                          <Td>{row.clientName}</Td>
                          <Td>{row.gstOrId ?? "—"}</Td>
                        </Tr>
                      ))
                    : null}
                  {activeMasterTab === "TRANSPORTER"
                    ? transporters.map((row) => (
                        <Tr key={row.transporterName}>
                          <Td>{row.transporterName}</Td>
                          <Td>{row.phone ?? "—"}</Td>
                        </Tr>
                      ))
                    : null}
                  {activeMasterTab === "ITEM"
                    ? items.map((row) => (
                        <Tr key={row.itemName}>
                          <Td>{row.itemName}</Td>
                          <Td>{row.uom ?? "—"}</Td>
                        </Tr>
                      ))
                    : null}
                </Tbody>
              </Table>
            </TableContainer>
          </CardBody>
        </Card>

        <HStack justify="end">
          <Button leftIcon={<Save size={16} />} colorScheme="teal" onClick={saveBasics}>
            Save Settings
          </Button>
        </HStack>
      </VStack>
    </ControlTowerLayout>
  );
}
