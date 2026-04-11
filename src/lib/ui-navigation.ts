import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  ClipboardCheck,
  Ellipsis,
  FlaskConical,
  Home,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  TriangleAlert,
  BriefcaseBusiness,
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

const HOME_DESTINATIONS: Record<NormalizedRole, string> = {
  ADMIN: "/admin",
  OPERATIONS: "/userinsp",
  RND: "/rnd",
  VIEWER: "/exceptions",
};

function getPrimaryMobileModuleIds(role: NormalizedRole | null | undefined): string[] {
  if (role === "RND") {
    return ["home", "jobs", "documents", "exceptions"];
  }

  if (role === "VIEWER") {
    return ["home", "inspection", "documents"];
  }

  return ["home", "inspection", "documents", "exceptions"];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "home",
    label: "Home",
    href: "/userinsp",
    icon: Home,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/(userinsp|rnd|userrd|exceptions|admin)$/,
    mobileTabGroup: "home",
    mobilePriority: 1,
    mobileLabel: "Home",
    roleDestinationMap: HOME_DESTINATIONS,
  },
  {
    id: "inspection",
    label: "Inspection",
    href: "/operations",
    icon: ClipboardCheck,
    roles: ["ADMIN", "OPERATIONS", "VIEWER"],
    activeMatch: /^\/operations/,
    mobileTabGroup: "queue",
    mobilePriority: 2,
    mobileLabel: "Inspection",
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
    icon: BriefcaseBusiness,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/(jobs|rd)(\/|$)/,
    mobileTabGroup: "queue",
    mobilePriority: 3,
  },
  {
    id: "rnd",
    label: "R&D",
    href: "/rnd",
    icon: FlaskConical,
    roles: ["ADMIN", "RND", "VIEWER"],
    activeMatch: /^\/(rnd|userrd)(\/|$)/,
    mobileTabGroup: "queue",
    mobilePriority: 4,
    roleDestinationMap: {
      ADMIN: "/rnd",
      RND: "/rnd",
      VIEWER: "/rnd",
    },
  },
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: FileText,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/(documents|reports|traceability)(\/|$)/,
    mobileTabGroup: "reports",
    mobilePriority: 5,
    mobileLabel: "Documents",
  },
  {
    id: "exceptions",
    label: "Exceptions",
    href: "/exceptions",
    icon: TriangleAlert,
    roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
    activeMatch: /^\/(exceptions|status)(\/|$)/,
    mobileTabGroup: "monitoring",
    mobilePriority: 6,
    mobileLabel: "Exceptions",
  },
  {
    id: "master-data",
    label: "Master Data",
    href: "/master",
    icon: Blocks,
    roles: ["ADMIN", "OPERATIONS"],
    activeMatch: /^\/master(\/|$)/,
    mobileTabGroup: "more",
    mobilePriority: 7,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings/workflow",
    icon: Settings,
    roles: ["ADMIN"],
    activeMatch: /^\/(settings|admin\/settings\/(workflow|company)|admin\/company-profile)(\/|$)/,
    mobileTabGroup: "more",
    mobilePriority: 8,
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    roles: ["ADMIN"],
    activeMatch: /^\/admin(\/|$)/,
    mobileTabGroup: "more",
    mobilePriority: 9,
  },
];

export const PAGE_DEFINITIONS: PageDefinition[] = [
  {
    id: "jobs-registry",
    title: "Jobs",
    subtitle: "Unified job registry with workflow-first execution routing.",
    moduleId: "jobs",
    matcher: /^\/jobs$/,
    breadcrumbs: [{ label: "Jobs", href: "/jobs" }],
  },
  {
    id: "job-detail",
    title: "Job Detail",
    subtitle: "Job context, linked records, and workflow entry for the selected job.",
    moduleId: "jobs",
    matcher: /^\/jobs\/[^/]+$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Detail" },
    ],
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
    id: "home-operations",
    title: "Home",
    subtitle: "Production workspace with current assignments, inspections, and next required actions.",
    moduleId: "home",
    matcher: /^\/userinsp$/,
    breadcrumbs: [{ label: "Home", href: "/userinsp" }],
  },
  {
    id: "home-rnd",
    title: "Home",
    subtitle: "R&D workspace for pending samples, active testing, and review handoffs.",
    moduleId: "home",
    matcher: /^\/(rnd|userrd)$/,
    breadcrumbs: [{ label: "Home", href: "/rnd" }],
  },
  {
    id: "home-manager",
    title: "Home",
    subtitle: "Manager workspace for exceptions, blockers, missing documents, and lot aging.",
    moduleId: "home",
    matcher: /^\/exceptions$/,
    breadcrumbs: [{ label: "Home", href: "/exceptions" }],
  },
  {
    id: "home-admin",
    title: "Home",
    subtitle: "Admin workspace for governance, role management, audit review, and workflow configuration.",
    moduleId: "home",
    matcher: /^\/admin$/,
    breadcrumbs: [{ label: "Home", href: "/admin" }],
  },
  {
    id: "inspection-list",
    title: "Inspection",
    subtitle: "Operational inspection queue with explicit lot linkage and primary next actions.",
    moduleId: "inspection",
    matcher: /^\/operations$/,
    breadcrumbs: [{ label: "Inspection", href: "/operations" }],
  },
  {
    id: "inspection-detail-legacy-userinsp",
    title: "Job Workflow",
    subtitle: "Legacy inspection route redirected into the canonical job workflow.",
    moduleId: "jobs",
    matcher: /^\/userinsp\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "inspection-detail-legacy-operations",
    title: "Job Workflow",
    subtitle: "Legacy operations route redirected into the canonical job workflow.",
    moduleId: "jobs",
    matcher: /^\/operations\/job\/[^/]+$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "inspection-lot-legacy-userinsp",
    title: "Job Workflow",
    subtitle: "Legacy lot route redirected into the canonical job workflow.",
    moduleId: "jobs",
    matcher: /^\/userinsp\/job\/[^/]+\/lot\/[^/]+$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "inspection-lot-legacy-operations",
    title: "Job Workflow",
    subtitle: "Legacy lot route redirected into the canonical job workflow.",
    moduleId: "jobs",
    matcher: /^\/operations\/job\/[^/]+\/lot\/[^/]+$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "packet-legacy-userinsp",
    title: "Job Workflow",
    subtitle: "Legacy packet route redirected into the canonical job workflow.",
    moduleId: "jobs",
    matcher: /^\/userinsp\/job\/[^/]+\/lot\/[^/]+\/packet$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "packet-legacy-operations",
    title: "Job Workflow",
    subtitle: "Legacy packet route redirected into the canonical job workflow.",
    moduleId: "jobs",
    matcher: /^\/operations\/job\/[^/]+\/lot\/[^/]+\/packet$/,
    breadcrumbs: [
      { label: "Jobs", href: "/jobs" },
      { label: "Job Workflow" },
    ],
  },
  {
    id: "rnd-workbench",
    title: "R&D",
    subtitle: "Sample testing board, result capture, and approval handoff for active analytical work.",
    moduleId: "rnd",
    matcher: /^\/(rnd\/jobs\/[^/]+|userrd\/job\/[^/]+)$/,
    breadcrumbs: [
      { label: "R&D", href: "/rnd" },
      { label: "R&D Job Detail" },
    ],
  },
  {
    id: "job-orchestration-legacy",
    title: "Jobs",
    subtitle: "Legacy job orchestration route retained while the unified jobs registry becomes canonical.",
    moduleId: "jobs",
    matcher: /^\/rd$/,
    breadcrumbs: [{ label: "Jobs", href: "/jobs" }],
  },
  {
    id: "documents-home",
    title: "Documents",
    subtitle: "Fast retrieval for COA, dispatch documents, test reports, and evidence uploads.",
    moduleId: "documents",
    matcher: /^\/documents$/,
    breadcrumbs: [{ label: "Documents", href: "/documents" }],
  },
  {
    id: "reports-home",
    title: "Reports",
    subtitle: "Generate and review packing lists, stickers, and downstream PDF outputs.",
    moduleId: "documents",
    matcher: /^\/reports$/,
    breadcrumbs: [
      { label: "Documents", href: "/documents" },
      { label: "Reports" },
    ],
  },
  {
    id: "traceability-lot",
    title: "Lot Traceability",
    subtitle: "Lot-anchored lifecycle lineage across inspection, samples, packets, documents, and audit history.",
    moduleId: "documents",
    matcher: /^\/traceability\/(lot|lots)\/[^/]+$/,
    breadcrumbs: [
      { label: "Documents", href: "/documents" },
      { label: "Lot Traceability" },
    ],
  },
  {
    id: "reference-data-home",
    title: "Master Data",
    subtitle: "Enterprise master records governing clients, materials, containers, and transporters.",
    moduleId: "master-data",
    matcher: /^\/master$/,
    breadcrumbs: [{ label: "Master Data", href: "/master" }],
  },
  {
    id: "lot-detail-route",
    title: "Lot Detail",
    subtitle: "Direct lot lookup route with traceability-oriented record context.",
    moduleId: "documents",
    matcher: /^\/lots\/[^/]+$/,
    breadcrumbs: [
      { label: "Documents", href: "/documents" },
      { label: "Lot Detail" },
    ],
  },
  {
    id: "sample-detail-route",
    title: "Sample Detail",
    subtitle: "Direct sample lookup route with linked lot and R&D context.",
    moduleId: "rnd",
    matcher: /^\/samples\/[^/]+$/,
    breadcrumbs: [
      { label: "R&D", href: "/rnd" },
      { label: "Sample Detail" },
    ],
  },
  {
    id: "packet-detail-route",
    title: "Packet Detail",
    subtitle: "Direct packet lookup route with linked lot, dispatch, and document context.",
    moduleId: "documents",
    matcher: /^\/packets\/[^/]+$/,
    breadcrumbs: [
      { label: "Documents", href: "/documents" },
      { label: "Packet Detail" },
    ],
  },
  {
    id: "workspace-config-home",
    title: "Module Settings",
    subtitle: "Company-scoped workflow, numbering, proof, approval, and access policies.",
    moduleId: "settings",
    matcher: /^\/(settings|admin\/settings\/workflow)$/,
    breadcrumbs: [
      { label: "Admin", href: "/admin" },
      { label: "Settings", href: "/admin/settings/workflow" },
      { label: "Module Settings" },
    ],
  },
  {
    id: "company-profile-settings",
    title: "Company Profile",
    subtitle: "Company identity, logo, colors, and document branding defaults for report, packing list, and COA output.",
    moduleId: "settings",
    matcher: /^\/(admin\/settings\/company|admin\/company-profile)$/,
    breadcrumbs: [
      { label: "Admin", href: "/admin" },
      { label: "Settings", href: "/admin/settings/workflow" },
      { label: "Company Profile" },
    ],
  },
  {
    id: "status-home",
    title: "Exceptions",
    subtitle: "Legacy status route showing derived blockers and workflow escalations.",
    moduleId: "exceptions",
    matcher: /^\/status$/,
    breadcrumbs: [{ label: "Exceptions", href: "/exceptions" }],
  },
];

const fallbackPageDefinition: PageDefinition = {
  id: "workspace",
  title: "Workspace",
  subtitle: "Enterprise operations workspace.",
  moduleId: "home",
  matcher: /^\/.*/,
  breadcrumbs: [{ label: "Workspace" }],
};

export function resolveModuleHref(
  module: ModuleDefinition,
  role: NormalizedRole | null | undefined
): string {
  if (role && module.roleDestinationMap?.[role]) {
    return module.roleDestinationMap[role] as string;
  }

  return module.href;
}

export function getVisibleModules(role: NormalizedRole | null | undefined): ModuleDefinition[] {
  if (!role) {
    return [];
  }

  const homeHref = HOME_DESTINATIONS[role];

  return MODULE_DEFINITIONS.filter((module) => {
    if (!module.roles.includes(role)) {
      return false;
    }

    if (module.id === "home") {
      return true;
    }

    return resolveModuleHref(module, role) !== homeHref;
  });
}

export function isModuleActive(
  module: ModuleDefinition,
  pathname: string,
  role: NormalizedRole | null | undefined
): boolean {
  if (module.id === "home") {
    if (!role) {
      return false;
    }
    return HOME_DESTINATIONS[role] === pathname;
  }

  if (role && resolveModuleHref(module, role) === HOME_DESTINATIONS[role]) {
    return false;
  }

  return module.activeMatch.test(pathname);
}

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
  const homeHref = role ? HOME_DESTINATIONS[role] : "/userinsp";

  if (role === "RND") {
    return [
      {
        id: "home",
        label: "Home",
        href: homeHref,
        icon: Home,
        activeMatch: /^\/(rnd|userrd)$/,
      },
      {
        id: "queue",
        label: "Jobs",
        href: "/jobs",
        icon: BriefcaseBusiness,
        activeMatch: /^\/(jobs|rd)(\/|$)/,
      },
      {
        id: "reports",
        label: "Documents",
        href: "/documents",
        icon: FileText,
        activeMatch: /^\/(documents|reports|traceability)(\/|$)/,
      },
      {
        id: "monitoring",
        label: "Exceptions",
        href: "/exceptions",
        icon: TriangleAlert,
        activeMatch: /^\/(exceptions|status)(\/|$)/,
      },
      {
        id: "more",
        label: "More",
        icon: Ellipsis,
        activeMatch: /^\/(settings|admin|master)(\/|$)/,
        isMore: true,
      },
    ];
  }

  return [
    {
      id: "home",
      label: "Home",
      href: homeHref,
      icon: Home,
      activeMatch: /^\/(userinsp|exceptions|admin)$/,
    },
    {
      id: "queue",
      label: "Inspection",
      href: "/operations",
      icon: ClipboardCheck,
      activeMatch: /^\/operations(\/|$)/,
    },
    {
      id: "reports",
      label: "Documents",
      href: "/documents",
      icon: FileText,
      activeMatch: /^\/(documents|reports|traceability)(\/|$)/,
    },
    ...(role === "VIEWER"
      ? []
      : [
          {
            id: "monitoring" as const,
            label: "Exceptions",
            href: "/exceptions",
            icon: TriangleAlert,
            activeMatch: /^\/(exceptions|status)(\/|$)/,
          },
        ]),
    {
      id: "more",
      label: "More",
      icon: Ellipsis,
      activeMatch: /^\/(jobs|settings|admin|master|rnd|userrd|rd)(\/|$)/,
      isMore: true,
    },
  ];
}

export function getMobileMoreModules(role: NormalizedRole | null | undefined): ModuleDefinition[] {
  if (!role) {
    return [];
  }

  const primaryModuleIds = new Set(getPrimaryMobileModuleIds(role));

  return getVisibleModules(role)
    .filter((module) => !primaryModuleIds.has(module.id))
    .sort((left, right) => (left.mobilePriority ?? 999) - (right.mobilePriority ?? 999));
}

export const GLOBAL_SEARCH_PLACEHOLDER = "Search Lot ID, Job ID, Sample ID, Packet ID, Dispatch ID, Certificate";
export const GLOBAL_FILTER_ICON = SlidersHorizontal;
