"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
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
import { RefreshCcw, Save } from "lucide-react";

import { PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import { MobileActionRail } from "@/components/enterprise/PageTemplates";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  defaultModuleWorkflowSettings,
  getCanonicalImagePolicyCategoryKeys,
  getImagePolicyCategoryLabel,
  repairEmptyImagePolicyBuckets,
  toModuleWorkflowPolicy,
  type ModuleWorkflowPolicy,
} from "@/lib/module-workflow-policy";
import { logSaveUxEvent } from "@/lib/ui-save-debug";
import type { CanonicalEvidenceCategory } from "@/lib/evidence-definition";

type SectionId =
  | "workflow"
  | "numbering"
  | "images"
  | "seal"
  | "sample"
  | "packet"
  | "approval"
  | "access";

const SECTION_DEFINITIONS: Array<{ id: SectionId; label: string; helper: string }> = [
  { id: "workflow", label: "Workflow", helper: "Controls overall operational stage behavior." },
  { id: "numbering", label: "Numbering", helper: "Configures lot, sample, and packet identifiers." },
  { id: "images", label: "Images / Proof", helper: "Defines required, optional, and hidden evidence categories." },
  { id: "seal", label: "Seal", helper: "Controls scan policy, fallback, and seal edit restrictions." },
  { id: "sample", label: "Sample", helper: "Controls container source and homogeneous proof rules." },
  { id: "packet", label: "Packet", helper: "Controls packet creation requirements and R&D handoff gate behavior." },
  { id: "approval", label: "Approval", helper: "Controls decision ownership and mandatory review notes." },
  { id: "access", label: "Access", helper: "Controls module visibility and edit restrictions by policy." },
];

const ALL_MODULE_OPTIONS = [
  "home",
  "inspection",
  "jobs",
  "rnd",
  "documents",
  "exceptions",
  "master-data",
  "settings",
  "admin",
];

const DEFAULT_POLICY = toModuleWorkflowPolicy(defaultModuleWorkflowSettings);

const AVAILABLE_CATEGORIES = getCanonicalImagePolicyCategoryKeys().map((key) => ({
  key,
  label: getImagePolicyCategoryLabel(key),
}));

function CategoryPolicySelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "REQUIRED" | "OPTIONAL" | "HIDDEN" | "NONE";
  onChange: (newValue: "REQUIRED" | "OPTIONAL" | "HIDDEN" | "NONE") => void;
}) {
  function handleChange(nextValue: string) {
    if (nextValue === "REQUIRED" || nextValue === "OPTIONAL" || nextValue === "HIDDEN" || nextValue === "NONE") {
      onChange(nextValue);
    }
  }

  return (
    <Tr>
      <Td py={2}>
        <Text fontSize="sm" fontWeight="medium">{label}</Text>
      </Td>
      <Td py={2}>
        <RadioGroup value={value} onChange={handleChange}>
          <HStack spacing={4}>
            <Radio value="REQUIRED" size="sm" colorScheme="blue">Required</Radio>
            <Radio value="OPTIONAL" size="sm" colorScheme="gray">Optional</Radio>
            <Radio value="HIDDEN" size="sm" colorScheme="orange">Hidden</Radio>
            <Radio value="NONE" size="sm" colorScheme="red">Not Used</Radio>
          </HStack>
        </RadioGroup>
      </Td>
    </Tr>
  );
}

export default function ModuleSettingsWorkflowPage() {
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<SectionId>("workflow");
  const [workflowPolicy, setWorkflowPolicy] = useState<ModuleWorkflowPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);


  useEffect(() => {
    let active = true;
    async function loadSettings() {
      setLoading(true);
      try {
        const policyResponse = await fetch("/api/settings/module-workflow");

        if (!policyResponse.ok) {
          throw new Error("Could not load module settings.");
        }

        const policyPayload = (await policyResponse.json()) as ModuleWorkflowPolicy;

        if (!active) {
          return;
        }
        setWorkflowPolicy(policyPayload);
        setTouched(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load module settings.";
        toast({ title: "Settings unavailable", description: message, status: "error" });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadSettings();
    return () => {
      active = false;
    };
  }, [toast]);

  function markTouched() {
    if (!touched) {
      setTouched(true);
    }
  }

  async function handleSave() {

    setSaving(true);
    logSaveUxEvent("save_started", { source: "SettingsWorkflow:save" });
    try {
      const policyResponse = await fetch("/api/settings/module-workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflowPolicy),
      });

      if (!policyResponse.ok) {
        throw new Error("Settings save failed.");
      }

      const policyPayload = (await policyResponse.json()) as ModuleWorkflowPolicy;
      setWorkflowPolicy(policyPayload);
      setTouched(false);

      logSaveUxEvent("save_success", { source: "SettingsWorkflow:save" });
      toast({ title: "Module settings saved", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Settings save failed.";
      logSaveUxEvent("save_failed", { source: "SettingsWorkflow:save", message });
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    setWorkflowPolicy(DEFAULT_POLICY);
    setTouched(true);
  }

  function handleRestoreRecommendedImageDefaults() {
    setWorkflowPolicy((prev) => ({
      ...prev,
      images: repairEmptyImagePolicyBuckets(prev.images),
    }));
    markTouched();
    toast({
      title: "Recommended image defaults restored",
      description: "Required proof categories have been reset to enterprise defaults.",
      status: "success",
    });
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="Module Settings"
          subtitle="Company-scoped workflow policy controls for the unified operations flow."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Settings", href: "/admin/settings/workflow" },
            { label: "Module Settings" },
          ]}
          right={
            <>
              <Button
                as={Link}
                href="/admin/settings/company"
                variant="outline"
                isDisabled={loading || saving}
              >
                Open Company Profile
              </Button>
              <Button
                variant="outline"
                leftIcon={<RefreshCcw size={16} />}
                onClick={handleResetDefaults}
                isDisabled={loading || saving}
              >
                Reset to Default
              </Button>
              <Button
                display={{ base: "none", lg: "inline-flex" }}
                colorScheme="blue"
                leftIcon={<Save size={16} />}
                onClick={() => void handleSave()}
                isLoading={saving}
                isDisabled={loading}
              >
                Save Settings
              </Button>
            </>
          }
        />

        <Stack direction={{ base: "column", xl: "row" }} spacing={4} align="start">
          <VStack
            align="stretch"
            spacing={1.5}
            borderWidth="1px"
            borderColor="border.default"
            borderRadius="lg"
            p={2.5}
            bg="bg.surface"
            w={{ base: "full", xl: "280px" }}
          >
            {SECTION_DEFINITIONS.map((section) => (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "solid" : "ghost"}
                justifyContent="flex-start"
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </Button>
            ))}
            <Divider />
            <Button
              as={Link}
              href="/admin/settings/company"
              variant="ghost"
              justifyContent="flex-start"
            >
              Company Profile
            </Button>
          </VStack>

          <VStack
            align="stretch"
            spacing={4}
            borderWidth="1px"
            borderColor="border.default"
            borderRadius="lg"
            p={4}
            bg="bg.surface"
            flex="1"
            minW={0}
          >
            <Box>
              <Text fontSize="md" fontWeight="semibold" color="text.primary">
                {SECTION_DEFINITIONS.find((section) => section.id === activeSection)?.label}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {SECTION_DEFINITIONS.find((section) => section.id === activeSection)?.helper}
              </Text>
            </Box>

            {activeSection === "workflow" ? (
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Enable unified workflow page</Text>
                    <Text fontSize="sm" color="text.secondary">Keeps execution on a single guided page.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.workflow.submitToRndEnabled} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, submitToRndEnabled: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Decision required before sampling</Text>
                    <Text fontSize="sm" color="text.secondary">Blocks sampling until final decision is completed.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.workflow.decisionRequiredBeforeSampling} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, decisionRequiredBeforeSampling: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Creator is default assignee</Text>
                    <Text fontSize="sm" color="text.secondary">Auto-assign new jobs to the creator unless changed.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.workflow.creatorIsDefaultAssignee} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, creatorIsDefaultAssignee: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Deadline required</Text>
                    <Text fontSize="sm" color="text.secondary">Requires deadline on job basics step.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.workflow.deadlineRequired} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, deadlineRequired: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Allow owner + collaborators</Text>
                    <Text fontSize="sm" color="text.secondary">Allows multiple users to access same job context.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.workflow.allowJobCollaborators} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, allowJobCollaborators: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
              </VStack>
            ) : null}

            {activeSection === "numbering" ? (
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Auto lot numbering</Text>
                  <Switch isChecked={workflowPolicy.workflow.autoLotNumbering} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, autoLotNumbering: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Auto sample ID generation</Text>
                  <Switch isChecked={workflowPolicy.workflow.autoSampleIdGeneration} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, autoSampleIdGeneration: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Auto packet ID generation</Text>
                  <Switch isChecked={workflowPolicy.workflow.autoPacketIdGeneration} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, autoPacketIdGeneration: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <Divider />
                <Stack direction={{ base: "column", md: "row" }} spacing={4}>
                  <FormControl>
                    <FormLabel>Lot prefix</FormLabel>
                    <Input value={workflowPolicy.workflow.lotNumberPrefix} onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, lotNumberPrefix: event.target.value },
                      }));
                      markTouched();
                    }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Lot sequence format</FormLabel>
                    <Input value={workflowPolicy.workflow.lotNumberSequenceFormat} onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, lotNumberSequenceFormat: event.target.value },
                      }));
                      markTouched();
                    }} />
                  </FormControl>
                </Stack>
                <Stack direction={{ base: "column", md: "row" }} spacing={4}>
                  <FormControl>
                    <FormLabel>Sample prefix</FormLabel>
                    <Input value={workflowPolicy.workflow.sampleIdPrefix} onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, sampleIdPrefix: event.target.value },
                      }));
                      markTouched();
                    }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Sample sequence format</FormLabel>
                    <Input value={workflowPolicy.workflow.sampleIdSequenceFormat} onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, sampleIdSequenceFormat: event.target.value },
                      }));
                      markTouched();
                    }} />
                  </FormControl>
                </Stack>
                <Stack direction={{ base: "column", md: "row" }} spacing={4}>
                  <FormControl>
                    <FormLabel>Packet prefix</FormLabel>
                    <Input value={workflowPolicy.workflow.packetIdPrefix} onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, packetIdPrefix: event.target.value },
                      }));
                      markTouched();
                    }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Packet sequence format</FormLabel>
                    <Input value={workflowPolicy.workflow.packetIdSequenceFormat} onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, packetIdSequenceFormat: event.target.value },
                      }));
                      markTouched();
                    }} />
                  </FormControl>
                </Stack>
              </VStack>
            ) : null}

            {activeSection === "images" ? (
              <VStack align="stretch" spacing={6}>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Timestamp on image</Text>
                    <Text fontSize="sm" color="text.secondary">Adds timestamp overlay to captured evidence.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.images.imageTimestampRequired} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      images: { ...prev.images, imageTimestampRequired: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between" align="start" spacing={4}>
                  <VStack align="start" spacing={0.5}>
                    <Text fontSize="sm" color="text.secondary">
                      Required proof is enforced before both <Text as="span" fontWeight="semibold">Submit for Decision</Text> and <Text as="span" fontWeight="semibold">Pass</Text>.
                    </Text>
                    <Text fontSize="xs" color="text.muted">
                      `Not Used` means the category is excluded from required, optional, and hidden buckets.
                    </Text>
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRestoreRecommendedImageDefaults}
                    isDisabled={loading || saving}
                  >
                    Restore recommended image defaults
                  </Button>
                </HStack>

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Evidence Category Policies</Text>
                  <Text fontSize="xs" color="text.secondary" mb={4}>
                    Assign variables to buckets. Each variable can only exist in one bucket.
                  </Text>
                  <Box 
                    borderWidth="1px" 
                    borderColor="border.default" 
                    borderRadius="md" 
                    overflow="hidden"
                  >
                    <Table size="sm" variant="simple">
                      <Thead bg="bg.subtle">
                        <Tr>
                          <Th>Category Variable</Th>
                          <Th>Policy Assignment</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {AVAILABLE_CATEGORIES.map((category) => {
                          const categoryKey = category.key;
                          let currentPolicy: "REQUIRED" | "OPTIONAL" | "HIDDEN" | "NONE" = "NONE";
                          if (workflowPolicy.images.requiredImageCategories.includes(categoryKey)) {
                            currentPolicy = "REQUIRED";
                          } else if (workflowPolicy.images.optionalImageCategories.includes(categoryKey)) {
                            currentPolicy = "OPTIONAL";
                          } else if (workflowPolicy.images.hiddenImageCategories.includes(categoryKey)) {
                            currentPolicy = "HIDDEN";
                          }

                          return (
                            <CategoryPolicySelector
                              key={categoryKey}
                              label={category.label}
                              value={currentPolicy}
                              onChange={(newVal) => {
                                setWorkflowPolicy((prev) => {
                                  const targetCategory = categoryKey as CanonicalEvidenceCategory;
                                  const next = { ...prev, images: { ...prev.images } };

                                  // Cleanup all buckets first to ensure fresh state
                                  next.images.requiredImageCategories = next.images.requiredImageCategories.filter((value) => value !== targetCategory);
                                  next.images.optionalImageCategories = next.images.optionalImageCategories.filter((value) => value !== targetCategory);
                                  next.images.hiddenImageCategories = next.images.hiddenImageCategories.filter((value) => value !== targetCategory);
                                  
                                  // Add to new bucket if applicable
                                  if (newVal === "REQUIRED") next.images.requiredImageCategories = [...next.images.requiredImageCategories, targetCategory];
                                  if (newVal === "OPTIONAL") next.images.optionalImageCategories = [...next.images.optionalImageCategories, targetCategory];
                                  if (newVal === "HIDDEN") next.images.hiddenImageCategories = [...next.images.hiddenImageCategories, targetCategory];
                                  
                                  return next;
                                });
                                markTouched();
                              }}
                            />
                          );
                        })}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              </VStack>
            ) : null}

            {activeSection === "seal" ? (
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Seal scan required</Text>
                    <Text fontSize="sm" color="text.secondary">Shows scan-first behavior in seal step.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.seal.sealScanRequired} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      seal: { ...prev.seal, sealScanRequired: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Bulk seal generation enabled</Text>
                    <Text fontSize="sm" color="text.secondary">Allows generated seal mapping when scan not available.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.seal.bulkSealGenerationEnabled} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      seal: { ...prev.seal, bulkSealGenerationEnabled: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <FormControl>
                  <FormLabel>Seal edit policy</FormLabel>
                  <Select
                    value={workflowPolicy.seal.sealEditPolicy}
                    onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        seal: {
                          ...prev.seal,
                          sealEditPolicy: event.target.value as ModuleWorkflowPolicy["seal"]["sealEditPolicy"],
                        },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="ADMIN_ONLY">Admin only after generation or scan</option>
                    <option value="ALLOWED">Allow assigned workflow users</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Allowed seal edit roles</FormLabel>
                  <Select
                    value=""
                    onChange={(event) => {
                      const role = event.target.value;
                      if (!role) {
                        return;
                      }
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        seal: {
                          ...prev.seal,
                          sealEditRoles: Array.from(new Set([...prev.seal.sealEditRoles, role])),
                        },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="">Add role</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OPERATIONS">OPERATIONS</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="RND">RND</option>
                  </Select>
                  <HStack mt={2} spacing={2} flexWrap="wrap">
                    {workflowPolicy.seal.sealEditRoles.map((role) => (
                      <Button key={role} size="xs" variant="outline" onClick={() => {
                        setWorkflowPolicy((prev) => ({
                          ...prev,
                          seal: {
                            ...prev.seal,
                            sealEditRoles: prev.seal.sealEditRoles.filter((entry) => entry !== role),
                          },
                        }));
                        markTouched();
                      }}>
                        {role} ×
                      </Button>
                    ))}
                  </HStack>
                </FormControl>
              </VStack>
            ) : null}

            {activeSection === "sample" ? (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Container type source</FormLabel>
                  <Select
                    value={workflowPolicy.sampling.containerTypeSource}
                    onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        sampling: {
                          ...prev.sampling,
                          containerTypeSource: event.target.value as ModuleWorkflowPolicy["sampling"]["containerTypeSource"],
                        },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="MASTER_ONLY">Master list only</option>
                  </Select>
                </FormControl>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Homogeneous proof required</Text>
                    <Text fontSize="sm" color="text.secondary">Requires proof completion before packet creation.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.sampling.homogeneousProofRequired} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      sampling: { ...prev.sampling, homogeneousProofRequired: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <FormControl>
                  <FormLabel>Homogeneous weight capture</FormLabel>
                  <Input value="Disabled by policy" isReadOnly />
                  <FormHelperText>Homogeneous step is proof-only and does not capture weight.</FormHelperText>
                </FormControl>
              </VStack>
            ) : null}

            {activeSection === "packet" ? (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Packet purpose ownership</FormLabel>
                  <Select
                    value={workflowPolicy.packet.packetPurposeMode}
                    onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        packet: {
                          ...prev.packet,
                          packetPurposeMode: event.target.value as ModuleWorkflowPolicy["packet"]["packetPurposeMode"],
                        },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="OPTIONAL">Set during operations packet creation</option>
                    <option value="RND_OWNED">Assigned by R&D after handoff</option>
                  </Select>
                </FormControl>
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="medium">Lock packet editing after Submit to R&D</Text>
                    <Text fontSize="sm" color="text.secondary">Prevents post-handover packet updates.</Text>
                  </Box>
                  <Switch isChecked={workflowPolicy.workflow.lockPacketEditingAfterRndSubmit} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      workflow: { ...prev.workflow, lockPacketEditingAfterRndSubmit: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <FormControl>
                  <FormLabel>Packet weight requirement</FormLabel>
                  <Input value="Required by policy" isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Submit to R&D availability</FormLabel>
                  <Select
                    value={workflowPolicy.workflow.submitToRndEnabled ? "ENABLED" : "DISABLED"}
                    onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: { ...prev.workflow, submitToRndEnabled: event.target.value === "ENABLED" },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="ENABLED">Enabled</option>
                    <option value="DISABLED">Disabled</option>
                  </Select>
                </FormControl>
              </VStack>
            ) : null}

            {activeSection === "approval" ? (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Final decision owner</FormLabel>
                  <Select
                    value={workflowPolicy.workflow.finalDecisionApproverPolicy}
                    onChange={(event) => {
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        workflow: {
                          ...prev.workflow,
                          finalDecisionApproverPolicy: event.target.value as ModuleWorkflowPolicy["workflow"]["finalDecisionApproverPolicy"],
                        },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER_ADMIN">Manager or Admin</option>
                  </Select>
                </FormControl>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Hold/Reject notes mandatory</Text>
                  <Switch isChecked={workflowPolicy.approval.holdRejectNotesMandatory} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      approval: { ...prev.approval, holdRejectNotesMandatory: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Notify on assign</Text>
                  <Switch isChecked={workflowPolicy.approval.notifyOnAssign} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      approval: { ...prev.approval, notifyOnAssign: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Notify on submit</Text>
                  <Switch isChecked={workflowPolicy.approval.notifyOnSubmit} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      approval: { ...prev.approval, notifyOnSubmit: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Notify on decision</Text>
                  <Switch isChecked={workflowPolicy.approval.notifyOnDecision} onChange={(event) => {
                    setWorkflowPolicy((prev) => ({
                      ...prev,
                      approval: { ...prev.approval, notifyOnDecision: event.target.checked },
                    }));
                    markTouched();
                  }} />
                </HStack>
              </VStack>
            ) : null}

            {activeSection === "access" ? (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Allowed modules (company policy)</FormLabel>
                  <Select
                    value=""
                    onChange={(event) => {
                      const moduleId = event.target.value;
                      if (!moduleId) {
                        return;
                      }
                      setWorkflowPolicy((prev) => ({
                        ...prev,
                        access: {
                          ...prev.access,
                          allowedModuleIds: Array.from(new Set([...prev.access.allowedModuleIds, moduleId])),
                        },
                      }));
                      markTouched();
                    }}
                  >
                    <option value="">Add module</option>
                    {ALL_MODULE_OPTIONS.map((moduleId) => (
                      <option key={moduleId} value={moduleId}>{moduleId}</option>
                    ))}
                  </Select>
                  <HStack mt={2} spacing={2} flexWrap="wrap">
                    {workflowPolicy.access.allowedModuleIds.map((moduleId) => (
                      <Button key={moduleId} size="xs" variant="outline" onClick={() => {
                        setWorkflowPolicy((prev) => ({
                          ...prev,
                          access: {
                            ...prev.access,
                            allowedModuleIds: prev.access.allowedModuleIds.filter((entry) => entry !== moduleId),
                          },
                        }));
                        markTouched();
                      }}>
                        {moduleId} ×
                      </Button>
                    ))}
                  </HStack>
                </FormControl>
                <Text fontSize="sm" color="text.secondary">
                  User onboarding and credential setup remain in admin onboarding flow for now.
                </Text>
                <HStack spacing={3} flexWrap="wrap">
                  <Button as={Link} href="/admin" variant="outline">Open Admin Workspace</Button>
                  <Button as={Link} href="/master" variant="outline">Open Master Data</Button>
                </HStack>
              </VStack>
            ) : null}

          </VStack>

          <VStack
            align="stretch"
            spacing={2.5}
            borderWidth="1px"
            borderColor="border.default"
            borderRadius="lg"
            p={3}
            bg="bg.surface"
            w={{ base: "full", xl: "300px" }}
            position={{ xl: "sticky" }}
            top={{ xl: "88px" }}
          >
            <Text fontWeight="semibold">Settings Summary</Text>
            <Text fontSize="sm" color="text.secondary">
              Applies to all new and active workflows in this company scope.
            </Text>
            <Divider />
            <Text fontSize="sm">Unsaved changes: {touched ? "Yes" : "No"}</Text>
            <Text fontSize="sm">Final decision owner: {workflowPolicy.workflow.finalDecisionApproverPolicy}</Text>
            <Text fontSize="sm">Required image categories: {workflowPolicy.images.requiredImageCategories.length}</Text>
            <Text fontSize="sm">Allowed modules: {workflowPolicy.access.allowedModuleIds.length}</Text>
            <Text fontSize="xs" color="text.muted">
              Empty all three image buckets is invalid and will be auto-repaired to recommended defaults.
            </Text>
            <Divider />
            <Text fontSize="sm" color="text.secondary">
              Master-data quick links:
            </Text>
            <HStack spacing={2} flexWrap="wrap">
              <Button as={Link} href="/master" size="sm" variant="outline">Clients / Items</Button>
              <Button as={Link} href="/master" size="sm" variant="outline">Container Types</Button>
              <Button as={Link} href="/master" size="sm" variant="outline">Transporters</Button>
              <Button as={Link} href="/admin/settings/company" size="sm" variant="outline">Company Profile</Button>
            </HStack>
          </VStack>
        </Stack>

        <MobileActionRail>
          <Button
            colorScheme="blue"
            leftIcon={<Save size={16} />}
            onClick={() => void handleSave()}
            isLoading={saving}
            isDisabled={loading || !touched}
          >
            Save Settings
          </Button>
        </MobileActionRail>
      </VStack>
    </ControlTowerLayout>
  );
}
