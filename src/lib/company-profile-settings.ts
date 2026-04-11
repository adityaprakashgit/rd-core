export type CompanyProfileSettings = {
  companyName: string;
  legalName: string;
  billingAddress: string;
  shippingAddress: string;
  sameAsBilling: boolean;
  gstNumber: string;
  cinOrRegistration: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportColor: string;
  reportHeaderName: string;
  packingListHeaderName: string;
  coaHeaderName: string;
  footerText: string;
  signatureName: string;
  signatureTitle: string;
  stampImageUrl: string;
};

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeHexColor(value: unknown, fallback: string) {
  const normalized = sanitizeString(value);
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

export function getDefaultCompanyProfileSettings(baseCompanyName = "Inspection Control Tower"): CompanyProfileSettings {
  return {
    companyName: baseCompanyName,
    legalName: "",
    billingAddress: "",
    shippingAddress: "",
    sameAsBilling: true,
    gstNumber: "",
    cinOrRegistration: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    website: "",
    logoUrl: "",
    primaryColor: "#1A4F8A",
    secondaryColor: "#2E7D99",
    accentColor: "#E17C2F",
    supportColor: "#F2F4F7",
    reportHeaderName: baseCompanyName,
    packingListHeaderName: baseCompanyName,
    coaHeaderName: baseCompanyName,
    footerText: "",
    signatureName: "",
    signatureTitle: "",
    stampImageUrl: "",
  };
}

export function sanitizeCompanyProfileSettings(
  payload: Partial<CompanyProfileSettings> | null | undefined,
  baseCompanyName = "Inspection Control Tower",
): CompanyProfileSettings {
  const defaults = getDefaultCompanyProfileSettings(baseCompanyName);
  const billingAddress = sanitizeString(payload?.billingAddress);
  const sameAsBilling = payload?.sameAsBilling ?? defaults.sameAsBilling;

  return {
    companyName: sanitizeString(payload?.companyName) || defaults.companyName,
    legalName: sanitizeString(payload?.legalName),
    billingAddress,
    shippingAddress: sameAsBilling ? billingAddress : sanitizeString(payload?.shippingAddress),
    sameAsBilling,
    gstNumber: sanitizeString(payload?.gstNumber),
    cinOrRegistration: sanitizeString(payload?.cinOrRegistration),
    contactPerson: sanitizeString(payload?.contactPerson),
    contactNumber: sanitizeString(payload?.contactNumber),
    email: sanitizeString(payload?.email),
    website: sanitizeString(payload?.website),
    logoUrl: sanitizeString(payload?.logoUrl),
    primaryColor: sanitizeHexColor(payload?.primaryColor, defaults.primaryColor),
    secondaryColor: sanitizeHexColor(payload?.secondaryColor, defaults.secondaryColor),
    accentColor: sanitizeHexColor(payload?.accentColor, defaults.accentColor),
    supportColor: sanitizeHexColor(payload?.supportColor, defaults.supportColor),
    reportHeaderName: sanitizeString(payload?.reportHeaderName) || defaults.reportHeaderName,
    packingListHeaderName: sanitizeString(payload?.packingListHeaderName) || defaults.packingListHeaderName,
    coaHeaderName: sanitizeString(payload?.coaHeaderName) || defaults.coaHeaderName,
    footerText: sanitizeString(payload?.footerText),
    signatureName: sanitizeString(payload?.signatureName),
    signatureTitle: sanitizeString(payload?.signatureTitle),
    stampImageUrl: sanitizeString(payload?.stampImageUrl),
  };
}
