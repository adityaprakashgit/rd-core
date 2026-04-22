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
type QuaggaDecodeSingleResultLike = { codeResult?: { code?: string } };
type QuaggaLike = {
  decodeSingle: (
    config: Record<string, unknown>,
    callback: (result: QuaggaDecodeSingleResultLike | null) => void,
  ) => void;
};

const BARCODE_FORMATS = [
  "code_128",
  "code_39",
  "qr_code",
  "ean_13",
  "ean_8",
  "codabar",
  "itf",
  "upc_a",
  "upc_e",
] as const;

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
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImageScanning, setIsImageScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualSeal, setManualSeal] = useState("");

  const supportsNativeBarcode = useMemo(() => Boolean(getBarcodeDetectorCtor()), []);
  const hasSecureContext = useMemo(() => (typeof window === "undefined" ? true : window.isSecureContext), []);
  const hasCameraStreamSupport = useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    [],
  );
  const prefersCaptureFlow = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
    [],
  );
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
      const exactMatch = rawValue.match(/\d{16}/)?.[0] ?? null;
      const digitsOnly = rawValue.replace(/\D/g, "");
      const fallbackMatch = digitsOnly.length >= 16 ? digitsOnly.slice(0, 16) : null;
      const normalizedSeal = exactMatch ?? fallbackMatch;

      if (normalizedSeal && /^\d{16}$/.test(normalizedSeal)) {
        onScanned(normalizedSeal);
        setManualSeal(normalizedSeal);
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
        (result) => {
          if (result) {
            consumeScannedValue(result.getText());
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
    if (prefersCaptureFlow) {
      captureInputRef.current?.click();
      return;
    }

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
        formats: [...BARCODE_FORMATS],
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
        } catch {}
      }, 700);

      setIsScanning(true);
    } catch {
      await startZxingScan();
    }
  }, [consumeScannedValue, prefersCaptureFlow, startZxingScan, stopScan]);

  const scanFromImageFile = useCallback(
    async (file: File) => {
      setScanError(null);
      setIsImageScanning(true);
      try {
        const imageUrl = URL.createObjectURL(file);
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = imageUrl;
        });

        try {
          const quaggaModule = await import("@ericblade/quagga2");
          const quagga = (quaggaModule.default ?? quaggaModule) as unknown as QuaggaLike;
          const quaggaCode = await new Promise<string | null>((resolve) => {
            quagga.decodeSingle(
              {
                src: imageUrl,
                numOfWorkers: 0,
                locate: true,
                inputStream: { size: 1200 },
                decoder: {
                  readers: [
                    "code_128_reader",
                    "code_39_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "codabar_reader",
                    "i2of5_reader",
                    "code_93_reader",
                  ],
                },
              },
              (result) => resolve(result?.codeResult?.code ?? null),
            );
          });
          if (quaggaCode) {
            consumeScannedValue(quaggaCode);
            return;
          }

          const detectorCtor = getBarcodeDetectorCtor();
          if (detectorCtor) {
            const detector = new detectorCtor({ formats: [...BARCODE_FORMATS] });
            const detections = await detector.detect(image);
            const raw = detections[0]?.rawValue?.trim() ?? "";
            if (raw) {
              consumeScannedValue(raw);
              return;
            }
          }

          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const result = await reader.decodeFromImageElement(image);
          consumeScannedValue(result.getText());
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      } catch {
        setScanError("Could not detect seal from image. Retry or enter seal manually.");
      } finally {
        setIsImageScanning(false);
      }
    },
    [consumeScannedValue],
  );

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
        <ModalContent borderRadius={{ base: 0, md: "xl" }} borderWidth="1px" borderColor="border.default">
          <ModalHeader pb={3}>Scan seal</ModalHeader>
          <ModalCloseButton />
          <ModalBody py={4}>
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
                  {isScanning ? "Scanning..." : prefersCaptureFlow ? "Capture and scan" : "Start camera scan"}
                </Button>
                <Button variant="outline" onClick={stopScan} isDisabled={!isScanning}>
                  Stop
                </Button>
              </HStack>
              <Text fontSize="xs" color="text.secondary">
                Supports phone camera scan, barcode-reader input, image upload, and manual seal entry.
              </Text>
              <HStack spacing={3} flexWrap="wrap">
                <Button
                  variant="outline"
                  onClick={() => captureInputRef.current?.click()}
                  isDisabled={isImageScanning}
                >
                  {isImageScanning ? "Scanning image..." : "Capture photo to scan"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => uploadInputRef.current?.click()}
                  isDisabled={isImageScanning}
                >
                  Upload image to scan
                </Button>
                <Input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  display="none"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void scanFromImageFile(file);
                    }
                    event.target.value = "";
                  }}
                />
                <Input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  display="none"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void scanFromImageFile(file);
                    }
                    event.target.value = "";
                  }}
                />
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
                <Box borderWidth="1px" borderColor="red.200" borderRadius="lg" bg="bg.rail" p={3}>
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
              {!hasSecureContext || !hasCameraStreamSupport ? (
                <Text fontSize="xs" color="orange.600">
                  Live camera scan is limited on this connection. Use &quot;Capture photo to scan&quot; or manual seal entry.
                </Text>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter borderTopWidth="1px" borderColor="border.default" pt={3}>
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
