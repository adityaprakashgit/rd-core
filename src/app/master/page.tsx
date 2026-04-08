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
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { FilterRail, RegistryPageTemplate } from "@/components/enterprise/PageTemplates";
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
  materialType: string | null;
  description: string | null;
  uom: string | null;
};

type WarehouseMasterOption = {
  warehouseName: string;
  description: string | null;
};

type SaveState =
  | "client"
  | "transporter"
  | "item"
  | "warehouse"
  | "client-deactivate"
  | "transporter-deactivate"
  | "item-deactivate"
  | "warehouse-deactivate"
  | "client-reactivate"
  | "transporter-reactivate"
  | "item-reactivate"
  | "warehouse-reactivate"
  | null;

type RegistryTab = "CLIENT" | "TRANSPORTER" | "ITEM" | "WAREHOUSE" | "INACTIVE";

const MATERIAL_TYPE_OPTIONS = [
  { value: "INHOUSE", label: "In-house" },
  { value: "TRADED", label: "Traded" },
] as const;

function toDetails(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && payload !== null) {
    const details = (payload as { details?: unknown }).details;
    if (typeof details === "string" && details.trim().length > 0) {
      return details;
    }
  }
  return fallback;
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

export default function MasterPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<RegistryTab>("CLIENT");
  const [activePanel, setActivePanel] = useState<"overview" | "registry">("registry");
  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [transporters, setTransporters] = useState<TransporterMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseMasterOption[]>([]);
  const [inactiveClients, setInactiveClients] = useState<ClientMasterOption[]>([]);
  const [inactiveTransporters, setInactiveTransporters] = useState<TransporterMasterOption[]>([]);
  const [inactiveItems, setInactiveItems] = useState<ItemMasterOption[]>([]);
  const [inactiveWarehouses, setInactiveWarehouses] = useState<WarehouseMasterOption[]>([]);
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [masterDataSaving, setMasterDataSaving] = useState<SaveState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    materialType: "",
    description: "",
    uom: "",
  });
  const [warehouseForm, setWarehouseForm] = useState({
    warehouseName: "",
    description: "",
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
      `${row.itemName} ${row.materialType ?? ""} ${row.description ?? ""} ${row.uom ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [items, masterSearchTerm]);

  const filteredWarehouses = useMemo(() => {
    if (!masterSearchTerm) return warehouses;
    return warehouses.filter((row) =>
      `${row.warehouseName} ${row.description ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [masterSearchTerm, warehouses]);

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
      `${row.itemName} ${row.materialType ?? ""} ${row.description ?? ""} ${row.uom ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [inactiveItems, masterSearchTerm]);

  const filteredInactiveWarehouses = useMemo(() => {
    if (!masterSearchTerm) return inactiveWarehouses;
    return inactiveWarehouses.filter((row) =>
      `${row.warehouseName} ${row.description ?? ""}`
        .toLowerCase()
        .includes(masterSearchTerm)
    );
  }, [inactiveWarehouses, masterSearchTerm]);

  const loadDispatchMasters = useCallback(async () => {
    setMasterDataLoading(true);
    setLoadError(null);
    try {
      const [
        clientRes,
        transporterRes,
        itemRes,
        warehouseRes,
        inactiveClientRes,
        inactiveTransporterRes,
        inactiveItemRes,
        inactiveWarehouseRes,
      ] =
        await Promise.all([
          fetch("/api/masters/clients"),
          fetch("/api/masters/transporters"),
          fetch("/api/masters/items"),
          fetch("/api/masters/warehouses"),
          fetch("/api/masters/clients?status=inactive"),
          fetch("/api/masters/transporters?status=inactive"),
          fetch("/api/masters/items?status=inactive"),
          fetch("/api/masters/warehouses?status=inactive"),
        ]);

      if (
        !clientRes.ok ||
        !transporterRes.ok ||
        !itemRes.ok ||
        !warehouseRes.ok ||
        !inactiveClientRes.ok ||
        !inactiveTransporterRes.ok ||
        !inactiveItemRes.ok ||
        !inactiveWarehouseRes.ok
      ) {
        const failedResponse = !clientRes.ok
          ? clientRes
          : !transporterRes.ok
            ? transporterRes
            : !itemRes.ok
              ? itemRes
              : !warehouseRes.ok
                ? warehouseRes
              : !inactiveClientRes.ok
                ? inactiveClientRes
                : !inactiveTransporterRes.ok
                  ? inactiveTransporterRes
                  : !inactiveItemRes.ok
                    ? inactiveItemRes
                    : inactiveWarehouseRes;
        const payload = (await failedResponse.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to load dispatch masters."));
      }

      const [
        clientData,
        transporterData,
        itemData,
        warehouseData,
        inactiveClientData,
        inactiveTransporterData,
        inactiveItemData,
        inactiveWarehouseData,
      ] =
        await Promise.all([
          clientRes.json() as Promise<ClientMasterOption[]>,
          transporterRes.json() as Promise<TransporterMasterOption[]>,
          itemRes.json() as Promise<ItemMasterOption[]>,
          warehouseRes.json() as Promise<WarehouseMasterOption[]>,
          inactiveClientRes.json() as Promise<ClientMasterOption[]>,
          inactiveTransporterRes.json() as Promise<TransporterMasterOption[]>,
          inactiveItemRes.json() as Promise<ItemMasterOption[]>,
          inactiveWarehouseRes.json() as Promise<WarehouseMasterOption[]>,
        ]);

      setClients(Array.isArray(clientData) ? clientData : []);
      setTransporters(Array.isArray(transporterData) ? transporterData : []);
      setItems(Array.isArray(itemData) ? itemData : []);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setInactiveClients(Array.isArray(inactiveClientData) ? inactiveClientData : []);
      setInactiveTransporters(Array.isArray(inactiveTransporterData) ? inactiveTransporterData : []);
      setInactiveItems(Array.isArray(inactiveItemData) ? inactiveItemData : []);
      setInactiveWarehouses(Array.isArray(inactiveWarehouseData) ? inactiveWarehouseData : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dispatch masters.";
      setLoadError(message);
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

    if (!itemForm.materialType) {
      toast({ title: "Material type is required", status: "warning" });
      return;
    }

    setMasterDataSaving("item");
    try {
      const response = await fetch("/api/masters/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: itemForm.itemName.trim(),
          materialType: itemForm.materialType,
          description: itemForm.description.trim() || undefined,
          uom: itemForm.uom.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to save item master."));
      }
      setItemForm({ itemName: "", materialType: "", description: "", uom: "" });
      toast({ title: "Item master saved", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save item master.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const saveWarehouseMaster = async () => {
    if (!warehouseForm.warehouseName.trim()) {
      toast({ title: "Warehouse name is required", status: "warning" });
      return;
    }

    setMasterDataSaving("warehouse");
    try {
      const response = await fetch("/api/masters/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseName: warehouseForm.warehouseName.trim(),
          description: warehouseForm.description.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to save warehouse master."));
      }
      setWarehouseForm({ warehouseName: "", description: "" });
      toast({ title: "Warehouse master saved", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save warehouse master.";
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
          materialType: row.materialType ?? undefined,
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

  const deactivateWarehouseMaster = async (row: WarehouseMasterOption) => {
    setMasterDataSaving("warehouse-deactivate");
    try {
      const response = await fetch("/api/masters/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseName: row.warehouseName,
          description: row.description ?? undefined,
          isActive: false,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to deactivate warehouse."));
      }
      toast({ title: "Warehouse deactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deactivate warehouse.";
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
          materialType: row.materialType ?? undefined,
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

  const reactivateWarehouseMaster = async (row: WarehouseMasterOption) => {
    setMasterDataSaving("warehouse-reactivate");
    try {
      const response = await fetch("/api/masters/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseName: row.warehouseName,
          description: row.description ?? undefined,
          isActive: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to reactivate warehouse."));
      }
      toast({ title: "Warehouse reactivated", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reactivate warehouse.";
      toast({ title: "Re-activate failed", description: message, status: "error" });
    } finally {
      setMasterDataSaving(null);
    }
  };

  const activeRecordCount = useMemo(() => {
    switch (activeTab) {
      case "CLIENT":
        return filteredClients.length;
      case "TRANSPORTER":
        return filteredTransporters.length;
      case "ITEM":
        return filteredItems.length;
      case "WAREHOUSE":
        return filteredWarehouses.length;
      default:
        return filteredInactiveClients.length + filteredInactiveTransporters.length + filteredInactiveItems.length + filteredInactiveWarehouses.length;
    }
  }, [
    activeTab,
    filteredClients.length,
    filteredInactiveClients.length,
    filteredInactiveItems.length,
    filteredInactiveTransporters.length,
    filteredInactiveWarehouses.length,
    filteredItems.length,
    filteredTransporters.length,
    filteredWarehouses.length,
  ]);

  const activeForm = (() => {
    if (activeTab === "CLIENT") {
      return (
        <Stack spacing={3}>
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
            Save client
          </Button>
        </Stack>
      );
    }

    if (activeTab === "TRANSPORTER") {
      return (
        <Stack spacing={3}>
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
            Save transporter
          </Button>
        </Stack>
      );
    }

    if (activeTab === "ITEM") {
      return (
        <Stack spacing={3}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Item name</FormLabel>
            <Input value={itemForm.itemName} onChange={(event) => setItemForm((prev) => ({ ...prev, itemName: event.target.value }))} borderRadius="xl" />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Material type</FormLabel>
            <HStack spacing={3} flexWrap="wrap">
              {MATERIAL_TYPE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={itemForm.materialType === option.value ? "solid" : "outline"}
                  colorScheme={itemForm.materialType === option.value ? "teal" : "gray"}
                  onClick={() => setItemForm((prev) => ({ ...prev, materialType: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </HStack>
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
            Save item
          </Button>
        </Stack>
      );
    }

    if (activeTab === "WAREHOUSE") {
      return (
        <Stack spacing={3}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Warehouse name</FormLabel>
            <Input value={warehouseForm.warehouseName} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, warehouseName: event.target.value }))} borderRadius="xl" />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Description</FormLabel>
            <Input value={warehouseForm.description} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, description: event.target.value }))} borderRadius="xl" />
          </FormControl>
          <Button colorScheme="teal" onClick={() => void saveWarehouseMaster()} isLoading={masterDataSaving === "warehouse"}>
            Save warehouse
          </Button>
        </Stack>
      );
    }

    return (
      <EmptyWorkState
        title="Inactive records only"
        description="Use this tab to restore previously disabled records. Creation is intentionally disabled here."
      />
    );
  })();

  const activeTable = (() => {
    if (activeTab === "CLIENT") {
      return (
        <EnterpriseDataTable
          rows={filteredClients}
          rowKey={(row) => row.clientName}
          filters={[{ id: "search", label: "Search", value: masterSearch || "All active clients" }]}
          emptyLabel="No active client records found."
          columns={[
            { id: "client", header: "Client", render: (row) => row.clientName },
            { id: "billTo", header: "Bill to", render: (row) => row.billToAddress },
            { id: "shipTo", header: "Ship to", render: (row) => row.shipToAddress },
            { id: "gst", header: "GST / ID", render: (row) => row.gstOrId ?? "—" },
          ]}
          rowActions={[
            {
              id: "edit",
              label: "Edit",
              onClick: (row) =>
                setClientForm({
                  clientName: row.clientName,
                  billToAddress: row.billToAddress,
                  shipToAddress: row.shipToAddress,
                  gstOrId: row.gstOrId ?? "",
                }),
            },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void deactivateClientMaster(row),
            },
          ]}
          recordCard={{
            title: (row) => row.clientName,
            subtitle: (row) => row.gstOrId ?? "No GST / ID",
            fields: [
              { id: "bill", label: "Bill to", render: (row) => row.billToAddress },
              { id: "ship", label: "Ship to", render: (row) => row.shipToAddress },
            ],
          }}
        />
      );
    }

    if (activeTab === "TRANSPORTER") {
      return (
        <EnterpriseDataTable
          rows={filteredTransporters}
          rowKey={(row) => row.transporterName}
          filters={[{ id: "search", label: "Search", value: masterSearch || "All active transporters" }]}
          emptyLabel="No active transporter records found."
          columns={[
            { id: "transporter", header: "Transporter", render: (row) => row.transporterName },
            { id: "contact", header: "Contact", render: (row) => row.contactPerson ?? "—" },
            { id: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
            { id: "email", header: "Email", render: (row) => row.email ?? "—" },
          ]}
          rowActions={[
            {
              id: "edit",
              label: "Edit",
              onClick: (row) =>
                setTransporterForm({
                  transporterName: row.transporterName,
                  contactPerson: row.contactPerson ?? "",
                  phone: row.phone ?? "",
                  email: row.email ?? "",
                  address: row.address ?? "",
                  gstOrId: row.gstOrId ?? "",
                }),
            },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void deactivateTransporterMaster(row),
            },
          ]}
          recordCard={{
            title: (row) => row.transporterName,
            subtitle: (row) => row.phone ?? "No phone on record",
            fields: [
              { id: "contact", label: "Contact", render: (row) => row.contactPerson ?? "—" },
              { id: "email", label: "Email", render: (row) => row.email ?? "—" },
            ],
          }}
        />
      );
    }

    if (activeTab === "ITEM") {
      return (
        <EnterpriseDataTable
          rows={filteredItems}
          rowKey={(row) => row.itemName}
          filters={[{ id: "search", label: "Search", value: masterSearch || "All active items" }]}
          emptyLabel="No active item records found."
          columns={[
            { id: "item", header: "Item", render: (row) => row.itemName },
            { id: "materialType", header: "Material type", render: (row) => formatMaterialTypeLabel(row.materialType) },
            { id: "description", header: "Description", render: (row) => row.description ?? "—" },
            { id: "uom", header: "UOM", render: (row) => row.uom ?? "—" },
          ]}
          rowActions={[
            {
              id: "edit",
              label: "Edit",
              onClick: (row) =>
                setItemForm({
                  itemName: row.itemName,
                  materialType: row.materialType ?? "",
                  description: row.description ?? "",
                  uom: row.uom ?? "",
                }),
            },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void deactivateItemMaster(row),
            },
          ]}
          recordCard={{
            title: (row) => row.itemName,
            subtitle: (row) => `${formatMaterialTypeLabel(row.materialType)}${row.uom ? ` • ${row.uom}` : ""}`,
            fields: [{ id: "description", label: "Description", render: (row) => row.description ?? "—" }],
          }}
        />
      );
    }

    if (activeTab === "WAREHOUSE") {
      return (
        <EnterpriseDataTable
          rows={filteredWarehouses}
          rowKey={(row) => row.warehouseName}
          filters={[{ id: "search", label: "Search", value: masterSearch || "All active warehouses" }]}
          emptyLabel="No active warehouse records found."
          columns={[
            { id: "warehouse", header: "Warehouse", render: (row) => row.warehouseName },
            { id: "description", header: "Description", render: (row) => row.description ?? "—" },
          ]}
          rowActions={[
            {
              id: "edit",
              label: "Edit",
              onClick: (row) =>
                setWarehouseForm({
                  warehouseName: row.warehouseName,
                  description: row.description ?? "",
                }),
            },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void deactivateWarehouseMaster(row),
            },
          ]}
          recordCard={{
            title: (row) => row.warehouseName,
            subtitle: (row) => row.description ?? "No description",
          }}
        />
      );
    }

    if (
      filteredInactiveClients.length === 0 &&
      filteredInactiveTransporters.length === 0 &&
      filteredInactiveItems.length === 0 &&
      filteredInactiveWarehouses.length === 0
    ) {
      return (
        <EmptyWorkState
          title="No inactive master records"
          description="Disabled records will appear here so they can be restored without creating duplicates."
        />
      );
    }

    return (
      <SimpleGrid columns={{ base: 1, xl: 4 }} spacing={4}>
        <Card variant="outline" borderRadius="2xl">
          <CardBody>
            <Text fontWeight="semibold" color="text.primary" mb={4}>
              Inactive clients
            </Text>
            <EnterpriseDataTable
              rows={filteredInactiveClients}
              rowKey={(row) => row.clientName}
              emptyLabel="No inactive clients."
              columns={[
                { id: "client", header: "Client", render: (row) => row.clientName },
                { id: "gst", header: "GST / ID", render: (row) => row.gstOrId ?? "—" },
              ]}
              rowActions={[
                {
                  id: "reactivate",
                  label: "Set active",
                  onClick: (row) => void reactivateClientMaster(row),
                },
              ]}
              recordCard={{
                title: (row) => row.clientName,
                subtitle: (row) => row.gstOrId ?? "No GST / ID",
              }}
            />
          </CardBody>
        </Card>
        <Card variant="outline" borderRadius="2xl">
          <CardBody>
            <Text fontWeight="semibold" color="text.primary" mb={4}>
              Inactive transporters
            </Text>
            <EnterpriseDataTable
              rows={filteredInactiveTransporters}
              rowKey={(row) => row.transporterName}
              emptyLabel="No inactive transporters."
              columns={[
                { id: "transporter", header: "Transporter", render: (row) => row.transporterName },
                { id: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
              ]}
              rowActions={[
                {
                  id: "reactivate",
                  label: "Set active",
                  onClick: (row) => void reactivateTransporterMaster(row),
                },
              ]}
              recordCard={{
                title: (row) => row.transporterName,
                subtitle: (row) => row.phone ?? "No phone",
              }}
            />
          </CardBody>
        </Card>
        <Card variant="outline" borderRadius="2xl">
          <CardBody>
            <Text fontWeight="semibold" color="text.primary" mb={4}>
              Inactive items
            </Text>
            <EnterpriseDataTable
              rows={filteredInactiveItems}
              rowKey={(row) => row.itemName}
              emptyLabel="No inactive items."
              columns={[
                { id: "item", header: "Item", render: (row) => row.itemName },
                { id: "uom", header: "UOM", render: (row) => row.uom ?? "—" },
              ]}
              rowActions={[
                {
                  id: "reactivate",
                  label: "Set active",
                  onClick: (row) => void reactivateItemMaster(row),
                },
              ]}
              recordCard={{
                title: (row) => row.itemName,
                subtitle: (row) => row.uom ?? "No UOM",
              }}
            />
          </CardBody>
        </Card>
        <Card variant="outline" borderRadius="2xl">
          <CardBody>
            <Text fontWeight="semibold" color="text.primary" mb={4}>
              Inactive warehouses
            </Text>
            <EnterpriseDataTable
              rows={filteredInactiveWarehouses}
              rowKey={(row) => row.warehouseName}
              emptyLabel="No inactive warehouses."
              columns={[
                { id: "warehouse", header: "Warehouse", render: (row) => row.warehouseName },
                { id: "description", header: "Description", render: (row) => row.description ?? "—" },
              ]}
              rowActions={[
                {
                  id: "reactivate",
                  label: "Set active",
                  onClick: (row) => void reactivateWarehouseMaster(row),
                },
              ]}
              recordCard={{
                title: (row) => row.warehouseName,
                subtitle: (row) => row.description ?? "No description",
              }}
            />
          </CardBody>
        </Card>
      </SimpleGrid>
    );
  })();

  if (masterDataLoading && clients.length === 0 && transporters.length === 0 && items.length === 0 && warehouses.length === 0) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={3} rows={2} />
      </ControlTowerLayout>
    );
  }

  if (!masterDataLoading && loadError && clients.length === 0 && transporters.length === 0 && items.length === 0 && warehouses.length === 0) {
    return (
      <ControlTowerLayout>
        <InlineErrorState
          title="Master registry unavailable"
          description={loadError}
          onRetry={() => void loadDispatchMasters()}
        />
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6} h="full" overflow="hidden">
        <Box>
          <HStack spacing={2} flexWrap="wrap">
            <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
              MASTER REGISTRY
            </Badge>
            <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
              SINGLE SOURCE OF TRUTH
            </Badge>
          </HStack>
          <Heading size="lg" color="text.primary" mt={2}>
            Masters
          </Heading>
        </Box>

        <HStack spacing={3}>
          <Button variant={activePanel === "overview" ? "solid" : "outline"} onClick={() => setActivePanel("overview")}>
            Overview
          </Button>
          <Button variant={activePanel === "registry" ? "solid" : "outline"} onClick={() => setActivePanel("registry")}>
            Registry
          </Button>
        </HStack>

        {activePanel === "overview" ? (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4}>
          {[
            { label: "Active clients", value: clients.length },
            { label: "Active transporters", value: transporters.length },
            { label: "Active items", value: items.length },
            { label: "Active warehouses", value: warehouses.length },
            { label: "Inactive records", value: inactiveClients.length + inactiveTransporters.length + inactiveItems.length + inactiveWarehouses.length },
          ].map((item) => (
            <Card key={item.label} variant="outline" borderRadius="2xl">
              <CardBody p={5}>
                <Text fontSize="sm" color="text.muted">
                  {item.label}
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                  {item.value}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
        ) : null}

        {activePanel === "registry" ? (
        <RegistryPageTemplate
          summary={
            <Stack direction={{ base: "column", lg: "row" }} justify="space-between" spacing={4}>
              <Box>
                <Text fontWeight="semibold" color="text.primary">
                  Registry control
                </Text>
              </Box>
              <FilterRail>
                {(["CLIENT", "TRANSPORTER", "ITEM", "WAREHOUSE", "INACTIVE"] as RegistryTab[]).map((tab) => (
                  <Button
                    key={tab}
                    size="sm"
                    variant={activeTab === tab ? "solid" : "outline"}
                    colorScheme={activeTab === tab ? "teal" : "gray"}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "CLIENT"
                      ? "Clients"
                      : tab === "TRANSPORTER"
                        ? "Transporters"
                        : tab === "ITEM"
                          ? "Items"
                          : tab === "WAREHOUSE"
                            ? "Warehouses"
                          : "Inactive"}
                  </Button>
                ))}
              </FilterRail>
            </Stack>
          }
          filters={
            <Stack direction={{ base: "column", lg: "row" }} justify="space-between" spacing={4}>
              <Input
                maxW={{ base: "full", lg: "lg" }}
                borderRadius="xl"
                placeholder="Search names, addresses, phone numbers, GST, UOM..."
                value={masterSearch}
                onChange={(event) => setMasterSearch(event.target.value)}
              />
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1}>
                  {activeRecordCount} visible
                </Badge>
                <Button variant="outline" size="sm" onClick={() => void loadDispatchMasters()} isLoading={masterDataLoading}>
                  Refresh
                </Button>
              </HStack>
            </Stack>
          }
          content={
            <VStack align="stretch" spacing={4}>
              <SimpleGrid columns={{ base: 1, xl: activeTab === "INACTIVE" ? 1 : 2 }} spacing={4}>
                <Card variant="outline" borderRadius="2xl">
                  <CardBody p={5}>
                    <Text fontWeight="semibold" color="text.primary">
                      {activeTab === "CLIENT"
                        ? "Create or edit client"
                        : activeTab === "TRANSPORTER"
                          ? "Create or edit transporter"
                          : activeTab === "ITEM"
                            ? "Create or edit item"
                            : activeTab === "WAREHOUSE"
                              ? "Create or edit warehouse"
                            : "Inactive records"}
                    </Text>
                    {activeForm}
                  </CardBody>
                </Card>

                {activeTab !== "INACTIVE" ? (
                  <Card variant="outline" borderRadius="2xl">
                    <CardBody p={5}>
                      <Text fontWeight="semibold" color="text.primary">
                        Registry rules
                      </Text>
                      <VStack align="stretch" spacing={3} mt={4}>
                        <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="xl">
                          <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                            Avoid duplicate naming
                          </Text>
                        </Box>
                        <Box p={4} borderWidth="1px" borderColor="border.default" borderRadius="xl">
                          <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                            Keep commercial data concise
                          </Text>
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>
                ) : null}
              </SimpleGrid>

              {activeTable}
            </VStack>
          }
        />
        ) : null}
      </VStack>
    </ControlTowerLayout>
  );
}
