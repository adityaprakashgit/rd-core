# IMPLEMENTATION_PLAN_UI_REVAMP

## 1. Current UI problems
- Operational screens contain dashboard/KPI clutter that does not help immediate execution.
- Task flow is fragmented across screens with mixed priorities.
- Labels are inconsistent and sometimes technical.
- Image capture is not consistently camera-first.
- Seal scan visibility and fallback handling are inconsistent.
- PDF actions are ambiguous in naming and placement.

## 2. UX simplification goals
- Make operational workflow understandable in under 10 minutes for new users.
- Enforce one-screen-one-task behavior.
- Keep only action-driving values visible.
- Standardize labels and CTA names.
- Remove KPI and dashboard content from operational mobile/tablet routes.

## 3. Shared layout strategy
- Shared stage header with only:
  - Job Number
  - Lot Number
  - Material Name
  - Current Stage
  - actionable Status
- Shared task container with one dominant primary CTA.
- Shared inline validation block near failing control.
- Shared collapsible details panel for non-actionable metadata.

## 4. Mobile component strategy
- Single-column page templates for all operational stages.
- Sticky bottom primary CTA rail.
- One expanded task section at a time.
- Card-based required-first evidence layout.
- Larger tap targets for camera, scan, and PDF actions.

## 5. Tablet component strategy
- Reuse mobile interaction model with responsive two-pane layout.
- Left pane: task controls.
- Right pane: compact context and secondary actions.
- Preserve same CTA order and naming as mobile.
- Keep operational screens free of KPI widgets.

## 6. Form simplification strategy
- Required fields first, optional fields collapsed.
- Plain operational labels only.
- Remove technical/internal terms from form labels.
- Keep validation inline and immediate.
- Keep previously entered values on error.

## 7. Image capture implementation plan
Use exact categories:
1. Bag photo with visible LOT no
2. Material in bag
3. During Sampling Photo
4. Sample Completion
5. Seal on bag
6. Bag condition
7. Whole Job bag palletized and packed

Implementation steps:
- Build/extend shared evidence card component.
- Set `Capture Photo` as primary action on mobile and tablet.
- Keep `Upload from device` as secondary.
- Add per-card status model: `Missing`, `Uploaded`, `Retake`.
- Add per-card inline error and retry behavior.

## 8. Seal scanning implementation plan
- Make `Scan Seal` the default primary action in Final Pass.
- Keep `Capture Seal Photo` available in same flow.
- Implement immediate validation for scanned value.
- Implement manual entry behind explicit fallback control only.
- Show inline validation reasons and `Retry Scan` on failure.

## 9. PDF/download action cleanup
Standardize actions to:
- `Download Report PDF`
- `Download Packing List PDF`
- `View PDF`
- `Print PDF`
- `Share PDF`

Implementation rules:
- Remove ambiguous action labels.
- Place actions in dedicated document action sections.
- Show PDF states: `Generating`, `Ready`, `Failed`.

## 10. Responsive behavior plan
- Define breakpoints for desktop-first enterprise shell pages and mobile/tablet task-execution pages.
- Keep behavior logic identical across devices.
- Only layout changes by breakpoint, not workflow rules.
- Keep stage context visible without introducing clutter.

## 11. State management notes
- Use stage-centric UI state: current stage, required task, blocker state.
- Keep per-card upload states local and resilient.
- Maintain deterministic mapping from backend error codes to inline messages.
- Preserve unsaved user input between validation attempts.

## 12. API/UI integration notes
- Keep existing operational APIs; focus on UI contract alignment.
- Require stable error payloads for inline messaging.
- Ensure upload endpoints support direct camera capture payloads.
- Ensure seal endpoints support scan-first + manual fallback handling.
- Ensure report/packing PDF endpoints map to explicit action labels.

## 13. Rollout/migration sequence
1. Shared layout and label foundation.
2. Job/Lot task-first screens.
3. Image capture card migration.
4. Final Pass seal scan-first migration.
5. Lab Testing task cleanup.
6. Report and Packing List PDF action cleanup.
7. Remove remaining KPI/dashboard clutter from operational routes.

## 14. Testing plan
- Content and label tests for exact CTA names.
- Mobile/tablet responsive UI tests for layout parity.
- Image flow tests for camera-first behavior and retake.
- Seal flow tests for scan success/failure and fallback manual entry.
- Validation tests for inline error display and retry.
- PDF action tests for Report and Packing List labels and behavior.
- End-to-end tests across full stage sequence:
  `Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`

## 15. Risks and fallback plan
Risks:
- Legacy routes still showing KPI/dashboard elements.
- Label drift across modules after incremental rollout.
- Device-specific camera/scan behavior inconsistencies.

Fallbacks:
- Feature flag by stage for incremental release.
- Keep legacy screen path temporarily for rollback.
- Add telemetry on blocked actions and scan/upload failures to detect regressions quickly.
