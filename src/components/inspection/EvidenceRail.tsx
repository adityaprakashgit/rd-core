"use client";

import { useMemo, useRef } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Icon,
  Image,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AlertTriangle, Camera, CheckCircle2, RefreshCcw, Upload } from "lucide-react";

export type EvidenceRailStatus = "missing" | "uploaded" | "retake";

export type EvidenceRailItem = {
  id: string;
  title: string;
  note?: string;
  required: boolean;
  status: EvidenceRailStatus;
  previewUrl?: string | null;
  error?: string | null;
  isLoading?: boolean;
  isDisabled?: boolean;
};

export function EvidenceRail({
  items,
  onUpload,
  onClearError,
}: {
  items: EvidenceRailItem[];
  onUpload: (itemId: string, file: File) => void | Promise<void>;
  onClearError?: (itemId: string) => void;
}) {
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const nextMissingId = useMemo(
    () => items.find((item) => item.required && item.status !== "uploaded")?.id ?? null,
    [items],
  );

  function getStatusMeta(status: EvidenceRailStatus) {
    if (status === "uploaded") {
      return { label: "Uploaded", colorScheme: "green" as const, icon: CheckCircle2 };
    }
    if (status === "retake") {
      return { label: "Retake", colorScheme: "orange" as const, icon: RefreshCcw };
    }
    return { label: "Missing", colorScheme: "red" as const, icon: AlertTriangle };
  }

  return (
    <VStack align="stretch" spacing={4}>
      {items.map((item, index) => {
        const statusMeta = getStatusMeta(item.status);
        const isNextMissing = nextMissingId === item.id;

        return (
          <Box
            key={item.id}
            borderWidth="1px"
            borderColor={isNextMissing ? "orange.300" : "border.default"}
            bg={isNextMissing ? "orange.50" : "transparent"}
            borderRadius="xl"
            p={4}
          >
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" align="start" spacing={2}>
                <Box>
                  <HStack spacing={2} flexWrap="wrap">
                    <Text fontWeight="semibold">{item.title}</Text>
                    <Badge colorScheme={item.required ? "red" : "gray"} variant="subtle">
                      {item.required ? "Required" : "Optional"}
                    </Badge>
                    <Badge colorScheme={statusMeta.colorScheme} variant="subtle">
                      <HStack spacing={1}>
                        <Icon as={statusMeta.icon} boxSize={3.5} />
                        <Text as="span">{statusMeta.label}</Text>
                      </HStack>
                    </Badge>
                    {isNextMissing ? (
                      <Badge colorScheme="orange" variant="solid">Next missing evidence</Badge>
                    ) : null}
                  </HStack>
                  {item.note ? (
                    <Text fontSize="sm" color="text.secondary" mt={1}>
                      {item.note}
                    </Text>
                  ) : null}
                </Box>
              </HStack>

              {item.previewUrl ? (
                <Image src={item.previewUrl} alt={item.title} borderRadius="lg" h="140px" w="100%" objectFit="cover" />
              ) : (
                <Box borderRadius="lg" h="140px" bg="bg.rail" display="flex" alignItems="center" justifyContent="center">
                  <Text fontSize="sm" color="text.secondary">Proof pending</Text>
                </Box>
              )}

              {item.error ? (
                <Box borderRadius="md" bg="red.50" borderWidth="1px" borderColor="red.100" p={3}>
                  <Text fontSize="sm" color="red.700">{item.error}</Text>
                  {onClearError ? (
                    <Button mt={2} size="xs" variant="ghost" onClick={() => onClearError(item.id)}>
                      Clear error
                    </Button>
                  ) : null}
                </Box>
              ) : null}

              <HStack spacing={2}>
                <Input
                  type="file"
                  accept="image/*"
                  display="none"
                  ref={(node) => {
                    fileInputsRef.current[item.id] = node;
                  }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void onUpload(item.id, file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={item.status === "retake" ? <RefreshCcw size={14} /> : item.previewUrl ? <Camera size={14} /> : <Upload size={14} />}
                  onClick={() => fileInputsRef.current[item.id]?.click()}
                  isLoading={item.isLoading}
                  isDisabled={item.isDisabled}
                >
                  {item.status === "retake" ? "Retry" : item.previewUrl ? "Retake" : "Upload"}
                </Button>
              </HStack>
            </VStack>
            {index < items.length - 1 ? <Divider mt={4} /> : null}
          </Box>
        );
      })}
    </VStack>
  );
}
