# UX_CLEANUP_RULES

## Governance Authority
- Canonical UI governance is defined in `docs/enterprise-ui-governance.md`.
- This file provides operational UX cleanup constraints and examples.
- If phrasing conflicts with architecture policy, precedence is:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. Module-specific docs

## 1. Objective
Define strict, non-optional UI rules for operational mobile and tablet screens in the industrial inspection ERP so daily users can complete work quickly with low confusion.

Stage order used across all screens and documents:
`Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

Execution shells may render Batch/Bag wording in the workflow chrome, but Job Number and Lot Number remain the canonical identifiers for traceability and reporting.

Device policy lock:
- Registry/oversight screens may use dense enterprise list layouts when actionable.
- Process-heavy execution stages MUST use mobile/tablet task-first behavior.
- Workflow orientation MUST be visible without relying on long page scrolling.

## 2. What should never be shown on operational mobile screens
- KPI cards, trend charts, dashboard widgets, scorecards, productivity graphs.
- Any value that does not change the user’s next action.
- Duplicate status displays for the same entity.
- Technical/internal labels and terms.
- Long metadata sections above the current task controls.
- Mixed-task screens that require users to decide where to start.

## 3. What must stay visible
- `Job Number`
- `Lot Number`
- `Material Name`
- `Current Stage`
- `Status` only when it affects current action.
- Current stage title in plain operational language.
- Single primary CTA for current task.
- Inline validation and retry actions for failed operations.

## 4. Rules for hiding low-value metadata
- Hide all non-actionable metadata behind `Show details`.
- Keep details collapsed by default on mobile and tablet.
- Never place low-value metadata above primary task controls.
- Auto-hide historical sections unless user explicitly opens them.
- Do not show empty optional values.

## 5. Rules for field simplification
- Use user-facing labels, not backend terms.
- Keep labels short and specific to the task.
- Avoid vague labels like `Value`, `Info`, `Data`.
- Group fields by task sequence, not by database model.
- Show required fields first.

## 6. Rules for progressive disclosure
- One screen = one clear task.
- One active section expanded at a time on mobile.
- Optional and advanced controls must be collapsed by default.
- Completed sections can collapse automatically after success.
- Users must still be able to reopen completed sections.

## 7. Rules for task-first screens
- Each screen must answer: `What do I do next?`
- Only one primary action can be visually dominant.
- Primary CTA must be verb-first and specific.
- Secondary actions must be visible but visually lighter.
- Avoid branching choices before required task completion.
- Process-heavy pages must show a clear stage header/tabs and one active stage panel.

## 8. Rules for image capture cards
Use these exact categories:
1. Bag photo with visible bag no
2. Material in bag
3. During Sampling Photo
4. Sample Completion
5. Seal on bag
6. Bag condition
7. Whole batch photo

Compatibility note:
- Legacy aliases remain supported in imported settings/backfill data.

Card behavior rules:
- Required cards first, optional cards later.
- Every card shows requirement, status, and latest preview.
- Mobile and tablet must support direct camera capture as primary action.
- File picker is secondary.
- Each card must support `Retake`.
- Inline error and `Retry` must exist per card.

## 9. Rules for seal scanning + fallback entry
- `Scan Seal` must be a first-class, clearly visible action.
- Seal scan is default method because seals are pre-printed.
- `Capture Seal Photo` must be available in the same flow.
- Manual seal entry is fallback only.
- Scanned seal value must be shown immediately and validated immediately.
- On scan failure, show inline reason and keep `Retry Scan` visible.

## 10. Rules for PDF / document labels
Allowed labels:
- `Download Report PDF`
- `Download Packing List PDF`
- `View PDF`
- `Print PDF`
- `Share PDF`

Rules:
- Do not use generic labels like `Download` or `Export`.
- Do not use confusing terms like `Export artifact`, `Build output`, `Generate object`, `File artifact`.
- Document actions must be in a dedicated section.
- PDF status must be explicit: `Generating`, `Ready`, `Failed`.

## 11. Rules for mobile vs tablet differences
Mobile:
- Single-column layout.
- Sticky bottom primary action.
- One expanded task section at a time.

Tablet:
- Two-pane allowed: action pane + context pane.
- Same workflow logic and labels as mobile.
- No KPI/dashboard content on operational screens.

Shared rule:
- Platform differences are layout-only, not logic differences.

## 14. Governance Prohibitions (UX Layer)
- No one-off workflow layout when approved template exists.
- No local status/badge mapping logic inside pages.
- No duplicate timeline/history families for same use case.
- No competing canonical routes for the same object experience.
- No process page without explicit stage ownership and next action visibility.

## 12. Examples of bad UI patterns
- KPI tiles on execution screens.
- Multiple competing primary buttons.
- Toast-only failures without inline guidance.
- Generic CTA labels (`Submit`, `Continue`, `Export`) without context.
- Hidden seal scan behind submenu.
- Camera capture not available directly from evidence card.

## 13. Examples of good UI patterns
- Clear stage header + next required task.
- Required evidence list with `Next missing` highlight.
- `Scan Seal` primary, manual fallback secondary.
- Per-control inline validation with immediate fix guidance.
- Explicit PDF action labels for report and packing list.
- Minimal context values only: Job Number, Lot Number, Material Name, Current Stage, actionable Status.
