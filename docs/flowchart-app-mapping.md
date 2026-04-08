# Flowchart vs App Mapping (Expanded)

Legend:
- `Exact`: Implemented directly with matching behavior.
- `Partial`: Implemented, but not as an explicit standalone workflow node exactly as charted.
- `Missing`: Not found as a distinct implemented node/automation.

## 1) Job Creation Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Job Creation (start) | Job creation module and API exist | Exact | `src/app/api/jobs/route.ts` |
| Open Job Creation Form | Job creation UI route exists | Exact | `src/app/rd/page.tsx` |
| Enter Source and Client Name | `sourceName/clientName` required | Exact | `src/app/api/jobs/route.ts` |
| Enter Material Category or Commodity | `materialCategory/commodity` required | Exact | `src/app/api/jobs/route.ts` |
| Optional Source Location and Material Type | Optional mapping + normalization | Exact | `src/app/api/jobs/route.ts` |
| Validate User, Permissions, Company Scope | Session + RBAC + payload scope guards | Exact | `src/app/api/jobs/route.ts`, `src/lib/rbac.ts` |
| Cross Company Data Access | Forbidden on company mismatch | Exact | `src/app/api/jobs/route.ts` |
| Reference Master Missing | No strict master-existence check in create-job API | Partial | `src/app/api/jobs/route.ts` |
| Unauthorized | Explicit `401` | Exact | `src/app/api/jobs/route.ts` |
| Forbidden | Explicit `403` | Exact | `src/app/api/jobs/route.ts` |
| Duplicate or Suspicious Job | No explicit duplicate/suspicious-job detector | Missing | `src/app/api/jobs/route.ts` |
| Duplicate Warning | No dedicated warning node; generic conflict paths elsewhere | Partial | `src/app/api/jobs/route.ts` |
| Override by Privileged User | Not implemented as a distinct override path in job-create | Missing | `src/app/api/jobs/route.ts` |
| Route to Admin Review | No explicit admin-review queue state for job-create conflicts | Missing | `src/app/api/jobs/route.ts` |
| Security Escalation | Errors and RBAC responses exist, no dedicated escalation engine | Partial | `src/lib/rbac.ts`, `src/app/api/*` |
| Generate Inspection Serial Number | Serial generation before create | Exact | `src/app/api/jobs/route.ts`, `src/lib/serial.ts` |
| Create Inspection Job (Company Scoped) | Transactional create with company scope | Exact | `src/app/api/jobs/route.ts` |
| Assign Job to Creator | `assignedToId/assignedById/assignedAt` set | Exact | `src/app/api/jobs/route.ts` |
| Write Audit Log | `JOB_CREATED` event logged | Exact | `src/app/api/jobs/route.ts`, `src/lib/audit.ts` |
| Audit Log Write Failure | Fails as server error; no dedicated workflow escalation node | Partial | `src/app/api/jobs/route.ts` |
| Technical Escalation | Represented via API errors | Partial | `src/app/api/*` |

## 2) Lot Intake Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Lot Intake | Lot wizard and intake API available | Exact | `src/components/inspection/LotIntakeWizard.tsx`, `src/app/api/inspection/lots/route.ts` |
| Open Lot Intake for Job | Route/workspace exists | Exact | `src/components/inspection/JobIntakeWorkspace.tsx` |
| Create Lot | `POST /api/inspection/lots` | Exact | `src/app/api/inspection/lots/route.ts` |
| Enter Lot Number and Material Name | Required and validated | Exact | `src/app/api/inspection/lots/route.ts` |
| Choose Quantity Mode | `SINGLE_PIECE` / `MULTI_WEIGHT` supported | Exact | `src/app/api/inspection/lots/route.ts`, `src/lib/intake-workflow.ts` |
| Validate Lot Data | Required fields and mode constraints | Exact | `src/app/api/inspection/lots/route.ts` |
| Validation Error | Structured validation responses | Exact | `src/app/api/inspection/lots/route.ts` |
| Duplicate Lot Number | Conflict (`409`) handling | Exact | `src/app/api/inspection/lots/route.ts` |
| Multi-user Conflict on Lot Editing | No optimistic locking/version check | Partial | `src/app/api/inspection/lots/route.ts` |
| Concurrent Lot Edit Conflict | Not explicit as a dedicated conflict detector | Partial | `src/app/api/inspection/lots/route.ts` |
| Create Lot Audit Log | `LOT_CREATED`, `QUANTITY_MODE_SELECTED`, `LOT_EDITED` | Exact | `src/app/api/inspection/lots/route.ts` |
| Lot State Changed During Action | Terminal state guard blocks modifications | Exact | `src/app/api/inspection/lots/route.ts` |
| Final State Modification Attempt | Locked/terminal job states blocked | Exact | `src/app/api/inspection/lots/route.ts` |

## 3) Image Evidence Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Bag Lot Belongs to Job Company Scope | Company-scope enforcement on lot/media operations | Exact | `src/app/api/media/upload/route.ts`, `src/app/api/inspection/lots/route.ts` |
| Image Capture | Upload APIs and UI capture hooks exist | Exact | `src/components/inspection/LotIntakeWizard.tsx`, `src/app/api/media/upload/route.ts` |
| Upload or Capture Required Image | Category-based upload pipeline | Exact | `src/app/api/media/upload/route.ts` |
| Required Image Categories | Required category definitions and checks | Exact | `src/lib/evidence-definition.ts`, `src/lib/intake-workflow.ts` |
| Validate Required Image Completion | Wizard gating + report/dispatch validations | Exact | `src/components/inspection/LotIntakeWizard.tsx`, `src/app/api/report/packing-list/route.ts` |
| Required Image Missing | Wizard blocks progression and report checks fail | Exact | `src/components/inspection/LotIntakeWizard.tsx`, `src/app/api/report/packing-list/route.ts` |
| Wrong Image Linked | No standalone classifier; category-based validation only | Partial | `src/app/api/media/upload/route.ts` |
| Media Link Mismatch | Partial validation via category/lot scope checks | Partial | `src/app/api/media/upload/route.ts`, `src/app/api/report/packing-list/route.ts` |
| Link Images to Lot | Upload persists media linked to lot/job | Exact | `src/app/api/media/upload/route.ts` |
| Final Pass Check (Evidence complete?) | Inspection/report gates require required evidence | Exact | `src/app/api/inspection/execution/route.ts`, `src/app/api/report/packing-list/route.ts` |
| Evidence Incomplete | Validation failures block progression | Exact | `src/app/api/report/packing-list/route.ts`, `src/app/api/inspection/execution/route.ts` |

## 4) Final Inspection Decision Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Perform Final Inspection | Inspection execution module exists | Exact | `src/app/api/inspection/execution/route.ts` |
| Verify Lot Identity / Bag / Material / Images | Checklist + issue validations | Exact | `src/app/api/inspection/execution/route.ts`, `src/lib/inspection-checklist.ts` |
| Final Pass Decide | Decision status updates supported | Exact | `src/app/api/inspection/execution/route.ts` |
| Pass | Decision can become `READY_FOR_SAMPLING` | Exact | `src/app/api/inspection/execution/route.ts`, `src/types/inspection.ts` |
| Hold | Decision `ON_HOLD` supported | Exact | `src/app/api/inspection/execution/route.ts`, `src/types/inspection.ts` |
| Reject | Decision `REJECTED` supported | Exact | `src/app/api/inspection/execution/route.ts`, `src/types/inspection.ts` |
| Inspection Fail or Hold After Progress | Issues/checklist and decision transitions supported | Exact | `src/app/api/inspection/execution/route.ts` |
| Document Block After Inspection Failure | Validation errors and blocking behavior present | Exact | `src/app/api/inspection/execution/route.ts` |
| Supervisor Review | No separate supervisor workflow engine/state | Partial | `src/lib/workflow-stage.ts`, `src/app/operations/page.tsx` |

## 5) Sampling / Testing / Reporting Readiness Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Prepare Sample | Sample start and bootstrap path exists | Exact | `src/app/api/inspection/sample-management/route.ts` |
| Sampling Blocked | Sampling gate blocks invalid state transitions | Exact | `src/app/api/inspection/sampling/route.ts`, `src/lib/sampling-gate.ts` |
| Sampling Blocked State | Explicit response codes/details for blocked writes | Exact | `src/app/api/inspection/sampling/route.ts` |
| Reason Code Required | Validation-driven details required in several transitions | Partial | `src/app/api/inspection/execution/route.ts`, `src/lib/inspection-checklist.ts` |
| Alert Operations or Supervisor | No explicit alert subsystem; errors/manual workflow only | Missing | `src/app/api/*` |
| Perform Testing | Lab/sample workflows record testing-related state | Exact | `src/app/api/inspection/sample-management/route.ts`, `src/app/api/rd/trial/route.ts` |
| Record Results | Sampling/sample/trial data persisted | Exact | `src/app/api/inspection/sample-management/route.ts`, `src/app/api/rd/trial/route.ts` |
| Reporting | Reporting route and workflow stage exist | Exact | `src/app/reports/page.tsx`, `src/lib/workflow-stage.ts` |
| Create Report Ready Record | Report build/generate snapshot endpoints exist | Exact | `src/app/api/report/build/route.ts`, `src/app/api/report/generate/route.ts` |
| Reviewer Checks Report | Report validation endpoint/logic exists | Exact | `src/app/api/report/build/route.ts`, `src/lib/report-validation.ts` |
| Approve and Move | QA approve transitions job to `LOCKED` | Exact | `src/app/api/inspection/qa/route.ts` |
| Report Precondition Failed | Explicit validation failures returned | Exact | `src/app/api/report/build/route.ts`, `src/app/api/report/export/route.ts` |

## 6) Packet Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Create Packet from Testing Unit | Packet API creates packets from sample context | Exact | `src/app/api/rd/packet/route.ts` |
| Sample Not Homogenized Pending | Sample readiness gate enforces homogenized requirement | Exact | `src/app/api/inspection/sample-management/route.ts`, `src/lib/sample-management.ts` |
| Packet Quantity Exceeds Sample Available | Explicit quantity guard | Exact | `src/app/api/rd/packet/route.ts` |
| Packet Already Reserved or Used | Allocation state model supports this | Exact | `src/app/api/rd/packet/route.ts`, `src/lib/packet-management.ts` |
| Packet Reuse Blocked | Blocked/used readiness logic enforced | Exact | `src/app/api/rd/packet/route.ts`, `src/lib/packet-management.ts` |
| Preserve Job, Lot, Test Lineage | Traceability fields and packet lineage retained | Exact | `src/lib/traceability.ts`, `src/app/api/report/generate/route.ts` |

## 7) Dispatch / Report Output Lane

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Packing List and Dispatch | Packing list generation and output path exists | Exact | `src/app/api/report/packing-list/route.ts` |
| Prepare Output for Dispatch | Reporting/export endpoints exist | Exact | `src/app/api/report/export/route.ts`, `src/app/api/report/packing-list/route.ts` |
| Packing List Attempted Before Report Approval | Partially enforced through validation/state checks, not one dedicated guard node | Partial | `src/app/api/inspection/qa/route.ts`, `src/lib/report-validation.ts`, `src/app/api/report/packing-list/route.ts` |
| Packing List Precondition Failed | Explicit precondition errors | Exact | `src/app/api/report/packing-list/route.ts` |
| Generate Packing List (Traceable) | PDF + traceability + audit log | Exact | `src/app/api/report/packing-list/route.ts`, `src/lib/traceability.ts` |
| Compare Operational Flow | Ops dashboards and queue tracking exist | Exact | `src/app/operations/page.tsx`, `src/app/userinsp/page.tsx` |
| Write Final Audit Log | Audit logging for report artifacts and transitions exists | Exact | `src/lib/audit.ts`, `src/app/api/report/packing-list/route.ts`, `src/app/api/report/stickers/route.ts` |
| End | Terminal status represented (`LOCKED`, `COMPLETED`, `DISPATCHED`) not a literal End node | Partial | `src/lib/workflow-stage.ts` |

## 8) Escalation and Exception Nodes

| Flowchart Node | App Implementation | Status | Evidence |
|---|---|---|---|
| Validation Error | Standardized validation responses across modules | Exact | `src/app/api/*` |
| Conflict | Explicit conflict responses for duplicates and immutable actions | Exact | `src/app/api/inspection/lots/route.ts`, `src/app/api/lots/[id]/seal/route.ts` |
| Duplicate Lot Blocked | Explicit `409` duplicate lot guard | Exact | `src/app/api/inspection/lots/route.ts` |
| Concurrent Lot Edit Conflict | No dedicated optimistic concurrency token handling | Partial | `src/app/api/inspection/lots/route.ts` |
| Lot State Changed During Action | Terminal-state guards for mutation | Exact | `src/app/api/inspection/lots/route.ts`, `src/app/api/inspection/execution/route.ts` |
| Security Escalation | RBAC/forbidden responses exist; no escalation queue | Partial | `src/lib/rbac.ts`, `src/app/api/*` |
| Technical Escalation | Error responses exist; no escalation orchestrator | Partial | `src/app/api/*` |
| Operational Escalation | Operational monitoring exists; explicit escalation workflow is manual | Partial | `src/app/operations/page.tsx`, `src/app/admin/page.tsx` |
| Admin or Master Data Escalation | Master endpoints/settings exist; escalation is process-driven | Partial | `src/app/api/masters/*`, `src/app/settings/page.tsx` |

## Alignment Summary

- Coverage against flowchart nodes: `High`.
- Core process chain is aligned:
  - `Job Creation -> Lot Intake -> Inspection Decision -> Sampling -> Packet -> QA/Lock -> Reporting/Dispatch`
- Remaining alignment gaps are mostly orchestration concerns:
  - Dedicated escalation engine/queues (`Security/Technical/Operational` as explicit workflow nodes)
  - Explicit privileged override/admin review branches for suspicious/duplicate jobs
  - Explicit optimistic concurrency node for lot edit race conflicts
