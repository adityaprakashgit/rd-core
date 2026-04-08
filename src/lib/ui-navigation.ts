import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Blocks,
  ClipboardCheck,
  Ellipsis,
  FlaskConical,
  Home,
  LayoutDashboard,
  PackageCheck,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
} from "lucide-react";

import type { NormalizedRole } from "@/lib/role";

export type BreadcrumbDefinition = {
  label: string;
  href?: string;
};

export type ActionDefinition = {
  label: string;
  href: string;
  variant?: "solid" | "outline" | "ghost";
};

export type ModuleDefinition = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: NormalizedRole[];
  activeMatch: RegExp;
  mobileTabGroup?: "home" | "queue" | "reports" | "monitoring" | "more";
  mobilePriority?: number;
  mobileLabel?: string;
  roleDestinationMap?: Partial<Record<NormalizedRole, string>>;
};

export type PageDefinition = {
  id: string;
  title: string;
  subtitle: string;
  moduleId: string;
  matcher: RegExp;
  breadcrumbs: BreadcrumbDefinition[] | ((pathname: string) => BreadcrumbDefinition[]);
  primaryActions?: ActionDefinition[];
};

export type MobileTabKey = "home" | "queue" | "reports" | "monitoring" | "more";

export type MobileTabDefinition = {
  id: MobileTabKey;
  label: string;
  href?: string;
  icon: LucideIcon;
  activeMatch: RegExp;
  isMore?: boolean;
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "control-center",
    label: "Dashboard",
    href: "/userinsp",
    icon: LayoutDashboard,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/userinsp|^\/userrd$/,
    mobileTabGroup: "home",
    mobilePriority: 1,
    mobileLabel: "Home",
    roleDestinationMap: {
      ADMIN: "/userinsp",
      OPERATIONS: "/userinsp",
      VIEWER: "/userinsp",
    },
  },
  {
    id: "execution",
    label: "Inspection",
    href: "/operations",
    icon: ClipboardCheck,
    roles: ["ADMIN", "OPERATIONS", "VIEWER"],
    activeMatch: /^\/operations/,
    mobileTabGroup: "queue",
    mobilePriority: 2,
    mobileLabel: "Queue",
    roleDestinationMap: {
      ADMIN: "/operations",
      OPERATIONS: "/operations",
      VIEWER: "/operations",
    },
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/jobs",
    icon: ClipboardCheck,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/jobs|^\/rd$/,
    mobileTabGroup: "queue",
    mobilePriority: 2,
  },
  {
    id: "lab-analysis",
    label: "R&D",
    href: "/userrd",
    icon: FlaskConical,
    roles: ["ADMIN", "RND", "VIEWER"],
    activeMatch: /^\/userrd|^\/rd/,
    mobileTabGroup: "home",
    mobilePriority: 1,
    mobileLabel: "Home",
    roleDestinationMap: {
      RND: "/userrd",
    },
  },
  {
    id: "packet-management",
    label: "Packet Management",
    href: "/operations",
    icon: PackageCheck,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /\/packet$/,
    mobileTabGroup: "monitoring",
    mobilePriority: 4,
  },
  {
    id: "dispatch",
    label: "Dispatch",
    href: "/reports",
    icon: Activity,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/reports$/,
    mobileTabGroup: "reports",
    mobilePriority: 3,
  },
  {
    id: "documents-reports",
    label: "Documents",
    href: "/documents",
    icon: FileText,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/documents|^\/traceability/,
    mobileTabGroup: "reports",
    mobilePriority: 3,
    mobileLabel: "Documents",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: FileText,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/reports$/,
    mobileTabGroup: "reports",
    mobilePriority: 3,
    mobileLabel: "Reports",
  },
  {
    id: "monitoring",
    label: "Exceptions",
    href: "/exceptions",
    icon: Activity,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/exceptions|^\/status/,
    mobileTabGroup: "monitoring",
    mobilePriority: 4,
    mobileLabel: "Exceptions",
  },
  {
    id: "reference-data",
    label: "Master Data",
    href: "/master",
    icon: Blocks,
    roles: ["ADMIN", "OPERATIONS"],
    activeMatch: /^\/master/,
    mobileTabGroup: "more",
    mobilePriority: 5,
  },
  {
    id: "administration",
    label: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    roles: ["ADMIN"],
    activeMatch: /^\/admin/,
    mobileTabGroup: "more",
    mobilePriority: 7,
  },
  {
    id: "workspace-configuration",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["ADMIN"],
    activeMatch: /^\/settings/,
    mobileTabGroup: "more",
    mobilePriority: 6,
  },
];

export const PAGE_DEFINITIONS: PageDefinition[] = [
  {
    id: "jobs-registry",
    title: "Job Registry",
    subtitle: "Unified job registry with workflow-first execution routing.",
    moduleId: "jobs",
    matcher: /^\/jobs$/,
    breadcrumbs: [{ label: "Jobs", href: "/jobs" }],
  },
  {
    id: "jobs-workflow",
    title: "Job Workflow",
    subtitle: "One guided flow from job basics through lots, proof, packets, and R&D submission.",
    moduleId: "jobs",
    matcher: /^\/jobs\/[^/]+\/workflow$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "control-center-home",
    title: "Inspection List",
    subtitle: "Table-first inspection registry and assignment queue.",
    moduleId: "control-center",
    matcher: /^\/userinsp$/,
    breadcrumbs: [{ label: "Control Center", href: "/userinsp" }],
  },
  {
    id: "control-center-job",
    title: "Inspection Detail",
    subtitle: "Lot progression, evidence capture, and final pass decisions for the selected job.",
    moduleId: "control-center",
    matcher: /^\/userinsp\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Inspection", href: "/userinsp" },
      { label: "Inspection Detail" },
    ],
  },
  {
    id: "control-center-lot-packet",
    title: "Packet Management",
    subtitle: "Split the ready sample into traceable packets with proof and availability control.",
    moduleId: "control-center",
    matcher: /^\/userinsp\/job\/[^/]+\/lot\/[^/]+\/packet$/,
    breadcrumbs: [
      { label: "Inspection", href: "/userinsp" },
      { label: "Inspection Detail" },
      { label: "Lot View" },
      { label: "Packet Management" },
    ],
  },
  {
    id: "control-center-lot",
    title: "Lot Inspection Workbench",
    subtitle: "Guided inspection, exception capture, and proof collection at lot level.",
    moduleId: "control-center",
    matcher: /^\/userinsp\/job\/[^/]+\/lot\/[^/]+$/,
    breadcrumbs: [
      { label: "Inspection", href: "/userinsp" },
      { label: "Inspection Detail" },
      { label: "Lot View" },
    ],
  },
  {
    id: "execution-home",
    title: "Inspection List",
    subtitle: "Operational inspection list with explicit lot linkage.",
    moduleId: "execution",
    matcher: /^\/operations$/,
    breadcrumbs: [{ label: "Execution", href: "/operations" }],
  },
  {
    id: "execution-job",
    title: "Inspection Detail",
    subtitle: "Inspection task detail with lot-level execution and traceability.",
    moduleId: "execution",
    matcher: /^\/operations\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Inspection Queue", href: "/operations" },
      { label: "Inspection Detail" },
    ],
  },
  {
    id: "execution-lot-packet",
    title: "Packet Management",
    subtitle: "Split the ready sample into traceable packets with proof and availability control.",
    moduleId: "execution",
    matcher: /^\/operations\/job\/[^/]+\/lot\/[^/]+\/packet$/,
    breadcrumbs: [
      { label: "Inspection Queue", href: "/operations" },
      { label: "Inspection Detail" },
      { label: "Lot View" },
      { label: "Packet Management" },
    ],
  },
  {
    id: "execution-lot",
    title: "Lot Inspection Workbench",
    subtitle: "Guided inspection, exception capture, and proof collection for each lot.",
    moduleId: "execution",
    matcher: /^\/operations\/job\/[^/]+\/lot\/[^/]+$/,
    breadcrumbs: [
      { label: "Inspection Queue", href: "/operations" },
      { label: "Inspection Detail" },
      { label: "Lot View" },
    ],
  },
  {
    id: "lab-home",
    title: "Lab & Analysis",
    subtitle: "Sampling lifecycle, assay readiness, and analytical throughput.",
    moduleId: "lab-analysis",
    matcher: /^\/userrd$/,
    breadcrumbs: [{ label: "Lab & Analysis", href: "/userrd" }],
  },
  {
    id: "lab-job",
    title: "Analytical Workbench",
    subtitle: "Structured trial execution, measurement capture, and QA handoff.",
    moduleId: "lab-analysis",
    matcher: /^\/userrd\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Lab & Analysis", href: "/userrd" },
      { label: "Analytical Workbench" },
    ],
  },
  {
    id: "documents-home",
    title: "Document Registry",
    subtitle: "Fast retrieval for COA, dispatch documents, test reports, and evidence uploads.",
    moduleId: "documents-reports",
    matcher: /^\/documents$|^\/reports$/,
    breadcrumbs: [{ label: "Documents", href: "/documents" }],
  },
  {
    id: "traceability-lot",
    title: "Lot Traceability",
    subtitle: "Lot-anchored lifecycle lineage across inspection, samples, packets, documents, and audit history.",
    moduleId: "documents-reports",
    matcher: /^\/traceability\/lot\/[^/]+$/,
    breadcrumbs: [
      { label: "Documents", href: "/documents" },
      { label: "Lot Traceability" },
    ],
  },
  {
    id: "monitoring-home",
    title: "Exception Queue",
    subtitle: "Derived blockers and workflow escalations with stage-level actionability.",
    moduleId: "monitoring",
    matcher: /^\/exceptions$|^\/status$/,
    breadcrumbs: [{ label: "Exceptions", href: "/exceptions" }],
  },
  {
    id: "reference-data-home",
    title: "Reference Data",
    subtitle: "Enterprise master records governing dispatch, clients, and materials.",
    moduleId: "reference-data",
    matcher: /^\/master$/,
    breadcrumbs: [{ label: "Reference Data", href: "/master" }],
  },
  {
    id: "workspace-config-home",
    title: "Workspace Configuration",
    subtitle: "Global settings, defaults, and enterprise communication preferences.",
    moduleId: "workspace-configuration",
    matcher: /^\/settings$/,
    breadcrumbs: [{ label: "Workspace Configuration", href: "/settings" }],
  },
  {
    id: "administration-home",
    title: "Administration",
    subtitle: "Enterprise governance controls, tenancy configuration, and access oversight.",
    moduleId: "administration",
    matcher: /^\/admin$/,
    breadcrumbs: [{ label: "Administration", href: "/admin" }],
  },
  {
    id: "job-orchestration-create",
    title: "Job Orchestration",
    subtitle: "Create and initialize jobs with enterprise workflow defaults.",
    moduleId: "jobs",
    matcher: /^\/rd$/,
    breadcrumbs: [
      { label: "Jobs", href: "/rd" },
      { label: "Job Orchestration" },
    ],
  },
];

const fallbackPageDefinition: PageDefinition = {
  id: "workspace",
  title: "Workspace",
  subtitle: "Enterprise operations workspace.",
  moduleId: "control-center",
  matcher: /^\/.*/,
  breadcrumbs: [{ label: "Workspace" }],
};

export function resolvePageDefinition(pathname: string): PageDefinition {
  return PAGE_DEFINITIONS.find((page) => page.matcher.test(pathname)) ?? fallbackPageDefinition;
}

export function resolveBreadcrumbs(definition: PageDefinition, pathname: string): BreadcrumbDefinition[] {
  return typeof definition.breadcrumbs === "function"
    ? definition.breadcrumbs(pathname)
    : definition.breadcrumbs;
}

export function getModuleById(moduleId: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((module) => module.id === moduleId);
}

export function getMobileTabDefinitions(role: NormalizedRole | null | undefined): MobileTabDefinition[] {
  if (role === "RND") {
    return [
      {
        id: "home",
        label: "Home",
        href: "/userrd",
        icon: Home,
        activeMatch: /^\/userrd/,
      },
      {
        id: "queue",
        label: "Queue",
        href: "/rd",
        icon: ClipboardCheck,
        activeMatch: /^\/rd/,
      },
      {
        id: "reports",
        label: "Documents",
        href: "/documents",
        icon: FileText,
        activeMatch: /^\/documents|^\/reports/,
      },
      {
        id: "monitoring",
        label: "Exceptions",
        href: "/exceptions",
        icon: Activity,
        activeMatch: /^\/exceptions|^\/status/,
      },
      {
        id: "more",
        label: "More",
        icon: Ellipsis,
        activeMatch: /^\/(settings|admin|master)/,
        isMore: true,
      },
    ];
  }

  return [
    {
      id: "home",
      label: "Home",
      href: "/userinsp",
      icon: Home,
      activeMatch: /^\/userinsp/,
    },
    {
      id: "queue",
      label: "Queue",
      href: "/operations",
      icon: ClipboardCheck,
      activeMatch: /^\/operations/,
    },
    {
      id: "reports",
      label: "Documents",
      href: "/documents",
      icon: FileText,
      activeMatch: /^\/documents|^\/reports/,
    },
    {
      id: "monitoring",
      label: "Exceptions",
      href: "/exceptions",
      icon: Activity,
      activeMatch: /^\/exceptions|^\/status/,
    },
    {
      id: "more",
      label: "More",
      icon: Ellipsis,
      activeMatch: /^\/(settings|admin|master|userrd|rd)/,
      isMore: true,
    },
  ];
}

export function getMobileMoreModules(role: NormalizedRole | null | undefined): ModuleDefinition[] {
  if (!role) {
    return [];
  }

  return MODULE_DEFINITIONS.filter(
    (module) => module.roles.includes(role) && module.mobileTabGroup === "more"
  ).sort((left, right) => (left.mobilePriority ?? 999) - (right.mobilePriority ?? 999));
}

export const GLOBAL_SEARCH_PLACEHOLDER = "Search Lot ID, Job ID, Sample ID, Packet ID, Dispatch ID, Certificate";
export const GLOBAL_FILTER_ICON = SlidersHorizontal;
