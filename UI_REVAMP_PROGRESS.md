# UI_REVAMP_PROGRESS

## Last Updated
2026-04-10 00:22:00 IST

## Governance Sync (Current)
- Canonical UI architecture authority locked to `docs/enterprise-ui-governance.md`.
- Agent enforcement locked via `AGENTS.md` (mandatory for UI/page/layout/refactor tasks).
- Supporting revamp docs aligned to precedence model:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. Module-specific/supporting docs
- Migration language aligned to canonical sequence:
  - foundation lock
  - canonical job workflow
  - R&D detail alignment
  - packet detail alignment
  - traceability/document/timeline standardization
  - legacy cleanup

## Created
- UI_REVAMP_PRD.md
- UI_REVAMP_PLAN.md
- UI_REVAMP_SCREEN_MAP.md
- UI_REVAMP_COMPONENT_SYSTEM.md
- UI_REVAMP_STATUS_TERMS.md
- UI_REVAMP_TEST_PLAN.md
- UI_REVAMP_PROGRESS.md

## Updated
- UI_REVAMP_SCREEN_MAP.md (major IA rewrite: workflow-first, lot-centric, role-specific)
- UI_REVAMP_COMPONENT_SYSTEM.md (reusable enterprise pattern library and wrapper strategy)
- UI_REVAMP_PROGRESS.md (IA + pattern-library milestone refresh)
- src/components/enterprise/EnterprisePatterns.tsx (new enterprise wrappers for identity bar, action bar, filter strip, sticky table, tabs layout, quick drawer, linked records, history timeline, empty state, exception banner)
- src/components/inspection/InspectionListWorkspace.tsx (shared inspection list workspace for operations/userinsp)
- src/app/operations/page.tsx (retrofitted to table-first inspection list)
- src/app/userinsp/page.tsx (retrofitted to table-first inspection list + archive action)
- src/app/rd/page.tsx (retrofitted to table-first job registry + quick-create drawer)
- src/components/inspection/JobIntakeWorkspace.tsx (inspection detail tabs + linked lot view + history tab)
- src/app/userrd/job/[jobId]/page.tsx (job detail tab navigation for overview/lots/samples/r&d/docs/dispatch/timeline)
- src/app/userrd/page.tsx (full table-first job registry rework for R&D queue; removed playground CTA)
- src/lib/ui-navigation.ts (enterprise wording cleanup, removed playground matching from revised nav labels)
- src/app/userrd/page.tsx (R&D Queue bucket wording locked to Pending Samples, In Testing, Awaiting Review, Completed with canonical identifiers)
- src/app/userrd/job/[jobId]/page.tsx (R&D detail tabs relabeled to Sample Testing Board, Test Entry, Result Review / Approval, R&D History)
- src/components/inspection/PacketManagementWorkspace.tsx (Packet List table + fixed Packet Detail tabs: Overview, Source Lot, Quality/Test Summary, Documents, Dispatch, Audit Trail)
- src/components/inspection/JobIntakeWorkspace.tsx (migrated detail tabs to shared `DetailTabsLayout` with standardized right rail blocks)
- src/components/inspection/PacketManagementWorkspace.tsx (migrated packet detail tabs to shared `DetailTabsLayout` and added explicit dispatch blocker mapping with actions)
- src/app/userrd/job/[jobId]/page.tsx (migrated R&D detail tab shell to shared `DetailTabsLayout` with linked-record and history rail)
- src/app/api/traceability/lot/[lotId]/route.ts (new lot-lifecycle read API with linked records, COA state, related documents, and audit timeline)
- src/app/api/documents/registry/route.ts (new flattened document registry API with lot/packet/job/date/type/status filters)
- src/app/api/exceptions/queue/route.ts (new derived exception queue API merged with workflow escalations and role-aware visibility)
- src/app/traceability/lot/[lotId]/page.tsx (new lot-centric traceability page with full lifecycle sections and linked actions)
- src/app/documents/page.tsx (new table-first document registry with canonical filters and retrieval actions)
- src/app/exceptions/page.tsx (new table-first exception queue with blocker context and deep links)
- src/lib/ui-navigation.ts (navigation + breadcrumb mapping for Documents, Exceptions, and Lot Traceability routes)
- src/components/home/ProductionWorkspaceHome.tsx (new production workspace home with 4 action queues and explicit lot/job/packet/document actions)
- src/app/operations/page.tsx (retrofitted to Production workspace home shell)
- src/app/userinsp/page.tsx (aligned to Production workspace home as my/company tasks variant)
- src/app/userrd/page.tsx (R&D homepage reworked into required action queues: Pending samples, In-progress tests, Awaiting Review, Overdue testing items)
- src/app/exceptions/page.tsx (manager homepage reworked into scoped oversight queues: active jobs, lot aging, bottlenecks, missing docs, dispatch delays, missing COA)
- src/app/admin/page.tsx (admin homepage reworked into governance queues: user/role, master data, workflow config, audit logs, document templates + escalation queue)
- src/components/home/ProductionWorkspaceHome.tsx (added lot-linked `Open Traceability` actions and canonical `Job Number`/`Lot Number` headings)
- src/components/inspection/InspectionListWorkspace.tsx (added `Open Traceability` row action and canonical `Lot Number` heading)
- src/components/inspection/JobIntakeWorkspace.tsx (linked records normalized to `Job Number`/`Lot Number` + explicit traceability link)
- src/components/inspection/PacketManagementWorkspace.tsx (traceability action added to packet list/detail and contextual document actions aligned)
- src/app/documents/page.tsx (table-first sticky registry with context-aware PDF retrieval actions and canonical filter labels)
- src/app/api/search/global/route.ts (new company-scoped global search API for Lot/Job/Sample/Packet/Dispatch/Certificate deep links)
- src/layout/Header.tsx (global search dropdown wired to grouped search results with keyboard support)
- src/layout/Sidebar.tsx (navigation controls upgraded to semantic buttons with `aria-current` for accessibility)
- src/lib/ui-navigation.ts (enterprise navigation label refresh and canonical global-search placeholder)
- src/app/userrd/page.tsx (R&D queue terminology normalized to `Awaiting Review` and filter parity updated)
- src/app/exceptions/page.tsx (manager queue actions relabeled for explicit navigation intent)
- src/app/admin/page.tsx (admin governance queue action relabeled for explicit navigation intent)
- src/app/traceability/lot/[lotId]/page.tsx (related-document action label clarified to `View PDF` with `Not Available` fallback)
- UI_REVAMP_PRD.md, UI_REVAMP_PLAN.md, UI_REVAMP_SCREEN_MAP.md, UI_REVAMP_COMPONENT_SYSTEM.md, UI_REVAMP_STATUS_TERMS.md, UI_REVAMP_TEST_PLAN.md (final terminology and device-policy lock)
- PRD_MOBILE_TABLET_UI.md, MOBILE_TABLET_SCREEN_MAP.md, IMPLEMENTATION_PLAN_UI_REVAMP.md, UX_CLEANUP_RULES.md (final-state consistency sync)
- prisma/schema.prisma (unified workflow domain fields for job basics, lot numbering, sample proof, seal source/editability, packet R&D submission, workflow settings, and container types)
- src/types/inspection.ts, src/lib/job-workspace.ts (unified workflow data shape extended for new job/lot/sample/packet fields)
- src/app/api/jobs/route.ts, src/app/api/jobs/[id]/workflow/route.ts (workflow-oriented job creation/read/update contract)
- src/app/api/settings/module-workflow/route.ts (company-scoped workflow settings API)
- src/app/api/masters/container-types/route.ts, src/app/master/page.tsx (container type master support + expanded client master fields)
- src/app/settings/page.tsx (workflow settings controls for numbering, decision policy, image requirements, seal policy, timestamps)
- src/components/jobs/UnifiedJobWorkflow.tsx (canonical single-page Job Workflow execution shell)
- src/app/jobs/page.tsx, src/app/jobs/[jobId]/page.tsx, src/app/jobs/[jobId]/workflow/page.tsx (canonical Jobs route family)
- src/app/operations/job/[jobId]/page.tsx, src/app/operations/job/[jobId]/lot/[lotId]/page.tsx, src/app/operations/job/[jobId]/lot/[lotId]/packet/page.tsx, src/app/userinsp/job/[jobId]/page.tsx, src/app/userinsp/job/[jobId]/lot/[lotId]/page.tsx, src/app/userinsp/job/[jobId]/lot/[lotId]/packet/page.tsx (legacy execution routes redirected into unified workflow)
- src/app/api/lots/[id]/route.ts, src/app/api/samples/[id]/route.ts, src/app/api/packets/[id]/route.ts, src/components/navigation/RecordRouteRedirect.tsx, src/app/lots/[lotId]/page.tsx, src/app/samples/[sampleId]/page.tsx, src/app/packets/[packetId]/page.tsx (canonical supporting detail-route resolution)
- src/lib/rbac.ts, src/app/api/rd/packet/route.ts (packet workflow permission expansion and Submit to R&D audit path)
- src/components/inspection/SealScanner.tsx (ZXing type-safe scanner fallback fix during unified workflow validation)
- src/lib/module-workflow-policy.ts (grouped module workflow policy contract, defaults, normalization, and permission helpers)
- src/app/api/settings/module-workflow/route.ts (grouped company-scoped module settings contract)
- src/app/settings/page.tsx (settings UI reorganized around Workflow, Image, Seal, Sampling, Packet, and UI policy groups)
- src/app/api/inspection/lots/route.ts, src/app/api/inspection/sample-management/route.ts, src/app/api/inspection/execution/route.ts, src/app/api/rd/packet/route.ts (server-side enforcement of settings-driven numbering, sample IDs, required proof, decision ownership, seal edit policy, packet lock policy, and packet weight requirements)
- src/app/api/jobs/[id]/workflow/route.ts, src/components/jobs/UnifiedJobWorkflow.tsx (unified workflow payload expanded with grouped policy, next action, blockers, and workflow context)
- prisma/schema.prisma, prisma/migrations/20260409113000_module_settings_admin_surface/migration.sql (module settings policy expansion + new company-scoped profile/branding settings model)
- src/lib/module-workflow-policy.ts (grouped policy expanded for workflow, numbering, image hidden buckets, approval notifications, and access controls)
- src/lib/company-profile-settings.ts, src/app/api/settings/company-profile/route.ts (new persisted company profile/branding settings contract)
- src/app/admin/settings/workflow/page.tsx (new canonical admin module settings page with 9 policy groups and enterprise layout)
- src/app/settings/page.tsx (compatibility redirect to canonical `/admin/settings/workflow`)
- src/lib/ui-navigation.ts (settings destination + breadcrumbs aligned to canonical admin settings route)
- src/lib/packet-management.ts, src/app/api/rd/packet/route.ts, src/app/api/inspection/execution/route.ts (settings-driven enforcement for packet ID prefix/format, submit-to-R&D toggle, and hold/reject note policy)
- src/app/api/inspection/sample-management/route.ts (seal edit authorization honors role-allowlist fallback policy)
- src/app/admin/settings/company/page.tsx (new dedicated Company Profile + Branding workspace with logo upload, color suggestions, and report/packing/COA previews)
- src/app/admin/company-profile/page.tsx (compatibility alias redirect to `/admin/settings/company`)
- src/app/admin/settings/workflow/page.tsx (company branding editor removed; workflow page now links to dedicated Company Profile settings)
- src/app/api/settings/company-profile/logo/route.ts (admin-only logo upload endpoint used by Company Profile settings UI)
- src/lib/branding-color-suggestions.ts (client-side logo palette extraction for optional manual color suggestions)
- src/lib/ui-navigation.ts (settings active matching and page definitions updated for Company Profile route)
- src/app/api/admin/workflow-escalations/[id]/route.ts, src/app/api/jobs/[id]/archive/route.ts, src/app/api/jobs/[id]/assign/route.ts, src/app/api/jobs/[id]/workflow/route.ts, src/app/api/lots/[id]/assign/route.ts, src/app/api/lots/[id]/route.ts, src/app/api/lots/[id]/seal/route.ts, src/app/api/packets/[id]/route.ts, src/app/api/samples/[id]/route.ts (replaced ambient `RouteContext` usage with explicit route-context typing)
- src/app/admin/settings/company/page.tsx (upload-only color-suggestion policy copy locked; URL logos remain supported for branding and preview)
- src/types/next-route-context.d.ts (removed temporary global route-context shim)

## Completed
- IA definition completed (workflow-first + role-specific).
- Reusable enterprise UI pattern library defined for shell, navigation, list/detail layouts, drawers, forms, statuses, timelines, linked records, documents, and exceptions.
- Inspection + Job UI revamp implementation completed on existing routes (no new route family).
- Inspection + Job revamp extended to all active Job surfaces (`/rd`, `/userrd`, job detail routes).
- Lot Traceability + Document Registry + Exception Queue implementation completed on dedicated routes and read-only aggregation APIs.
- Role-based workspace homepages reworked on existing routes (`/operations`, `/userinsp`, `/userrd`, `/exceptions`, `/admin`) with queue-first, action-oriented layouts.
- Unified Job Workflow refactor completed with canonical `/jobs/[jobId]/workflow` execution routing and legacy route compatibility redirects.
- Workflow settings and master-data controls added for client details, container types, numbering policy, image policy, seal policy, and final-decision approver policy.
- Module Settings architecture implemented as a grouped, company-scoped policy contract with server-side workflow enforcement.
- Admin Module Settings page completed on canonical `/admin/settings/workflow` route with persisted company profile/branding settings and compatibility redirect from `/settings`.
- Remaining follow-ups closed: explicit route-handler typing applied and branding color suggestions locked to upload-only behavior.

## Blocked
- No planning-stage blockers.
- No implementation blockers in this phase.

## Next
1. Create and apply a Prisma migration for the new unified workflow schema fields before production rollout.
2. Run manual workflow QA across Production, Manager, and R&D roles on the new `/jobs/[jobId]/workflow` path.

## Phase-2 Backlog
- Persist dispatch-document linkage as a dedicated model/API contract to replace derived artifact inference.

## Post-Release QA Focus
- Validate `Awaiting Review` terminology appears consistently in R&D queues and related docs.
- Validate `Open Traceability` availability from production, packet, and exception action surfaces.
- Validate document actions remain context-aware and use canonical labels only.
- Validate operator routes remain queue-first and free of KPI/dashboard clutter on mobile/tablet.

## Scope Notes
- Runtime UI refactor with additive read-only aggregation APIs for traceability, documents, and exceptions.
- No schema migrations or mutation contract changes.
- Permission/scoping/gating logic preserved.
- Playground remains excluded.
- Lot remains the primary traceable object.
- Status semantics and badge rendering are governed by shared dictionary + `WorkflowStateChip`; local page mapping is disallowed.

## Audit Coverage Snapshot
- Global app shell and navigation reviewed.
- Dashboard/list/detail patterns reviewed.
- Chakra usage patterns reviewed.
- Inspection, Job, R&D, and Packet Management workflows reviewed.
- Document retrieval, COA discoverability, lot traceability visibility, and role-based usability reviewed.

## Validation Snapshot
- `npm run lint`: pass with pre-existing warnings only (`prisma.config.ts`, `LotInspectionWorkspace` hook deps).
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- Re-run completed after role-homepage workspace redesign; no new lint/type/build regressions introduced by this slice.
- Final cleanup re-run completed after terminology/pattern/traceability/doc retrieval sync: lint warnings unchanged, typecheck pass, build pass.
- Final hardening re-run completed after global search + navigation/a11y + `Awaiting Review` terminology lock: lint warnings unchanged, typecheck pass, build pass.
- Final closure re-run completed after `DetailTabsLayout` adoption on pending detail pages and dispatch blocker hardening: lint warnings unchanged, typecheck pass, build pass.
- Module-settings architecture re-run completed after grouped policy contract and server-side enforcement: lint warnings unchanged, typecheck pass, build pass.
- Module-settings route and persistence hardening re-run completed: lint warnings unchanged, `npx tsc --noEmit` pass, build pass.

## Image-Proof Settings Closure (Final)
- Root cause closed: some company rows had all three image buckets empty (`required`, `optional`, `hidden`), which made all categories appear as `Not Used`.
- Runtime guard locked:
  - `repairEmptyImagePolicyBuckets()` now repairs buckets only when all three are empty.
  - valid custom and partial admin configurations are preserved unchanged.
- Admin UX clarified on `/admin/settings/workflow`:
  - explicit `Not Used` definition,
  - explicit required-proof impact (blocks Submit for Decision and Pass),
  - `Restore recommended image defaults` action,
  - summary rail microcopy for invalid all-empty bucket state.
- Migration backfill added:
  - `prisma/migrations/20260410000623_backfill_empty_image_policy_buckets/migration.sql`
  - updates only rows where all three image buckets are empty.
- Test coverage extended:
  - `src/lib/module-workflow-policy.test.ts`
  - `src/app/api/settings/module-workflow/route.test.ts`
  - `src/lib/image-proof-policy.test.ts` retained in run set.

### Migration Runbook
1. Apply migrations in target environment:
   - `npx prisma migrate deploy`
2. Verify no all-empty bucket rows remain:
   - `SELECT COUNT(*) FROM "ModuleWorkflowSettings" WHERE COALESCE(array_length("requiredImageCategories", 1), 0) = 0 AND COALESCE(array_length("optionalImageCategories", 1), 0) = 0 AND COALESCE(array_length("hiddenImageCategories", 1), 0) = 0;`
3. Expected result: `0`

### Rollback Note
- No destructive migration behavior.
- Backfill updates only all-empty rows and does not alter intentional non-empty admin policies.
