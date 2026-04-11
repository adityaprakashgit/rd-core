# PRD_MOBILE_TABLET_UI

## Governance Authority
- Canonical UI governance is defined in `docs/enterprise-ui-governance.md`.
- Agent enforcement is defined in `AGENTS.md`.
- This PRD is intent/outcome documentation and MUST remain subordinate to canonical governance.
- If wording conflicts, precedence is:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. supporting/module docs

## 1. Objective
Deliver a task-first operational UX where process-heavy execution remains stage-oriented and non-scroll-dependent across mobile/tablet/desktop, and registry/oversight views remain clean enterprise surfaces.

Stage order (fixed across product):
`Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

Playground is out of scope.

## 2. Product principles
- Workflow clarity over decoration.
- One object, one canonical experience.
- One screen = one clear task.
- Show only action-driving information.
- Execution/process pages MUST be stage-oriented and non-scroll-dependent.
- Registry/oversight pages MAY use dense enterprise layouts when actionable.
- Use plain operational labels.
- Scan-first seal handling with fallback.
- Camera-first image capture on mobile and tablet.
- Explicit, human-readable PDF actions.

## 3. Workflow Semantics Contract
The following terms MUST remain distinct on all workflow-heavy documentation and UI surfaces:
- Stage = process position
- Status = record state
- Next Action = immediate required action
- Owner = accountable role/user
- Blocker = condition preventing progression

Workflow-heavy detail pages MUST follow Object Process Template behavior:
- sticky/non-scroll-dependent stage tabs/header
- one active stage panel at a time
- right rail for linked records, blockers, history, and documents

## 4. Scope
In scope:
- Job Creation
- Lot
- Images
- Final Pass
- Lab Testing
- Report
- Packing List

Out of scope:
- Playground
- KPI/dashboards on operational execution routes

## 5. User roles
- Operator/Inspector: performs daily execution workflow.
- Supervisor/QA: verifies completion, handles blockers, approves progression.
- Report user: generates and distributes report/packing list PDFs.

## 6. End-to-end user task flow
1. Create Job with required fields.
2. Add Lot and required lot details.
3. Capture required Images.
4. Complete Final Pass checks.
5. Complete Lab Testing steps.
6. Access Report documents.
7. Access Packing List documents.

Progression rule:
- Each stage blocks forward movement if required fields/evidence are missing.

## 7. Stage-by-stage UX expectations
Job Creation:
- Show only required form fields and `Create Job`.
- No KPI summaries.

Lot:
- Show lot-required inputs and current stage context.
- Show only actionable status.

Images:
- Use required evidence cards first.
- Camera-first capture and retake.

Final Pass:
- Show checklist decisions and blockers.
- Keep completion action explicit.

Lab Testing:
- Show required sampling fields/evidence.
- Block completion until required items pass.

Report:
- Show document availability and clear report actions.

Packing List:
- Show packing list readiness and clear packing list actions.

## 8. Mobile task behavior
- Single-column interaction model.
- Sticky bottom primary CTA zone.
- One expanded task section at a time.
- Camera opens directly from image cards.
- Seal scan action visible above fold.

## 9. Tablet behavior
- Same task logic and labels as mobile.
- Two-pane layout allowed for context + action.
- Keep primary action prominence identical to mobile.
- Do not introduce KPI cards or dashboard clutter.

## 10. What to remove from current UI
- KPI cards, charts, summary widgets from operational screens.
- Non-actionable values and redundant metadata blocks.
- Technical jargon and internal system labels.
- Generic document terms and ambiguous action names.

## 11. What to keep visible
Always keep visible where relevant:
- `Job Number`
- `Lot Number`
- `Material Name`
- `Current Stage`
- `Status` only when it changes next action

Also keep visible:
- Current stage title.
- Next Action.
- Primary CTA.
- Inline validation near failing control.

## 12. Image capture behavior
Required categories (exact names):
1. Bag photo with visible LOT no
2. Material in bag
3. During Sampling Photo
4. Sample Completion
5. Seal on bag
6. Bag condition
7. Whole Job bag palletized and packed

Behavior:
- Direct camera capture is primary on mobile and tablet.
- File upload is secondary.
- Each card shows status: `Missing`, `Uploaded`, `Retake`.
- Per-card inline validation and retry.

## 13. Seal scanning behavior
- `Scan Seal` is primary and always visible.
- `Capture Seal Photo` is available in the same stage.
- Manual seal entry is fallback only.
- Scanned seal value appears immediately and validates immediately.
- On failure, show inline error and `Retry Scan`.

## 14. PDF/download behavior
Use these exact labels:
- `Download Report PDF`
- `Download Packing List PDF`
- `View PDF`
- `Print PDF`
- `Share PDF`

Rules:
- Keep actions in dedicated document sections.
- Show clear states: `Generating`, `Ready`, `Failed`.
- Never use `Export artifact`, `Build output`, `Generate object`, `File artifact`.

## 15. Error and validation behavior
- Inline first, toast secondary.
- Message format: what failed + what to do now.
- Keep user-entered values after validation errors.
- Recoverable failures must include retry.
- Blocking rule messages must be task-specific.

## 16. Acceptance criteria
- Operational mobile/tablet screens contain no KPI/dashboard clutter.
- Every visible value is directly actionable.
- Stage order is consistent across screens and docs.
- Image flows support direct camera capture on mobile and tablet.
- Seal flow is scan-first with manual fallback.
- Report/Packing List actions use exact PDF labels.
- New user can complete core flow without guidance in under 10 minutes.
