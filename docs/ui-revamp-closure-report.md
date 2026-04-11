# Recycos UI Revamp Closure Report

Date: April 9, 2026  
Phase: Enterprise UI Revamp (governance + structure + visual convergence + enforcement)

## 1) What Was Standardized

- **Governance precedence** is now explicit and enforced in docs: `docs/enterprise-ui-governance.md` -> `AGENTS.md` -> module docs.
- **Canonical page shell contract** is standardized and reused across active enterprise routes: `AppLayout -> PageIdentityBar -> PageActionBar -> FilterSearchStrip or stage header/tabs -> Content -> optional Right Rail -> optional Mobile Action Rail`.
- **Workflow semantics** are separated and consistently surfaced: stage, status, next action, owner, blocker.
- **Status presentation** is standardized through shared status presentation and `WorkflowStateChip`; local status-color mapping drift has been reduced on core routes.
- **Template-led composition** is now the default for high-traffic pages (queue/object-process/document/settings surfaces) rather than one-off local layouts.

## 2) What High-Risk Drift Was Removed

- Removed mixed visual-era drift on high-traffic execution surfaces:
  - softer startup-style panels (oversized radii, saturated contextual fills, heavy card stacks),
  - inconsistent section rhythm and nested wrappers.
- Replaced ad-hoc stage/button strip in job workflow with shared enterprise stage visual treatment.
- Reduced table wrapper duplication (`EnterpriseStickyTable` + extra padded wrapper) on manager/admin/registry surfaces.
- Standardized modal/drawer surfaces on key interaction pages (R&D, Admin, Seal Scanner, mobile drawer) with enterprise radius and spacing rhythm.
- Reduced residual visual drift in inspection and reporting workspaces by moving emphasis from colored blocks to neutral surfaces + semantic chips/icons.

## 3) What Shared Primitives Now Define the System

The enterprise UI is now defined by shared primitives and templates, not page-local styling:

- **Shell and identity**
  - `ControlTowerLayout`
  - `PageIdentityBar`
  - `PageActionBar`
  - `FilterSearchStrip`
- **Workflow/process**
  - `WorkflowStepTracker`
  - shared stage tabs treatment (`line-enterprise`)
  - `ProcessFlowLayout`
  - `MobileActionRail`
- **Status and traceability**
  - `WorkflowStateChip`
  - `LinkedRecordsPanel`
  - `HistoryTimeline`
- **Data and structure**
  - `EnterpriseDataTable`
  - `EnterpriseStickyTable`
  - `RegistryPageTemplate` / `WorkbenchPageTemplate` / other enterprise templates
- **Error and empty-state behavior**
  - enterprise async states (`InlineErrorState`, `EmptyWorkState`, `TopErrorBanner`, `PageSkeleton`)

## 4) What Enforcement Was Added

- **Lint guardrails (warn-level)** were added in `eslint.config.mjs` for UI drift detection:
  - flag `borderRadius="2xl"` on enterprise surfaces,
  - flag direct saturated `*.50` contextual backgrounds,
  - flag padded wrapper nesting inside `EnterpriseStickyTable`.
- **Governance policy additions** were added in `docs/enterprise-ui-governance.md`:
  - *Visual Convergence Compliance Checklist*,
  - *Local Wrapper Deprecation* guidance for generic local Button/Card wrappers where enterprise primitives exist.
- **Policy intent**: guide contributors during feature work without blocking existing in-flight changes (warn-first adoption).

## 5) What Exceptions Remain Intentionally Unresolved

- Some legacy/auxiliary surfaces remain intentionally deferred where full conversion would create high churn for low operational gain (especially non-core flows and compatibility routes).
- Warn-level lint is intentionally non-blocking in this phase; hard-fail rollout is deferred until warning noise is near zero.
- Select local wrapper/component usage may still exist on low-risk legacy screens and can be retired opportunistically.
- Playground and non-canonical aliases are intentionally out of closure scope unless they affect shared primitives.

## 6) What Future Contributors Must Follow

Contributors **MUST**:

- Reuse shared enterprise primitives before introducing local layout/styling patterns.
- Keep workflow pages stage-oriented with clear current stage ownership and one primary action hierarchy.
- Use shared status presentation (`WorkflowStateChip` + shared status dictionary); do not add local status color maps.
- Prefer neutral structural surfaces (`bg.surface`, `bg.rail`) and semantic chips/icons over saturated contextual blocks.
- Keep tables and registries in enterprise rhythm (no redundant container nesting around sticky tables).
- Keep modal/drawer spacing and radius aligned to shared enterprise tokens.

Contributors **MUST NOT**:

- Add new one-off workflow/detail shells when an approved enterprise template exists.
- Reintroduce broad soft/dashboard-era styling patterns on execution surfaces.
- Reopen this revamp as a broad redesign without system-level evidence.

## 7) Recommended Done Statement

**Recommended phase closure statement:**

> The Recycos Enterprise UI Revamp Phase is closed for broad redesign work.  
> Governance, shared structure, visual convergence, and lightweight enforcement are now in place and sufficient for feature-mode delivery.  
> UI changes from this point forward MUST be targeted, template-first, and policy-compliant.  
> Reopening this phase broadly requires documented system-level regression evidence (not isolated page preference).

---

## Evidence Appendix

### A) Changed Surface Clusters (representative)

- **Governance and enforcement**
  - `docs/enterprise-ui-governance.md`
  - `eslint.config.mjs`
- **Core enterprise primitives**
  - `src/components/enterprise/EnterprisePatterns.tsx`
  - `src/components/enterprise/WorkflowStepTracker.tsx`
  - `src/components/enterprise/WorkflowStateChip.tsx`
- **High-traffic workflow/list surfaces**
  - `src/components/jobs/UnifiedJobWorkflow.tsx`
  - `src/app/reports/page.tsx`
  - `src/app/userrd/job/[jobId]/page.tsx`
  - `src/app/userrd/page.tsx`
  - `src/app/master/page.tsx`
  - `src/app/exceptions/page.tsx`
  - `src/app/traceability/lot/[lotId]/page.tsx`
- **Interaction surface standardization**
  - `src/app/rd/page.tsx`
  - `src/app/admin/page.tsx`
  - `src/components/inspection/SealScanner.tsx`
  - `src/layout/MobileBottomNav.tsx`

### B) Validation Snapshot

- Targeted `eslint` on Wave A/B/C files: passed (warn-level policy checks active as designed).
- `tsc --noEmit`: passed.

### C) Known Non-Blocking Deferred Items

- Legacy low-risk/auxiliary pages not yet fully migrated to enterprise templates.
- Warn-level guardrails still in adoption phase; hard error migration deferred by design.
