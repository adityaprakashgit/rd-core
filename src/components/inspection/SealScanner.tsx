"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { Camera, ScanLine } from "lucide-react";

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
type ZxingControlsLike = { stop: () => void };

function getBarcodeDetectorCtor(): BarcodeDetectorCtorLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
  return detector ?? null;
}

export function SealScanner({
  onScanned,
  onManualConfirm,
  isDisabled = false,
}: {
  onScanned: (sealNumber: string) => void;
  onManualConfirm: (sealNumber: string) => void;
  isDisabled?: boolean;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<ZxingControlsLike | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualSeal, setManualSeal] = useState("");

  const supportsNativeBarcode = useMemo(() => Boolean(getBarcodeDetectorCtor()), []);
  const isValidSeal = /^\d{16}$/.test(manualSeal.trim());

  const stopScan = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const consumeScannedValue = useCallback(
    (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      if (/^\d{16}$/.test(digits)) {
        onScanned(digits);
        setManualSeal(digits);
        stopScan();
        onClose();
        return;
      }
      setScanError("Scanned value is not a valid 16-digit seal.");
    },
    [onClose, onScanned, stopScan],
  );

  const startZxingScan = useCallback(async () => {
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const videoElement = videoRef.current;
      if (!videoElement) {
        setScanError("Scanner could not start. Retry.");
        return;
      }

      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoElement,
        (result, error) => {
          if (result) {
            consumeScannedValue(result.getText());
            return;
          }
          if (error && (typeof error !== "object" || error === null || !("name" in error) || error.name !== "NotFoundException")) {
            setScanError("Scanner could not read the seal. Move closer and retry.");
          }
        },
      );
      zxingControlsRef.current = controls as unknown as ZxingControlsLike;
      setIsScanning(true);
    } catch {
      setScanError("Scanner unavailable on this device. Use manual entry.");
    }
  }, [consumeScannedValue]);

  const startScan = useCallback(async () => {
    setScanError(null);
    stopScan();

    const detectorCtor = getBarcodeDetectorCtor();
    if (!detectorCtor) {
      await startZxingScan();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new detectorCtor({
        formats: ["code_128", "qr_code", "ean_13", "code_39"],
      });

      timerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          return;
        }
        try {
          const detections = await detector.detect(video);
          const raw = detections[0]?.rawValue?.trim() ?? "";
          if (!raw) {
            return;
          }
          consumeScannedValue(raw);
        } catch {
          setScanError("Scanner could not read the seal. Move closer and retry.");
        }
      }, 700);

      setIsScanning(true);
    } catch {
      await startZxingScan();
    }
  }, [consumeScannedValue, startZxingScan, stopScan]);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  return (
    <>
      <HStack spacing={2} flexWrap="wrap">
        <Button leftIcon={<ScanLine size={16} />} onClick={onOpen} isDisabled={isDisabled}>
          Scan seal
        </Button>
      </HStack>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          stopScan();
          onClose();
        }}
        size={{ base: "full", md: "xl" }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Scan seal</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" overflow="hidden" bg="black">
                <Box
                  as="video"
                  ref={videoRef}
                  width="100%"
                  maxH="280px"
                  autoPlay
                  muted
                  playsInline
                />
              </Box>

              <HStack spacing={3}>
                <Button leftIcon={<Camera size={16} />} onClick={() => void startScan()} isDisabled={isScanning}>
                  {isScanning ? "Scanning..." : "Start camera scan"}
                </Button>
                <Button variant="outline" onClick={stopScan} isDisabled={!isScanning}>
                  Stop
                </Button>
              </HStack>

              <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" p={4}>
                <Text fontWeight="semibold" mb={2}>
                  Manual fallback
                </Text>
                <Input
                  value={manualSeal}
                  onChange={(event) => setManualSeal(event.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="Enter 16-digit seal number"
                  inputMode="numeric"
                />
                <HStack mt={3} spacing={2}>
                  <Badge colorScheme={isValidSeal ? "green" : "orange"}>
                    {isValidSeal ? "Seal format valid" : "Need 16 digits"}
                  </Badge>
                </HStack>
              </Box>

              {scanError ? (
                <Box borderWidth="1px" borderColor="red.200" borderRadius="xl" bg="red.50" p={3}>
                  <Text fontSize="sm" color="red.700">
                    {scanError}
                  </Text>
                </Box>
              ) : null}
              {!supportsNativeBarcode ? (
                <Text fontSize="xs" color="text.secondary">
                  Using compatibility scanner mode for this device.
                </Text>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  if (!isValidSeal) {
                    setScanError("Seal number must be exactly 16 digits.");
                    return;
                  }
                  onManualConfirm(manualSeal.trim());
                  onClose();
                }}
              >
                Use this seal
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
