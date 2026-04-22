# Recycos Workflow Bug Triage Sheet

Canonical checklist reference: `docs/qa/recycos-canonical-workflow-qa-checklist.md`

Canonical route: `/jobs/[jobId]/workflow`

Use this sheet to turn manual QA findings into a clean triage record in the same order the workflow QA runs:

1. Production happy path
2. Manager decision checks
3. R&D intake checks
4. Admin policy checks
5. Negative-case replay

## 1) Purpose

- Convert manual QA findings into consistent fix tickets.
- Keep triage aligned to the canonical workflow stage order and execution passes.
- Prevent free-form notes from obscuring the real blocker, owner, or release impact.

This sheet is a companion to the manual QA checklist. It does not replace the checklist; it standardizes the issue record after a tester finds something.

Execution surfaces may use Batch/Bag wording in workflow chrome. Triage should still key off the canonical stage order and Job Number/Lot Number identifiers.

## 2) Triage Fields

Use this compact field set for every issue:

| Field | Value |
|---|---|
| Round |  |
| Role |  |
| Stage |  |
| URL |  |
| Job / Lot / Sample / Packet / R&D Job IDs |  |
| Expected behavior |  |
| Actual behavior |  |
| Severity |  |
| Issue type |  |
| Reproducibility |  |
| Likely owner |  |
| Release impact |  |
| Screenshot / artifact reference |  |
| Notes |  |

## 3) Severity Policy

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
- **Medium**
  - Layout issues
  - Inconsistent labels
  - Visual noise
  - Minor mobile discomfort that does not stop task completion
- **Low**
  - Cosmetic or informational drift with no operational impact

## 4) Issue Type Classification

Use one primary type per issue:

- Workflow / stage progression bug
- Permission / role-gating bug
- Validation / blocker bug
- Traceability / document bug
- Policy / settings bug
- UX / clarity bug
- Regression / automation mismatch
- Data / migration / environment issue

## 5) Ownership Guidance

Assign the most likely owner first. Escalate only if the fix clearly spans multiple areas.

- **Frontend UX**: shell, spacing, labels, visibility, stage navigation, right rail, mobile/tablet presentation
- **Workflow/API**: stage transitions, blockers, submit-to-R&D behavior, queue routing, handoff logic
- **Settings/policy**: image policy, seal policy, note policy, packet constraints, module workflow toggles
- **R&D flow**: `/rnd` queue, R&D detail lineage, test setup/review behavior
- **Production workflow**: job basics, lots, images, seal, sampling, packets, handoff initiation
- **Admin/settings**: policy validation, override behavior, company-scoped settings
- **DB/data/migration**: bad seed data, missing fields, backfill/migration, environment repair

## 6) Release Impact Guidance

Use one of these outcomes:

- **Release blocker**: blocks the canonical workflow, breaks stage progression, or creates unsafe permission leakage
- **Must fix before operational use**: blocks real operators or creates misleading traceability/doc behavior
- **Can ship with workaround**: issue is real but the workflow still completes safely and consistently
- **Can defer**: low-risk cosmetic or non-blocking drift

## 7) Recommended Triage Flow

1. Validate repro on the same round and stage the tester used.
2. Classify the issue by stage and role.
3. Assign severity using the policy above.
4. Assign the most likely owner.
5. Decide release impact.
6. Link the issue to a fix ticket with the artifact reference.

## 8) Triage Table Template

Use this for batch triage or standup review:

| Round | Role | Stage | Severity | Issue type | Likely owner | Release impact | Short summary | Ticket / link |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |

## 9) Assumptions

- The canonical QA sequence is the source of truth for round ordering.
- Issues should be triaged by the first stage where the failure is visible, even if the root cause is later in the flow.
- If an issue spans multiple stages, use the earliest broken stage as the primary stage and mention the downstream blast radius in Notes.
