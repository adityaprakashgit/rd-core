# UI_REVAMP_TEST_PLAN

## Governance Authority
- Canonical UI governance is defined in `docs/enterprise-ui-governance.md`.
- Agent enforcement is defined in `AGENTS.md`.
- This file is a testing reference and MUST remain subordinate to canonical governance.
- If wording conflicts, precedence is:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. supporting/module docs

## Objective
Verify the UI revamp delivers workflow clarity, operational speed, traceability visibility, and reliable document retrieval without regression in controls.

## Canonical Baseline
- Stage flow: `Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`
- Roles: Production, R&D, Manager, Admin
- Runtime role mapping: Production -> `OPERATIONS`, R&D -> `RND`, Manager -> `VIEWER`, Admin -> `ADMIN`
- Core object: Lot
- Canonical lineage: `Job -> Lot -> Sample -> Trial -> Packet -> Dispatch -> COA`
- Exclude Playground
- No KPI/dashboard clutter on operational screens
- Device policy: execution/process pages are task-first and stage-oriented across breakpoints; registry/oversight may use dense enterprise list/table layouts.

## Workflow Semantics Contract (Tested)
- Stage, Status, Next Action, Owner, and Blocker MUST remain distinct.
- Workflow-heavy detail pages MUST follow Object Process Template behavior:
  - sticky/non-scroll-dependent stage orientation
  - one active stage panel at a time
  - right rail context for linked records/blockers/history/documents

## Test Layers
- Unit: component behavior, label rendering, shared status dictionary + `WorkflowStateChip` rendering.
- Integration: stage transitions, blocker propagation, role-based visibility.
- E2E: full operational journey from Job Creation to Packing List.
- Accessibility: keyboard navigation, semantic structure, color contrast, focus order.
- Responsive: mobile and tablet layout behavior parity.

## Key Scenarios
### Workflow and Gating
- Progress through all stages in canonical order.
- Verify Hold/Reject in Final Pass blocks progression until resolved.
- Verify Lot context remains visible and consistent across stages.

### Evidence and Seal
- Verify camera-first action is primary on evidence cards.
- Verify required evidence categories block stage completion when missing.
- Verify `Scan Seal` primary behavior.
- Verify manual seal entry works only as fallback.

### Document Retrieval
- Verify exact action labels:
  - `Download Report PDF`
  - `Download Packing List PDF`
  - `View PDF`
  - `Share PDF`
  - `Print PDF`
- Verify document states: Generating, Ready, Failed.
- Verify failed states show clear retry path.

### Visual and Content Rules
- Verify no KPI-heavy/dashboard clutter on operational screens.
- Verify no decorative widgets or flashy consumer styling.
- Verify approved terminology only; no technical/internal labels exposed.
- Verify no local page-level status/badge mapping logic is introduced.
- Verify workflow-heavy detail pages do not regress to long mixed-scroll stage rendering.

### Role Coverage
- Production: execution-focused visibility and actions.
- R&D: lab testing controls and blocker resolution.
- Manager: review and progression oversight.
- Admin: role/config control views and restrictions.

## Acceptance Criteria
- Users can complete operational flow without ambiguity.
- Blockers are explicit and actionable.
- Traceability context is preserved through Lot-centric flow.
- Document actions are clear and discoverable.
- Mobile/tablet behavior supports practical field use.

## Exit Criteria
- All critical E2E scenarios pass.
- No blocking accessibility defects on operational screens.
- No regression in role visibility, blockers, or document actions.

## Final Closure Scenarios
- Verify `DetailTabsLayout` is active and functional on:
  - Inspection Job Detail
  - Packet Detail
  - R&D Job Detail
- Verify packet dispatch blockers render actionable next steps and canonical fallback text (`Not Available`).
- Verify destination-explicit action labels replace ambiguous `Open` labels on revamp surfaces.
- Verify `Awaiting Review` appears consistently in R&D queue sections and filters.
