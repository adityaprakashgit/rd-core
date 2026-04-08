# UI_REVAMP_STATUS_TERMS

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
