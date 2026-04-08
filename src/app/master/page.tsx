"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";

import { EmptyWorkState, InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { FilterRail } from "@/components/enterprise/PageTemplates";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

type ClientMasterOption = {
  id?: string;
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  gstOrId: string | null;
  contactPerson?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  sameAsBilling?: boolean;
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

type ContainerTypeOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

type RegistryTab = "CLIENT" | "TRANSPORTER" | "ITEM" | "WAREHOUSE" | "INACTIVE";
type ActiveRegistryTab = Exclude<RegistryTab, "INACTIVE">;
type DrawerMode = "create" | "edit";

type InactiveRegistryRow = {
  id: string;
  type: ActiveRegistryTab;
  name: string;
  detail: string;
  raw: ClientMasterOption | TransporterMasterOption | ItemMasterOption | WarehouseMasterOption;
};

const MATERIAL_TYPE_OPTIONS = [
  { value: "INHOUSE", label: "In-house" },
  { value: "TRADED", label: "Traded" },
] as const;

const ACTIVE_TABS: ActiveRegistryTab[] = ["CLIENT", "TRANSPORTER", "ITEM", "WAREHOUSE"];

const TAB_LABELS: Record<RegistryTab, string> = {
  CLIENT: "Clients",
  TRANSPORTER: "Transporters",
  ITEM: "Items",
  WAREHOUSE: "Warehouses",
  INACTIVE: "Inactive",
};

const TAB_SINGULAR_LABELS: Record<ActiveRegistryTab, string> = {
  CLIENT: "Client",
  TRANSPORTER: "Transporter",
  ITEM: "Item",
  WAREHOUSE: "Warehouse",
};

const ENDPOINT_BY_TAB: Record<ActiveRegistryTab, string> = {
  CLIENT: "/api/masters/clients",
  TRANSPORTER: "/api/masters/transporters",
  ITEM: "/api/masters/items",
  WAREHOUSE: "/api/masters/warehouses",
};

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
  if (value === "INHOUSE") return "In-house";
  if (value === "TRADED") return "Traded";
  return "Not set";
}

function MasterTypeTabs({ activeTab, onChange }: { activeTab: RegistryTab; onChange: (tab: RegistryTab) => void }) {
  return (
    <FilterRail>
      {(["CLIENT", "TRANSPORTER", "ITEM", "WAREHOUSE", "INACTIVE"] as RegistryTab[]).map((tab) => (
        <Button
          key={tab}
          size="sm"
          variant={activeTab === tab ? "solid" : "outline"}
          colorScheme={activeTab === tab ? "teal" : "gray"}
          onClick={() => onChange(tab)}
        >
          {TAB_LABELS[tab]}
        </Button>
      ))}
    </FilterRail>
  );
}

function MasterGrid<RowType>({
  rows,
  rowKey,
  columns,
  rowActions,
  recordCard,
  emptyLabel,
  filters,
}: {
  rows: RowType[];
  rowKey: (row: RowType) => string;
  columns: Parameters<typeof EnterpriseDataTable<RowType>>[0]["columns"];
  rowActions?: Parameters<typeof EnterpriseDataTable<RowType>>[0]["rowActions"];
  recordCard?: Parameters<typeof EnterpriseDataTable<RowType>>[0]["recordCard"];
  emptyLabel?: string;
  filters?: Parameters<typeof EnterpriseDataTable<RowType>>[0]["filters"];
}) {
  return (
    <EnterpriseDataTable
      rows={rows}
      rowKey={rowKey}
      columns={columns}
      rowActions={rowActions}
      recordCard={recordCard}
      emptyLabel={emptyLabel}
      filters={filters}
      rowsPerPage={{ mobile: 4, desktop: 12 }}
    />
  );
}

type MasterRegistryShellProps = {
  activeTab: RegistryTab;
  onTabChange: (tab: RegistryTab) => void;
  masterSearch: string;
  onMasterSearchChange: (value: string) => void;
  activeRecordCount: number;
  onRefresh: () => Promise<void>;
  onOpenCreate: () => void;
  disableCreate: boolean;
  disableActions: boolean;
  loading: boolean;
  kpis: Array<{ label: string; value: number }>;
  children: ReactNode;
};

function MasterRegistryShell({
  activeTab,
  onTabChange,
  masterSearch,
  onMasterSearchChange,
  activeRecordCount,
  onRefresh,
  onOpenCreate,
  disableCreate,
  disableActions,
  loading,
  kpis,
  children,
}: MasterRegistryShellProps) {
  return (
    <VStack align="stretch" spacing={5}>
      <Box>
        <HStack spacing={2} flexWrap="wrap">
          <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
            MASTER REGISTRY
          </Badge>
          <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={1}>
            ENTERPRISE CONTROL
          </Badge>
        </HStack>
        <Heading size="lg" color="text.primary" mt={2}>
          Masters
        </Heading>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} spacing={3}>
        {kpis.map((item) => (
          <Card key={item.label} variant="outline" borderRadius="2xl">
            <CardBody p={4}>
              <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                {item.label}
              </Text>
              <Text fontSize="xl" fontWeight="bold" color="text.primary" mt={1}>
                {item.value}
              </Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      <Box position="sticky" top={{ base: "72px", lg: "84px" }} zIndex={10}>
        <Card variant="outline" borderRadius="2xl">
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <MasterTypeTabs activeTab={activeTab} onChange={onTabChange} />
              <Stack direction={{ base: "column", lg: "row" }} spacing={3} justify="space-between">
                <Input
                  maxW={{ base: "full", lg: "xl" }}
                  borderRadius="xl"
                  placeholder="Search names, addresses, phone numbers, GST, UOM..."
                  value={masterSearch}
                  onChange={(event) => onMasterSearchChange(event.target.value)}
                />
                <HStack spacing={2} flexWrap="wrap" justify={{ base: "flex-start", lg: "flex-end" }}>
                  <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1}>
                    {activeRecordCount} visible
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => void onRefresh()} isLoading={loading} isDisabled={disableActions}>
                    Refresh
                  </Button>
                  <Button
                    colorScheme="teal"
                    size="sm"
                    onClick={onOpenCreate}
                    isDisabled={disableCreate || disableActions}
                  >
                    {activeTab === "INACTIVE" ? "Create disabled" : `New ${TAB_SINGULAR_LABELS[activeTab]}`}
                  </Button>
                </HStack>
              </Stack>
            </VStack>
          </CardBody>
        </Card>
      </Box>

      <Card variant="outline" borderRadius="2xl">
        <CardBody>{children}</CardBody>
      </Card>
    </VStack>
  );
}

type MasterFormDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  activeTab: RegistryTab;
  mode: DrawerMode;
  isSaving: boolean;
  onSave: () => Promise<void>;
  clientForm: {
    clientName: string;
    billToAddress: string;
    shipToAddress: string;
    gstOrId: string;
    contactPerson: string;
    contactNumber: string;
    email: string;
    sameAsBilling: boolean;
  };
  setClientForm: Dispatch<
    SetStateAction<{
      clientName: string;
      billToAddress: string;
      shipToAddress: string;
      gstOrId: string;
      contactPerson: string;
      contactNumber: string;
      email: string;
      sameAsBilling: boolean;
    }>
  >;
  transporterForm: { transporterName: string; contactPerson: string; phone: string; email: string; address: string; gstOrId: string };
  setTransporterForm: Dispatch<SetStateAction<{ transporterName: string; contactPerson: string; phone: string; email: string; address: string; gstOrId: string }>>;
  itemForm: { itemName: string; materialType: string; description: string; uom: string };
  setItemForm: Dispatch<SetStateAction<{ itemName: string; materialType: string; description: string; uom: string }>>;
  warehouseForm: { warehouseName: string; description: string };
  setWarehouseForm: Dispatch<SetStateAction<{ warehouseName: string; description: string }>>;
};

function MasterFormDrawer({
  isOpen,
  onClose,
  activeTab,
  mode,
  isSaving,
  onSave,
  clientForm,
  setClientForm,
  transporterForm,
  setTransporterForm,
  itemForm,
  setItemForm,
  warehouseForm,
  setWarehouseForm,
}: MasterFormDrawerProps) {
  if (activeTab === "INACTIVE") return null;

  const title = `${mode === "create" ? "Create" : "Edit"} ${TAB_SINGULAR_LABELS[activeTab]}`;

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size={{ base: "full", md: "lg" }}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>{title}</DrawerHeader>
        <DrawerBody>
          {activeTab === "CLIENT" ? (
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
              <HStack justify="space-between" align="start">
                <Box>
                  <Text fontSize="sm" fontWeight="medium" color="text.primary">
                    Shipping same as billing
                  </Text>
                  <Text fontSize="xs" color="text.secondary">
                    Use billing address for shipping documents by default.
                  </Text>
                </Box>
                <Switch
                  colorScheme="teal"
                  isChecked={clientForm.sameAsBilling}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      sameAsBilling: event.target.checked,
                      shipToAddress: event.target.checked ? prev.billToAddress : prev.shipToAddress,
                    }))
                  }
                />
              </HStack>
              <FormControl>
                <FormLabel fontSize="sm">GST / ID</FormLabel>
                <Input value={clientForm.gstOrId} onChange={(event) => setClientForm((prev) => ({ ...prev, gstOrId: event.target.value }))} borderRadius="xl" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Contact person</FormLabel>
                <Input value={clientForm.contactPerson} onChange={(event) => setClientForm((prev) => ({ ...prev, contactPerson: event.target.value }))} borderRadius="xl" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Contact number</FormLabel>
                <Input value={clientForm.contactNumber} onChange={(event) => setClientForm((prev) => ({ ...prev, contactNumber: event.target.value }))} borderRadius="xl" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Email</FormLabel>
                <Input value={clientForm.email} onChange={(event) => setClientForm((prev) => ({ ...prev, email: event.target.value }))} borderRadius="xl" />
              </FormControl>
            </Stack>
          ) : null}

          {activeTab === "TRANSPORTER" ? (
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
            </Stack>
          ) : null}

          {activeTab === "ITEM" ? (
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
            </Stack>
          ) : null}

          {activeTab === "WAREHOUSE" ? (
            <Stack spacing={3}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Warehouse name</FormLabel>
                <Input value={warehouseForm.warehouseName} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, warehouseName: event.target.value }))} borderRadius="xl" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Description</FormLabel>
                <Input value={warehouseForm.description} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, description: event.target.value }))} borderRadius="xl" />
              </FormControl>
            </Stack>
          ) : null}
        </DrawerBody>
        <DrawerFooter>
          <HStack spacing={3}>
            <Button variant="outline" onClick={onClose} isDisabled={isSaving}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={() => void onSave()} isLoading={isSaving}>
              Save
            </Button>
          </HStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default function MasterPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<RegistryTab>("CLIENT");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [clients, setClients] = useState<ClientMasterOption[]>([]);
  const [transporters, setTransporters] = useState<TransporterMasterOption[]>([]);
  const [items, setItems] = useState<ItemMasterOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseMasterOption[]>([]);

  const [inactiveClients, setInactiveClients] = useState<ClientMasterOption[]>([]);
  const [inactiveTransporters, setInactiveTransporters] = useState<TransporterMasterOption[]>([]);
  const [inactiveItems, setInactiveItems] = useState<ItemMasterOption[]>([]);
  const [inactiveWarehouses, setInactiveWarehouses] = useState<WarehouseMasterOption[]>([]);

  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [masterSearch, setMasterSearch] = useState("");
  const [containerTypes, setContainerTypes] = useState<ContainerTypeOption[]>([]);
  const [containerTypeName, setContainerTypeName] = useState("");

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
  const [transporterForm, setTransporterForm] = useState({
    transporterName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    gstOrId: "",
  });
  const [itemForm, setItemForm] = useState({ itemName: "", materialType: "", description: "", uom: "" });
  const [warehouseForm, setWarehouseForm] = useState({ warehouseName: "", description: "" });

  const masterSearchTerm = masterSearch.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    if (!masterSearchTerm) return clients;
    return clients.filter((row) => `${row.clientName} ${row.billToAddress} ${row.shipToAddress} ${row.gstOrId ?? ""}`.toLowerCase().includes(masterSearchTerm));
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
    return items.filter((row) => `${row.itemName} ${row.materialType ?? ""} ${row.description ?? ""} ${row.uom ?? ""}`.toLowerCase().includes(masterSearchTerm));
  }, [items, masterSearchTerm]);

  const filteredWarehouses = useMemo(() => {
    if (!masterSearchTerm) return warehouses;
    return warehouses.filter((row) => `${row.warehouseName} ${row.description ?? ""}`.toLowerCase().includes(masterSearchTerm));
  }, [masterSearchTerm, warehouses]);

  const filteredInactiveClients = useMemo(() => {
    if (!masterSearchTerm) return inactiveClients;
    return inactiveClients.filter((row) => `${row.clientName} ${row.billToAddress} ${row.shipToAddress} ${row.gstOrId ?? ""}`.toLowerCase().includes(masterSearchTerm));
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
    return inactiveItems.filter((row) => `${row.itemName} ${row.materialType ?? ""} ${row.description ?? ""} ${row.uom ?? ""}`.toLowerCase().includes(masterSearchTerm));
  }, [inactiveItems, masterSearchTerm]);

  const filteredInactiveWarehouses = useMemo(() => {
    if (!masterSearchTerm) return inactiveWarehouses;
    return inactiveWarehouses.filter((row) => `${row.warehouseName} ${row.description ?? ""}`.toLowerCase().includes(masterSearchTerm));
  }, [inactiveWarehouses, masterSearchTerm]);

  const inactiveRows = useMemo<InactiveRegistryRow[]>(
    () => [
      ...filteredInactiveClients.map((row) => ({
        id: `CLIENT:${row.clientName}`,
        type: "CLIENT" as const,
        name: row.clientName,
        detail: row.gstOrId ?? "No GST / ID",
        raw: row,
      })),
      ...filteredInactiveTransporters.map((row) => ({
        id: `TRANSPORTER:${row.transporterName}`,
        type: "TRANSPORTER" as const,
        name: row.transporterName,
        detail: row.phone ?? row.email ?? "No contact",
        raw: row,
      })),
      ...filteredInactiveItems.map((row) => ({
        id: `ITEM:${row.itemName}`,
        type: "ITEM" as const,
        name: row.itemName,
        detail: `${formatMaterialTypeLabel(row.materialType)}${row.uom ? ` • ${row.uom}` : ""}`,
        raw: row,
      })),
      ...filteredInactiveWarehouses.map((row) => ({
        id: `WAREHOUSE:${row.warehouseName}`,
        type: "WAREHOUSE" as const,
        name: row.warehouseName,
        detail: row.description ?? "No description",
        raw: row,
      })),
    ],
    [filteredInactiveClients, filteredInactiveItems, filteredInactiveTransporters, filteredInactiveWarehouses]
  );

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
        return inactiveRows.length;
    }
  }, [activeTab, filteredClients.length, filteredItems.length, filteredTransporters.length, filteredWarehouses.length, inactiveRows.length]);

  const loadDispatchMasters = useCallback(async () => {
    setMasterDataLoading(true);
    setLoadError(null);
    try {
      const [
        clientRes,
        transporterRes,
        itemRes,
        warehouseRes,
        containerTypeRes,
        inactiveClientRes,
        inactiveTransporterRes,
        inactiveItemRes,
        inactiveWarehouseRes,
      ] = await Promise.all([
        fetch("/api/masters/clients"),
        fetch("/api/masters/transporters"),
        fetch("/api/masters/items"),
        fetch("/api/masters/warehouses"),
        fetch("/api/masters/container-types"),
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
        !containerTypeRes.ok ||
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
                : !containerTypeRes.ok
                  ? containerTypeRes
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
        containerTypeData,
        inactiveClientData,
        inactiveTransporterData,
        inactiveItemData,
        inactiveWarehouseData,
      ] = await Promise.all([
        clientRes.json() as Promise<ClientMasterOption[]>,
        transporterRes.json() as Promise<TransporterMasterOption[]>,
        itemRes.json() as Promise<ItemMasterOption[]>,
        warehouseRes.json() as Promise<WarehouseMasterOption[]>,
        containerTypeRes.json() as Promise<ContainerTypeOption[]>,
        inactiveClientRes.json() as Promise<ClientMasterOption[]>,
        inactiveTransporterRes.json() as Promise<TransporterMasterOption[]>,
        inactiveItemRes.json() as Promise<ItemMasterOption[]>,
        inactiveWarehouseRes.json() as Promise<WarehouseMasterOption[]>,
      ]);

      setClients(Array.isArray(clientData) ? clientData : []);
      setTransporters(Array.isArray(transporterData) ? transporterData : []);
      setItems(Array.isArray(itemData) ? itemData : []);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setContainerTypes(Array.isArray(containerTypeData) ? containerTypeData : []);
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

  const resetFormForTab = useCallback((tab: ActiveRegistryTab) => {
    if (tab === "CLIENT") setClientForm({ clientName: "", billToAddress: "", shipToAddress: "", gstOrId: "", contactPerson: "", contactNumber: "", email: "", sameAsBilling: true });
    if (tab === "TRANSPORTER") setTransporterForm({ transporterName: "", contactPerson: "", phone: "", email: "", address: "", gstOrId: "" });
    if (tab === "ITEM") setItemForm({ itemName: "", materialType: "", description: "", uom: "" });
    if (tab === "WAREHOUSE") setWarehouseForm({ warehouseName: "", description: "" });
  }, []);

  const openCreateDrawer = useCallback(() => {
    if (activeTab === "INACTIVE") return;
    setDrawerMode("create");
    resetFormForTab(activeTab);
    setIsDrawerOpen(true);
  }, [activeTab, resetFormForTab]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setDrawerMode("create");
  }, []);

  const submitMasterForm = useCallback(async () => {
    if (activeTab === "INACTIVE") return;

    let payload: Record<string, unknown> | null = null;
    let validationMessage: string | null = null;

    if (activeTab === "CLIENT") {
      if (!clientForm.clientName.trim() || !clientForm.billToAddress.trim() || !clientForm.shipToAddress.trim()) {
        validationMessage = "Client name, bill-to, and ship-to are required";
      } else {
        payload = {
          clientName: clientForm.clientName.trim(),
          billToAddress: clientForm.billToAddress.trim(),
          shipToAddress: (clientForm.sameAsBilling ? clientForm.billToAddress : clientForm.shipToAddress).trim(),
          gstOrId: clientForm.gstOrId.trim() || undefined,
          contactPerson: clientForm.contactPerson.trim() || undefined,
          contactNumber: clientForm.contactNumber.trim() || undefined,
          email: clientForm.email.trim() || undefined,
          sameAsBilling: clientForm.sameAsBilling,
        };
      }
    }

    if (activeTab === "TRANSPORTER") {
      if (!transporterForm.transporterName.trim()) {
        validationMessage = "Transporter name is required";
      } else {
        payload = {
          transporterName: transporterForm.transporterName.trim(),
          contactPerson: transporterForm.contactPerson.trim() || undefined,
          phone: transporterForm.phone.trim() || undefined,
          email: transporterForm.email.trim() || undefined,
          address: transporterForm.address.trim() || undefined,
          gstOrId: transporterForm.gstOrId.trim() || undefined,
        };
      }
    }

    if (activeTab === "ITEM") {
      if (!itemForm.itemName.trim()) {
        validationMessage = "Item name is required";
      } else if (!itemForm.materialType) {
        validationMessage = "Material type is required";
      } else {
        payload = {
          itemName: itemForm.itemName.trim(),
          materialType: itemForm.materialType,
          description: itemForm.description.trim() || undefined,
          uom: itemForm.uom.trim() || undefined,
        };
      }
    }

    if (activeTab === "WAREHOUSE") {
      if (!warehouseForm.warehouseName.trim()) {
        validationMessage = "Warehouse name is required";
      } else {
        payload = {
          warehouseName: warehouseForm.warehouseName.trim(),
          description: warehouseForm.description.trim() || undefined,
        };
      }
    }

    if (validationMessage) {
      toast({ title: validationMessage, status: "warning" });
      return;
    }

    if (!payload) return;

    setActionBusyKey("drawer-save");
    try {
      const response = await fetch(ENDPOINT_BY_TAB[activeTab], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const responsePayload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(responsePayload, `Failed to save ${TAB_SINGULAR_LABELS[activeTab].toLowerCase()} master.`));
      }
      toast({ title: `${TAB_SINGULAR_LABELS[activeTab]} master saved`, status: "success" });
      resetFormForTab(activeTab);
      closeDrawer();
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setActionBusyKey(null);
    }
  }, [
    activeTab,
    clientForm.billToAddress,
    clientForm.clientName,
    clientForm.contactNumber,
    clientForm.contactPerson,
    clientForm.email,
    clientForm.gstOrId,
    clientForm.sameAsBilling,
    clientForm.shipToAddress,
    closeDrawer,
    itemForm.description,
    itemForm.itemName,
    itemForm.materialType,
    itemForm.uom,
    loadDispatchMasters,
    resetFormForTab,
    toast,
    transporterForm.address,
    transporterForm.contactPerson,
    transporterForm.email,
    transporterForm.gstOrId,
    transporterForm.phone,
    transporterForm.transporterName,
    warehouseForm.description,
    warehouseForm.warehouseName,
  ]);

  const setMasterStatus = useCallback(
    async (tab: ActiveRegistryTab, row: ClientMasterOption | TransporterMasterOption | ItemMasterOption | WarehouseMasterOption, isActive: boolean) => {
      const busyKey = `${tab}-${isActive ? "reactivate" : "deactivate"}`;
      setActionBusyKey(busyKey);

      let payload: Record<string, unknown>;
      if (tab === "CLIENT") {
        const typed = row as ClientMasterOption;
        payload = {
          clientName: typed.clientName,
          billToAddress: typed.billToAddress,
          shipToAddress: typed.shipToAddress,
          gstOrId: typed.gstOrId ?? undefined,
          contactPerson: typed.contactPerson ?? undefined,
          contactNumber: typed.contactNumber ?? undefined,
          email: typed.email ?? undefined,
          sameAsBilling: typed.sameAsBilling ?? typed.billToAddress === typed.shipToAddress,
          isActive,
        };
      } else if (tab === "TRANSPORTER") {
        const typed = row as TransporterMasterOption;
        payload = {
          transporterName: typed.transporterName,
          contactPerson: typed.contactPerson ?? undefined,
          phone: typed.phone ?? undefined,
          email: typed.email ?? undefined,
          address: typed.address ?? undefined,
          gstOrId: typed.gstOrId ?? undefined,
          isActive,
        };
      } else if (tab === "ITEM") {
        const typed = row as ItemMasterOption;
        payload = {
          itemName: typed.itemName,
          materialType: typed.materialType ?? undefined,
          description: typed.description ?? undefined,
          uom: typed.uom ?? undefined,
          isActive,
        };
      } else {
        const typed = row as WarehouseMasterOption;
        payload = {
          warehouseName: typed.warehouseName,
          description: typed.description ?? undefined,
          isActive,
        };
      }

      try {
        const response = await fetch(ENDPOINT_BY_TAB[tab], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const responsePayload = (await response.json().catch(() => null)) as unknown;
          throw new Error(toDetails(responsePayload, `Failed to ${isActive ? "reactivate" : "deactivate"} ${TAB_SINGULAR_LABELS[tab].toLowerCase()}.`));
        }

        toast({ title: `${TAB_SINGULAR_LABELS[tab]} ${isActive ? "reactivated" : "deactivated"}`, status: "success" });
        await loadDispatchMasters();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed.";
        toast({ title: `${isActive ? "Re-activate" : "Deactivate"} failed`, description: message, status: "error" });
      } finally {
        setActionBusyKey(null);
      }
    },
    [loadDispatchMasters, toast]
  );

  const openEditForClient = useCallback((row: ClientMasterOption) => {
    setActiveTab("CLIENT");
    setDrawerMode("edit");
    setClientForm({
      clientName: row.clientName,
      billToAddress: row.billToAddress,
      shipToAddress: row.shipToAddress,
      gstOrId: row.gstOrId ?? "",
      contactPerson: row.contactPerson ?? "",
      contactNumber: row.contactNumber ?? "",
      email: row.email ?? "",
      sameAsBilling: row.sameAsBilling ?? row.billToAddress === row.shipToAddress,
    });
    setIsDrawerOpen(true);
  }, []);

  const openEditForTransporter = useCallback((row: TransporterMasterOption) => {
    setActiveTab("TRANSPORTER");
    setDrawerMode("edit");
    setTransporterForm({
      transporterName: row.transporterName,
      contactPerson: row.contactPerson ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      gstOrId: row.gstOrId ?? "",
    });
    setIsDrawerOpen(true);
  }, []);

  const openEditForItem = useCallback((row: ItemMasterOption) => {
    setActiveTab("ITEM");
    setDrawerMode("edit");
    setItemForm({
      itemName: row.itemName,
      materialType: row.materialType ?? "",
      description: row.description ?? "",
      uom: row.uom ?? "",
    });
    setIsDrawerOpen(true);
  }, []);

  const openEditForWarehouse = useCallback((row: WarehouseMasterOption) => {
    setActiveTab("WAREHOUSE");
    setDrawerMode("edit");
    setWarehouseForm({ warehouseName: row.warehouseName, description: row.description ?? "" });
    setIsDrawerOpen(true);
  }, []);

  const createContainerType = useCallback(async () => {
    if (!containerTypeName.trim()) {
      toast({ title: "Container type name is required", status: "warning" });
      return;
    }

    setActionBusyKey("container-type-save");
    try {
      const response = await fetch("/api/masters/container-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: containerTypeName.trim(), isActive: true }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(toDetails(payload, "Failed to save container type."));
      }

      setContainerTypeName("");
      toast({ title: "Container type saved", status: "success" });
      await loadDispatchMasters();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save container type.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setActionBusyKey(null);
    }
  }, [containerTypeName, loadDispatchMasters, toast]);

  const tableContent = (() => {
    const actionsDisabled = Boolean(actionBusyKey);

    if (activeTab === "CLIENT") {
      return (
        <MasterGrid
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
            { id: "edit", label: "Edit", onClick: openEditForClient, isDisabled: () => actionsDisabled },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void setMasterStatus("CLIENT", row, false),
              isDisabled: () => actionsDisabled,
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
        <MasterGrid
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
            { id: "edit", label: "Edit", onClick: openEditForTransporter, isDisabled: () => actionsDisabled },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void setMasterStatus("TRANSPORTER", row, false),
              isDisabled: () => actionsDisabled,
            },
          ]}
          recordCard={{
            title: (row) => row.transporterName,
            subtitle: (row) => row.phone ?? "No phone",
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
        <MasterGrid
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
            { id: "edit", label: "Edit", onClick: openEditForItem, isDisabled: () => actionsDisabled },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void setMasterStatus("ITEM", row, false),
              isDisabled: () => actionsDisabled,
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
        <MasterGrid
          rows={filteredWarehouses}
          rowKey={(row) => row.warehouseName}
          filters={[{ id: "search", label: "Search", value: masterSearch || "All active warehouses" }]}
          emptyLabel="No active warehouse records found."
          columns={[
            { id: "warehouse", header: "Warehouse", render: (row) => row.warehouseName },
            { id: "description", header: "Description", render: (row) => row.description ?? "—" },
          ]}
          rowActions={[
            { id: "edit", label: "Edit", onClick: openEditForWarehouse, isDisabled: () => actionsDisabled },
            {
              id: "deactivate",
              label: "Set inactive",
              onClick: (row) => void setMasterStatus("WAREHOUSE", row, false),
              isDisabled: () => actionsDisabled,
            },
          ]}
          recordCard={{
            title: (row) => row.warehouseName,
            subtitle: (row) => row.description ?? "No description",
          }}
        />
      );
    }

    if (inactiveRows.length === 0) {
      return (
        <EmptyWorkState
          title="No inactive master records"
          description="Disabled records will appear here so they can be restored without creating duplicates."
        />
      );
    }

    return (
      <MasterGrid
        rows={inactiveRows}
        rowKey={(row) => row.id}
        filters={[{ id: "search", label: "Search", value: masterSearch || "All inactive records" }]}
        emptyLabel="No inactive records found."
        columns={[
          { id: "type", header: "Type", render: (row) => TAB_LABELS[row.type] },
          { id: "name", header: "Name", render: (row) => row.name },
          { id: "detail", header: "Detail", render: (row) => row.detail },
        ]}
        rowActions={[
          {
            id: "reactivate",
            label: "Set active",
            onClick: (row) => void setMasterStatus(row.type, row.raw, true),
            isDisabled: () => actionsDisabled,
          },
        ]}
        recordCard={{
          title: (row) => row.name,
          subtitle: (row) => `${TAB_LABELS[row.type]} • ${row.detail}`,
          fields: [{ id: "type", label: "Type", render: (row) => TAB_LABELS[row.type] }],
        }}
      />
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
        <InlineErrorState title="Master registry unavailable" description={loadError} onRetry={() => void loadDispatchMasters()} />
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <MasterRegistryShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        masterSearch={masterSearch}
        onMasterSearchChange={setMasterSearch}
        activeRecordCount={activeRecordCount}
        onRefresh={loadDispatchMasters}
        onOpenCreate={openCreateDrawer}
        disableCreate={activeTab === "INACTIVE"}
        disableActions={Boolean(actionBusyKey)}
        loading={masterDataLoading}
        kpis={[
          { label: "Active clients", value: clients.length },
          { label: "Active transporters", value: transporters.length },
          { label: "Active items", value: items.length },
          { label: "Active warehouses", value: warehouses.length },
          {
            label: "Inactive records",
            value: inactiveClients.length + inactiveTransporters.length + inactiveItems.length + inactiveWarehouses.length,
          },
        ]}
      >
        {tableContent}
      </MasterRegistryShell>

      <Card variant="outline" borderRadius="2xl" mt={5}>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between" align={{ base: "start", md: "center" }} flexWrap="wrap">
              <Box>
                <Heading size="md" color="text.primary">
                  Container Types
                </Heading>
                <Text fontSize="sm" color="text.secondary">
                  Sampling uses this master list for the container type dropdown in the unified workflow.
                </Text>
              </Box>
              <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={3} py={1}>
                {containerTypes.length} active
              </Badge>
            </HStack>
            <HStack align="end" spacing={3} flexWrap="wrap">
              <FormControl maxW="360px">
                <FormLabel fontSize="sm">New container type</FormLabel>
                <Input
                  value={containerTypeName}
                  onChange={(event) => setContainerTypeName(event.target.value)}
                  placeholder="Bag, Bottle, Drum, Box..."
                  borderRadius="xl"
                />
              </FormControl>
              <Button
                colorScheme="teal"
                onClick={() => void createContainerType()}
                isLoading={actionBusyKey === "container-type-save"}
              >
                Save Container Type
              </Button>
            </HStack>
            <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" px={4} py={3}>
              {containerTypes.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  No container types configured yet.
                </Text>
              ) : (
                <List spacing={2}>
                  {containerTypes.map((row) => (
                    <ListItem key={row.id}>
                      <Text color="text.primary">{row.name}</Text>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </VStack>
        </CardBody>
      </Card>

      <MasterFormDrawer
        isOpen={isDrawerOpen && ACTIVE_TABS.includes(activeTab as ActiveRegistryTab)}
        onClose={closeDrawer}
        activeTab={activeTab}
        mode={drawerMode}
        isSaving={actionBusyKey === "drawer-save"}
        onSave={submitMasterForm}
        clientForm={clientForm}
        setClientForm={setClientForm}
        transporterForm={transporterForm}
        setTransporterForm={setTransporterForm}
        itemForm={itemForm}
        setItemForm={setItemForm}
        warehouseForm={warehouseForm}
        setWarehouseForm={setWarehouseForm}
      />
    </ControlTowerLayout>
  );
}
