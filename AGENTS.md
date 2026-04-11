<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# rd-core Codex Instructions (Source of Truth)

Use this file as the canonical repository guidance for Codex behavior.

## Mission
This repository powers live industrial inspection workflows. Prioritize operational correctness, user clarity, traceability, and auditability.

## Canonical UI Governance (Mandatory)
- For any UI/page/layout/refactor task, you MUST read and follow:
  - `docs/enterprise-ui-governance.md`
- This governance file is the canonical architecture source for enterprise UI behavior.
- If UI docs conflict, precedence is:
  1. `docs/enterprise-ui-governance.md`
  2. `AGENTS.md`
  3. module-specific docs

## Current Product Priorities
- Mobile-first, then tablet-first UX simplification.
- Task-first operational execution screens.
- Reduced daily-user confusion and faster field usability.
- Remove KPI/dashboard clutter from operational screens.
- Preserve validations, traceability, permissions, and audit logging.
- Do not consider Playground unless explicitly requested.

## Workflow and Gating
Preserve this workflow order:
1. Job Creation
2. Lot
3. Images
4. Final Pass
5. Lab Testing
6. Report
7. Packing List

Final Pass rules:
- Decisions: Pass, Hold, Reject.
- Hold and Reject must block forward movement until reviewed/resolved.

## UX Rules (Operational Screens)
- Design around current user task, not backend modules.
- Mobile screens should focus on: compact header, current task, essential context, required fields, capture actions, and a clear primary CTA.
- Tablet may include limited extra context or list-detail split only when it improves execution speed.
- Hide by default: KPI cards, analytics widgets, charts, deep metadata, internal IDs, backend timestamps, non-actionable status chips.
- Use progressive disclosure for secondary info (View details, expandable section, drawer, secondary review).
- One screen should represent one clear task.

## Evidence and Seal Rules
- Image workflows must be camera-first on mobile and tablet.
- Do not assume file browsing as primary capture flow.
- Seal flow must support:
  - Scan Seal
  - Capture Seal Photo
  - Manual seal entry (fallback only)

Required image categories (use exact wording when relevant):
1. Bag photo with visible LOT no
2. Material in bag
3. During Sampling Photo
4. Sample Completion
5. Seal on bag
6. Bag condition
7. Whole Job bag palletized and packed

## Terminology and PDF Labels
Prefer user-facing terms:
- Job Number, Lot Number, Material Name, Current Step, Missing Photos
- Scan Seal
- Download Report PDF, Download Packing List PDF, View PDF, Share PDF, Print PDF

Avoid exposing:
- Raw DB IDs, enum names, workflow internals
- Technical labels like Export artifact, Build output, Generate file object

## Engineering Guardrails
Before meaningful changes, inspect:
- `package.json`
- relevant app routes/components
- relevant API routes
- types, workflow/state utilities
- validation helpers
- audit helpers
- report and packing flows

Do not weaken:
- company scoping
- permission checks
- locked/terminal protections
- validations
- audit logging

No shallow fixes:
- do not silence with `any`
- do not disable validations to pass builds
- do not hide broken workflow logic behind UI-only changes

UI-specific mandatory guardrails:
- Prefer enterprise primitives/templates over custom layout creation.
- Prefer template reuse over per-page invention.
- Do not introduce local status chips or custom badge mappings inside pages.
- Do not create long mixed-scroll workflow pages for process-heavy views.
- Use stage-oriented pages with one active panel for process flows where applicable.
- Preserve canonical route ownership for core object experiences.
- Surface lineage and linked records consistently on relevant detail/process pages.
- When editing a page, check if the change should be abstracted into a shared component.
- When touching legacy pages, move them toward approved templates; do not add drift.

## Done Means
A task is complete only when:
- workflow remains correct
- UI is simpler for operators
- terminology is understandable
- mobile/tablet usability is improved
- validations still work
- traceability is preserved
- auditability is preserved
- relevant checks/build/tests pass where applicable

For UI/workflow tasks, include:
1. Current problem summary
2. Proposed solution
3. Files changed
4. Risks or follow-up notes
