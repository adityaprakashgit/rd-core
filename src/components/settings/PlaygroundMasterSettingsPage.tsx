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
  SimpleGrid,
  Switch,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Database, FlaskConical, Save, Trash2 } from "lucide-react";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

type MasterType = "STEP" | "CHEMICAL" | "ASSET" | "UNIT" | "TEMPLATE";
type MasterRecord = Record<string, unknown> & { id: string };

type StepForm = {
  id: string;
  name: string;
  category: string;
  defaultDurationSeconds: string;
  requiresTimer: boolean;
  allowsChemicals: boolean;
  allowsAssets: boolean;
  requiresAsset: boolean;
  isActive: boolean;
};

type ChemicalForm = {
  id: string;
  name: string;
  code: string;
  category: string;
  baseUnit: string;
  allowedUnits: string;
  stockQuantity: string;
  reorderLevel: string;
  location: string;
  isActive: boolean;
};

type AssetForm = {
  id: string;
  name: string;
  code: string;
  category: string;
  availability: "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "UNAVAILABLE";
  location: string;
  calibrationDate: string;
  isActive: boolean;
};

type UnitForm = {
  id: string;
  unitCode: string;
  category: "VOLUME" | "WEIGHT" | "COUNT";
  conversionToBase: string;
  isActive: boolean;
};

type TemplateForm = {
  id: string;
  name: string;
  notes: string;
  stepNames: string;
  expectedMeasurements: string;
  isActive: boolean;
};

type FormState = StepForm | ChemicalForm | AssetForm | UnitForm | TemplateForm;

const masterTypes: Array<{ type: MasterType; label: string; helper: string }> = [
  { type: "STEP", label: "Step Master", helper: "Process step definitions and controls" },
  { type: "CHEMICAL", label: "Chemical Master", helper: "Chemicals, units, and stock fields" },
  { type: "ASSET", label: "Asset Master", helper: "Equipment and availability records" },
  { type: "UNIT", label: "Unit Master", helper: "Unit categories and conversions" },
  { type: "TEMPLATE", label: "Template Master", helper: "Reusable experiment flow templates" },
];

function csvToArray(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCsv(value: unknown) {
  return Array.isArray(value) ? value.map((v) => String(v)).join(", ") : "";
}

function baseForm(type: MasterType): FormState {
  const ts = Date.now();
  switch (type) {
    case "STEP":
      return {
        id: `step-${ts}`,
        name: "",
        category: "",
        defaultDurationSeconds: "600",
        requiresTimer: true,
        allowsChemicals: true,
        allowsAssets: true,
        requiresAsset: false,
        isActive: true,
      };
    case "CHEMICAL":
      return {
        id: `chem-${ts}`,
        name: "",
        code: "",
        category: "",
        baseUnit: "ml",
        allowedUnits: "ml, l",
        stockQuantity: "0",
        reorderLevel: "0",
        location: "",
        isActive: true,
      };
    case "ASSET":
      return {
        id: `asset-${ts}`,
        name: "",
        code: "",
        category: "",
        availability: "AVAILABLE",
        location: "",
        calibrationDate: "",
        isActive: true,
      };
    case "UNIT":
      return {
        id: `unit-${ts}`,
        unitCode: "",
        category: "COUNT",
        conversionToBase: "1",
        isActive: true,
      };
    case "TEMPLATE":
      return {
        id: `tpl-${ts}`,
        name: "",
        notes: "",
        stepNames: "",
        expectedMeasurements: "",
        isActive: true,
      };
  }
}

function recordToForm(type: MasterType, row: MasterRecord): FormState {
  switch (type) {
    case "STEP":
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        category: String(row.category ?? ""),
        defaultDurationSeconds: String(row.defaultDurationSeconds ?? "600"),
        requiresTimer: Boolean(row.requiresTimer),
        allowsChemicals: Boolean(row.allowsChemicals),
        allowsAssets: Boolean(row.allowsAssets),
        requiresAsset: Boolean(row.requiresAsset),
        isActive: Boolean(row.isActive),
      };
    case "CHEMICAL":
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        code: String(row.code ?? ""),
        category: String(row.category ?? ""),
        baseUnit: String(row.baseUnit ?? "ml"),
        allowedUnits: arrayToCsv(row.allowedUnits),
        stockQuantity: String(row.stockQuantity ?? "0"),
        reorderLevel: String(row.reorderLevel ?? "0"),
        location: String(row.location ?? ""),
        isActive: Boolean(row.isActive),
      };
    case "ASSET":
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        code: String(row.code ?? ""),
        category: String(row.category ?? ""),
        availability: String(row.availability ?? "AVAILABLE") as AssetForm["availability"],
        location: String(row.location ?? ""),
        calibrationDate: String(row.calibrationDate ?? ""),
        isActive: Boolean(row.isActive),
      };
    case "UNIT":
      return {
        id: String(row.id),
        unitCode: String(row.unitCode ?? ""),
        category: String(row.category ?? "COUNT") as UnitForm["category"],
        conversionToBase: String(row.conversionToBase ?? "1"),
        isActive: Boolean(row.isActive),
      };
    case "TEMPLATE":
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        notes: String(row.notes ?? ""),
        stepNames: arrayToCsv(row.stepNames),
        expectedMeasurements: arrayToCsv(row.expectedMeasurements),
        isActive: Boolean(row.isActive),
      };
  }
}

function formToPayload(type: MasterType, form: FormState): Record<string, unknown> {
  switch (type) {
    case "STEP": {
      const f = form as StepForm;
      return {
        id: f.id,
        name: f.name,
        category: f.category,
        defaultDurationSeconds: Number(f.defaultDurationSeconds || 0),
        requiresTimer: f.requiresTimer,
        allowsChemicals: f.allowsChemicals,
        allowsAssets: f.allowsAssets,
        requiresAsset: f.requiresAsset,
        isActive: f.isActive,
      };
    }
    case "CHEMICAL": {
      const f = form as ChemicalForm;
      return {
        id: f.id,
        name: f.name,
        code: f.code,
        category: f.category,
        baseUnit: f.baseUnit,
        allowedUnits: csvToArray(f.allowedUnits),
        stockQuantity: Number(f.stockQuantity || 0),
        reorderLevel: Number(f.reorderLevel || 0),
        location: f.location,
        isActive: f.isActive,
      };
    }
    case "ASSET": {
      const f = form as AssetForm;
      return {
        id: f.id,
        name: f.name,
        code: f.code,
        category: f.category,
        availability: f.availability,
        location: f.location,
        calibrationDate: f.calibrationDate,
        isActive: f.isActive,
      };
    }
    case "UNIT": {
      const f = form as UnitForm;
      return {
        id: f.id,
        unitCode: f.unitCode,
        category: f.category,
        conversionToBase: Number(f.conversionToBase || 1),
        isActive: f.isActive,
      };
    }
    case "TEMPLATE": {
      const f = form as TemplateForm;
      return {
        id: f.id,
        name: f.name,
        notes: f.notes,
        stepNames: csvToArray(f.stepNames),
        expectedMeasurements: csvToArray(f.expectedMeasurements),
        isActive: f.isActive,
      };
    }
  }
}

function summarize(row: MasterRecord, type: MasterType) {
  if (type === "STEP") return `${String(row.name ?? row.id)} • ${String(row.category ?? "")}`;
  if (type === "CHEMICAL") return `${String(row.name ?? row.id)} • ${String(row.baseUnit ?? "")}`;
  if (type === "ASSET") return `${String(row.name ?? row.id)} • ${String(row.availability ?? "")}`;
  if (type === "UNIT") return `${String(row.unitCode ?? row.id)} • ${String(row.category ?? "")}`;
  return `${String(row.name ?? row.id)} • ${arrayToCsv(row.stepNames)}`;
}

export default function SettingsPage() {
  const toast = useToast();
  const [activeType, setActiveType] = useState<MasterType>("STEP");
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [form, setForm] = useState<FormState>(baseForm("STEP"));

  const activeMeta = useMemo(() => masterTypes.find((item) => item.type === activeType), [activeType]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rd/playground/masters?type=${activeType}`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as MasterRecord[];
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load master records", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [activeType, toast]);

  useEffect(() => {
    setEditingId("");
    setForm(baseForm(activeType));
    void fetchRecords();
  }, [activeType, fetchRecords]);

  const resetForm = () => {
    setEditingId("");
    setForm(baseForm(activeType));
  };

  const saveForm = async () => {
    const payload = formToPayload(activeType, form);
    if (!payload.id || !payload.name && activeType !== "UNIT") {
      toast({ title: "Please fill required fields", status: "warning" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/rd/playground/masters", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? { type: activeType, id: editingId, data: payload }
            : { type: activeType, data: payload }
        ),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: editingId ? "Record updated" : "Record created", status: "success" });
      resetForm();
      await fetchRecords();
    } catch {
      toast({ title: "Save failed", status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const res = await fetch("/api/rd/playground/masters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeType, id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      if (editingId === id) resetForm();
      toast({ title: "Record deleted", status: "success" });
      await fetchRecords();
    } catch {
      toast({ title: "Delete failed", status: "error" });
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack spacing={2}>
            <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={2.5} py={1}>
              PLAYGROUND SETTINGS
            </Badge>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={1}>
              FORM UX
            </Badge>
          </HStack>
          <Heading size="lg" color="gray.900" mt={2}>
            Playground Master Management
          </Heading>
          <Text color="gray.600" mt={2}>
            Faster non-JSON setup for Step, Chemical, Asset, Unit, and Template masters.
          </Text>
        </Box>

        <HStack spacing={2} wrap="wrap">
          {masterTypes.map((item) => (
            <Button
              key={item.type}
              size="sm"
              variant={activeType === item.type ? "solid" : "outline"}
              colorScheme={activeType === item.type ? "teal" : "gray"}
              onClick={() => setActiveType(item.type)}
            >
              {item.label}
            </Button>
          ))}
        </HStack>

        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={6}>
              <HStack mb={4}>
                <Box p={2.5} bg="teal.50" color="teal.600" borderRadius="xl">
                  <Database size={18} />
                </Box>
                <Box>
                  <Heading size="sm" color="gray.900">
                    {editingId ? "Edit" : "Create"} {activeMeta?.label}
                  </Heading>
                  <Text fontSize="sm" color="gray.600">{activeMeta?.helper}</Text>
                </Box>
              </HStack>

              <VStack align="stretch" spacing={3}>
                <FormControl>
                  <FormLabel>ID</FormLabel>
                  <Input value={String(form.id ?? "")} onChange={(e) => updateField("id", e.target.value)} isDisabled={Boolean(editingId)} />
                </FormControl>

                {activeType === "STEP" ? (
                  <>
                    <FormControl><FormLabel>Name</FormLabel><Input value={String((form as StepForm).name)} onChange={(e) => updateField("name", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Category</FormLabel><Input value={String((form as StepForm).category)} onChange={(e) => updateField("category", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Default Duration (sec)</FormLabel><Input type="number" value={String((form as StepForm).defaultDurationSeconds)} onChange={(e) => updateField("defaultDurationSeconds", e.target.value)} /></FormControl>
                    <HStack justify="space-between"><Text>Requires Timer</Text><Switch isChecked={(form as StepForm).requiresTimer} onChange={(e) => updateField("requiresTimer", e.target.checked)} /></HStack>
                    <HStack justify="space-between"><Text>Allows Chemicals</Text><Switch isChecked={(form as StepForm).allowsChemicals} onChange={(e) => updateField("allowsChemicals", e.target.checked)} /></HStack>
                    <HStack justify="space-between"><Text>Allows Assets</Text><Switch isChecked={(form as StepForm).allowsAssets} onChange={(e) => updateField("allowsAssets", e.target.checked)} /></HStack>
                    <HStack justify="space-between"><Text>Requires Asset</Text><Switch isChecked={(form as StepForm).requiresAsset} onChange={(e) => updateField("requiresAsset", e.target.checked)} /></HStack>
                  </>
                ) : null}

                {activeType === "CHEMICAL" ? (
                  <>
                    <FormControl><FormLabel>Name</FormLabel><Input value={String((form as ChemicalForm).name)} onChange={(e) => updateField("name", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Code</FormLabel><Input value={String((form as ChemicalForm).code)} onChange={(e) => updateField("code", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Category</FormLabel><Input value={String((form as ChemicalForm).category)} onChange={(e) => updateField("category", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Base Unit</FormLabel><Input value={String((form as ChemicalForm).baseUnit)} onChange={(e) => updateField("baseUnit", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Allowed Units (comma separated)</FormLabel><Input value={String((form as ChemicalForm).allowedUnits)} onChange={(e) => updateField("allowedUnits", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Stock Quantity</FormLabel><Input type="number" value={String((form as ChemicalForm).stockQuantity)} onChange={(e) => updateField("stockQuantity", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Reorder Level</FormLabel><Input type="number" value={String((form as ChemicalForm).reorderLevel)} onChange={(e) => updateField("reorderLevel", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Location</FormLabel><Input value={String((form as ChemicalForm).location)} onChange={(e) => updateField("location", e.target.value)} /></FormControl>
                  </>
                ) : null}

                {activeType === "ASSET" ? (
                  <>
                    <FormControl><FormLabel>Name</FormLabel><Input value={String((form as AssetForm).name)} onChange={(e) => updateField("name", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Code</FormLabel><Input value={String((form as AssetForm).code)} onChange={(e) => updateField("code", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Category</FormLabel><Input value={String((form as AssetForm).category)} onChange={(e) => updateField("category", e.target.value)} /></FormControl>
                    <FormControl>
                      <FormLabel>Availability</FormLabel>
                      <Select value={(form as AssetForm).availability} onChange={(e) => updateField("availability", e.target.value as AssetForm["availability"])}>
                        <option value="AVAILABLE">AVAILABLE</option>
                        <option value="IN_USE">IN_USE</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="UNAVAILABLE">UNAVAILABLE</option>
                      </Select>
                    </FormControl>
                    <FormControl><FormLabel>Location</FormLabel><Input value={String((form as AssetForm).location)} onChange={(e) => updateField("location", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Calibration Date</FormLabel><Input type="date" value={String((form as AssetForm).calibrationDate)} onChange={(e) => updateField("calibrationDate", e.target.value)} /></FormControl>
                  </>
                ) : null}

                {activeType === "UNIT" ? (
                  <>
                    <FormControl><FormLabel>Unit Code</FormLabel><Input value={String((form as UnitForm).unitCode)} onChange={(e) => updateField("unitCode", e.target.value)} /></FormControl>
                    <FormControl>
                      <FormLabel>Category</FormLabel>
                      <Select value={(form as UnitForm).category} onChange={(e) => updateField("category", e.target.value as UnitForm["category"])}>
                        <option value="VOLUME">VOLUME</option>
                        <option value="WEIGHT">WEIGHT</option>
                        <option value="COUNT">COUNT</option>
                      </Select>
                    </FormControl>
                    <FormControl><FormLabel>Conversion to Base</FormLabel><Input type="number" value={String((form as UnitForm).conversionToBase)} onChange={(e) => updateField("conversionToBase", e.target.value)} /></FormControl>
                  </>
                ) : null}

                {activeType === "TEMPLATE" ? (
                  <>
                    <FormControl><FormLabel>Name</FormLabel><Input value={String((form as TemplateForm).name)} onChange={(e) => updateField("name", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Notes</FormLabel><Input value={String((form as TemplateForm).notes)} onChange={(e) => updateField("notes", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Step Names (comma separated)</FormLabel><Input value={String((form as TemplateForm).stepNames)} onChange={(e) => updateField("stepNames", e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Expected Measurements (comma separated)</FormLabel><Input value={String((form as TemplateForm).expectedMeasurements)} onChange={(e) => updateField("expectedMeasurements", e.target.value)} /></FormControl>
                  </>
                ) : null}

                <Divider />
                <HStack justify="space-between"><Text>Active</Text><Switch isChecked={Boolean(form.isActive)} onChange={(e) => updateField("isActive", e.target.checked)} /></HStack>

                <HStack justify="end" spacing={2}>
                  <Button variant="ghost" onClick={resetForm}>Reset</Button>
                  <Button leftIcon={<Save size={15} />} colorScheme="teal" onClick={saveForm} isLoading={saving}>
                    {editingId ? "Update" : "Create"}
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={6}>
              <HStack justify="space-between" mb={4}>
                <HStack>
                  <Box p={2.5} bg="purple.50" color="purple.600" borderRadius="xl">
                    <FlaskConical size={18} />
                  </Box>
                  <Box>
                    <Heading size="sm" color="gray.900">Existing Records</Heading>
                    <Text fontSize="sm" color="gray.600">{loading ? "Loading..." : `${records.length} record(s)`}</Text>
                  </Box>
                </HStack>
                <Button size="sm" variant="outline" onClick={() => void fetchRecords()}>Refresh</Button>
              </HStack>

              <VStack align="stretch" spacing={2} maxH="640px" overflowY="auto" pr={1}>
                {records.map((row) => (
                  <HStack key={row.id} p={2.5} borderWidth="1px" borderColor="gray.200" borderRadius="lg" justify="space-between" align="start">
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" color="gray.900">{summarize(row, activeType)}</Text>
                      <Text fontSize="xs" color="gray.500">{row.id}</Text>
                    </Box>
                    <HStack>
                      <Button
                        size="xs"
                        onClick={() => {
                          setEditingId(String(row.id));
                          setForm(recordToForm(activeType, row));
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="xs" colorScheme="red" variant="outline" leftIcon={<Trash2 size={12} />} onClick={() => void deleteRecord(String(row.id))}>
                        Delete
                      </Button>
                    </HStack>
                  </HStack>
                ))}

                {!loading && records.length === 0 ? (
                  <Box p={4} borderWidth="1px" borderStyle="dashed" borderColor="gray.300" borderRadius="xl">
                    <Text fontSize="sm" color="gray.500">No records yet.</Text>
                  </Box>
                ) : null}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
