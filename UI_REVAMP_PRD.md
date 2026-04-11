# UI_REVAMP_PRD

## Product Intent
Revamp the application UI into a clean, structured, enterprise-grade product inspired by Zoho-style operational clarity, while staying practical for operations-heavy usage.

## Governance Reference
- Enforceable UI architecture and implementation policy is defined in:
  - `docs/enterprise-ui-governance.md`
- This PRD defines product intent and outcomes. If any architecture-level wording conflicts, canonical governance takes precedence.

## Stage Flow (Canonical)
`Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

## Core Object
`Lot` is the primary traceable object across all modules and screens.

## Roles
- Production
- R&D
- Manager
- Admin

Runtime role mapping:
- Production -> `OPERATIONS`
- R&D -> `RND`
- Manager -> `VIEWER` (scoped)
- Admin -> `ADMIN`

## Priority Modules
1. Inspection
2. Job
3. R&D
4. Packet Management

## Scope
In scope:
- UI/UX restructuring for the canonical stage flow
- Task-first stage-oriented execution surfaces across breakpoints
- Dense enterprise shell patterns for registry/oversight pages where actionable
- Mobile/tablet task-first operational usability for execution pages
- Workflow clarity, traceability visibility, operational speed, and document retrieval
- Standardized actions and terms for evidence, decisions, and PDFs

Out of scope:
- Playground
- Decorative widgets, oversized KPI cards, and dashboard-first operational screens
- Runtime API/schema behavior changes in this planning phase

## Guiding Principles
- Task-first UX: one screen, one clear operational task.
- Show only values needed to act now.
- Keep progression and blockers explicit.
- Use plain operational terminology.
- Preserve permission boundaries and auditability.

## Operational UX Requirements
- Mobile first, tablet second, desktop third.
- No KPI/dashboard clutter on operational execution screens.
- Camera-first evidence capture.
- Seal flow: `Scan Seal` primary, `Capture Seal Photo` available, manual entry fallback only.
- PDF actions use exact labels:
  - `Download Report PDF`
  - `Download Packing List PDF`
  - `View PDF`
  - `Share PDF`
  - `Print PDF`

## User Outcomes
- Users can complete daily flow with minimal navigation confusion.
- Users can quickly locate current step, blockers, and next action.
- Users can retrieve required documents without ambiguous action names.

## Role Responsibilities
- Production: execute stage tasks and capture required evidence.
- R&D: complete lab testing inputs and validations.
- Manager: resolve blockers, review status, and approve progression.
- Admin: maintain configuration, permissions, and compliance controls.

## Success Metrics
- Reduced time-to-complete for the canonical stage flow.
- Reduced stage-blocker confusion and misclicks.
- Improved first-time task completion on mobile/tablet.
- Faster report and packing list retrieval.
- No regression in traceability, permissions, or audit logging expectations.

## Constraints
- Maintain consistent stage names and order in all revamp docs.
- Keep terminology aligned with operational language.
- Do not introduce consumer-style visual noise.
