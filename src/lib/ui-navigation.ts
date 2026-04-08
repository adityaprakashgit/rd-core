import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Blocks,
  ClipboardCheck,
  Ellipsis,
  FlaskConical,
  Home,
  LayoutDashboard,
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
    label: "Control Center",
    href: "/userinsp",
    icon: LayoutDashboard,
    roles: ["ADMIN", "OPERATIONS", "VIEWER"],
    activeMatch: /^\/userinsp/,
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
    label: "Execution",
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
    id: "lab-analysis",
    label: "Lab & Analysis",
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
    id: "documents-reports",
    label: "Documents & Reports",
    href: "/reports",
    icon: FileText,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/reports/,
    mobileTabGroup: "reports",
    mobilePriority: 3,
    mobileLabel: "Reports",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    href: "/status",
    icon: Activity,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/status/,
    mobileTabGroup: "monitoring",
    mobilePriority: 4,
    mobileLabel: "Monitoring",
  },
  {
    id: "reference-data",
    label: "Reference Data",
    href: "/master",
    icon: Blocks,
    roles: ["ADMIN", "OPERATIONS"],
    activeMatch: /^\/master|^\/masterplayground/,
    mobileTabGroup: "more",
    mobilePriority: 5,
  },
  {
    id: "administration",
    label: "Administration",
    href: "/admin",
    icon: ShieldCheck,
    roles: ["ADMIN"],
    activeMatch: /^\/admin/,
    mobileTabGroup: "more",
    mobilePriority: 7,
  },
  {
    id: "workspace-configuration",
    label: "Workspace Configuration",
    href: "/settings",
    icon: Settings,
    roles: ["ADMIN"],
    activeMatch: /^\/settings|^\/playground/,
    mobileTabGroup: "more",
    mobilePriority: 6,
  },
];

export const PAGE_DEFINITIONS: PageDefinition[] = [
  {
    id: "control-center-home",
    title: "Control Center",
    subtitle: "Enterprise inspection oversight and operational prioritization.",
    moduleId: "control-center",
    matcher: /^\/userinsp$/,
    breadcrumbs: [{ label: "Control Center", href: "/userinsp" }],
  },
  {
    id: "control-center-job",
    title: "Inspection Workbench",
    subtitle: "Lot progression, governance, and execution status for the selected job.",
    moduleId: "control-center",
    matcher: /^\/userinsp\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Control Center", href: "/userinsp" },
      { label: "Inspection Workbench" },
    ],
  },
  {
    id: "control-center-lot-packet",
    title: "Packet Management",
    subtitle: "Split the ready sample into traceable packets with proof and availability control.",
    moduleId: "control-center",
    matcher: /^\/userinsp\/job\/[^/]+\/lot\/[^/]+\/packet$/,
    breadcrumbs: [
      { label: "Control Center", href: "/userinsp" },
      { label: "Inspection Workbench" },
      { label: "Lot Inspection Workbench" },
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
      { label: "Control Center", href: "/userinsp" },
      { label: "Inspection Workbench" },
      { label: "Lot Inspection Workbench" },
    ],
  },
  {
    id: "execution-home",
    title: "Execution",
    subtitle: "Operational command board for job throughput, assignment, and readiness.",
    moduleId: "execution",
    matcher: /^\/operations$/,
    breadcrumbs: [{ label: "Execution", href: "/operations" }],
  },
  {
    id: "execution-job",
    title: "Execution Workbench",
    subtitle: "Runbook-driven execution view for job-level control and approvals.",
    moduleId: "execution",
    matcher: /^\/operations\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Execution", href: "/operations" },
      { label: "Execution Workbench" },
    ],
  },
  {
    id: "execution-lot-packet",
    title: "Packet Management",
    subtitle: "Split the ready sample into traceable packets with proof and availability control.",
    moduleId: "execution",
    matcher: /^\/operations\/job\/[^/]+\/lot\/[^/]+\/packet$/,
    breadcrumbs: [
      { label: "Execution", href: "/operations" },
      { label: "Execution Workbench" },
      { label: "Lot Inspection Workbench" },
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
      { label: "Execution", href: "/operations" },
      { label: "Execution Workbench" },
      { label: "Lot Inspection Workbench" },
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
    title: "Documents & Reports",
    subtitle: "Generate formal communication outputs and traceability artifacts.",
    moduleId: "documents-reports",
    matcher: /^\/reports$/,
    breadcrumbs: [{ label: "Documents & Reports", href: "/reports" }],
  },
  {
    id: "monitoring-home",
    title: "Monitoring",
    subtitle: "Cross-workspace health, workflow observability, and exception monitoring.",
    moduleId: "monitoring",
    matcher: /^\/status$/,
    breadcrumbs: [{ label: "Monitoring", href: "/status" }],
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
    id: "reference-data-playground",
    title: "Reference Data Playground",
    subtitle: "Schema-safe sandbox for extending and validating master data controls.",
    moduleId: "reference-data",
    matcher: /^\/masterplayground$/,
    breadcrumbs: [
      { label: "Reference Data", href: "/master" },
      { label: "Playground" },
    ],
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
    id: "workspace-config-playground",
    title: "Workflow Playground",
    subtitle: "Controlled environment for workflow model experimentation and validation.",
    moduleId: "workspace-configuration",
    matcher: /^\/playground$/,
    breadcrumbs: [
      { label: "Workspace Configuration", href: "/settings" },
      { label: "Workflow Playground" },
    ],
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
    moduleId: "lab-analysis",
    matcher: /^\/rd$/,
    breadcrumbs: [
      { label: "Lab & Analysis", href: "/userrd" },
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
        label: "Reports",
        href: "/reports",
        icon: FileText,
        activeMatch: /^\/reports/,
      },
      {
        id: "monitoring",
        label: "Monitoring",
        href: "/status",
        icon: Activity,
        activeMatch: /^\/status/,
      },
      {
        id: "more",
        label: "More",
        icon: Ellipsis,
        activeMatch: /^\/(settings|admin|master|masterplayground|playground)/,
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
      label: "Reports",
      href: "/reports",
      icon: FileText,
      activeMatch: /^\/reports/,
    },
    {
      id: "monitoring",
      label: "Monitoring",
      href: "/status",
      icon: Activity,
      activeMatch: /^\/status/,
    },
    {
      id: "more",
      label: "More",
      icon: Ellipsis,
      activeMatch: /^\/(settings|admin|master|masterplayground|playground|userrd|rd)/,
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

export const GLOBAL_SEARCH_PLACEHOLDER = "Search jobs, lots, clients, reports";
export const GLOBAL_FILTER_ICON = SlidersHorizontal;
