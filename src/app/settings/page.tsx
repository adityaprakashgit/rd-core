"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  Switch,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Building2, Plus, Save, Settings2, ShieldCheck, Workflow } from "lucide-react";

import { ConfigurationPageTemplate, MobileActionRail } from "@/components/enterprise/PageTemplates";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  defaultModuleWorkflowSettings,
  type ModuleWorkflowPolicy,
} from "@/lib/module-workflow-policy";
import {
  getDefaultReportPreferences,
  getReportDocumentTypeLabel,
  REPORT_DOCUMENT_TYPES,
  REPORT_PREFERENCES_STORAGE_KEY,
  sanitizeReportPreferences,
  type ReportPreferences,
} from "@/lib/report-preferences";
import type { InspectionChecklistItem } from "@/types/inspection";

type ChecklistSettingsResponse = {
  items: InspectionChecklistItem[];
  sectionOptions: string[];
  responseTypeOptions: string[];
};

export default function SettingsPageRoute() {
  const toast = useToast();
  const [companyName, setCompanyName] = useState("Aditya Test");
  const [location, setLocation] = useState("Industrial Park, Plot 24");
  const [defaultView, setDefaultView] = useState("my");
  const [samplingRequired, setSamplingRequired] = useState(true);
  const [qaGateEnabled, setQaGateEnabled] = useState(true);
  const [lockStrictMode, setLockStrictMode] = useState(true);
  const [checklistItems, setChecklistItems] = useState<InspectionChecklistItem[]>([]);
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const [responseTypeOptions, setResponseTypeOptions] = useState<string[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [creatingChecklistItem, setCreatingChecklistItem] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState({
    itemLabel: "",
    sectionName: "Lot Identity",
    responseType: "YES_NO",
    displayOrder: "999",
    isRequired: true,
    isActive: true,
  });
  const [reportPreferences, setReportPreferences] = useState<ReportPreferences>(() =>
    getDefaultReportPreferences(companyName)
  );
  const [activeSettingsSection, setActiveSettingsSection] = useState<
    | "company-profile"
    | "report-defaults"
    | "workflow-guardrails"
    | "inspection-checklist"
    | "registry-navigation"
  >("company-profile");
  const [workflowSettings, setWorkflowSettings] = useState<ModuleWorkflowPolicy>({
    workflow: {
      autoLotNumbering: defaultModuleWorkflowSettings.autoLotNumbering,
      lotNumberPrefix: defaultModuleWorkflowSettings.lotNumberPrefix ?? "LOT",
      lotNumberSequenceFormat: defaultModuleWorkflowSettings.lotNumberSequenceFormat ?? "0001",
      autoSampleIdGeneration: defaultModuleWorkflowSettings.autoSampleIdGeneration,
      sampleIdPrefix: defaultModuleWorkflowSettings.sampleIdPrefix ?? "SMP",
      sampleIdSequenceFormat: defaultModuleWorkflowSettings.sampleIdSequenceFormat ?? "0001",
      finalDecisionApproverPolicy: "MANAGER_ADMIN",
      lockPacketEditingAfterRndSubmit: defaultModuleWorkflowSettings.lockPacketEditingAfterRndSubmit,
    },
    images: {
      requiredImageCategories: defaultModuleWorkflowSettings.requiredImageCategories,
      optionalImageCategories: defaultModuleWorkflowSettings.optionalImageCategories,
      imageTimestampRequired: defaultModuleWorkflowSettings.imageTimestampRequired,
    },
    seal: {
      sealScanRequired: defaultModuleWorkflowSettings.sealScanRequired,
      bulkSealGenerationEnabled: defaultModuleWorkflowSettings.bulkSealGenerationEnabled,
      sealEditPolicy: "ADMIN_ONLY",
    },
    sampling: {
      containerTypeSource: "MASTER_ONLY",
      homogeneousProofRequired: defaultModuleWorkflowSettings.homogeneousProofRequired,
      homogeneousWeightEnabled: false,
    },
    packet: {
      packetWeightRequired: true,
      packetPurposeMode: "OPTIONAL",
    },
    ui: {
      showOptionalImageSection: defaultModuleWorkflowSettings.showOptionalImageSection,
      showBlockersInline: defaultModuleWorkflowSettings.showBlockersInline,
    },
  });
  const [loadingWorkflowSettings, setLoadingWorkflowSettings] = useState(true);
  const [savingWorkflowSettings, setSavingWorkflowSettings] = useState(false);

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

  const fetchChecklistSettings = useCallback(async () => {
    setLoadingChecklist(true);
    try {
      const res = await fetch("/api/settings/inspection-checklist");
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Failed to load inspection checklist settings.");
      }

      const payload = (await res.json()) as ChecklistSettingsResponse;
      setChecklistItems(payload.items);
      setSectionOptions(payload.sectionOptions);
      setResponseTypeOptions(payload.responseTypeOptions);
      setNewChecklistItem((prev) => ({
        ...prev,
        sectionName: payload.sectionOptions[0] ?? prev.sectionName,
        responseType: payload.responseTypeOptions[0] ?? prev.responseType,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load inspection checklist settings.";
      toast({ title: "Checklist settings unavailable", description: message, status: "warning" });
    } finally {
      setLoadingChecklist(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchChecklistSettings();
  }, [fetchChecklistSettings]);

  useEffect(() => {
    let active = true;

    async function fetchWorkflowSettings() {
      setLoadingWorkflowSettings(true);
      try {
        const res = await fetch("/api/settings/module-workflow");
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { details?: string } | null;
          throw new Error(payload?.details ?? "Failed to load workflow settings.");
        }

        const payload = (await res.json()) as ModuleWorkflowPolicy;
        if (active) {
          setWorkflowSettings(payload);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load workflow settings.";
        toast({ title: "Workflow settings unavailable", description: message, status: "warning" });
      } finally {
        if (active) {
          setLoadingWorkflowSettings(false);
        }
      }
    }

    void fetchWorkflowSettings();
    return () => {
      active = false;
    };
  }, [toast]);

  const saveBasics = () => {
    try {
      const normalized = sanitizeReportPreferences(reportPreferences, companyName);
      window.localStorage.setItem(REPORT_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      toast({ title: "Report preferences could not be saved", status: "warning" });
      return;
    }

    toast({ title: "Settings saved", status: "success" });
  };

  async function saveWorkflowSettings() {
    setSavingWorkflowSettings(true);
    try {
      const response = await fetch("/api/settings/module-workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflowSettings),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Failed to save workflow settings.");
      }
      const payload = (await response.json()) as ModuleWorkflowPolicy;
      setWorkflowSettings(payload);
      toast({ title: "Workflow settings saved", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save workflow settings.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setSavingWorkflowSettings(false);
    }
  }

  async function saveChecklistItem(item: InspectionChecklistItem) {
    setSavingChecklistId(item.id);
    try {
      const res = await fetch("/api/settings/inspection-checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          itemLabel: item.itemLabel,
          sectionName: item.sectionName,
          responseType: item.responseType,
          displayOrder: item.displayOrder,
          isRequired: item.isRequired,
          isActive: item.isActive,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Failed to save checklist item.");
      }

      const updated = (await res.json()) as InspectionChecklistItem;
      setChecklistItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      toast({ title: "Checklist item saved", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save checklist item.";
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setSavingChecklistId(null);
    }
  }

  async function createChecklistItem() {
    setCreatingChecklistItem(true);
    try {
      const res = await fetch("/api/settings/inspection-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChecklistItem),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { details?: string } | null;
        throw new Error(payload?.details ?? "Failed to create checklist item.");
      }

      const created = (await res.json()) as InspectionChecklistItem;
      setChecklistItems((prev) => [...prev, created].sort((left, right) => left.displayOrder - right.displayOrder));
      setNewChecklistItem((prev) => ({ ...prev, itemLabel: "", displayOrder: String((created.displayOrder ?? 999) + 1) }));
      toast({ title: "Checklist item added", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create checklist item.";
      toast({ title: "Create failed", description: message, status: "error" });
    } finally {
      setCreatingChecklistItem(false);
    }
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box>
          <HStack spacing={2} flexWrap="wrap">
            <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={2.5} py={1}>
              WORKSPACE PREFERENCES
            </Badge>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={1}>
              CLEANER IA
            </Badge>
          </HStack>
          <Heading size="lg" color="text.primary" mt={2}>
            Workspace Configuration
          </Heading>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Default queue view
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {defaultView === "my" ? "My tasks" : "Company view"}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Default document
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {getReportDocumentTypeLabel(reportPreferences.defaultDocumentType)}
              </Text>
            </CardBody>
          </Card>
          <Card variant="outline" borderRadius="2xl">
            <CardBody p={5}>
              <Text fontSize="sm" color="text.muted">
                Guardrails enabled
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="text.primary" mt={2}>
                {[samplingRequired, qaGateEnabled, lockStrictMode].filter(Boolean).length}/3
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Stack direction={{ base: "column", md: "row" }} spacing={3} align="stretch" flexWrap={{ md: "wrap" }}>
          <Button w={{ base: "full", md: "auto" }} variant={activeSettingsSection === "company-profile" ? "solid" : "outline"} onClick={() => setActiveSettingsSection("company-profile")}>
            Identity
          </Button>
          <Button w={{ base: "full", md: "auto" }} variant={activeSettingsSection === "report-defaults" ? "solid" : "outline"} onClick={() => setActiveSettingsSection("report-defaults")}>
            Reports
          </Button>
          <Button w={{ base: "full", md: "auto" }} variant={activeSettingsSection === "workflow-guardrails" ? "solid" : "outline"} onClick={() => setActiveSettingsSection("workflow-guardrails")}>
            Guardrails
          </Button>
          <Button w={{ base: "full", md: "auto" }} variant={activeSettingsSection === "inspection-checklist" ? "solid" : "outline"} onClick={() => setActiveSettingsSection("inspection-checklist")}>
            Checklist
          </Button>
          <Button w={{ base: "full", md: "auto" }} variant={activeSettingsSection === "registry-navigation" ? "solid" : "outline"} onClick={() => setActiveSettingsSection("registry-navigation")}>
            Registry
          </Button>
        </Stack>

        <ConfigurationPageTemplate
          sections={[
            {
              id: "company-profile",
              title: "Workspace Identity",
              description: "Use concise company details that should appear across dashboards and generated documents.",
              content: (
                <VStack align="stretch" spacing={4}>
                  <HStack spacing={3} align="start">
                    <Box p={2.5} bg="teal.50" color="teal.600" borderRadius="xl">
                      <Building2 size={18} />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" color="text.primary">
                        Company profile
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        Keep only the information that operators and customers actually see.
                      </Text>
                    </Box>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Company name</FormLabel>
                      <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Primary location</FormLabel>
                      <Input value={location} onChange={(event) => setLocation(event.target.value)} />
                    </FormControl>
                  </SimpleGrid>
                </VStack>
              ),
            },
            {
              id: "report-defaults",
              title: "Report Defaults",
              description: "Set stable branding and export defaults here. Job-specific commercial fields stay on the document workspace.",
              content: (
                <VStack align="stretch" spacing={4}>
                  <HStack spacing={3} align="start">
                    <Box p={2.5} bg="blue.50" color="blue.600" borderRadius="xl">
                      <ShieldCheck size={18} />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" color="text.primary">
                        Print and branding
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        These values are reused by document generation and should rarely change.
                      </Text>
                    </Box>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Default report type</FormLabel>
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
                      <FormLabel>Brand display name</FormLabel>
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
                      <FormLabel>Brand address</FormLabel>
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
                      <FormLabel>Contact line</FormLabel>
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
                      <FormLabel>GST / tax ID</FormLabel>
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
                      <FormLabel>Logo URL</FormLabel>
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
                      <FormLabel>Footer note</FormLabel>
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
                      <FormLabel>Authorized signatory name</FormLabel>
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
                      <FormLabel>Authorized signatory title</FormLabel>
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
                  </SimpleGrid>
                </VStack>
              ),
            },
            {
              id: "workflow-guardrails",
              title: "Workflow Guardrails",
              description: "Keep only the operational defaults that affect step gating. Registry CRUD has been removed from this page.",
              content: (
                <VStack align="stretch" spacing={4}>
                  <HStack spacing={3} align="start">
                    <Box p={2.5} bg="orange.50" color="orange.600" borderRadius="xl">
                      <Workflow size={18} />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" color="text.primary">
                        Default behavior
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        These toggles should match your real operating policy, not individual exceptions.
                      </Text>
                    </Box>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    <VStack align="stretch" spacing={4}>
                      <FormControl>
                        <FormLabel>Default inspection view</FormLabel>
                        <Select value={defaultView} onChange={(event) => setDefaultView(event.target.value)}>
                          <option value="my">My tasks</option>
                          <option value="all">Company view</option>
                        </Select>
                      </FormControl>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">Sampling mandatory before homogeneous sample</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Prevents the R&D stage from starting too early.
                          </Text>
                        </Box>
                        <Switch colorScheme="teal" isChecked={samplingRequired} onChange={(event) => setSamplingRequired(event.target.checked)} />
                      </HStack>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">Auto lot numbering</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Generate lot numbers from company settings instead of manual entry.
                          </Text>
                        </Box>
                        <Switch
                          colorScheme="teal"
                          isChecked={workflowSettings.workflow.autoLotNumbering}
                          onChange={(event) =>
                            setWorkflowSettings((prev) => ({
                              ...prev,
                              workflow: { ...prev.workflow, autoLotNumbering: event.target.checked },
                            }))
                          }
                        />
                      </HStack>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">Auto sample ID generation</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Create sample IDs automatically during the sampling step.
                          </Text>
                        </Box>
                        <Switch
                          colorScheme="teal"
                          isChecked={workflowSettings.workflow.autoSampleIdGeneration}
                          onChange={(event) =>
                            setWorkflowSettings((prev) => ({
                              ...prev,
                              workflow: { ...prev.workflow, autoSampleIdGeneration: event.target.checked },
                            }))
                          }
                        />
                      </HStack>
                    </VStack>
                    <VStack align="stretch" spacing={4}>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">QA gate required before lock</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Keeps report release explicit.
                          </Text>
                        </Box>
                        <Switch colorScheme="teal" isChecked={qaGateEnabled} onChange={(event) => setQaGateEnabled(event.target.checked)} />
                      </HStack>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">Strict lock mode</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Prevent post-lock edits without reopening the workflow.
                          </Text>
                        </Box>
                        <Switch colorScheme="teal" isChecked={lockStrictMode} onChange={(event) => setLockStrictMode(event.target.checked)} />
                      </HStack>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">Seal scan required</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Force scan-first seal capture with a later generated fallback only when needed.
                          </Text>
                        </Box>
                        <Switch
                          colorScheme="teal"
                          isChecked={workflowSettings.seal.sealScanRequired}
                          onChange={(event) =>
                            setWorkflowSettings((prev) => ({
                              ...prev,
                              seal: { ...prev.seal, sealScanRequired: event.target.checked },
                            }))
                          }
                        />
                      </HStack>
                      <HStack justify="space-between">
                        <Box>
                          <Text color="text.primary">Image timestamp overlay</Text>
                          <Text fontSize="sm" color="text.secondary">
                            Add timestamp proof to captured images when the company requires it.
                          </Text>
                        </Box>
                        <Switch
                          colorScheme="teal"
                          isChecked={workflowSettings.images.imageTimestampRequired}
                          onChange={(event) =>
                            setWorkflowSettings((prev) => ({
                              ...prev,
                              images: { ...prev.images, imageTimestampRequired: event.target.checked },
                            }))
                          }
                        />
                      </HStack>
                    </VStack>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    <FormControl>
                      <FormLabel>Final decision approver</FormLabel>
                      <Select
                        value={workflowSettings.workflow.finalDecisionApproverPolicy}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            workflow: {
                              ...prev.workflow,
                              finalDecisionApproverPolicy: event.target.value as ModuleWorkflowPolicy["workflow"]["finalDecisionApproverPolicy"],
                            },
                          }))
                        }
                      >
                        <option value="MANAGER">Manager only</option>
                        <option value="ADMIN">Admin only</option>
                        <option value="MANAGER_ADMIN">Manager or Admin</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Seal edit control</FormLabel>
                      <Select
                        value={workflowSettings.seal.sealEditPolicy}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            seal: {
                              ...prev.seal,
                              sealEditPolicy: event.target.value as ModuleWorkflowPolicy["seal"]["sealEditPolicy"],
                            },
                          }))
                        }
                      >
                        <option value="ADMIN_ONLY">Admin only after generation</option>
                        <option value="ALLOWED">Allowed by assigned workflow user</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Lot numbering prefix</FormLabel>
                      <Input
                        value={workflowSettings.workflow.lotNumberPrefix}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            workflow: { ...prev.workflow, lotNumberPrefix: event.target.value },
                          }))
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Sample ID prefix</FormLabel>
                      <Input
                        value={workflowSettings.workflow.sampleIdPrefix}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            workflow: { ...prev.workflow, sampleIdPrefix: event.target.value },
                          }))
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Packet editing after Submit to R&D</FormLabel>
                      <Select
                        value={workflowSettings.workflow.lockPacketEditingAfterRndSubmit ? "LOCK" : "ALLOW"}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            workflow: {
                              ...prev.workflow,
                              lockPacketEditingAfterRndSubmit: event.target.value === "LOCK",
                            },
                          }))
                        }
                      >
                        <option value="LOCK">Lock packet edits after submit</option>
                        <option value="ALLOW">Allow packet edits after submit</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Container type source</FormLabel>
                      <Select
                        value={workflowSettings.sampling.containerTypeSource}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            sampling: {
                              ...prev.sampling,
                              containerTypeSource: event.target.value as ModuleWorkflowPolicy["sampling"]["containerTypeSource"],
                            },
                          }))
                        }
                      >
                        <option value="MASTER_ONLY">Master list only</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Required image categories</FormLabel>
                      <Textarea
                        rows={5}
                        value={workflowSettings.images.requiredImageCategories.join("\n")}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            images: {
                              ...prev.images,
                              requiredImageCategories: event.target.value
                                .split("\n")
                                .map((value) => value.trim())
                                .filter(Boolean),
                            },
                          }))
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Optional image categories</FormLabel>
                      <Textarea
                        rows={5}
                        value={workflowSettings.images.optionalImageCategories.join("\n")}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            images: {
                              ...prev.images,
                              optionalImageCategories: event.target.value
                                .split("\n")
                                .map((value) => value.trim())
                                .filter(Boolean),
                            },
                          }))
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Packet purpose mode</FormLabel>
                      <Select
                        value={workflowSettings.packet.packetPurposeMode}
                        onChange={(event) =>
                          setWorkflowSettings((prev) => ({
                            ...prev,
                            packet: {
                              ...prev.packet,
                              packetPurposeMode: event.target.value as ModuleWorkflowPolicy["packet"]["packetPurposeMode"],
                            },
                          }))
                        }
                      >
                        <option value="OPTIONAL">Optional in operations workflow</option>
                        <option value="RND_OWNED">Set later by R&D</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Workflow preview behavior</FormLabel>
                      <Stack spacing={3}>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="text.primary">Show optional images section</Text>
                          <Switch
                            colorScheme="teal"
                            isChecked={workflowSettings.ui.showOptionalImageSection}
                            onChange={(event) =>
                              setWorkflowSettings((prev) => ({
                                ...prev,
                                ui: { ...prev.ui, showOptionalImageSection: event.target.checked },
                              }))
                            }
                          />
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="text.primary">Show blockers inline in workflow</Text>
                          <Switch
                            colorScheme="teal"
                            isChecked={workflowSettings.ui.showBlockersInline}
                            onChange={(event) =>
                              setWorkflowSettings((prev) => ({
                                ...prev,
                                ui: { ...prev.ui, showBlockersInline: event.target.checked },
                              }))
                            }
                          />
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="text.primary">Homogeneous proof required</Text>
                          <Switch
                            colorScheme="teal"
                            isChecked={workflowSettings.sampling.homogeneousProofRequired}
                            onChange={(event) =>
                              setWorkflowSettings((prev) => ({
                                ...prev,
                                sampling: { ...prev.sampling, homogeneousProofRequired: event.target.checked },
                              }))
                            }
                          />
                        </HStack>
                      </Stack>
                    </FormControl>
                  </SimpleGrid>
                  <HStack justify="space-between" align="center">
                    <Text fontSize="sm" color="text.secondary">
                      {loadingWorkflowSettings ? "Loading workflow controls..." : "Workflow controls are company-scoped."}
                    </Text>
                    <Button
                      leftIcon={<Save size={16} />}
                      colorScheme="teal"
                      onClick={() => void saveWorkflowSettings()}
                      isLoading={savingWorkflowSettings}
                      isDisabled={loadingWorkflowSettings}
                    >
                      Save Workflow Settings
                    </Button>
                  </HStack>
                </VStack>
              ),
            },
            {
              id: "inspection-checklist",
              title: "Inspection Checklist",
              description: "Keep the default inspection flow lean. Add only the questions that matter for your real operation.",
              content: (
                <VStack align="stretch" spacing={5}>
                  <HStack spacing={3} align="start">
                    <Box p={2.5} bg="purple.50" color="purple.600" borderRadius="xl">
                      <Workflow size={18} />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" color="text.primary">
                        Admin-managed inspection form
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        Questions added here appear in the inspection wizard. Keep the active set short so field teams can move quickly.
                      </Text>
                    </Box>
                  </HStack>

                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <Card variant="outline" borderRadius="xl">
                      <CardBody p={4}>
                        <Text fontSize="sm" color="text.muted">Active questions</Text>
                        <Text fontSize="2xl" fontWeight="bold" mt={2}>{checklistItems.filter((item) => item.isActive).length}</Text>
                      </CardBody>
                    </Card>
                    <Card variant="outline" borderRadius="xl">
                      <CardBody p={4}>
                        <Text fontSize="sm" color="text.muted">Required questions</Text>
                        <Text fontSize="2xl" fontWeight="bold" mt={2}>{checklistItems.filter((item) => item.isActive && item.isRequired).length}</Text>
                      </CardBody>
                    </Card>
                    <Card variant="outline" borderRadius="xl">
                      <CardBody p={4}>
                        <Text fontSize="sm" color="text.muted">Default inspection photos</Text>
                        <Text fontSize="2xl" fontWeight="bold" mt={2}>2</Text>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  <Card variant="outline" borderRadius="xl">
                    <CardBody p={5}>
                      <VStack align="stretch" spacing={4}>
                        <Text fontWeight="semibold" color="text.primary">Add question</Text>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <FormControl gridColumn={{ md: "span 2" }}>
                            <FormLabel>Question label</FormLabel>
                            <Textarea
                              value={newChecklistItem.itemLabel}
                              onChange={(event) => setNewChecklistItem((prev) => ({ ...prev, itemLabel: event.target.value }))}
                              placeholder="For example: Material condition acceptable for visual inspection"
                              rows={3}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Section</FormLabel>
                            <Select value={newChecklistItem.sectionName} onChange={(event) => setNewChecklistItem((prev) => ({ ...prev, sectionName: event.target.value }))}>
                              {sectionOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Response type</FormLabel>
                            <Select value={newChecklistItem.responseType} onChange={(event) => setNewChecklistItem((prev) => ({ ...prev, responseType: event.target.value }))}>
                              {responseTypeOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Display order</FormLabel>
                            <Input value={newChecklistItem.displayOrder} onChange={(event) => setNewChecklistItem((prev) => ({ ...prev, displayOrder: event.target.value }))} />
                          </FormControl>
                          <VStack align="stretch" spacing={4} justify="end">
                            <HStack justify="space-between">
                              <Text color="text.primary">Required</Text>
                              <Switch isChecked={newChecklistItem.isRequired} onChange={(event) => setNewChecklistItem((prev) => ({ ...prev, isRequired: event.target.checked }))} />
                            </HStack>
                            <HStack justify="space-between">
                              <Text color="text.primary">Active immediately</Text>
                              <Switch isChecked={newChecklistItem.isActive} onChange={(event) => setNewChecklistItem((prev) => ({ ...prev, isActive: event.target.checked }))} />
                            </HStack>
                          </VStack>
                        </SimpleGrid>
                        <HStack justify="end">
                          <Button leftIcon={<Plus size={16} />} colorScheme="purple" onClick={createChecklistItem} isLoading={creatingChecklistItem}>
                            Add question
                          </Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  <VStack align="stretch" spacing={3}>
                    {loadingChecklist ? (
                      <Text fontSize="sm" color="text.secondary">Loading checklist questions…</Text>
                    ) : checklistItems.length === 0 ? (
                      <Text fontSize="sm" color="text.secondary">No checklist questions configured.</Text>
                    ) : (
                      checklistItems
                        .slice()
                        .sort((left, right) => left.displayOrder - right.displayOrder)
                        .map((item) => (
                          <Card key={item.id} variant="outline" borderRadius="xl">
                            <CardBody p={5}>
                              <VStack align="stretch" spacing={4}>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                  <FormControl gridColumn={{ md: "span 2" }}>
                                    <FormLabel>Question</FormLabel>
                                    <Input
                                      value={item.itemLabel}
                                      onChange={(event) =>
                                        setChecklistItems((prev) =>
                                          prev.map((entry) => (entry.id === item.id ? { ...entry, itemLabel: event.target.value } : entry)),
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormControl>
                                    <FormLabel>Section</FormLabel>
                                    <Select
                                      value={item.sectionName}
                                      onChange={(event) =>
                                        setChecklistItems((prev) =>
                                          prev.map((entry) => (entry.id === item.id ? { ...entry, sectionName: event.target.value } : entry)),
                                        )
                                      }
                                    >
                                      {sectionOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </Select>
                                  </FormControl>
                                  <FormControl>
                                    <FormLabel>Response type</FormLabel>
                                    <Select
                                      value={item.responseType}
                                      onChange={(event) =>
                                        setChecklistItems((prev) =>
                                          prev.map((entry) => (entry.id === item.id ? { ...entry, responseType: event.target.value } : entry)),
                                        )
                                      }
                                    >
                                      {responseTypeOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </Select>
                                  </FormControl>
                                  <FormControl>
                                    <FormLabel>Display order</FormLabel>
                                    <Input
                                      value={String(item.displayOrder)}
                                      onChange={(event) =>
                                        setChecklistItems((prev) =>
                                          prev.map((entry) => (entry.id === item.id ? { ...entry, displayOrder: Number(event.target.value) || 0 } : entry)),
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <VStack align="stretch" spacing={4} justify="end">
                                    <HStack justify="space-between">
                                      <Text color="text.primary">Required</Text>
                                      <Switch
                                        isChecked={item.isRequired}
                                        onChange={(event) =>
                                          setChecklistItems((prev) =>
                                            prev.map((entry) => (entry.id === item.id ? { ...entry, isRequired: event.target.checked } : entry)),
                                          )
                                        }
                                      />
                                    </HStack>
                                    <HStack justify="space-between">
                                      <Text color="text.primary">Active</Text>
                                      <Switch
                                        isChecked={item.isActive}
                                        onChange={(event) =>
                                          setChecklistItems((prev) =>
                                            prev.map((entry) => (entry.id === item.id ? { ...entry, isActive: event.target.checked } : entry)),
                                          )
                                        }
                                      />
                                    </HStack>
                                  </VStack>
                                </SimpleGrid>
                                <HStack justify="space-between" flexWrap="wrap">
                                  <HStack spacing={2}>
                                    <Badge colorScheme={item.isActive ? "green" : "gray"} variant="subtle">{item.isActive ? "Active" : "Inactive"}</Badge>
                                    <Badge colorScheme={item.isRequired ? "red" : "gray"} variant="subtle">{item.isRequired ? "Required" : "Optional"}</Badge>
                                  </HStack>
                                  <Button size="sm" leftIcon={<Save size={14} />} onClick={() => void saveChecklistItem(item)} isLoading={savingChecklistId === item.id}>
                                    Save question
                                  </Button>
                                </HStack>
                              </VStack>
                            </CardBody>
                          </Card>
                        ))
                    )}
                  </VStack>
                </VStack>
              ),
            },
            {
              id: "registry-navigation",
              title: "Registry Ownership",
              description: "Client, transporter, and item records have been moved out of settings to reduce confusion and duplicate entry points.",
              content: (
                <HStack justify="space-between" align={{ base: "start", md: "center" }} flexDir={{ base: "column", md: "row" }} spacing={4}>
                  <HStack spacing={3} align="start">
                    <Box p={2.5} bg="gray.100" color="gray.700" borderRadius="xl">
                      <Settings2 size={18} />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" color="text.primary">
                        Use the master registry for operational records
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        Create and maintain clients, transporters, items, and inactive records in one dedicated place.
                      </Text>
                    </Box>
                  </HStack>
                  <Button as="a" href="/master" variant="outline">
                    Open master registry
                  </Button>
                </HStack>
              ),
            },
          ].filter((section) => section.id === activeSettingsSection)}
        />

        <HStack justify="end" display={{ base: "none", md: "flex" }}>
          <Button leftIcon={<Save size={16} />} colorScheme="teal" onClick={saveBasics}>
            Save Settings
          </Button>
        </HStack>

        <MobileActionRail>
          <Button leftIcon={<Save size={16} />} flex="1" onClick={saveBasics}>
            Save Settings
          </Button>
          <Button as="a" href="/master" flex="1" variant="outline">
            Open Masters
          </Button>
        </MobileActionRail>
      </VStack>
    </ControlTowerLayout>
  );
}
