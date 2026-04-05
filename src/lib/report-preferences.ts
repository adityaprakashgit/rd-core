export const REPORT_PREFERENCES_STORAGE_KEY = "rd-report-preferences-v1";

export const REPORT_DOCUMENT_TYPES = [
  "EXPORT",
  "DOMESTIC",
  "TRANSPORTATION",
  "INTERNAL",
] as const;

export type ReportDocumentType = (typeof REPORT_DOCUMENT_TYPES)[number];

export type ReportBranding = {
  companyName: string;
  companyAddress: string;
  companyContact: string;
  taxId: string;
  logoUrl: string;
  footerNote: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
};

export type ReportPreferences = {
  defaultDocumentType: ReportDocumentType;
  branding: ReportBranding;
};

const documentTypeLabelMap: Record<ReportDocumentType, string> = {
  EXPORT: "Export",
  DOMESTIC: "Domestic",
  TRANSPORTATION: "Transportation",
  INTERNAL: "Internal",
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isDocumentType(value: unknown): value is ReportDocumentType {
  return REPORT_DOCUMENT_TYPES.includes(value as ReportDocumentType);
}

export function getReportDocumentTypeLabel(documentType: ReportDocumentType): string {
  return documentTypeLabelMap[documentType];
}

export function sanitizeReportDocumentType(value: unknown): ReportDocumentType {
  return isDocumentType(value) ? value : "EXPORT";
}

export function getDefaultReportPreferences(baseCompanyName = "Inspection Control Tower"): ReportPreferences {
  return {
    defaultDocumentType: "EXPORT",
    branding: {
      companyName: baseCompanyName,
      companyAddress: "",
      companyContact: "",
      taxId: "",
      logoUrl: "",
      footerNote: "",
      authorizedSignatoryName: "",
      authorizedSignatoryTitle: "",
    },
  };
}

export function sanitizeReportPreferences(
  input: unknown,
  baseCompanyName = "Inspection Control Tower"
): ReportPreferences {
  const defaults = getDefaultReportPreferences(baseCompanyName);
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const payload = input as Partial<ReportPreferences> & {
    branding?: Partial<ReportBranding>;
  };

  return {
    defaultDocumentType: sanitizeReportDocumentType(payload.defaultDocumentType),
    branding: {
      companyName: asTrimmedString(payload.branding?.companyName) || defaults.branding.companyName,
      companyAddress: asTrimmedString(payload.branding?.companyAddress),
      companyContact: asTrimmedString(payload.branding?.companyContact),
      taxId: asTrimmedString(payload.branding?.taxId),
      logoUrl: asTrimmedString(payload.branding?.logoUrl),
      footerNote: asTrimmedString(payload.branding?.footerNote),
      authorizedSignatoryName: asTrimmedString(payload.branding?.authorizedSignatoryName),
      authorizedSignatoryTitle: asTrimmedString(payload.branding?.authorizedSignatoryTitle),
    },
  };
}
