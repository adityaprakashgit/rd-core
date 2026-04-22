# Recycos Canonical Workflow QA Checklist

Canonical route: `/jobs/[jobId]/workflow`

Stage order locked for this QA run:

`Job Basics -> Lots -> Images -> Seal -> Final Decision -> Sampling -> Packets -> Submit to R&D`

This checklist is for human, role-based manual QA of the canonical workflow path only. It is aligned to the current enterprise governance, workflow policy, traceability, and document behavior in the codebase.

Execution surfaces may use Batch/Bag wording in workflow chrome. QA should anchor on the locked stage order plus Job Number/Lot Number and treat the wording as a terminology layer, not a different route.

## 1) Purpose

- Validate the canonical workflow path end to end on the production-like execution route.
- Verify role-based action gating, blocker behavior, stage progression, and traceability/document access.
- Confirm the workflow shell stays canonical: identity, actions, stage navigation, right rail, and mobile action behavior.
- Confirm the current stage order and policy behavior remain intact after UI/workflow hardening.

Exclusions:

- Playground and non-canonical routes.
- Broad redesign checks.
- Backend/API implementation verification beyond what is visible through the workflow UI.
- Generic UI polish that is not tied to the workflow path.

## 2) Preconditions

### Test users / roles

- Production user with operational permissions for job, lot, image, seal, sampling, packet, and handoff actions.
- Manager user with final decision authority and oversight access.
- R&D user with queue and job-detail access for submitted work.
- Admin user with `MANAGE_MODULE_SETTINGS` and any required override permissions for settings/policy validation.

### Data setup required

- At least one active company-scoped job available at `/jobs/[jobId]/workflow`.
- At least one job with:
  - no lots yet, for `Job Basics` and empty-state checks
  - one or more lots with inspection data, for progression checks
  - one approved lot ready for sampling, for sampling/seal validation
  - one packet-ready path, for packet generation and handoff validation
  - one submitted R&D job, for downstream verification
- At least one negative-test job or lot with incomplete prerequisites:
  - missing required images
  - missing seal evidence
  - decision still pending
  - insufficient sample readiness
  - insufficient packet quantity or weight

### Settings / policies to verify before running

- Decision is required before sampling.
- Submit to R&D is enabled for the environment being tested.
- Seal policy is known and stable for the environment:
  - seal scan required or not
  - manual entry fallback allowed or not
  - admin-only seal edit behavior if enabled
- Image policy buckets are valid and not all empty:
  - required
  - optional
  - hidden
- Hold/reject notes policy is known and enforced.
- Packet weight requirement is enabled and visible in packet checks.
- Company-scoped document/report retrieval is working.

### Required state to verify in setup

- The test job must be in the expected state for the stage being tested.
- The tester must know whether the role has permission to complete the action or only observe/block it.
- The tester must confirm the canonical route opens without fallback to legacy routes.

## 3) Execution Order

1. Production happy path
2. Manager decision checks
3. R&D intake checks
4. Admin policy checks
5. Negative-case replay

### Blocker severity policy

- **Critical**
  - Canonical route fails
  - Stage progression breaks
  - Submit to R&D duplicates child jobs
  - Forbidden action is allowed
  - Required blocker does not stop progression
- **High**
  - Traceability is missing
  - Document action is wrong or unavailable when expected
  - Stage navigation routes incorrectly
  - Right rail or blocker copy is misleading enough to block operations
- **Medium / Low**
  - Layout issues
  - Inconsistent labels
  - Visual noise
  - Minor mobile discomfort that does not stop task completion

### Ownership order

- Production tester owns stages 1 to 8 first.
- Manager tester joins at Final Decision and oversight checks.
- R&D tester starts only after Submit to R&D.
- Admin tester prepares policy state first, then validates policy-sensitive stages last.

## 4) Workflow Stage Coverage

| Stage | Pass(es) | Responsible role(s) | What to validate | Happy path checks | Document / traceability checks | Expected next action |
|---|---|---|---|---|---|---|
| Job Basics | Pass 1 | Production, Manager, Admin | Job identity, stage clarity, current step, owner/assignee, canonical header/actions | Open job workflow, confirm Job Number, stage label, next action, and canonical stage order | Job lineage should be visible from the header/right rail; job history should remain accessible | Move to Lots when lot creation is allowed |
| Lots | Pass 1 | Production, Manager, Admin | Lot creation/editing, lot identity, quantity mode, and lot readiness | Create or open lots, confirm lot number, material name, quantity mode, and linked job | Lot should show linked job and any available evidence/history context | Move to Images after a valid lot is ready |
| Images | Pass 1, Pass 4 | Production, Manager, Admin | Required images, capture/upload/retake, proof status, and timestamp behavior if enabled | Capture required images and confirm each card changes from missing/pending to captured | Image evidence should remain linked to the lot/job context and be visible in traceable history where applicable | Move to Seal when image requirements are satisfied |
| Seal | Pass 1, Pass 4 | Production, Admin | Seal scan, manual fallback if allowed, seal assignment, edit restrictions | Scan or enter seal number, confirm seal evidence and seal number persistence | Seal provenance should be visible in the sample/lot context and in any linked records | Move to Final Decision when seal evidence is complete |
| Final Decision | Pass 1, Pass 2 | Production, Manager, Admin | Pass / Hold / Reject behavior, notes requirement, and state transitions | Pass should advance when prerequisites are satisfied; Hold/Reject should persist notes when required | Decision rationale should be visible in history/traceability context | Move to Sampling only after pass approval |
| Sampling | Pass 1 | Production, Admin | Sample start, sample details, homogeneous proof, and sample evidence | Start sample, save details, capture sampling photos, confirm homogeneous state, and verify readiness to packeting | Sample should remain linked to the lot and show sample history/events | Move to Packets when ready-for-packeting is reached |
| Packets | Pass 1, Pass 4 | Production, R&D, Admin | Packet creation, packet weight, packet readiness, packet list/detail, and linked documents | Create packet rows, confirm packet IDs, weight, readiness, and linked output | Packet detail should show linked lot/sample/job, prior reports, and dispatch-related document links | Move to Submit to R&D when packet generation and readiness are complete |
| Submit to R&D | Pass 1, Pass 3, Pass 4 | Production, R&D, Manager, Admin | Handoff completeness and downstream visibility | Submit packet/job to R&D and confirm downstream queue visibility | Submitted work should appear in R&D queue/detail with lineage intact | End the operational workflow and verify R&D intake |

### Round 2 / replay negative cases

Run these only after the happy path has been proven once:

- Missing images
- Invalid seal
- Missing hold/reject note
- Blocked sampling
- Blocked packet readiness
- Duplicate R&D handoff prevention

Use these to replay the blocker behavior and confirm the correct message appears at the correct stage.

## 5) Cross-Cutting Checks

- [ ] Stage navigation matches the locked order and does not skip or reorder steps.
- [ ] Next action text is clear and routes to the correct stage or page.
- [ ] Blocker messages are specific, readable, and tied to the failing prerequisite.
- [ ] Status and stage are distinct and not visually conflated.
- [ ] The right rail shows linked records, blockers, history, or documents where relevant.
- [ ] Traceability links preserve the lineage chain and open the expected context.
- [ ] Document access uses the canonical labels and output names.
- [ ] Mobile action rail does not duplicate the primary CTA or hide the active stage action.
- [ ] Tablet layout remains usable without long mixed-scroll workflow sections becoming unreadable.
- [ ] Roles only see the actions they are allowed to perform.
- [ ] Admin-only overrides or settings are visible only where policy requires them.
- [ ] Shared enterprise surfaces are used for errors, empty states, modals, drawers, and summary blocks.

## 6) Role-Based Execution Views

### Production tester

Must test:

- Job Basics
- Lots
- Images
- Seal
- Final Decision
- Sampling
- Packets
- Submit to R&D

Must be able to:

- Create and progress workflow data where permissions allow.
- Capture required evidence and move the job through the canonical flow.
- Verify blockers and then clear them through the proper action.

Must not be able to:

- Bypass missing evidence or blocked prerequisites.
- Submit invalid seal, sample, or packet data.
- Reorder the canonical stage flow.

Must verify:

- Blocker copy is clear.
- Traceability is visible at each step.
- Document/report actions are only available when the workflow state supports them.

### Manager tester

Must test:

- Final Decision
- Blocker visibility
- Traceability access
- Document visibility

Must be able to:

- Approve, hold, or reject when policy allows.
- Review blockers, lineage, and document state.

Must not be able to:

- Complete production-only actions that are outside approval scope.
- Override required notes or blockers when policy requires them.

Must verify:

- Decision notes are enforced where required.
- Hold/Reject changes downstream state correctly.
- Audit/traceability context is readable and complete.

### R&D tester

Must test:

- Submit to R&D handoff result
- `/rnd` queue visibility
- R&D detail lineage
- Duplicate handoff prevention on repeat submit

Must be able to:

- Receive submitted work in the R&D queue.
- Open the R&D job detail and confirm parent job, sample, packet, and report lineage.
- Continue setup/testing/review actions in the R&D flow where applicable.

Must not be able to:

- Create duplicate child jobs from the same handoff.
- Modify upstream production state outside R&D permissions.

Must verify:

- Handed-off work retains the source lineage.
- Queue rows and job detail show the right identifiers.
- The submitted work is understandable without consulting raw IDs.

### Admin tester

Must test:

- Image policy
- Seal policy
- Submit-to-R&D toggle
- Note policy / packet constraints
- Company branding/settings only where needed to support workflow QA

Must be able to:

- Confirm or adjust policy settings for the test environment.
- Validate admin-only overrides or seal-edit permissions when enabled.
- Restore recommended settings if a test intentionally changes policy state.

Must not be able to:

- Change workflow behavior in ways that bypass governance or canonical stage order.
- Reintroduce invalid image-policy bucket states.

Must verify:

- Settings changes are reflected in the workflow UI and API behavior.
- Policy toggles produce the expected blocker or allowance behavior.

## 7) Bug Logging Format

Use this exact record format for each issue:

| Field | Value |
|---|---|
| Role |  |
| Stage |  |
| URL |  |
| Expected behavior |  |
| Actual behavior |  |
| Blocker severity | Critical / High / Medium / Low |
| Screenshot / artifact reference |  |

Suggested notes:

- Include the job ID, lot ID, packet ID, or sample ID if relevant.
- Capture the exact blocker text if the UI shows one.
- Note whether the issue is role-specific or reproducible across roles.

## 8) Signoff Section

### Pass / fail by role

| Role | Pass | Fail | Blocked | Notes |
|---|---|---|---|---|
| Production |  |  |  |  |
| Manager |  |  |  |  |
| R&D |  |  |  |  |
| Admin |  |  |  |  |

### Pass / fail by stage

| Stage | Pass | Fail | Blocked | Notes |
|---|---|---|---|---|
| Job Basics |  |  |  |  |
| Lots |  |  |  |  |
| Images |  |  |  |  |
| Seal |  |  |  |  |
| Final Decision |  |  |  |  |
| Sampling |  |  |  |  |
| Packets |  |  |  |  |
| Submit to R&D |  |  |  |  |

### Release readiness notes

- Overall readiness:
- Open blockers:
- Known accepted exceptions:
- Approval owner:
- Approval date:

## 9) Assumptions and Areas That Need Real-World Verification

- Exact role labels in the environment may vary; map them to the closest permission set if needed.
- Some actions depend on company policy toggles, so the Admin tester must confirm the environment settings before production/manager/R&D runs.
- Some negative checks require pre-seeded blocked data or a dedicated test job/lot/packet state.
- The QA sheet assumes the canonical workflow route is `/jobs/[jobId]/workflow` and that this remains the primary operational path.
- If a route alias or compatibility path is still present in the environment, it should only be used to confirm redirect behavior, not as the main QA path.

## 10) Closure Guidance

This execution sheet is meant for active manual QA only. Broad workflow/UI cleanup is considered closed; after this point, only targeted fixes or regression-specific checks should be added.
