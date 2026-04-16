# Enterprise UI Governance (Canonical)

This document is the canonical UI governance policy for Recycos web surfaces.  
It is implementation-oriented and enforceable for all UI work in this repository.

## Applicability and Precedence

- Applies to all production UI routes and components.
- Playground-specific flows are out of scope unless explicitly requested.
- If UI guidance conflicts across markdown files, precedence is:
  1. `docs/enterprise-ui-governance.md` (this file)
  2. `AGENTS.md`
  3. Module-specific docs

## Product Context

- Recycos is a multi-module ERP for the recycling industry.
- This codebase is one module within the broader ERP architecture.
- UI direction:
  - Zoho-like usability and cleanliness
  - SAP/Fiori-like structure, lineage visibility, and workflow governance

## 1) Core UI Principles (Enforceable)

1. **Workflow over decoration**  
   UI MUST prioritize task execution, progression, and blocker resolution over visual ornament.
2. **One object, one canonical experience**  
   Each core object MUST have a canonical route and primary UI pattern.
3. **Stage and status are different**  
   Stage (where in process) MUST NOT be conflated with status (state of record).
4. **Non-scroll-dependent workflow orientation**  
   Process-heavy pages MUST provide stage orientation without requiring long vertical scanning.
5. **Lineage and auditability must be visible**  
   Linked records and audit timeline MUST be visible on process/detail surfaces.
6. **Reuse before customization**  
   Existing shared primitives/templates MUST be reused before creating local UI patterns.
7. **Role-based relevance**  
   Actions and context MUST reflect role responsibility and least-privilege visibility.
8. **Human-readable identifiers first**  
   UI MUST prioritize Job Number/Lot Number/etc. and MUST NOT lead with internal IDs.

## 2) Canonical Lineage Model

The lineage model MUST be consistently represented:

`Job -> Lot -> Sample -> Trial -> Packet -> Dispatch -> COA`

Requirements:
- Detail/process pages SHOULD surface lineage in header, tabs, or right rail.
- Linked record navigation MUST preserve this sequence where applicable.

## 3) Global Page Shell Contract

All major pages MUST follow this shell order:

`AppLayout -> PageIdentityBar -> PageActionBar -> (FilterSearchStrip OR WorkflowStageHeader/WorkflowStageTabs) -> Content -> optional Right Rail -> optional Mobile Action Rail`

Rules:
- Action hierarchy MUST be explicit (single primary CTA, secondary actions clearly grouped).
- Process pages MUST keep stage ownership visible near top.
- Mobile action rail MUST avoid duplicate competing primary actions.

## 4) Approved Page Templates

Approved reusable templates:

- Queue Template
- Object Process Template
- Form Template
- Document Review Template
- Settings Template

Rules:
- New pages MUST start from an approved template.
- Local one-off layouts MUST NOT be introduced for behavior already covered by templates.

## 5) Object Process Template Rules

Object Process Template MUST include:

- Object header with: identifier, status, stage, owner, age, primary CTA
- Sticky/non-scroll-dependent stage tabs
- Exactly one active stage panel at a time
- Right rail for linked records, blockers, history, and documents

Process pages MUST NOT render all process stages as long mixed-scroll sections.

## 6) Shared Workflow Semantics

The following semantics MUST be explicitly represented and kept distinct:

- **Stage**: current process step (e.g., Sampling, Packets)
- **Status**: current record state (e.g., IN_PROGRESS, LOCKED)
- **Next action**: immediate operator/system action required
- **Owner**: accountable role/user for current stage
- **Blocker**: condition preventing progression

Each process-heavy page MUST provide these semantics in visible, actionable form.

### Image Policy Invariant

- Image policy buckets (`required`, `optional`, `hidden`) MUST NOT all be empty.
- All-empty bucket state is treated as a broken configuration and MUST auto-repair to canonical defaults.
- Intentional non-empty custom policies (including partial policies) MUST be preserved without silent override.

## 7) Status System Contract

Rules:
- Status display MUST use shared status dictionary only.
- Pages MUST use shared `WorkflowStateChip` (or canonical successor) for status rendering.
- Local page-level badge color mapping logic MUST NOT be introduced.

Implementation check:
- Any status color/label mapping inside a route page is a policy violation unless delegated to shared status primitives.

## 8) Shared Reusable Component Direction

The following components/patterns are required centralization targets:

- AppShell
- PageIdentityBar
- PageActionBar
- FilterSearchStrip
- WorkflowStageHeader
- WorkflowStageTabs
- ObjectProcessTemplate
- WorkflowStateChip
- LinkedRecordsRail
- UnifiedHistoryTimeline
- DocumentActionGroup
- EvidenceCaptureBlock
- MobileActionRail
- QueueTablePreset

Rules:
- When editing page UI, engineers MUST evaluate whether behavior belongs in shared components.
- Repeated behavior appearing in 2+ modules SHOULD be abstracted to a shared primitive/template.

## 9) Governance Prohibitions

The following are prohibited:

- New one-off layouts where approved templates apply
- Local status mapping/badge color logic in route pages
- Duplicate timeline/audit component families for same purpose
- Competing canonical routes for same object experience
- Workflow pages without clear stage ownership/orientation

## 10) Migration Direction (Priority Order)

Migration sequence MUST follow:

1. Foundation lock
2. Canonical job workflow
3. R&D detail alignment
4. Packet detail alignment
5. Lineage/document/timeline standardization
6. Legacy route/component cleanup

## Implementation Checks (PR/Task Gate)

For UI-affecting changes, reviewers/agents MUST confirm:

- Uses approved shell/template structure
- Maintains stage ownership clarity for process pages
- Uses shared status primitives (no local mapping)
- Preserves canonical route ownership
- Surfaces lineage/linked records where applicable
- Avoids introducing drift against shared component direction

## Visual Convergence Compliance Checklist

For UI passes affecting visual structure, authors/reviewers MUST confirm:

- No `borderRadius="2xl"` on enterprise workflow/list/settings surfaces unless explicitly approved.
- No direct saturated contextual fills (`brand.50`, `green.50`, `orange.50`, etc.) on execution panels; use neutral surfaces plus semantic chips/icons.
- No redundant table container stacking (`EnterpriseStickyTable` + extra padded wrapper).
- Process/detail pages use shared stage navigation treatment (shared tabs/trackers), not local ad-hoc button strips.
- Modal/Drawer surfaces use shared enterprise rhythm (radius, header/body/footer spacing, border-led hierarchy).

Recommended local check before PR:

- Run targeted lint on touched UI files and fix governance warnings:
  - `npx eslint <touched-ui-files>`

## Local Wrapper Deprecation

Local UI wrappers that duplicate Chakra/enterprise primitives (for example generic local `Button`/`Card` wrappers) are deprecated on new or refactored enterprise surfaces.

Rules:

- New UI work MUST prefer Chakra + enterprise primitives directly.
- Existing wrapper usage SHOULD be migrated opportunistically during visual cleanup waves.
- Wrapper usage MAY remain temporarily in legacy/low-risk pages where migration would introduce unnecessary churn.

## Deprecation Note for Legacy/Overlapping Docs

Existing revamp docs remain valid as historical and planning references.  
When wording differs, this file is authoritative for architecture and implementation decisions.
