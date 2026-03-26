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
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from "@chakra-ui/react";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

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

type SaveState =
  | "client"
  | "transporter"
  | "item"
  | "client-deactivate"
  | "transporter-deactivate"
  | "item-deactivate"
  | "client-reactivate"
  | "transporter-reactivate"
  | "item-reactivate"
  | null;

function toDetails(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && payload !== null) {
    const details = (payload as { details?: unknown }).details;
    if (typeof details === "string" && details.trim().length > 0) {
      return details;
    }
  }
  return fallback;
}

export default function MasterPage() {
  const toast = useToast();
  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [transporters, setTransporters] = useState<TransporterMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [inactiveClients, setInactiveClients] = useState<ClientMasterOption[]>([]);
  const [inactiveTransporters, setInactiveTransporters] = useState<TransporterMasterOption[]>([]);
  const [inactiveItems, setInactiveItems] = useState<ItemMasterOption[]>([]);
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [masterDataSaving, setMasterDataSaving] = useState<SaveState>(null);
  const [masterSearch, setMasterSearch] = useState("");
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

  const masterSearchTerm = masterSearch.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    if (!masterSearchTerm) return clients;
    return clients.filter((row) =>
      `${row.clientName} ${row.billToAddress} ${row.shipToAddress} ${row.gstOrId ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [clients, masterSearchTerm]);

  const filteredTransporters = useMemo(() => {
    if (!masterSearchTerm) return transporters;
    return transporters.filter((row) =>
      `${row.transporterName} ${row.contactPerson ?? ""} ${row.phone ?? ""} ${row.email ?? ""} ${row.address ?? ""} ${row.gstOrId ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [masterSearchTerm, transporters]);

  const filteredItems = useMemo(() => {
    if (!masterSearchTerm) return items;
    return items.filter((row) =>
      `${row.itemName} ${row.description ?? ""} ${row.uom ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [items, masterSearchTerm]);

  const filteredInactiveClients = useMemo(() => {
    if (!masterSearchTerm) return inactiveClients;
    return inactiveClients.filter((row) =>
      `${row.clientName} ${row.billToAddress} ${row.shipToAddress} ${row.gstOrId ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [inactiveClients, masterSearchTerm]);

  const filteredInactiveTransporters = useMemo(() => {
    if (!masterSearchTerm) return inactiveTransporters;
    return inactiveTransporters.filter((row) =>
      `${row.transporterName} ${row.contactPerson ?? ""} ${row.phone ?? ""} ${row.email ?? ""} ${row.address ?? ""} ${row.gstOrId ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [inactiveTransporters, masterSearchTerm]);

  const filteredInactiveItems = useMemo(() => {
    if (!masterSearchTerm) return inactiveItems;
    return inactiveItems.filter((row) =>
      `${row.itemName} ${row.description ?? ""} ${row.uom ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [inactiveItems, masterSearchTerm]);

  const loadDispatchMasters = useCallback(async () => {
    setMasterDataLoading(true);
    try {
      const [clientRes, transporterRes, itemRes, inactiveClientRes, inactiveTransporterRes, inactiveItemRes] = await Promise.all([
        fetch("/api/masters/clients"),
        fetch("/api/masters/transporters"),
        fetch("/api/masters/items"),
        fetch("/api/masters/clients?status=inactive"),
        fetch("/api/masters/transporters?status=inactive"),
        fetch("/api/masters/items?status=inactive"),
      ]);

      if (!clientRes.ok || !transporterRes.ok || !itemRes.ok || !inactiveClientRes.ok || !inactiveTransporterRes.ok || !inactiveItemRes.ok) {
        const failedResponse = !clientRes.ok
          ? clientRes
          : !transporterRes.ok
            ? transporterRes
            : !itemRes.ok
              ? itemRes
              : !inactiveClientRes.ok
                ? inactiveClientRes
                : !inactiveTransporterRes.ok
                  ? inactiveTransporterRes
                  : inactiveItemRes;
        const payload = (await failedResponse.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to load dispatch masters."));
      }

      const [clientData, transporterData, itemData, inactiveClientData, inactiveTransporterData, inactiveItemData] = await Promise.all([
        clientRes.json() as Promise<ClientMasterOption[]>,
        transporterRes.json() as Promise<TransporterMasterOption[]>,
        itemRes.json() as Promise<ItemMasterOption[]>,
        inactiveClientRes.json() as Promise<ClientMasterOption[]>,
        inactiveTransporterRes.json() as Promise<TransporterMasterOption[]>,
        inactiveItemRes.json() as Promise<ItemMasterOption[]>,
      ]);

      setClients(Array.isArray(clientData) ? clientData : []);
      setTransporters(Array.isArray(transporterData) ? transporterData : []);
      setItems(Array.isArray(itemData) ? itemData : []);
      setInactiveClients(Array.isArray(inactiveClientData) ? inactiveClientData : []);
      setInactiveTransporters(Array.isArray(inactiveTransporterData) ? inactiveTransporterData : []);
      setInactiveItems(Array.isArray(inactiveItemData) ? inactiveItemData : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dispatch masters.";
      toast({ title: "Dispatch masters unavailable", description: message, status: "error" });
    } finally {
      setMasterDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDispatchMasters();
  }, [loadDispatchMasters]);

  const saveClientMaster = async () => {
    if (!clientForm.clientName.trim() || !clientForm.billToAddress.trim() || !clientForm.shipToAddress.trim()) {
      toast({ title: "Client name, bill-to, and ship-to are required", status: "warning" });
      return;
    }

    setMasterDataSaving("client");
    try {
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
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to save client master."));
      }
      setClientForm({ clientName: "", billToAddress: "", shipToAddress: "", gstOrId: "" });
      toast({ title: "Client master saved", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save client master.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const saveTransporterMaster = async () => {
    if (!transporterForm.transporterName.trim()) {
      toast({ title: "Transporter name is required", status: "warning" });
      return;
    }

    setMasterDataSaving("transporter");
    try {
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
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to save transporter master."));
      }
      setTransporterForm({
        transporterName: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        gstOrId: "",
      });
      toast({ title: "Transporter master saved", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save transporter master.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const saveItemMaster = async () => {
    if (!itemForm.itemName.trim()) {
      toast({ title: "Item name is required", status: "warning" });
      return;
    }

    setMasterDataSaving("item");
    try {
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
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to save item master."));
      }
      setItemForm({ itemName: "", description: "", uom: "" });
      toast({ title: "Item master saved", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save item master.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const deactivateClientMaster = async (row: ClientMasterOption) => {
    setMasterDataSaving("client-deactivate");
    try {
      const response = await fetch("/api/masters/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: row.clientName,
          billToAddress: row.billToAddress,
          shipToAddress: row.shipToAddress,
          gstOrId: row.gstOrId ?? undefined,
          isActive: false,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to deactivate client."));
      }
      toast({ title: "Client deactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deactivate client.";
      toast({ title: "Deactivate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const deactivateTransporterMaster = async (row: TransporterMasterOption) => {
    setMasterDataSaving("transporter-deactivate");
    try {
      const response = await fetch("/api/masters/transporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transporterName: row.transporterName,
          contactPerson: row.contactPerson ?? undefined,
          phone: row.phone ?? undefined,
          email: row.email ?? undefined,
          address: row.address ?? undefined,
          gstOrId: row.gstOrId ?? undefined,
          isActive: false,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to deactivate transporter."));
      }
      toast({ title: "Transporter deactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deactivate transporter.";
      toast({ title: "Deactivate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const deactivateItemMaster = async (row: ItemMasterOption) => {
    setMasterDataSaving("item-deactivate");
    try {
      const response = await fetch("/api/masters/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: row.itemName,
          description: row.description ?? undefined,
          uom: row.uom ?? undefined,
          isActive: false,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to deactivate item."));
      }
      toast({ title: "Item deactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deactivate item.";
      toast({ title: "Deactivate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const reactivateClientMaster = async (row: ClientMasterOption) => {
    setMasterDataSaving("client-reactivate");
    try {
      const response = await fetch("/api/masters/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: row.clientName,
          billToAddress: row.billToAddress,
          shipToAddress: row.shipToAddress,
          gstOrId: row.gstOrId ?? undefined,
          isActive: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to reactivate client."));
      }
      toast({ title: "Client reactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reactivate client.";
      toast({ title: "Re-activate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const reactivateTransporterMaster = async (row: TransporterMasterOption) => {
    setMasterDataSaving("transporter-reactivate");
    try {
      const response = await fetch("/api/masters/transporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transporterName: row.transporterName,
          contactPerson: row.contactPerson ?? undefined,
          phone: row.phone ?? undefined,
          email: row.email ?? undefined,
          address: row.address ?? undefined,
          gstOrId: row.gstOrId ?? undefined,
          isActive: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to reactivate transporter."));
      }
      toast({ title: "Transporter reactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reactivate transporter.";
      toast({ title: "Re-activate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const reactivateItemMaster = async (row: ItemMasterOption) => {
    setMasterDataSaving("item-reactivate");
    try {
      const response = await fetch("/api/masters/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: row.itemName,
          description: row.description ?? undefined,
          uom: row.uom ?? undefined,
          isActive: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to reactivate item."));
      }
      toast({ title: "Item reactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reactivate item.";
      toast({ title: "Re-activate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack spacing={2}>
            <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
              DISPATCH SETTINGS
            </Badge>
            <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
              MASTER DATA
            </Badge>
          </HStack>
          <Heading size="lg" color="gray.900" mt={2}>
            Client, Transporter, and Item Masters
          </Heading>
          <Text color="gray.600" mt={2}>
            Master route for packing-list controls. Vehicle number remains manual for every dispatch.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4}>
          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <Heading size="sm" color="gray.900">Client Master</Heading>
              <Stack spacing={3} mt={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Client name</FormLabel>
                  <Input value={clientForm.clientName} onChange={(event) => setClientForm((prev) => ({ ...prev, clientName: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Bill to address</FormLabel>
                  <Input value={clientForm.billToAddress} onChange={(event) => setClientForm((prev) => ({ ...prev, billToAddress: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Ship to address</FormLabel>
                  <Input value={clientForm.shipToAddress} onChange={(event) => setClientForm((prev) => ({ ...prev, shipToAddress: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">GST / ID</FormLabel>
                  <Input value={clientForm.gstOrId} onChange={(event) => setClientForm((prev) => ({ ...prev, gstOrId: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <Button colorScheme="teal" onClick={() => void saveClientMaster()} isLoading={masterDataSaving === "client"}>
                  Save Client
                </Button>
              </Stack>
            </CardBody>
          </Card>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <Heading size="sm" color="gray.900">Transporter Master</Heading>
              <Stack spacing={3} mt={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Transporter name</FormLabel>
                  <Input value={transporterForm.transporterName} onChange={(event) => setTransporterForm((prev) => ({ ...prev, transporterName: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Contact person</FormLabel>
                  <Input value={transporterForm.contactPerson} onChange={(event) => setTransporterForm((prev) => ({ ...prev, contactPerson: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Phone</FormLabel>
                  <Input value={transporterForm.phone} onChange={(event) => setTransporterForm((prev) => ({ ...prev, phone: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Email</FormLabel>
                  <Input value={transporterForm.email} onChange={(event) => setTransporterForm((prev) => ({ ...prev, email: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Address</FormLabel>
                  <Input value={transporterForm.address} onChange={(event) => setTransporterForm((prev) => ({ ...prev, address: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">GST / ID</FormLabel>
                  <Input value={transporterForm.gstOrId} onChange={(event) => setTransporterForm((prev) => ({ ...prev, gstOrId: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <Button colorScheme="teal" onClick={() => void saveTransporterMaster()} isLoading={masterDataSaving === "transporter"}>
                  Save Transporter
                </Button>
              </Stack>
            </CardBody>
          </Card>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <Heading size="sm" color="gray.900">Item Name Master</Heading>
              <Stack spacing={3} mt={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Item name</FormLabel>
                  <Input value={itemForm.itemName} onChange={(event) => setItemForm((prev) => ({ ...prev, itemName: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Description</FormLabel>
                  <Input value={itemForm.description} onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">UOM</FormLabel>
                  <Input value={itemForm.uom} onChange={(event) => setItemForm((prev) => ({ ...prev, uom: event.target.value }))} borderRadius="xl" />
                </FormControl>
                <Button colorScheme="teal" onClick={() => void saveItemMaster()} isLoading={masterDataSaving === "item"}>
                  Save Item
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <HStack justify="space-between" flexWrap="wrap" spacing={3}>
              <Box>
                <Heading size="sm" color="gray.900">Dispatch Master Records</Heading>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {masterDataLoading
                    ? "Loading..."
                    : `${clients.length} clients • ${transporters.length} transporters • ${items.length} items`}
                </Text>
              </Box>
              <Button variant="outline" size="sm" onClick={() => void loadDispatchMasters()} isLoading={masterDataLoading}>
                Refresh
              </Button>
            </HStack>
            <Input
              mt={4}
              borderRadius="xl"
              placeholder="Search clients, transporters, items, GST, address, UOM..."
              value={masterSearch}
              onChange={(event) => setMasterSearch(event.target.value)}
            />
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4} mt={4}>
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" overflowX="auto">
                <TableContainer>
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Client</Th>
                        <Th>GST / ID</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredClients.map((row) => (
                        <Tr key={row.clientName}>
                          <Td>{row.clientName}</Td>
                          <Td>{row.gstOrId ?? "—"}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setClientForm({
                                    clientName: row.clientName,
                                    billToAddress: row.billToAddress,
                                    shipToAddress: row.shipToAddress,
                                    gstOrId: row.gstOrId ?? "",
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                isLoading={masterDataSaving === "client-deactivate"}
                                onClick={() => void deactivateClientMaster(row)}
                              >
                                Deactivate
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                      {filteredClients.length === 0 ? (
                        <Tr>
                          <Td colSpan={3} textAlign="center" color="gray.500">No clients</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" overflowX="auto">
                <TableContainer>
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Transporter</Th>
                        <Th>Phone</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredTransporters.map((row) => (
                        <Tr key={row.transporterName}>
                          <Td>{row.transporterName}</Td>
                          <Td>{row.phone ?? "—"}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setTransporterForm({
                                    transporterName: row.transporterName,
                                    contactPerson: row.contactPerson ?? "",
                                    phone: row.phone ?? "",
                                    email: row.email ?? "",
                                    address: row.address ?? "",
                                    gstOrId: row.gstOrId ?? "",
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                isLoading={masterDataSaving === "transporter-deactivate"}
                                onClick={() => void deactivateTransporterMaster(row)}
                              >
                                Deactivate
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                      {filteredTransporters.length === 0 ? (
                        <Tr>
                          <Td colSpan={3} textAlign="center" color="gray.500">No transporters</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" overflowX="auto">
                <TableContainer>
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Item Name</Th>
                        <Th>UOM</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredItems.map((row) => (
                        <Tr key={row.itemName}>
                          <Td>{row.itemName}</Td>
                          <Td>{row.uom ?? "—"}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  setItemForm({
                                    itemName: row.itemName,
                                    description: row.description ?? "",
                                    uom: row.uom ?? "",
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                isLoading={masterDataSaving === "item-deactivate"}
                                onClick={() => void deactivateItemMaster(row)}
                              >
                                Deactivate
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                      {filteredItems.length === 0 ? (
                        <Tr>
                          <Td colSpan={3} textAlign="center" color="gray.500">No items</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={6}>
            <Heading size="sm" color="gray.900">Inactive Dispatch Masters</Heading>
            <Text fontSize="sm" color="gray.600" mt={1}>
              Re-activate disabled records without recreating duplicate names.
            </Text>
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4} mt={4}>
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" overflowX="auto">
                <TableContainer>
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Client</Th>
                        <Th>Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredInactiveClients.map((row) => (
                        <Tr key={row.clientName}>
                          <Td>{row.clientName}</Td>
                          <Td>
                            <Button
                              size="xs"
                              colorScheme="green"
                              variant="outline"
                              isLoading={masterDataSaving === "client-reactivate"}
                              onClick={() => void reactivateClientMaster(row)}
                            >
                              Reactivate
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                      {filteredInactiveClients.length === 0 ? (
                        <Tr>
                          <Td colSpan={2} textAlign="center" color="gray.500">No inactive clients</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" overflowX="auto">
                <TableContainer>
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Transporter</Th>
                        <Th>Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredInactiveTransporters.map((row) => (
                        <Tr key={row.transporterName}>
                          <Td>{row.transporterName}</Td>
                          <Td>
                            <Button
                              size="xs"
                              colorScheme="green"
                              variant="outline"
                              isLoading={masterDataSaving === "transporter-reactivate"}
                              onClick={() => void reactivateTransporterMaster(row)}
                            >
                              Reactivate
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                      {filteredInactiveTransporters.length === 0 ? (
                        <Tr>
                          <Td colSpan={2} textAlign="center" color="gray.500">No inactive transporters</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" overflowX="auto">
                <TableContainer>
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Item</Th>
                        <Th>Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredInactiveItems.map((row) => (
                        <Tr key={row.itemName}>
                          <Td>{row.itemName}</Td>
                          <Td>
                            <Button
                              size="xs"
                              colorScheme="green"
                              variant="outline"
                              isLoading={masterDataSaving === "item-reactivate"}
                              onClick={() => void reactivateItemMaster(row)}
                            >
                              Reactivate
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                      {filteredInactiveItems.length === 0 ? (
                        <Tr>
                          <Td colSpan={2} textAlign="center" color="gray.500">No inactive items</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>
      </VStack>
    </ControlTowerLayout>
  );
}
