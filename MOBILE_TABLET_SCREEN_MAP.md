# MOBILE_TABLET_SCREEN_MAP

## Governance Authority
- Canonical UI governance is defined in `docs/enterprise-ui-governance.md`.
- Agent enforcement is defined in `AGENTS.md`.
- This file is a screen mapping reference and MUST remain subordinate to canonical governance.
- If wording conflicts, precedence is:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. supporting/module docs

Stage order used in every screen:
`Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

Canonical lineage model:
`Job -> Lot -> Sample -> Trial -> Packet -> Dispatch -> COA`

Execution shells may render Batch/Bag wording in the workflow chrome, but Job Number and Lot Number remain the canonical identifiers for traceability and reporting.

Device policy lock:
- Execution/process pages MUST be task-first and stage-oriented across breakpoints.
- Registry/oversight pages MAY use dense enterprise list/table patterns.
- Responsive differences MUST be layout-level, not workflow-logic-level.

Workflow semantics lock (must remain distinct):
- Stage = process position
- Status = record state
- Next Action = immediate required action
- Owner = accountable role/user
- Blocker = condition preventing progression

Workflow-heavy detail rule:
- Detail flows MUST follow Object Process Template behavior (sticky/non-scroll-dependent stage header/tabs, one active stage panel at a time, right rail for linked records/blockers/history/documents).

## Job Creation
- Screen Name: Job Creation
- Purpose: Create a new operational job.
- User Goal: Save valid job with minimum required information.
- Main Information Visible: Job Number (if pre-assigned), Current Stage, required form fields.
- Information Hidden by Default: advanced metadata, historical records, KPI widgets.
- Required Fields: Client, Material Name, Plant/Location, schedule/date fields.
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `Create Job`
- Secondary CTA: `Save Draft`
- Mobile Layout: Single column form, sticky bottom CTA.
- Tablet Layout: Two-pane optional (form + context), same CTA order.
- Validation / Blocking Rules: Required fields must pass before create; inline errors per field.
- Success State: Job created; route to Job Detail with Current Stage set to `Lot`.

## Job Detail
- Screen Name: Job Detail
- Purpose: Show current job context and next operational task.
- User Goal: Move to next required stage task quickly.
- Main Information Visible: Job Number, Material Name, Current Stage, actionable Status.
- Information Hidden by Default: KPI summaries, non-actionable aggregates, old logs.
- Required Fields: None (navigation/context screen).
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `Go to Lot`
- Secondary CTA: `View details`
- Mobile Layout: Compact stage card + next action.
- Tablet Layout: Stage context left, task shortcuts right.
- Validation / Blocking Rules: Block forward links to later stages if prior stage incomplete.
- Success State: User navigates to Add Lot or Lot Detail.

## Add Lot
- Screen Name: Add Lot
- Purpose: Add lot-level operational details.
- User Goal: Create lot record ready for image capture.
- Main Information Visible: Job Number, Lot Number input, Material Name, Current Stage.
- Information Hidden by Default: extra metadata and derived values.
- Required Fields: Lot Number, quantity-related required fields, Material Name (if editable).
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `Save Lot`
- Secondary CTA: `Cancel`
- Mobile Layout: Step form with one logical section at a time.
- Tablet Layout: Form pane + lot context pane.
- Validation / Blocking Rules: Lot Number required and unique within job; inline blockers.
- Success State: Lot saved; route to Lot Detail.

## Lot Detail
- Screen Name: Lot Detail
- Purpose: Display lot context and required next step.
- User Goal: Move immediately to pending task in Images or Final Pass.
- Main Information Visible: Job Number, Lot Number, Material Name, Current Stage, actionable Status.
- Information Hidden by Default: historical metadata, large read-only blocks.
- Required Fields: None on read state.
- Image Capture Actions: Quick jump to `Image Capture`.
- Seal Scan Actions: Quick jump to `Final Pass / Inspection` seal step.
- Primary CTA: `Go to Images`
- Secondary CTA: `Go to Final Pass`
- Mobile Layout: Minimal context header + next action card.
- Tablet Layout: Context summary + action shortcuts.
- Validation / Blocking Rules: Later stage shortcuts disabled if prerequisites missing.
- Success State: User enters appropriate next stage screen.

## Image Capture
- Screen Name: Image Capture
- Purpose: Capture required operational evidence.
- User Goal: Complete required image categories with minimal friction.
- Main Information Visible: Job Number, Lot Number, Material Name, Current Stage, required image cards first.
- Information Hidden by Default: optional cards and historical uploads.
- Required Fields: Required categories flagged as mandatory.
- Image Capture Actions:
  - `Capture Photo` (primary, direct camera)
  - `Retake`
  - `Upload from device` (secondary)
- Seal Scan Actions: None directly.
- Primary CTA: `Complete Images`
- Secondary CTA: `Save and Continue Later`
- Mobile Layout: Card list, one highlighted `Next missing` card.
- Tablet Layout: Card grid or two-column card list with same order.
- Validation / Blocking Rules: Must complete required categories before stage completion.
- Success State: Required images complete; stage advances to `Final Pass`.

## Final Pass / Inspection
- Screen Name: Final Pass / Inspection
- Purpose: Validate completion checks and seal actions.
- User Goal: Complete inspection decision and seal requirements.
- Main Information Visible: Job Number, Lot Number, Material Name, Current Stage, actionable Status, seal section.
- Information Hidden by Default: non-actionable history and verbose metadata.
- Required Fields: Inspection decision fields; seal value required when seal assignment is mandatory.
- Image Capture Actions: `Capture Seal Photo` available in flow.
- Seal Scan Actions:
  - `Scan Seal` (primary)
  - `Retry Scan`
  - `Enter seal manually` (fallback)
- Primary CTA: `Complete Final Pass`
- Secondary CTA: `Save Progress`
- Mobile Layout: Decision controls then seal section; scan control above fold.
- Tablet Layout: Decision pane + seal pane side-by-side.
- Validation / Blocking Rules: Immediate validation of scanned/manual seal; block on invalid/duplicate/missing prerequisites.
- Success State: Final pass complete; stage advances to `Lab Testing`.

## Lab Testing / Sampling
- Screen Name: Lab Testing / Sampling
- Purpose: Complete sampling tasks and required evidence.
- User Goal: Mark sampling complete without missing mandatory inputs.
- Main Information Visible: Job Number, Lot Number, Material Name, Current Stage, required sampling controls.
- Information Hidden by Default: extra notes and non-required sections.
- Required Fields: Mandatory lab/sampling fields and evidence required by workflow.
- Image Capture Actions: Camera-first capture for sampling-related images.
- Seal Scan Actions: None.
- Primary CTA: `Complete Lab Testing`
- Secondary CTA: `Save Progress`
- Mobile Layout: Single flow with required-first grouping.
- Tablet Layout: Task pane + context pane.
- Validation / Blocking Rules: Block completion until required sampling fields/evidence pass.
- Success State: Stage advances to `Report`.

## Report View
- Screen Name: Report View
- Purpose: Show report readiness and key context.
- User Goal: Open report actions quickly.
- Main Information Visible: Job Number, Lot Number, Material Name, Current Stage, report readiness status.
- Information Hidden by Default: detailed diagnostics and non-actionable internals.
- Required Fields: None if report is ready; generation prerequisites if not ready.
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `View PDF`
- Secondary CTA: `Go to Report PDF Actions`
- Mobile Layout: Readiness card + primary action.
- Tablet Layout: Readiness + actions panel.
- Validation / Blocking Rules: Disable view/download if report not generated; show inline next step.
- Success State: User opens report PDF action flow.

## Report PDF Actions
- Screen Name: Report PDF Actions
- Purpose: Provide explicit report document actions.
- User Goal: View, print, share, or download report PDF.
- Main Information Visible: Job Number, Lot Number, Current Stage, report PDF state.
- Information Hidden by Default: unrelated export options.
- Required Fields: None.
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `Download Report PDF`
- Secondary CTA: `View PDF`, `Print PDF`, `Share PDF`
- Mobile Layout: Action stack with clear button labels.
- Tablet Layout: Primary action left, secondary actions grouped right.
- Validation / Blocking Rules: If PDF generation failed, show inline `Retry` and failure reason.
- Success State: Report PDF downloaded/viewed/printed/shared.

## Packing List View
- Screen Name: Packing List View
- Purpose: Show packing list readiness and context.
- User Goal: Reach packing list document actions quickly.
- Main Information Visible: Job Number, Lot Number, Material Name, Current Stage, packing list readiness.
- Information Hidden by Default: non-actionable packing analytics.
- Required Fields: Packing data completeness if generation required.
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `View PDF`
- Secondary CTA: `Go to Packing List PDF Actions`
- Mobile Layout: Readiness summary + primary action.
- Tablet Layout: Readiness pane + action pane.
- Validation / Blocking Rules: Block actions if prerequisites incomplete; show inline fix guidance.
- Success State: User opens packing list PDF action flow.

## Packing List PDF Actions
- Screen Name: Packing List PDF Actions
- Purpose: Provide explicit packing list document actions.
- User Goal: View, print, share, or download packing list PDF.
- Main Information Visible: Job Number, Lot Number, Current Stage, packing list PDF state.
- Information Hidden by Default: generic export menus.
- Required Fields: None.
- Image Capture Actions: None.
- Seal Scan Actions: None.
- Primary CTA: `Download Packing List PDF`
- Secondary CTA: `View PDF`, `Print PDF`, `Share PDF`
- Mobile Layout: Vertical action list with large tap targets.
- Tablet Layout: Split actions with same naming and order.
- Validation / Blocking Rules: Failed generation shows inline retry and reason.
- Success State: Packing list PDF downloaded/viewed/printed/shared.

## Image category labels used on capture cards
1. Bag photo with visible bag no
2. Material in bag
3. During Sampling Photo
4. Sample Completion
5. Seal on bag
6. Bag condition
7. Whole batch photo

Compatibility note:
- Legacy aliases remain accepted when loaded from older policy data.
