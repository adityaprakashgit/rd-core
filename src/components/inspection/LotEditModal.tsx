"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { TopErrorBanner } from "@/components/enterprise/AsyncState";
import type { InspectionLot } from "@/types/inspection";

type QuantityMode = "SINGLE_PIECE" | "MULTI_WEIGHT";

export function LotEditModal({
  isOpen,
  onClose,
  onSaved,
  lot,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  lot: InspectionLot;
}) {
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);

  const [lotNumber, setLotNumber] = useState("");
  const [materialCategory, setMaterialCategory] = useState("");
  const [quantityMode, setQuantityMode] = useState<QuantityMode>("SINGLE_PIECE");
  const [bagCount, setBagCount] = useState("");
  const [pieceCount, setPieceCount] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (isOpen && lot) {
      setLotNumber(lot.lotNumber || "");
      setMaterialCategory(lot.materialCategory || "");
      setQuantityMode(lot.quantityMode === "MULTI_WEIGHT" ? "MULTI_WEIGHT" : "SINGLE_PIECE");
      setBagCount(lot.bagCount?.toString() || "");
      setPieceCount(lot.pieceCount?.toString() || "");
      setGrossWeight(lot.grossWeight?.toString() || "");
      setNetWeight(lot.netWeight?.toString() || "");
      setWeightUnit(lot.weightUnit || "kg");
      setRemarks(lot.remarks || lot.inspection?.overallRemark || "");
      setSurfaceError(null);
    }
  }, [isOpen, lot]);

  async function handleSave() {
    setSaving(true);
    setSurfaceError(null);

    try {
      const response = await fetch("/api/inspection/lots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: lot.id,
          expectedUpdatedAt: new Date(lot.updatedAt || lot.createdAt).toISOString(),
          materialName: materialCategory.trim() || "Item",
          materialCategory: materialCategory.trim() || undefined,
          quantityMode,
          bagCount: bagCount.trim() ? Number(bagCount) : null,
          pieceCount: pieceCount.trim() ? Number(pieceCount) : null,
          grossWeight: grossWeight.trim() ? Number(grossWeight) : null,
          netWeight: netWeight.trim() ? Number(netWeight) : null,
          weightUnit: weightUnit.trim() || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw await response.json();
      }

      toast({
        title: "Lot updated",
        status: "success",
      });

      await onSaved();
      onClose();
    } catch (error: unknown) {
      const details =
        error && typeof error === "object" && "details" in error
          ? String((error as { details?: unknown }).details)
          : "Unable to update the lot record.";

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="bg.app">
        <ModalHeader>
          <Heading size="md">Edit lot details</Heading>
          <Text fontSize="sm" color="text.secondary" mt={1}>
            Update core lot parameters for {lotNumber}.
          </Text>
          <ModalCloseButton />
        </ModalHeader>

        <ModalBody pb={6}>
          <VStack align="stretch" spacing={5}>
            {surfaceError ? (
              <TopErrorBanner title="Save blocked" description={surfaceError} onDismiss={() => setSurfaceError(null)} />
            ) : null}

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Lot number</FormLabel>
                <Input value={lotNumber} isDisabled />
                <Text fontSize="xs" color="text.muted" mt={1}>Lot number cannot be changed directly.</Text>
              </FormControl>
              <FormControl>
                <FormLabel>Material category</FormLabel>
                <Input value={materialCategory} onChange={(e) => setMaterialCategory(e.target.value)} />
              </FormControl>
            </SimpleGrid>

            {quantityMode === "SINGLE_PIECE" ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Bag count</FormLabel>
                  <Input type="number" inputMode="numeric" value={bagCount} onChange={(e) => setBagCount(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Piece count</FormLabel>
                  <Input type="number" inputMode="numeric" value={pieceCount} onChange={(e) => setPieceCount(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Gross weight</FormLabel>
                  <Input type="number" inputMode="decimal" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Net weight</FormLabel>
                  <Input type="number" inputMode="decimal" value={netWeight} onChange={(e) => setNetWeight(e.target.value)} />
                </FormControl>
              </SimpleGrid>
            ) : (
              <Text fontSize="sm" color="text.secondary">
                For Multi Weight mode, individual weights must be updated via the lot bag level API/workflow.
              </Text>
            )}

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl maxW="200px">
                <FormLabel>Unit</FormLabel>
                <Input value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} />
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Remarks</FormLabel>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter borderTopWidth="1px" borderColor="border.default">
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
