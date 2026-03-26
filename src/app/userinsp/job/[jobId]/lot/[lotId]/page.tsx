"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Divider,
  FormControl,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Thead,
  Tr,
  Th,
  useToast,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Plus,
  ScanLine,
  Save,
  Upload,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";
import { InspectionJob, InspectionLot, InspectionBag, Sampling } from "@/types/inspection";

type SamplingStep = "before" | "during" | "after";
type PhotoCategory = "BAG" | "SEAL";

const samplingSteps: Array<{ key: SamplingStep; title: string; note: string }> = [
  { key: "before", title: "Before", note: "Initial condition capture" },
  { key: "during", title: "During", note: "Mid-process traceability" },
  { key: "after", title: "After", note: "Post-process evidence" },
];

function getSamplingStatus(sampling: Sampling | null) {
  if (!sampling) {
    return { label: "Not Started", color: "gray" };
  }

  const hasAll = Boolean(sampling.beforePhotoUrl && sampling.duringPhotoUrl && sampling.afterPhotoUrl);
  return hasAll
    ? { label: "Completed", color: "green" }
    : { label: "In Progress", color: "orange" };
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  return String(value);
}

function getTraceabilityPhotoCount(lot: InspectionLot | null, sampling: Sampling | null) {
  const samplingReady = Boolean(sampling?.beforePhotoUrl || sampling?.duringPhotoUrl || sampling?.afterPhotoUrl);
  const flags = [Boolean(lot?.bagPhotoUrl), samplingReady, Boolean(lot?.sealPhotoUrl)];
  return flags.filter(Boolean).length;
}

export default function LotDetailPage() {
  const { jobId, lotId } = useParams<{ jobId: string; lotId: string }>();
  const router = useRouter();
  const { viewMode } = useWorkspaceView();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<InspectionJob | null>(null);
  const [lot, setLot] = useState<InspectionLot | null>(null);
  const [bags, setBags] = useState<InspectionBag[]>([]);
  const [sampling, setSampling] = useState<Sampling | null>(null);
  const [bagDrafts, setBagDrafts] = useState<Record<string, { grossWeight: string; netWeight: string }>>({});
  const [bagCount, setBagCount] = useState("1");
  const [savingBags, setSavingBags] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [uploadingStep, setUploadingStep] = useState<SamplingStep | null>(null);
  const [uploadingLotPhoto, setUploadingLotPhoto] = useState<PhotoCategory | null>(null);
  const [savingSampling, setSavingSampling] = useState(false);
  const [sealDraft, setSealDraft] = useState("");
  const [generatingSeal, setGeneratingSeal] = useState(false);
  const [assigningSeal, setAssigningSeal] = useState(false);

  const inputRefs = useRef<Record<SamplingStep | "bag" | "seal", HTMLInputElement | null>>({
    before: null,
    during: null,
    after: null,
    bag: null,
    seal: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, bagsRes, samplingRes, lotsRes] = await Promise.all([
        fetch(`/api/inspection/jobs?view=${viewMode}`),
        fetch(`/api/inspection/bags?lotId=${lotId}`),
        fetch(`/api/inspection/sampling?lotId=${lotId}`),
        fetch(`/api/inspection/lots?jobId=${jobId}`),
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        const currentJob = Array.isArray(jobsData) ? jobsData.find((item: InspectionJob) => item.id === jobId) : null;
        setJob(currentJob ?? null);
        const currentLot = currentJob?.lots?.find((entry: InspectionLot) => entry.id === lotId) ?? null;
        setLot(currentLot ?? null);
      }

      if (lotsRes.ok) {
        const lotsData = await lotsRes.json();
        if (Array.isArray(lotsData)) {
          const hydratedLot = lotsData.find((entry: InspectionLot) => entry.id === lotId) ?? null;
          if (hydratedLot) {
            setLot(hydratedLot);
          }
        }
      }

      if (bagsRes.ok) {
        const bagsData = await bagsRes.json();
        const nextBags = Array.isArray(bagsData) ? bagsData : [];
        setBags(nextBags);
        setBagDrafts(
          nextBags.reduce<Record<string, { grossWeight: string; netWeight: string }>>((acc, bag) => {
            acc[bag.id] = {
              grossWeight: formatWeight(bag.grossWeight as number | null | undefined),
              netWeight: formatWeight(bag.netWeight as number | null | undefined),
            };
            return acc;
          }, {})
        );
      }

      if (samplingRes.ok) {
        const samplingData = await samplingRes.json();
        setSampling(samplingData ?? null);
      }
    } catch {
      toast({ title: "Failed to load lot", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [jobId, lotId, toast, viewMode]);

  useEffect(() => {
    setSealDraft(lot?.sealNumber ?? "");
  }, [lot?.sealNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const samplingDraft = useMemo(() => ({
    before: sampling?.beforePhotoUrl ?? null,
    during: sampling?.duringPhotoUrl ?? null,
    after: sampling?.afterPhotoUrl ?? null,
  }), [sampling]);

  const persistSampling = useCallback(async (draft: Record<SamplingStep, string | null>) => {
    setSavingSampling(true);
    try {
      const res = await fetch("/api/inspection/sampling", {
        method: sampling ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId,
          beforePhotoUrl: draft.before ?? undefined,
          duringPhotoUrl: draft.during ?? undefined,
          afterPhotoUrl: draft.after ?? undefined,
        }),
      });

      if (!res.ok) {
        throw await res.json();
      }

      const nextSampling = await res.json();
      setSampling(nextSampling);
      toast({ title: "Sampling saved", status: "success" });
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to save sampling";
      toast({ title: "Sampling save failed", description: details, status: "error" });
    } finally {
      setSavingSampling(false);
    }
  }, [lotId, sampling, toast]);

  const handleSamplingUpload = useCallback(async (step: SamplingStep, file: File) => {
    setUploadingStep(step);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lotId", lotId);
      formData.append("category", step.toUpperCase());

      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw await uploadRes.json();
      }

      const uploadData = await uploadRes.json();
      const nextDraft = {
        ...samplingDraft,
        [step]: uploadData.url,
      } as Record<SamplingStep, string | null>;

      await persistSampling(nextDraft);
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to upload image";
      toast({ title: "Upload failed", description: details, status: "error" });
    } finally {
      setUploadingStep(null);
    }
  }, [lotId, persistSampling, samplingDraft, toast]);

  const handleLotPhotoUpload = useCallback(
    async (category: PhotoCategory, file: File) => {
      setUploadingLotPhoto(category);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("lotId", lotId);
        formData.append("category", category);

        const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          throw await uploadRes.json();
        }

        const uploadData = await uploadRes.json();
        setLot((prev) => {
          if (!prev) return prev;
          return category === "BAG"
            ? { ...prev, bagPhotoUrl: uploadData.url }
            : { ...prev, sealPhotoUrl: uploadData.url };
        });
        toast({ title: `${category === "BAG" ? "Bag" : "Seal"} photo uploaded`, status: "success" });
      } catch (err: unknown) {
        const details = err && typeof err === "object" && "details" in err
          ? String((err as { details?: unknown }).details)
          : "Unable to upload image";
        toast({ title: "Upload failed", description: details, status: "error" });
      } finally {
        setUploadingLotPhoto(null);
      }
    },
    [lotId, toast]
  );

  const handleGenerateSeal = useCallback(async () => {
    setGeneratingSeal(true);
    try {
      const res = await fetch("/api/seal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        throw await res.json();
      }

      const data = await res.json() as { sealNumber?: string };
      if (!data.sealNumber) {
        throw new Error("Seal generation failed.");
      }

      setSealDraft(data.sealNumber);
      toast({ title: "Seal number generated", status: "success" });
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to generate seal";
      toast({ title: "Seal generation failed", description: details, status: "error" });
    } finally {
      setGeneratingSeal(false);
    }
  }, [jobId, toast]);

  const handleAssignSeal = useCallback(async (auto: boolean) => {
    setAssigningSeal(true);
    try {
      const res = await fetch(`/api/lots/${lotId}/seal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auto ? { auto: true } : { sealNumber: sealDraft.trim() }),
      });

      if (!res.ok) {
        throw await res.json();
      }

      const data = await res.json() as { sealNumber?: string; sealAuto?: boolean };
      setLot((prev) => (prev ? { ...prev, sealNumber: data.sealNumber ?? prev.sealNumber, sealAuto: data.sealAuto ?? prev.sealAuto } : prev));
      setSealDraft(data.sealNumber ?? sealDraft);
      toast({ title: "Seal assigned", status: "success" });
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to assign seal";
      toast({ title: "Seal assignment failed", description: details, status: "error" });
    } finally {
      setAssigningSeal(false);
    }
  }, [lotId, sealDraft, toast]);

  const handleBagSave = useCallback(async (bag: InspectionBag) => {
    const draft = bagDrafts[bag.id];
    if (!draft) return;

    setSavingBags(bag.id);
    try {
      const res = await fetch("/api/inspection/bags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bagId: bag.id,
          grossWeight: draft.grossWeight,
          netWeight: draft.netWeight,
        }),
      });

      if (!res.ok) {
        throw await res.json();
      }

      const updated = await res.json();
      setBags((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast({ title: "Bag saved", status: "success" });
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to save bag weights";
      toast({ title: "Bag save failed", description: details, status: "error" });
    } finally {
      setSavingBags(null);
    }
  }, [bagDrafts, toast]);

  const handleRegisterBags = useCallback(async () => {
    if (!lotId) return;

    const count = Number(bagCount);
    if (!Number.isFinite(count) || count <= 0) {
      toast({ title: "Invalid bag count", status: "warning" });
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch("/api/inspection/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId,
          bags: Array.from({ length: count }, () => ({ grossWeight: null, netWeight: null })),
        }),
      });

      if (!res.ok) {
        throw await res.json();
      }

      toast({ title: "Bag rows created", status: "success" });
      await fetchData();
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to register bags";
      toast({ title: "Registry failed", description: details, status: "error" });
    } finally {
      setRegistering(false);
    }
  }, [bagCount, fetchData, lotId, toast]);

  if (loading) {
    return (
      <ControlTowerLayout>
        <Center minH="40vh">
          <Spinner size="xl" color="teal.500" />
        </Center>
      </ControlTowerLayout>
    );
  }

  if (!job || !lot) {
    return (
      <ControlTowerLayout>
        <Center minH="40vh">
          <Text color="gray.500">Lot record not found.</Text>
        </Center>
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" flexWrap="wrap" spacing={3}>
          <HStack spacing={3}>
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => router.push(`/userinsp/job/${jobId}?view=${viewMode}`)}
            >
              Back to Job
            </Button>
            <Box>
              <HStack spacing={2} wrap="wrap">
                <Badge colorScheme="teal" variant="solid" borderRadius="full" px={3} py={1}>
                  {lot.lotNumber}
                </Badge>
                <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={2.5} py={1}>
                  {getSamplingStatus(sampling).label}
                </Badge>
              </HStack>
              <Heading size="lg" color="gray.900" mt={2}>
                Lot Control Panel
              </Heading>
              <Text fontSize="sm" color="gray.600">
                {job.clientName} - {job.commodity}
              </Text>
            </Box>
          </HStack>

          <HStack spacing={3} flexWrap="wrap">
            <Button
              leftIcon={<Plus size={16} />}
              colorScheme="teal"
              borderRadius="xl"
              onClick={() => inputRefs.current.before?.click()}
            >
              Upload Before
            </Button>
            <Button
              leftIcon={<Upload size={16} />}
              variant="outline"
              borderRadius="xl"
              onClick={() => inputRefs.current.during?.click()}
            >
              Upload During
            </Button>
            <Button
              leftIcon={<Upload size={16} />}
              variant="outline"
              borderRadius="xl"
              onClick={() => inputRefs.current.after?.click()}
            >
              Upload After
            </Button>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {[
            { label: "Total Bags", value: lot.totalBags, color: "teal", desc: "Lot capacity under control" },
            { label: "Captured Bags", value: bags.length, color: "blue", desc: "Rows currently registered" },
            { label: "Sampling State", value: getSamplingStatus(sampling).label, color: getSamplingStatus(sampling).color, desc: "Visibility across the workflow" },
            { label: "Traceability", value: `${getTraceabilityPhotoCount(lot, sampling)}/3`, color: "purple", desc: "Bag, sampling, and seal photo evidence" },
          ].map((item) => (
            <Card key={item.label} variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <Text fontSize="sm" color="gray.500" fontWeight="medium">
                  {item.label}
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color={`${item.color}.600`} mt={2}>
                  {item.value}
                </Text>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {item.desc}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, xl: 4 }} spacing={6}>
          <Box gridColumn={{ xl: "span 2" }}>
            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={6}>
                <HStack justify="space-between" flexWrap="wrap" spacing={3} mb={4}>
                  <Box>
                    <Heading size="md" color="gray.900">
                      Sampling Workflow
                    </Heading>
                    <Text color="gray.600" fontSize="sm">
                      Before, during, and after evidence are tracked independently and saved immediately.
                    </Text>
                  </Box>
                  <Badge colorScheme={getSamplingStatus(sampling).color} variant="subtle" borderRadius="full" px={3} py={1}>
                    {getSamplingStatus(sampling).label}
                  </Badge>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  {samplingSteps.map((step) => {
                    const url = samplingDraft[step.key];
                    const active = Boolean(url);
                    return (
                      <Card key={step.key} variant="outline" borderRadius="xl" bg={active ? "teal.50" : "gray.50"} borderColor={active ? "teal.100" : "gray.200"}>
                        <CardBody p={4}>
                          <HStack justify="space-between" mb={3}>
                            <Box>
                              <Text fontWeight="bold" color="gray.900">
                                {step.title.toUpperCase()}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {step.note}
                              </Text>
                            </Box>
                            <Badge colorScheme={active ? "green" : "gray"} variant="subtle" borderRadius="full" px={2.5} py={1}>
                              {active ? "CAPTURED" : "PENDING"}
                            </Badge>
                          </HStack>

                          <Box
                            h="180px"
                            borderRadius="xl"
                            borderWidth="1px"
                            borderStyle="dashed"
                            borderColor={active ? "teal.200" : "gray.200"}
                            bg="white"
                            overflow="hidden"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            mb={3}
                          >
                            {url ? (
                              <Image src={url} alt={step.title} objectFit="cover" w="full" h="full" />
                            ) : (
                              <VStack spacing={2}>
                                <Icon as={Camera} boxSize={8} color="gray.300" />
                                <Text fontSize="sm" color="gray.500">
                                  No image uploaded
                                </Text>
                              </VStack>
                            )}
                          </Box>

                          <Button
                            w="full"
                            variant="outline"
                            borderRadius="xl"
                            leftIcon={<Camera size={16} />}
                            onClick={() => inputRefs.current[step.key]?.click()}
                            isLoading={uploadingStep === step.key}
                          >
                            Upload {step.title}
                          </Button>

                          <input
                            ref={(node) => {
                              inputRefs.current[step.key] = node;
                            }}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.currentTarget.value = "";
                              if (file) {
                                void handleSamplingUpload(step.key, file);
                              }
                            }}
                          />
                        </CardBody>
                      </Card>
                    );
                  })}
                </SimpleGrid>

                <HStack justify="end" mt={4}>
                  <Button
                    leftIcon={<Save size={16} />}
                    colorScheme="teal"
                    borderRadius="xl"
                    isLoading={savingSampling}
                    onClick={() => persistSampling({
                      before: samplingDraft.before,
                      during: samplingDraft.during,
                      after: samplingDraft.after,
                    })}
                  >
                    Save Sampling Record
                  </Button>
                </HStack>
              </CardBody>
            </Card>
          </Box>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <Heading size="sm" color="gray.900" mb={3}>
                Lot Summary
              </Heading>
              <VStack align="stretch" spacing={3}>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.600">Status</Text>
                  <Badge colorScheme={getSamplingStatus(sampling).color} variant="subtle" borderRadius="full" px={2.5} py={1}>
                    {getSamplingStatus(sampling).label}
                  </Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.600">Traceability photos</Text>
                  <Text fontWeight="bold" color="gray.900">
                    {getTraceabilityPhotoCount(lot, sampling)}/3
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.600">Uploaded images</Text>
                  <Text fontWeight="bold" color="gray.900">
                    {[samplingDraft.before, samplingDraft.during, samplingDraft.after].filter(Boolean).length}/3
                  </Text>
                </HStack>
                <Divider />
                <Text fontSize="sm" color="gray.600">
                  This panel keeps the workflow compact while maintaining full traceability for all evidence stages.
                </Text>
              </VStack>
            </CardBody>
          </Card>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <Heading size="sm" color="gray.900" mb={3}>
                Seal Control
              </Heading>
              <VStack align="stretch" spacing={3}>
                <FormControl>
                  <Input
                    value={sealDraft}
                    onChange={(event) => setSealDraft(event.target.value)}
                    placeholder="16-digit seal number"
                    isDisabled={Boolean(lot.sealNumber)}
                  />
                </FormControl>
                <HStack>
                  <Button
                    flex={1}
                    variant="outline"
                    leftIcon={<ScanLine size={16} />}
                    onClick={() => {
                      void handleGenerateSeal();
                    }}
                    isLoading={generatingSeal}
                    isDisabled={Boolean(lot.sealNumber)}
                  >
                    Generate
                  </Button>
                  <Button
                    flex={1}
                    colorScheme="teal"
                    onClick={() => {
                      void handleAssignSeal(false);
                    }}
                    isLoading={assigningSeal}
                    isDisabled={Boolean(lot.sealNumber)}
                  >
                    Assign
                  </Button>
                </HStack>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void handleAssignSeal(true);
                  }}
                  isLoading={assigningSeal}
                  isDisabled={Boolean(lot.sealNumber)}
                >
                  Auto Assign Seal
                </Button>
                <Text fontSize="xs" color="gray.500">
                  {lot.sealNumber ? `Assigned seal: ${lot.sealNumber}` : "Seal can be assigned only once."}
                </Text>
              </VStack>
            </CardBody>
          </Card>

          <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
            <CardBody p={5}>
              <Heading size="sm" color="gray.900" mb={3}>
                Photo Traceability
              </Heading>
              <VStack align="stretch" spacing={4}>
                {[
                  {
                    key: "BAG" as const,
                    title: "Bag Photo",
                    url: lot.bagPhotoUrl,
                  },
                  {
                    key: "SEAL" as const,
                    title: "Seal Photo",
                    url: lot.sealPhotoUrl,
                  },
                ].map((entry) => (
                  <Box key={entry.key}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color="gray.700" fontWeight="medium">
                        {entry.title}
                      </Text>
                      <Badge colorScheme={entry.url ? "green" : "gray"} variant="subtle" borderRadius="full" px={2.5} py={1}>
                        {entry.url ? "CAPTURED" : "PENDING"}
                      </Badge>
                    </HStack>
                    <Box
                      h="120px"
                      borderRadius="xl"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor={entry.url ? "teal.200" : "gray.200"}
                      bg="white"
                      overflow="hidden"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      mb={2}
                    >
                      {entry.url ? (
                        <Image src={entry.url} alt={entry.title} objectFit="cover" w="full" h="full" />
                      ) : (
                        <VStack spacing={1}>
                          <Icon as={Camera} boxSize={6} color="gray.300" />
                          <Text fontSize="xs" color="gray.500">
                            No image
                          </Text>
                        </VStack>
                      )}
                    </Box>
                    <Button
                      w="full"
                      size="sm"
                      variant="outline"
                      leftIcon={<Camera size={14} />}
                      onClick={() => inputRefs.current[entry.key === "BAG" ? "bag" : "seal"]?.click()}
                      isLoading={uploadingLotPhoto === entry.key}
                    >
                      Upload {entry.title}
                    </Button>
                    <input
                      ref={(node) => {
                        inputRefs.current[entry.key === "BAG" ? "bag" : "seal"] = node;
                      }}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) {
                          void handleLotPhotoUpload(entry.key, file);
                        }
                      }}
                    />
                  </Box>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
          <CardBody p={0}>
            <HStack justify="space-between" p={5} borderBottomWidth="1px" borderColor="gray.100" flexWrap="wrap" spacing={3}>
              <Box>
                <Heading size="md" color="gray.900">
                  Bag Table
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Inline editing for gross and net weight capture.
                </Text>
              </Box>
              <HStack>
                <FormControl w="28">
                  <Input type="number" min={1} value={bagCount} onChange={(e) => setBagCount(e.target.value)} size="sm" />
                </FormControl>
                <Button colorScheme="teal" leftIcon={<Plus size={16} />} onClick={handleRegisterBags} isLoading={registering}>
                  Add Bags
                </Button>
              </HStack>
            </HStack>

            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Bag Number</Th>
                    <Th>Gross Weight</Th>
                    <Th>Net Weight</Th>
                    <Th textAlign="right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {bags.map((bag) => (
                    <Tr key={bag.id}>
                      <Td fontWeight="semibold">#{bag.bagNumber}</Td>
                      <Td>
                        <Input
                          size="sm"
                          value={bagDrafts[bag.id]?.grossWeight ?? ""}
                          onChange={(e) => setBagDrafts((prev) => ({
                            ...prev,
                            [bag.id]: {
                              grossWeight: e.target.value,
                              netWeight: prev[bag.id]?.netWeight ?? "",
                            },
                          }))}
                        />
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          value={bagDrafts[bag.id]?.netWeight ?? ""}
                          onChange={(e) => setBagDrafts((prev) => ({
                            ...prev,
                            [bag.id]: {
                              grossWeight: prev[bag.id]?.grossWeight ?? "",
                              netWeight: e.target.value,
                            },
                          }))}
                        />
                      </Td>
                      <Td>
                        <HStack justify="end">
                          <Button
                            size="sm"
                            colorScheme="teal"
                            leftIcon={<Save size={14} />}
                            onClick={() => handleBagSave(bag)}
                            isLoading={savingBags === bag.id}
                          >
                            Save
                          </Button>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                  {bags.length === 0 && (
                    <Tr>
                      <Td colSpan={4}>
                        <Center py={12}>
                          <VStack spacing={2}>
                            <Icon as={CheckCircle2} boxSize={8} color="gray.300" />
                            <Text color="gray.500">No bags registered for this lot.</Text>
                          </VStack>
                        </Center>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </TableContainer>
          </CardBody>
        </Card>
      </VStack>
    </ControlTowerLayout>
  );
}
