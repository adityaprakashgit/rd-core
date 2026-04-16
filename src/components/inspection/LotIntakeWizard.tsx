"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, ImageIcon, Package2, Scale, ShieldCheck } from "lucide-react";

import { Card } from "@/components/Card";
import { TopErrorBanner } from "@/components/enterprise/AsyncState";
import { getEvidenceCategoryLabel, LOT_INTAKE_EVIDENCE_ITEMS } from "@/lib/evidence-definition";
import { createRandomId } from "@/lib/random-id";
import type { InspectionMediaCategory } from "@/types/inspection";

type QuantityMode = "SINGLE_PIECE" | "MULTI_WEIGHT";

type WizardPhoto = {
  category: InspectionMediaCategory;
  title: string;
  required: boolean;
  hint: string;
};

type WeightRow = {
  id: string;
  bagNo: string;
  weight: string;
};

const wizardSteps = [
  { id: "details", label: "Lot basics" },
  { id: "quantity", label: "Quantity" },
  { id: "photos", label: "Photos" },
  { id: "review", label: "Review" },
] as const;

const photoBlueprint: WizardPhoto[] = [
  ...LOT_INTAKE_EVIDENCE_ITEMS.map((item) => ({
    category: item.category,
    title: getEvidenceCategoryLabel(item.category),
    required: item.required,
    hint: item.hint,
  })),
];

const emptyPhotos = photoBlueprint.reduce<Record<string, File | null>>((acc, item) => {
  acc[item.category] = null;
  return acc;
}, {});

function formatModeLabel(mode: QuantityMode) {
  return mode === "MULTI_WEIGHT" ? "Multi Weight" : "Single Piece";
}

export function LotIntakeWizard({
  jobId,
  isOpen,
  materialCategory,
  onClose,
  onSaved,
}: {
  jobId: string;
  isOpen: boolean;
  materialCategory?: string | null;
  onClose: () => void;
  onSaved: (lotId: string) => Promise<void> | void;
}) {
  const toast = useToast();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [lotNumber, setLotNumber] = useState("");
  const [lotMaterialCategory, setLotMaterialCategory] = useState(materialCategory ?? "");
  const [quantityMode, setQuantityMode] = useState<QuantityMode>("SINGLE_PIECE");
  const [bagCount, setBagCount] = useState("");
  const [pieceCount, setPieceCount] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [remarks, setRemarks] = useState("");
  const [weightRows, setWeightRows] = useState<WeightRow[]>([
    { id: createRandomId(), bagNo: "1", weight: "" },
  ]);
  const [photos, setPhotos] = useState<Record<string, File | null>>({ ...emptyPhotos });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setLotMaterialCategory(materialCategory ?? "");
  }, [isOpen, materialCategory]);

  const progressValue = ((stepIndex + 1) / wizardSteps.length) * 100;

  function resetWizard() {
    setStepIndex(0);
    setSaving(false);
    setSurfaceError(null);
    setLotNumber("");
    setLotMaterialCategory(materialCategory ?? "");
    setQuantityMode("SINGLE_PIECE");
    setBagCount("");
    setPieceCount("");
    setGrossWeight("");
    setNetWeight("");
    setWeightUnit("kg");
    setRemarks("");
    setWeightRows([{ id: createRandomId(), bagNo: "1", weight: "" }]);
    setPhotos({ ...emptyPhotos });
  }

  function closeAndReset() {
    resetWizard();
    onClose();
  }

  function canAdvanceFromCurrentStep() {
    if (stepIndex === 0) {
      return lotNumber.trim().length > 0;
    }

    if (stepIndex === 1) {
      return grossWeight.trim().length > 0 || netWeight.trim().length > 0;
    }

    if (stepIndex === 2) {
      return photoBlueprint
        .filter((photo) => photo.required)
        .every((photo) => photos[photo.category]);
    }

    return true;
  }

  function goNext() {
    if (!canAdvanceFromCurrentStep()) {
      setSurfaceError(stepIndex === 2 ? "Required evidence photos are still missing." : "Required lot details are still missing.");
      toast({
        title: "Finish the current step",
        description: stepIndex === 2 ? "Required evidence photos are still missing." : "Required lot details are still missing.",
        status: "warning",
      });
      return;
    }

    setStepIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
    setSurfaceError(null);
  }

  function updateWeightRow(id: string, patch: Partial<WeightRow>) {
    setWeightRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addWeightRow() {
    setWeightRows((rows) => [
      ...rows,
        {
        id: createRandomId(),
        bagNo: String(rows.length + 1),
        weight: "",
      },
    ]);
  }

  async function uploadPhoto(lotId: string, category: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lotId", lotId);
    formData.append("category", category);
    formData.append("fileName", file.name);

    const response = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw await response.json();
    }
  }

  async function handleSave() {
    setSaving(true);
    setSurfaceError(null);
    try {
      const createLotResponse = await fetch("/api/inspection/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotNumber: lotNumber.trim(),
          materialName: lotMaterialCategory.trim() || "Item",
          materialCategory: lotMaterialCategory.trim() || undefined,
          quantityMode,
          bagCount: bagCount.trim() ? Number(bagCount) : null,
          pieceCount: pieceCount.trim() ? Number(pieceCount) : null,
          totalBags: quantityMode === "MULTI_WEIGHT" ? weightRows.filter((row) => row.weight.trim()).length : undefined,
          grossWeight: grossWeight.trim() ? Number(grossWeight) : null,
          netWeight: netWeight.trim() ? Number(netWeight) : null,
          weightUnit: weightUnit.trim() || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      if (!createLotResponse.ok) {
        throw await createLotResponse.json();
      }

      const lot = await createLotResponse.json();

      if (quantityMode === "MULTI_WEIGHT") {
        const validRows = weightRows.filter((row) => row.weight.trim().length > 0);
        if (validRows.length > 0) {
          const bagResponse = await fetch("/api/inspection/bags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lotId: lot.id,
              bags: validRows.map((row) => ({
                bagNumber: Number(row.bagNo) || undefined,
                grossWeight: Number(row.weight),
                netWeight: Number(row.weight),
              })),
            }),
          });

          if (!bagResponse.ok) {
            throw await bagResponse.json();
          }
        }
      }

      for (const photo of photoBlueprint) {
        const file = photos[photo.category];
        if (!file) {
          continue;
        }
        await uploadPhoto(lot.id, photo.category, file);
      }

      toast({
        title: "Lot added",
        description: `${lot.lotNumber} is now in the intake queue.`,
        status: "success",
      });

      await onSaved(lot.id);
      setSurfaceError(null);
      closeAndReset();
    } catch (error: unknown) {
      const details =
        error && typeof error === "object" && "details" in error
          ? String((error as { details?: unknown }).details)
          : "Unable to save the lot intake record.";

      toast({
        title: "Save failed",
        description: details,
        status: "error",
      });
      setSurfaceError(details);
    } finally {
      setSaving(false);
    }
  }

  function renderPhotoCard(photo: WizardPhoto) {
    const file = photos[photo.category];

    return (
      <Card key={photo.category} bg={file ? "green.50" : "white"} borderColor={file ? "green.200" : "border.default"}>
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" align="start">
            <Box>
              <Text fontWeight="semibold" color="text.primary">
                {photo.title}
              </Text>
              <Text fontSize="sm" color="text.secondary" mt={1}>
                {photo.hint}
              </Text>
            </Box>
            <Badge colorScheme={photo.required ? "orange" : "gray"}>
              {photo.required ? "Required" : "Optional"}
            </Badge>
          </HStack>

          <Box
            borderWidth="1px"
            borderStyle="dashed"
            borderColor={file ? "green.300" : "border.default"}
            borderRadius="xl"
            bg="whiteAlpha.800"
            minH="124px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            {file ? (
              <VStack spacing={2}>
                <Icon as={CheckCircle2} color="green.500" boxSize={8} />
                <Text fontSize="sm" color="green.700" fontWeight="semibold">
                  {file.name}
                </Text>
              </VStack>
            ) : (
              <VStack spacing={2}>
                <Icon as={ImageIcon} color="text.muted" boxSize={8} />
                <Text fontSize="sm" color="text.secondary">
                  Camera-first capture placeholder
                </Text>
              </VStack>
            )}
          </Box>

          <input
            ref={(node) => {
              fileInputs.current[photo.category] = node;
            }}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setPhotos((current) => ({ ...current, [photo.category]: nextFile }));
            }}
          />

          <HStack spacing={3}>
            <Button
              flex="1"
              leftIcon={<Camera size={16} />}
              onClick={() => fileInputs.current[photo.category]?.click()}
            >
              {file ? "Retake" : "Capture"}
            </Button>
            {file ? (
              <Badge colorScheme="green" alignSelf="center" px={3} py={1.5}>
                Done
              </Badge>
            ) : null}
          </HStack>
        </VStack>
      </Card>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={closeAndReset} size="full" scrollBehavior="inside">
      <ModalOverlay  />
      <ModalContent bg="bg.app">
        <ModalHeader pb={2}>
          <Stack spacing={3}>
            <HStack justify="space-between" align="center">
              <Box>
                <Badge colorScheme="brand">LOT INTAKE</Badge>
                <Heading size="lg" mt={2}>
                  Add lot
                </Heading>
                <Text fontSize="sm" color="text.secondary" mt={1}>
                  One screen, one task, one clear next step.
                </Text>
              </Box>
              <ModalCloseButton position="static" />
            </HStack>
            <Progress value={progressValue} size="sm" borderRadius="full" />
            <HStack spacing={2} overflowX="auto" pb={1}>
              {wizardSteps.map((step, index) => (
                <Badge
                  key={step.id}
                  colorScheme={index <= stepIndex ? "brand" : "gray"}
                  variant={index === stepIndex ? "solid" : "subtle"}
                  px={3}
                  py={1.5}
                >
                  {index + 1}. {step.label}
                </Badge>
              ))}
            </HStack>
          </Stack>
        </ModalHeader>

        <ModalBody>
          <VStack align="stretch" spacing={5} maxW="960px" mx="auto" py={2}>
            {surfaceError ? (
              <TopErrorBanner title="Lot save blocked" description={surfaceError} onDismiss={() => setSurfaceError(null)} />
            ) : null}

            {stepIndex === 0 ? (
              <Card>
                <VStack align="stretch" spacing={5}>
                  <HStack spacing={3}>
                    <Box p={3} borderRadius="lg" bg="bg.rail" color="brand.600">
                      <Package2 size={20} />
                    </Box>
                    <Box>
                      <Heading size="md">Lot basics</Heading>
                      <Text color="text.secondary" fontSize="sm" mt={1}>
                        Keep typing to the minimum needed to start inspection evidence.
                      </Text>
                    </Box>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>Lot no</FormLabel>
                      <Input value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} placeholder="e.g. LOT-018" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Material category</FormLabel>
                      <Input value={lotMaterialCategory} onChange={(event) => setLotMaterialCategory(event.target.value)} placeholder="e.g. Non-ferrous" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Remarks</FormLabel>
                      <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional intake note" rows={3} />
                    </FormControl>
                  </SimpleGrid>
                </VStack>
              </Card>
            ) : null}

            {stepIndex === 1 ? (
              <Card>
                <VStack align="stretch" spacing={5}>
                  <HStack spacing={3}>
                    <Box p={3} borderRadius="lg" bg="bg.rail" color="orange.600">
                      <Scale size={20} />
                    </Box>
                    <Box>
                      <Heading size="md">Single Piece quantity</Heading>
                      <Text color="text.secondary" fontSize="sm" mt={1}>
                        Capture a simple count and the overall weight. (At least one weight dimension is required to proceed)
                      </Text>
                    </Box>
                  </HStack>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Bag count</FormLabel>
                      <Input type="number" inputMode="numeric" value={bagCount} onChange={(event) => setBagCount(event.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Piece count</FormLabel>
                      <Input type="number" inputMode="numeric" value={pieceCount} onChange={(event) => setPieceCount(event.target.value)} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Gross weight</FormLabel>
                      <Input type="number" inputMode="decimal" value={grossWeight} onChange={(event) => setGrossWeight(event.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Net weight</FormLabel>
                      <Input type="number" inputMode="decimal" value={netWeight} onChange={(event) => setNetWeight(event.target.value)} />
                    </FormControl>
                    <FormControl maxW={{ md: "200px" }}>
                      <FormLabel>Unit</FormLabel>
                      <Input value={weightUnit} onChange={(event) => setWeightUnit(event.target.value)} />
                    </FormControl>
                  </SimpleGrid>
                </VStack>
              </Card>
            ) : null}

            {stepIndex === 2 ? (
              <VStack align="stretch" spacing={4}>
                <HStack spacing={3}>
                  <Box p={3} borderRadius="lg" bg="bg.rail" color="blue.600">
                    <Camera size={20} />
                  </Box>
                  <Box>
                    <Heading size="md">Capture inspection evidence photos</Heading>
                    <Text color="text.secondary" fontSize="sm" mt={1}>
                      Think social story flow: capture, confirm, continue.
                    </Text>
                  </Box>
                </HStack>
                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                  {photoBlueprint.map(renderPhotoCard)}
                </SimpleGrid>
              </VStack>
            ) : null}

            {stepIndex === 3 ? (
              <VStack align="stretch" spacing={4}>
                <Card>
                  <VStack align="stretch" spacing={4}>
                    <HStack spacing={3}>
                      <Box p={3} borderRadius="lg" bg="bg.rail" color="green.600">
                        <ShieldCheck size={20} />
                      </Box>
                      <Box>
                        <Heading size="md">Review lot intake</Heading>
                        <Text color="text.secondary" fontSize="sm" mt={1}>
                          One last glance before the lot enters the queue.
                        </Text>
                      </Box>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <Box>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                          Lot
                        </Text>
                        <Text fontWeight="semibold" mt={1}>{lotNumber}</Text>
                        <Text color="text.secondary">{lotMaterialCategory || "Item"}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                          Mode
                        </Text>
                        <Text fontWeight="semibold" mt={1}>Single Piece</Text>
                        <Text color="text.secondary">
                          {bagCount || pieceCount || "1"} units captured
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                          Photos
                        </Text>
                        <Text fontWeight="semibold" mt={1}>
                          {photoBlueprint.filter((photo) => photos[photo.category]).length} captured
                        </Text>
                        <Text color="text.secondary">
                          {photoBlueprint.filter((photo) => photo.required && photos[photo.category]).length}/{photoBlueprint.filter((photo) => photo.required).length} required done
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
                          Remarks
                        </Text>
                        <Text color="text.secondary" mt={1}>
                          {remarks.trim() || "No remarks added"}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </VStack>
                </Card>
              </VStack>
            ) : null}
          </VStack>
        </ModalBody>

        <ModalFooter borderTopWidth="1px" borderColor="border.default" bg="bg.surface">
          <HStack justify="space-between" w="full" maxW="960px" mx="auto">
            <Button variant="ghost" leftIcon={<ChevronLeft size={16} />} onClick={() => setStepIndex((current) => Math.max(current - 1, 0))} isDisabled={stepIndex === 0 || saving}>
              Back
            </Button>
            <HStack spacing={3}>
              <Button variant="outline" onClick={closeAndReset} isDisabled={saving}>
                Cancel
              </Button>
              {stepIndex < wizardSteps.length - 1 ? (
                <Button rightIcon={<ChevronRight size={16} />} onClick={goNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSave} isLoading={saving}>
                  Save lot
                </Button>
              )}
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
