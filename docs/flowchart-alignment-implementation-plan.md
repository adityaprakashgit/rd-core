# Flowchart Alignment Implementation Plan

Objective: close all `Missing` and `Partial` gaps from [flowchart-app-mapping.md](/Users/aditya/rd-core/docs/flowchart-app-mapping.md) with minimal regression risk.

## Priority Model

- `P0`: data integrity / workflow correctness / compliance-critical.
- `P1`: operational control and observability.
- `P2`: experience and automation polish.

## P0 (Implement First)

### 1) Optimistic Concurrency for Lot Edits

Gap addressed:
- `Concurrent Lot Edit Conflict` (Partial)

Change:
- Require `expectedUpdatedAt` in lot `PATCH` requests.
- Update only when DB `updatedAt` matches expected value, else return `409`.

Files:
- `src/app/api/inspection/lots/route.ts`
- `src/components/inspection/LotIntakeWizard.tsx`
- `src/components/inspection/JobIntakeWorkspace.tsx`

Acceptance:
- Two simultaneous edits on same lot: second save returns `409` with actionable message.

---

### 2) Explicit Report Approval Gate Before Packing List

Gap addressed:
- `Packing List Attempted Before Report Approval` (Partial)

Change:
- Enforce strict stage gate in packing list API:
  - allow only `LOCKED` (or configurable: `LOCKED|REPORT_READY|COMPLETED|DISPATCHED`).
- Reuse/extend existing policy utility.

Files:
- `src/app/api/report/packing-list/route.ts`
- `src/lib/report-export-policy.ts`
- `src/app/settings/page.tsx` (optional policy toggle if needed)

Acceptance:
- Packing list call before approved stage returns clear `422`/`403` precondition error.

---

### 3) Duplicate/Suspicious Job Detection + Override

Gaps addressed:
- `Duplicate or Suspicious Job` (Missing)
- `Duplicate Warning` (Partial)
- `Override by Privileged User` (Missing)

Change:
- Add duplicate heuristic at job create:
  - same `companyId + clientName + commodity + plantLocation` in configurable recent window.
- API response modes:
  - `warning` with candidate duplicates,
  - `blocked` if strict mode,
  - `override` path for privileged role (`ADMIN`) with reason.

Files:
- `src/app/api/jobs/route.ts`
- `src/lib/rbac.ts` (new permission, e.g. `OVERRIDE_DUPLICATE_JOB`)
- `src/app/rd/page.tsx` (warning/override UI)

Acceptance:
- Duplicate attempt gives deterministic warning/block and audit trail when overridden.

## P1 (Operational Workflow Closure)

### 4) Admin Review Queue for Suspicious or Failed Actions

Gaps addressed:
- `Route to Admin Review` (Missing)
- parts of `Security/Technical/Operational Escalation` (Partial)

Change:
- Introduce escalation queue table (example `WorkflowEscalation`):
  - `id, companyId, jobId, lotId, type, severity, status, payload, createdById, resolvedById, createdAt, resolvedAt`.
- Create entries from key failure points (duplicate block, repeated validation failures, audit-write failure fallback).

Files:
- `prisma/schema.prisma`
- new migration in `prisma/migrations/*`
- `src/lib/audit.ts` (fallback route)
- `src/app/api/jobs/route.ts`
- `src/app/api/inspection/lots/route.ts`
- `src/app/api/inspection/execution/route.ts`
- new endpoint: `src/app/api/escalations/route.ts`
- admin UI: `src/app/admin/page.tsx` (queue panel)

Acceptance:
- Escalatable failures create queue items visible to admins and resolvable with notes.

---

### 5) Alert Operations/Supervisor Notifications

Gap addressed:
- `Alert Operations or Supervisor` (Missing)

Change:
- Add notification events on escalation creation:
  - in-app feed first (email/webhook optional later).

Files:
- `prisma/schema.prisma` (optional `Notification` table)
- `src/app/api/escalations/route.ts`
- `src/app/operations/page.tsx`
- `src/app/admin/page.tsx`

Acceptance:
- New escalation appears in operations/admin alert surface with severity and link-to-context.

---

### 6) Explicit “Reason Code Required” Enforcement

Gap addressed:
- `Reason Code Required` (Partial)

Change:
- For blocked/hold/reject transitions require normalized reason code enum plus free-text notes.

Files:
- `src/app/api/inspection/execution/route.ts`
- `src/lib/inspection-checklist.ts`
- related inspection UI components under `src/components/inspection/*`

Acceptance:
- Hold/reject/save without reason code is rejected with clear validation message.

## P2 (Quality and UX Completeness)

### 7) Media Mismatch/Wrong Image Detection

Gaps addressed:
- `Wrong Image Linked` (Partial)
- `Media Link Mismatch` (Partial)

Change:
- Add lightweight metadata checks:
  - expected category vs uploaded category consistency,
  - optional capture-time and lot-context fingerprint checks.
- Flag suspicious media to escalation queue instead of hard-fail initially.

Files:
- `src/app/api/media/upload/route.ts`
- `src/lib/evidence-definition.ts`
- `src/app/api/report/packing-list/route.ts`

Acceptance:
- Mismatch scenarios are detected and flagged; critical mismatch can block dispatch generation.

---

### 8) End-State API for Explicit Closure

Gap addressed:
- `End` (Partial)

Change:
- Add explicit job closure transition endpoint with allowed state machine:
  - `LOCKED -> REPORT_READY -> DISPATCHED/COMPLETED`.
- Record actor, timestamp, and closure notes.

Files:
- new endpoint: `src/app/api/jobs/[id]/status/route.ts`
- `src/lib/workflow-stage.ts`
- `src/app/operations/page.tsx`, `src/app/userrd/page.tsx` (action buttons)

Acceptance:
- Workflow ends through explicit, auditable status transition API.

## Cross-Cutting Requirements

### Auditing
- Every new override/escalation/closure action must write audit logs.
- If audit table unavailable, write fallback diagnostic and create technical escalation item.

### RBAC
- Add fine-grained permissions:
  - `OVERRIDE_DUPLICATE_JOB`
  - `VIEW_ESCALATIONS`
  - `RESOLVE_ESCALATIONS`
  - `TRANSITION_JOB_STATUS`

### Testing

Add tests for each P0/P1 control:
- duplicate job warning/override
- packing-list gate by job status
- optimistic concurrency on lot PATCH
- escalation creation and resolution
- reason-code enforcement

Suggested file targets:
- `src/lib/process-critical.e2e.test.ts`
- `src/lib/seal-policy.test.ts`
- `src/lib/sampling-gate.test.ts`
- new: `src/lib/escalation-policy.test.ts`

## Delivery Sequence (Recommended)

1. `P0-1` lot optimistic concurrency
2. `P0-2` strict packing-list gate
3. `P0-3` duplicate detection + override
4. `P1-4` escalation queue schema + APIs
5. `P1-5` operations/admin alerts
6. `P1-6` reason-code strictness
7. `P2-7` media mismatch detection
8. `P2-8` explicit end-state transition API

## Done Criteria

- All nodes currently marked `Missing` become `Exact` or intentionally `Partial` with documented rationale.
- All `Partial` items in P0/P1 become `Exact`.
- Regression tests pass for job->lot->inspection->sample->packet->qa->report->dispatch chain.
