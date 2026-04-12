"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  HStack,
  Image as ChakraImage,
  Input,
  Progress,
  Stack,
  Switch,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { RefreshCcw, Save, Upload } from "lucide-react";

import { PageActionBar, PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import { MobileActionRail } from "@/components/enterprise/PageTemplates";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import {
  extractLogoColorSuggestions,
  type BrandPaletteSuggestion,
} from "@/lib/branding-color-suggestions";
import {
  getDefaultCompanyProfileSettings,
  sanitizeCompanyProfileSettings,
  type CompanyProfileSettings,
} from "@/lib/company-profile-settings";
import { logSaveUxEvent } from "@/lib/ui-save-debug";

type CompanySectionId =
  | "details"
  | "branding"
  | "suggestions"
  | "documents"
  | "preview";

const SECTION_DEFINITIONS: Array<{ id: CompanySectionId; label: string; helper: string }> = [
  {
    id: "details",
    label: "Company Details",
    helper: "Maintain legal identity, billing information, and contact data used across documents.",
  },
  {
    id: "branding",
    label: "Branding",
    helper: "Set logo and restrained brand colors for enterprise-safe document styling.",
  },
  {
    id: "suggestions",
    label: "Logo-Based Suggestions",
    helper: "Review optional color suggestions extracted from the uploaded logo.",
  },
  {
    id: "documents",
    label: "Document Branding",
    helper: "Configure report, packing list, and COA header/footer/signatory metadata.",
  },
  {
    id: "preview",
    label: "Preview",
    helper: "Representative preview for Report, Packing List, and COA branding output.",
  },
];

function uploadCompanyImage(
  file: File,
  onProgress: (value: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/settings/company-profile/logo");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () => reject(new Error("Image upload failed."));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        try {
          const payload = JSON.parse(request.responseText) as { details?: string };
          reject(new Error(payload.details || "Image upload failed."));
          return;
        } catch {
          reject(new Error("Image upload failed."));
          return;
        }
      }
      try {
        const payload = JSON.parse(request.responseText) as { logoUrl?: string };
        if (!payload.logoUrl) {
          reject(new Error("Image upload did not return a URL."));
          return;
        }
        resolve(payload.logoUrl);
      } catch {
        reject(new Error("Image upload returned an invalid response."));
      }
    };

    const formData = new FormData();
    formData.append("file", file);
    request.send(formData);
  });
}

function PreviewCard({
  title,
  headerName,
  profile,
}: {
  title: string;
  headerName: string;
  profile: CompanyProfileSettings;
}) {
  const addressBlock = [profile.billingAddress, profile.contactNumber, profile.email]
    .filter(Boolean)
    .join(" | ");

  return (
    <VStack
      align="stretch"
      spacing={3}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      bg="bg.surface"
      overflow="hidden"
      minH="280px"
    >
      <Box h="10px" bg={profile.accentColor} />
      <VStack align="stretch" spacing={3} p={4}>
        <HStack justify="space-between" align="start" spacing={4}>
          <VStack align="stretch" spacing={1}>
            <Text fontWeight="semibold" color="text.primary">
              {headerName || profile.companyName || "Company Header"}
            </Text>
            <Text fontSize="sm" color="text.secondary">
              {addressBlock || "Address and contact details appear here."}
            </Text>
          </VStack>
          {profile.logoUrl ? (
            <Box borderWidth="1px" borderColor="border.default" borderRadius="md" p={2} bg="white">
              <ChakraImage src={profile.logoUrl} alt="Company logo" w="72px" h="40px" objectFit="contain" />
            </Box>
          ) : (
            <Box borderWidth="1px" borderColor="border.default" borderRadius="md" p={2} minW="72px">
              <Text fontSize="xs" color="text.secondary" textAlign="center">
                Logo
              </Text>
            </Box>
          )}
        </HStack>
        <Divider />
        <Text fontSize="sm" color="text.secondary">
          {title} body content preview. Accent and support colors are applied to key section headings only.
        </Text>
        <Box borderRadius="md" borderWidth="1px" borderColor="border.default" p={3} bg={profile.supportColor}>
          <Text fontSize="sm" color="text.primary">Footer: {profile.footerText || "No footer text configured"}</Text>
          <Text fontSize="sm" color="text.secondary">
            Signature: {profile.signatureName || "Not set"}
            {profile.signatureTitle ? ` (${profile.signatureTitle})` : ""}
          </Text>
        </Box>
      </VStack>
    </VStack>
  );
}

export default function CompanyProfileSettingsPage() {
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<CompanySectionId>("details");
  const [profile, setProfile] = useState<CompanyProfileSettings>(getDefaultCompanyProfileSettings());
  const [savedProfile, setSavedProfile] = useState<CompanyProfileSettings>(getDefaultCompanyProfileSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [stampUploading, setStampUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stampUploadProgress, setStampUploadProgress] = useState(0);
  const [paletteSuggestions, setPaletteSuggestions] = useState<BrandPaletteSuggestion[]>([]);
  const [paletteStateMessage, setPaletteStateMessage] = useState<string>(
    "Upload a logo to generate color suggestions.",
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(savedProfile),
    [profile, savedProfile],
  );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      try {
        const response = await fetch("/api/settings/company-profile");
        if (!response.ok) {
          throw new Error("Could not load company profile settings.");
        }
        const payload = (await response.json()) as Partial<CompanyProfileSettings>;
        const normalized = sanitizeCompanyProfileSettings(payload);
        if (!active) {
          return;
        }
        setProfile(normalized);
        setSavedProfile(normalized);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load company profile settings.";
        toast({ title: "Settings unavailable", description: message, status: "error" });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [toast]);

  async function handleSave() {
    setSaving(true);
    logSaveUxEvent("save_started", { source: "SettingsCompany:save" });
    try {
      const response = await fetch("/api/settings/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error("Company profile save failed.");
      }

      const payload = (await response.json()) as Partial<CompanyProfileSettings>;
      const normalized = sanitizeCompanyProfileSettings(payload);
      setProfile(normalized);
      setSavedProfile(normalized);
      logSaveUxEvent("save_success", { source: "SettingsCompany:save" });
      toast({ title: "Company profile saved", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Company profile save failed.";
      logSaveUxEvent("save_failed", { source: "SettingsCompany:save", message });
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    const resetProfile = getDefaultCompanyProfileSettings(profile.companyName || "Inspection Control Tower");
    setProfile(resetProfile);
    setPaletteSuggestions([]);
    setPaletteStateMessage("Defaults loaded. Save to persist these values.");
  }

  async function handleLogoFileSelection(file: File) {
    setLogoUploading(true);
    setUploadProgress(0);

    try {
      const uploadedLogoUrl = await uploadCompanyImage(file, setUploadProgress);
      const suggestions = await extractLogoColorSuggestions(file);
      setProfile((previous) => ({ ...previous, logoUrl: uploadedLogoUrl }));
      setPaletteSuggestions(suggestions);
      setPaletteStateMessage(
        suggestions.length > 0
          ? "Optional color palettes generated from this logo. Click a palette to apply."
          : "Automatic color suggestions unavailable for this image. Set colors manually.",
      );
      toast({ title: "Logo uploaded", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logo upload failed.";
      setPaletteSuggestions([]);
      setPaletteStateMessage("Automatic color suggestions unavailable for this image. Set colors manually.");
      toast({ title: "Logo upload failed", description: message, status: "error" });
    } finally {
      setLogoUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleStampFileSelection(file: File) {
    setStampUploading(true);
    setStampUploadProgress(0);

    try {
      const uploadedStampUrl = await uploadCompanyImage(file, setStampUploadProgress);
      setProfile((previous) => ({ ...previous, stampImageUrl: uploadedStampUrl }));
      toast({ title: "Stamp uploaded", status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stamp upload failed.";
      toast({ title: "Stamp upload failed", description: message, status: "error" });
    } finally {
      setStampUploading(false);
      setStampUploadProgress(0);
    }
  }

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title="Company Profile"
          subtitle="Manage company identity and persisted document branding defaults for report generation."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Settings", href: "/admin/settings/workflow" },
            { label: "Company Profile" },
          ]}
          right={
            <>
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

        <PageActionBar
          secondaryActions={
            <>
              <Text fontSize="sm" color="text.secondary">
                Applies to all new and active workflows in this company scope.
              </Text>
              <Button as={Link} href="/admin/settings/workflow" variant="outline" size="sm">
                Open Module Settings
              </Button>
            </>
          }
          primaryAction={
            <Text fontSize="sm" fontWeight="medium" color={hasUnsavedChanges ? "orange.500" : "green.500"}>
              Unsaved changes: {hasUnsavedChanges ? "Yes" : "No"}
            </Text>
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

            {activeSection === "details" ? (
              <VStack align="stretch" spacing={4}>
                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                  <FormControl>
                    <FormLabel>Company Name</FormLabel>
                    <Input
                      value={profile.companyName}
                      onChange={(event) => setProfile((prev) => ({ ...prev, companyName: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Legal Name</FormLabel>
                    <Input
                      value={profile.legalName}
                      onChange={(event) => setProfile((prev) => ({ ...prev, legalName: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>GST Number</FormLabel>
                    <Input
                      value={profile.gstNumber}
                      onChange={(event) => setProfile((prev) => ({ ...prev, gstNumber: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>CIN / Registration Number</FormLabel>
                    <Input
                      value={profile.cinOrRegistration}
                      onChange={(event) => setProfile((prev) => ({ ...prev, cinOrRegistration: event.target.value }))}
                    />
                  </FormControl>
                </Grid>

                <FormControl>
                  <FormLabel>Billing Address</FormLabel>
                  <Textarea
                    value={profile.billingAddress}
                    onChange={(event) => {
                      const nextBillingAddress = event.target.value;
                      setProfile((prev) => ({
                        ...prev,
                        billingAddress: nextBillingAddress,
                        shippingAddress: prev.sameAsBilling ? nextBillingAddress : prev.shippingAddress,
                      }));
                    }}
                  />
                </FormControl>

                <HStack justify="space-between">
                  <Text fontSize="sm" color="text.primary">
                    Shipping address same as billing
                  </Text>
                  <Switch
                    isChecked={profile.sameAsBilling}
                    onChange={(event) => {
                      const sameAsBilling = event.target.checked;
                      setProfile((prev) => ({
                        ...prev,
                        sameAsBilling,
                        shippingAddress: sameAsBilling ? prev.billingAddress : prev.shippingAddress,
                      }));
                    }}
                  />
                </HStack>

                {!profile.sameAsBilling ? (
                  <FormControl>
                    <FormLabel>Shipping Address</FormLabel>
                    <Textarea
                      value={profile.shippingAddress}
                      onChange={(event) => setProfile((prev) => ({ ...prev, shippingAddress: event.target.value }))}
                    />
                  </FormControl>
                ) : null}

                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                  <FormControl>
                    <FormLabel>Contact Person</FormLabel>
                    <Input
                      value={profile.contactPerson}
                      onChange={(event) => setProfile((prev) => ({ ...prev, contactPerson: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Contact Number</FormLabel>
                    <Input
                      value={profile.contactNumber}
                      onChange={(event) => setProfile((prev) => ({ ...prev, contactNumber: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Website</FormLabel>
                    <Input
                      value={profile.website}
                      onChange={(event) => setProfile((prev) => ({ ...prev, website: event.target.value }))}
                    />
                  </FormControl>
                </Grid>
              </VStack>
            ) : null}

            {activeSection === "branding" ? (
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Company Logo</FormLabel>
                  <Stack direction={{ base: "column", lg: "row" }} spacing={4} align="start">
                    <VStack
                      align="stretch"
                      spacing={2}
                      borderWidth="1px"
                      borderColor="border.default"
                      borderRadius="md"
                      p={3}
                      minW={{ base: "full", lg: "260px" }}
                    >
                      <Text fontSize="sm" color="text.secondary">
                        Upload JPG, PNG, or WEBP. This logo appears on report, packing list, and COA outputs.
                      </Text>
                      <HStack spacing={2}>
                        <Button as="label" leftIcon={<Upload size={14} />} variant="outline" size="sm" isDisabled={logoUploading}>
                          Upload Logo
                          <Input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            display="none"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) {
                                void handleLogoFileSelection(file);
                              }
                            }}
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setProfile((prev) => ({ ...prev, logoUrl: "" }))}
                          isDisabled={!profile.logoUrl || logoUploading}
                        >
                          Remove
                        </Button>
                      </HStack>
                      {logoUploading ? <Progress size="sm" value={uploadProgress} borderRadius="md" /> : null}
                      <Input
                        placeholder="Or paste logo URL"
                        value={profile.logoUrl}
                        onChange={(event) => setProfile((prev) => ({ ...prev, logoUrl: event.target.value }))}
                      />
                      <FormHelperText>
                        URL logos are supported for document branding. Color suggestions are generated only from uploaded logo files.
                      </FormHelperText>
                    </VStack>

                    <Box borderWidth="1px" borderColor="border.default" borderRadius="md" p={3} bg="white" minW="220px" minH="120px">
                      {profile.logoUrl ? (
                        <ChakraImage
                          src={profile.logoUrl}
                          alt="Company logo preview"
                          w="220px"
                          h="96px"
                          objectFit="contain"
                          maxW="100%"
                        />
                      ) : (
                        <Text fontSize="sm" color="text.secondary" textAlign="center" pt={8}>
                          Logo preview appears here.
                        </Text>
                      )}
                    </Box>
                  </Stack>
                </FormControl>

                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                  <FormControl>
                    <FormLabel>Primary Color</FormLabel>
                    <HStack>
                      <Input
                        value={profile.primaryColor}
                        onChange={(event) => setProfile((prev) => ({ ...prev, primaryColor: event.target.value }))}
                      />
                      <Box w="10" h="10" borderRadius="md" borderWidth="1px" borderColor="border.default" bg={profile.primaryColor} />
                    </HStack>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Secondary Color</FormLabel>
                    <HStack>
                      <Input
                        value={profile.secondaryColor}
                        onChange={(event) => setProfile((prev) => ({ ...prev, secondaryColor: event.target.value }))}
                      />
                      <Box w="10" h="10" borderRadius="md" borderWidth="1px" borderColor="border.default" bg={profile.secondaryColor} />
                    </HStack>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Accent Color</FormLabel>
                    <HStack>
                      <Input
                        value={profile.accentColor}
                        onChange={(event) => setProfile((prev) => ({ ...prev, accentColor: event.target.value }))}
                      />
                      <Box w="10" h="10" borderRadius="md" borderWidth="1px" borderColor="border.default" bg={profile.accentColor} />
                    </HStack>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Support Color</FormLabel>
                    <HStack>
                      <Input
                        value={profile.supportColor}
                        onChange={(event) => setProfile((prev) => ({ ...prev, supportColor: event.target.value }))}
                      />
                      <Box w="10" h="10" borderRadius="md" borderWidth="1px" borderColor="border.default" bg={profile.supportColor} />
                    </HStack>
                  </FormControl>
                </Grid>
              </VStack>
            ) : null}

            {activeSection === "suggestions" ? (
              <VStack align="stretch" spacing={4}>
                <Text fontSize="sm" color="text.secondary">
                  Suggestions are generated from uploaded logo files only. If logo is set by URL, choose colors manually.
                </Text>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>{paletteStateMessage}</AlertDescription>
                </Alert>
                {paletteSuggestions.length > 0 ? (
                  <HStack spacing={3} flexWrap="wrap" align="stretch">
                    {paletteSuggestions.map((palette) => (
                      <VStack
                        key={`${palette.primaryColor}-${palette.secondaryColor}-${palette.accentColor}`}
                        align="stretch"
                        spacing={2}
                        borderWidth="1px"
                        borderColor="border.default"
                        borderRadius="md"
                        p={3}
                        minW="260px"
                      >
                        <HStack spacing={2}>
                          <Box w="8" h="8" borderRadius="sm" borderWidth="1px" borderColor="border.default" bg={palette.primaryColor} />
                          <Box w="8" h="8" borderRadius="sm" borderWidth="1px" borderColor="border.default" bg={palette.secondaryColor} />
                          <Box w="8" h="8" borderRadius="sm" borderWidth="1px" borderColor="border.default" bg={palette.accentColor} />
                        </HStack>
                        <Text fontSize="sm" color="text.secondary">
                          {palette.primaryColor} / {palette.secondaryColor} / {palette.accentColor}
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setProfile((prev) => ({
                              ...prev,
                              primaryColor: palette.primaryColor,
                              secondaryColor: palette.secondaryColor,
                              accentColor: palette.accentColor,
                            }));
                            toast({ title: "Palette applied", status: "success" });
                          }}
                        >
                          Apply Palette
                        </Button>
                      </VStack>
                    ))}
                  </HStack>
                ) : null}
              </VStack>
            ) : null}

            {activeSection === "documents" ? (
              <VStack align="stretch" spacing={4}>
                <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
                  <FormControl>
                    <FormLabel>Report Header Name</FormLabel>
                    <Input
                      value={profile.reportHeaderName}
                      onChange={(event) => setProfile((prev) => ({ ...prev, reportHeaderName: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Packing List Header Name</FormLabel>
                    <Input
                      value={profile.packingListHeaderName}
                      onChange={(event) => setProfile((prev) => ({ ...prev, packingListHeaderName: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>COA Header Name</FormLabel>
                    <Input
                      value={profile.coaHeaderName}
                      onChange={(event) => setProfile((prev) => ({ ...prev, coaHeaderName: event.target.value }))}
                    />
                  </FormControl>
                </Grid>

                <FormControl>
                  <FormLabel>Footer Text</FormLabel>
                  <Textarea
                    value={profile.footerText}
                    onChange={(event) => setProfile((prev) => ({ ...prev, footerText: event.target.value }))}
                  />
                  <FormHelperText>Use concise compliance text or legal footer wording for generated PDFs.</FormHelperText>
                </FormControl>

                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                  <FormControl>
                    <FormLabel>Signature Name</FormLabel>
                    <Input
                      value={profile.signatureName}
                      onChange={(event) => setProfile((prev) => ({ ...prev, signatureName: event.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Signature Title</FormLabel>
                    <Input
                      value={profile.signatureTitle}
                      onChange={(event) => setProfile((prev) => ({ ...prev, signatureTitle: event.target.value }))}
                    />
                  </FormControl>
                </Grid>

                <FormControl>
                  <FormLabel>Stamp / Seal Image (Optional)</FormLabel>
                  <HStack spacing={2}>
                    <Button as="label" leftIcon={<Upload size={14} />} variant="outline" size="sm" isDisabled={stampUploading}>
                      Upload Stamp
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        display="none"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) {
                            void handleStampFileSelection(file);
                          }
                        }}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setProfile((prev) => ({ ...prev, stampImageUrl: "" }))}
                      isDisabled={!profile.stampImageUrl || stampUploading}
                    >
                      Remove
                    </Button>
                  </HStack>
                  {stampUploading ? <Progress size="sm" value={stampUploadProgress} borderRadius="md" mt={2} /> : null}
                  <Input
                    mt={2}
                    placeholder="Or paste stamp URL"
                    value={profile.stampImageUrl}
                    onChange={(event) => setProfile((prev) => ({ ...prev, stampImageUrl: event.target.value }))}
                  />
                </FormControl>
              </VStack>
            ) : null}

            {activeSection === "preview" ? (
              <VStack align="stretch" spacing={4}>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>
                    Preview is representative and updates from current form values. Final PDF templates continue to use persisted branding resolver logic.
                  </AlertDescription>
                </Alert>
                <Grid templateColumns={{ base: "1fr", xl: "repeat(3, 1fr)" }} gap={4}>
                  <PreviewCard title="Report Preview" headerName={profile.reportHeaderName} profile={profile} />
                  <PreviewCard title="Packing List Preview" headerName={profile.packingListHeaderName} profile={profile} />
                  <PreviewCard title="COA Preview" headerName={profile.coaHeaderName} profile={profile} />
                </Grid>
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
            w={{ base: "full", xl: "320px" }}
            position={{ xl: "sticky" }}
            top={{ xl: "88px" }}
          >
            <Text fontWeight="semibold">Branding Summary</Text>
            <Text fontSize="sm" color="text.secondary">
              Branding defaults are company-scoped and feed report export, packing-list, and COA rendering.
            </Text>
            <Divider />
            <Text fontSize="sm">Unsaved changes: {hasUnsavedChanges ? "Yes" : "No"}</Text>
            <Text fontSize="sm">Company name: {profile.companyName || "Not set"}</Text>
            <Text fontSize="sm">Logo configured: {profile.logoUrl ? "Yes" : "No"}</Text>
            <Text fontSize="sm">Footer configured: {profile.footerText ? "Yes" : "No"}</Text>
            <Divider />
            <Text fontSize="sm" color="text.secondary">Master-data quick links:</Text>
            <HStack spacing={2} flexWrap="wrap">
              <Button as={Link} href="/master" size="sm" variant="outline">Client Master</Button>
              <Button as={Link} href="/master" size="sm" variant="outline">Item Master</Button>
              <Button as={Link} href="/master" size="sm" variant="outline">Transporters</Button>
            </HStack>
          </VStack>
        </Stack>

        <MobileActionRail>
          <Button
            colorScheme="blue"
            leftIcon={<Save size={16} />}
            onClick={() => void handleSave()}
            isLoading={saving}
            isDisabled={loading || !hasUnsavedChanges}
          >
            Save Settings
          </Button>
        </MobileActionRail>
      </VStack>
    </ControlTowerLayout>
  );
}
