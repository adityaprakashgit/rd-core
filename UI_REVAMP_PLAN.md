# UI_REVAMP_PLAN

## Objective
Deliver a practical, implementation-ready UI revamp roadmap that improves workflow clarity and speed while preserving traceability and controls.

## Stage Flow (Canonical)
`Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

## Roles (Canonical)
- Production
- R&D
- Manager
- Admin

Runtime mapping:
- Production -> `OPERATIONS`
- R&D -> `RND`
- Manager -> `VIEWER` (scoped)
- Admin -> `ADMIN`

## Module Priority
1. Inspection
2. Job
3. R&D
4. Packet Management

## Non-Negotiables
- Exclude Playground.
- Keep Lot as primary traceable object.
- Remove KPI-heavy/dashboard clutter from operational screens.
- Device policy: desktop-first shell for registry/oversight, mobile/tablet task-first execution surfaces.
- Preserve permissions, validations, traceability, and auditability.
- Keep exact PDF action labels:
  - `Download Report PDF`
  - `Download Packing List PDF`
  - `View PDF`
  - `Share PDF`
  - `Print PDF`

## Phased Roadmap
### Phase 1: Foundations
- Finalize shared terms, statuses, and CTA labels.
- Define shared layout pattern for mobile/tablet task screens.
- Define screen-level visibility rules (show/hide).

### Phase 2: Job + Lot Flow
- Standardize Job creation and Lot management screens.
- Ensure Lot-centric context is visible and actionable.
- Enforce stage progression and blocker messaging.

### Phase 3: Inspection + Evidence
- Standardize Images and Final Pass UX.
- Enforce camera-first image capture and required evidence categories.
- Enforce seal flow with scan-first and manual fallback.

### Phase 4: R&D + Packet Management
- Align lab testing and packet-management interactions to stage progression.
- Keep operational forms concise and blocker-driven.

### Phase 5: Document Retrieval
- Standardize Report and Packing List actions.
- Ensure document states and retrieval actions are explicit and fast.

### Phase 6: Hardening
- Run UI consistency pass against all modules.
- Validate role-based visibility and permissions.
- Validate traceability and audit event coverage at flow boundaries.

## Dependencies
- Stable role/permission definitions for Production, R&D, Manager, Admin.
- Stable Lot linkage across screen contexts.
- Stable backend status and validation payloads (no runtime contract break in this planning phase).

## Rollout Slices
- Slice A: Job + Lot
- Slice B: Images + Final Pass
- Slice C: Lab Testing + Packet Management
- Slice D: Report + Packing List

## Risk Register
- Terminology drift across modules.
- UI clutter reintroduced in desktop variants.
- Inconsistent blocker handling between stage screens.
- Role-specific visibility inconsistencies.

## Mitigations
- Single status/terms dictionary.
- Shared screen template and component system.
- Cross-module QA checklist before each slice release.

## Delivery Artifacts
- `UI_REVAMP_SCREEN_MAP.md`
- `UI_REVAMP_COMPONENT_SYSTEM.md`
- `UI_REVAMP_STATUS_TERMS.md`
- `UI_REVAMP_TEST_PLAN.md`
- `UI_REVAMP_PROGRESS.md`
