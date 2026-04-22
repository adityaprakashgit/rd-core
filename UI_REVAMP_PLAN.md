# UI_REVAMP_PLAN

## Governance Authority
- Canonical UI governance is defined in `docs/enterprise-ui-governance.md`.
- This plan is an execution roadmap and MUST align with canonical governance.
- If wording conflicts, follow:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. Module-specific planning docs

## Objective
Deliver a practical, implementation-ready UI revamp roadmap that improves workflow clarity and speed while preserving traceability and controls.

## Stage Flow (Canonical)
`Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

Note:
- Shared execution shells may surface Batch/Bag wording in navigation or step labels.
- Keep Job Number/Lot Number visible in traceability, PDFs, and headers so the canonical identifiers stay obvious.

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
- Device policy: role-home queues and registries MAY use dense enterprise layout; process-heavy execution surfaces MUST remain mobile/tablet task-first.
- Preserve permissions, validations, traceability, and auditability.
- Workflow-heavy pages MUST use stage-oriented navigation and MUST NOT rely on long mixed-scroll sections.
- Status rendering MUST use shared status dictionary + `WorkflowStateChip` (or canonical successor).
- Keep exact PDF action labels:
  - `Download Report PDF`
  - `Download Packing List PDF`
  - `View PDF`
  - `Share PDF`
  - `Print PDF`

## Phased Roadmap
### Phase 1: Foundations
- Lock shell/template contract from canonical governance.
- Finalize shared terms, statuses, and CTA labels through central dictionary.
- Define screen-level visibility rules (show/hide) and stage ownership checks.

### Phase 2: Canonical Job Workflow
- Refactor Job/Lot execution into canonical stage-oriented process experience.
- Ensure Lot-centric context is visible and actionable with lineage links.
- Enforce one-active-panel stage behavior and blocker messaging.

### Phase 3: Inspection + Evidence
- Standardize Images and Final Pass UX.
- Enforce camera-first image capture and required evidence categories.
- Enforce seal flow with scan-first and manual fallback.

### Phase 4: R&D Detail Alignment
- Align R&D detail/process pages to the approved Object Process Template.
- Keep operational forms concise, blocker-driven, and stage-owned.

### Phase 5: Packet Detail Alignment
- Align packet detail/process pages to the same stage-oriented template family.
- Standardize packet stage/status/owner/next-action semantics.

### Phase 6: Traceability + Document + Timeline Standardization
- Standardize linked-record rails and lineage visibility patterns.
- Consolidate timeline/history and document action blocks.

### Phase 7: Legacy Cleanup + Hardening
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
