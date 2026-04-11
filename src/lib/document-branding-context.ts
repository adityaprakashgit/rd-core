import type { PrismaClient } from "@prisma/client";

import {
  sanitizeCompanyProfileSettings,
  type CompanyProfileSettings,
} from "@/lib/company-profile-settings";
import {
  sanitizeReportPreferences,
  type ReportPreferences,
} from "@/lib/report-preferences";

type PrismaLike = Pick<PrismaClient, "companyProfileSettings">;

type BrandingResolutionInput = {
  companyId: string;
  fallbackCompanyName: string;
  requestReportPreferences: unknown;
  documentKind?: "report" | "packing" | "coa";
};

export type DocumentBrandingContext = {
  reportPreferences: ReportPreferences;
  companyProfile: CompanyProfileSettings;
};

function toReportPreferencesFromCompanyProfile(
  profile: CompanyProfileSettings,
  documentKind: "report" | "packing" | "coa",
): ReportPreferences {
  const headerName =
    documentKind === "packing"
      ? profile.packingListHeaderName || profile.companyName
      : documentKind === "coa"
        ? profile.coaHeaderName || profile.companyName
        : profile.reportHeaderName || profile.companyName;

  return {
    defaultDocumentType: "EXPORT",
    branding: {
      companyName: headerName,
      companyAddress: profile.billingAddress,
      companyContact: [profile.contactPerson, profile.contactNumber, profile.email]
        .filter(Boolean)
        .join(" | "),
      taxId: profile.gstNumber,
      logoUrl: profile.logoUrl,
      footerNote: profile.footerText,
      authorizedSignatoryName: profile.signatureName,
      authorizedSignatoryTitle: profile.signatureTitle,
    },
  };
}

function mergeWithRequestOverrides(
  defaults: ReportPreferences,
  requestReportPreferences: unknown,
  fallbackCompanyName: string,
): ReportPreferences {
  const requestSanitized = sanitizeReportPreferences(
    requestReportPreferences,
    fallbackCompanyName,
  );

  const requestPayload =
    requestReportPreferences && typeof requestReportPreferences === "object"
      ? (requestReportPreferences as {
          defaultDocumentType?: unknown;
          branding?: Record<string, unknown>;
        })
      : null;

  return {
    defaultDocumentType:
      requestPayload?.defaultDocumentType !== undefined
        ? requestSanitized.defaultDocumentType
        : defaults.defaultDocumentType,
    branding: {
      companyName:
        requestPayload?.branding?.companyName !== undefined
          ? requestSanitized.branding.companyName
          : defaults.branding.companyName,
      companyAddress:
        requestPayload?.branding?.companyAddress !== undefined
          ? requestSanitized.branding.companyAddress
          : defaults.branding.companyAddress,
      companyContact:
        requestPayload?.branding?.companyContact !== undefined
          ? requestSanitized.branding.companyContact
          : defaults.branding.companyContact,
      taxId:
        requestPayload?.branding?.taxId !== undefined
          ? requestSanitized.branding.taxId
          : defaults.branding.taxId,
      logoUrl:
        requestPayload?.branding?.logoUrl !== undefined
          ? requestSanitized.branding.logoUrl
          : defaults.branding.logoUrl,
      footerNote:
        requestPayload?.branding?.footerNote !== undefined
          ? requestSanitized.branding.footerNote
          : defaults.branding.footerNote,
      authorizedSignatoryName:
        requestPayload?.branding?.authorizedSignatoryName !== undefined
          ? requestSanitized.branding.authorizedSignatoryName
          : defaults.branding.authorizedSignatoryName,
      authorizedSignatoryTitle:
        requestPayload?.branding?.authorizedSignatoryTitle !== undefined
          ? requestSanitized.branding.authorizedSignatoryTitle
          : defaults.branding.authorizedSignatoryTitle,
    },
  };
}

export async function resolveDocumentBrandingContext(
  tx: PrismaLike,
  input: BrandingResolutionInput,
): Promise<DocumentBrandingContext> {
  const profileRecord = await tx.companyProfileSettings.findUnique({
    where: { companyId: input.companyId },
  });

  const normalizedProfileInput = profileRecord
    ? {
        companyName: profileRecord.companyName ?? undefined,
        legalName: profileRecord.legalName ?? undefined,
        billingAddress: profileRecord.billingAddress ?? undefined,
        shippingAddress: profileRecord.shippingAddress ?? undefined,
        sameAsBilling: profileRecord.sameAsBilling,
        gstNumber: profileRecord.gstNumber ?? undefined,
        cinOrRegistration: profileRecord.cinOrRegistration ?? undefined,
        contactPerson: profileRecord.contactPerson ?? undefined,
        contactNumber: profileRecord.contactNumber ?? undefined,
        email: profileRecord.email ?? undefined,
        website: profileRecord.website ?? undefined,
        logoUrl: profileRecord.logoUrl ?? undefined,
        primaryColor: profileRecord.primaryColor ?? undefined,
        secondaryColor: profileRecord.secondaryColor ?? undefined,
        accentColor: profileRecord.accentColor ?? undefined,
        supportColor: profileRecord.supportColor ?? undefined,
        reportHeaderName: profileRecord.reportHeaderName ?? undefined,
        packingListHeaderName: profileRecord.packingListHeaderName ?? undefined,
        coaHeaderName: profileRecord.coaHeaderName ?? undefined,
        footerText: profileRecord.footerText ?? undefined,
        signatureName: profileRecord.signatureName ?? undefined,
        signatureTitle: profileRecord.signatureTitle ?? undefined,
        stampImageUrl: profileRecord.stampImageUrl ?? undefined,
      }
    : null;

  const companyProfile = sanitizeCompanyProfileSettings(
    normalizedProfileInput,
    input.fallbackCompanyName,
  );

  const persistedDefaults = toReportPreferencesFromCompanyProfile(
    companyProfile,
    input.documentKind ?? "report",
  );
  const reportPreferences = mergeWithRequestOverrides(
    persistedDefaults,
    input.requestReportPreferences,
    input.fallbackCompanyName,
  );

  return {
    reportPreferences,
    companyProfile,
  };
}
