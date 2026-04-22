# UI_REVAMP_STATUS_TERMS

## Governance Authority
- Canonical UI governance is defined in `docs/enterprise-ui-governance.md`.
- This file defines approved terminology and status language inventory.
- If terminology or behavior guidance conflicts, follow:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. Module-specific docs

## Canonical Context
- Stage flow: `Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`
- Roles: Production, R&D, Manager, Admin
- Runtime role mapping:
  - Production -> `OPERATIONS`
  - R&D -> `RND`
  - Manager -> `VIEWER` (scoped)
  - Admin -> `ADMIN`
- Core object: Lot
- Exclude Playground

## Execution Terminology Compatibility
- Shared workflow shells may render Job/Lot terminology as Batch/Bag in navigation and step labels.
- Canonical identifiers remain Job Number/Lot Number in traceability, PDFs, and audit trails.
- Legacy evidence-policy aliases remain accepted for imported settings and backfill compatibility only.

## Workflow Semantics (Must Stay Distinct)
- **Stage**: where the record is in the process sequence.
- **Status**: current record state within or across stages.
- **Next Action**: immediate action required to progress.
- **Owner**: role/user accountable for current action.
- **Blocker**: reason progression is currently stopped.

Rules:
- UI MUST NOT present Stage and Status as interchangeable labels.
- Process pages MUST show current Stage + Status + Next Action together.
- Owner and Blocker SHOULD be visible in process headers or rails when applicable.

## Approved Primary Labels
- Job Number
- Lot Number
- Material Name
- Current Step
- Missing Photos
- Scan Seal
- Download Report PDF
- Download Packing List PDF
- View PDF
- Share PDF
- Print PDF

## Execution Surface Labels
- Batch Number
- Bag Number
- Batch Workflow
- Bag Intake

## Final Pass Decision Terms
Allowed decisions:
- Pass
- Hold
- Reject

Blocking semantics:
- Hold: blocks forward progression until reviewed/resolved.
- Reject: blocks forward progression until reviewed/resolved.
- Pass: allows progression when all required validations are satisfied.

## Evidence Status Terms
- Missing
- Uploaded
- Retake

## Document Status Terms
- Generating
- Ready
- Failed

## Stage Status Terms
Use concise operational terms only:
- Not Started
- In Progress
- Blocked
- Awaiting Review
- Completed

## Status Rendering Contract
- Status presentation MUST use shared status dictionary.
- Status chips MUST use shared `WorkflowStateChip` (or canonical successor).
- Local per-page color/label mapping is prohibited.

## Blocker Message Pattern
- What is blocked
- Why it is blocked
- What action resolves it

## Disallowed User-Facing Terms
- Raw DB identifiers
- Enum names
- Workflow-internal technical labels
- Export artifact
- Build output
- Generate file object

## Terminology Governance
- Use the same terms across UI, QA scripts, and docs.
- Do not introduce synonyms for canonical CTA/status labels.
- Update this file first when adding any new user-facing operational term.

## Final Closure Lock
- R&D queue review bucket is locked to: `Awaiting Review`.
- Fallback availability text on operational surfaces should use: `Not Available`.
- Ambiguous row actions (for example `Open`) are disallowed; action labels must include destination context.
