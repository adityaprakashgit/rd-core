# Final UAT Tracker: Operations + R&D + Traceability + Documents Revamp

## 1. UAT Objective
Validate connected enterprise workflow behavior across Operations, R&D, Manager, and Admin with explicit verification of:
- lot traceability clarity
- workflow step clarity
- reliable document retrieval
- correct COA/report/dispatch linkage
- role-based action gating
- active vs historical output clarity

## 2. UAT Roles (Pre-assigned Owners)
- `Operations / Production` -> Owner Group: `Operations Team`
- `R&D` -> Owner Group: `R&D Team`
- `Manager` -> Owner Group: `Manager Team`
- `Admin` -> Owner Group: `Admin Team`

## 3. UAT Status + Severity
- Status: `Pass`, `Fail`, `Blocked`, `Not Tested`
- Severity: `Critical`, `High`, `Medium`, `Low`

## 4. Master Tracker Fields
Use this exact record format for each test row:
- `Test ID`
- `Role`
- `Module / Page`
- `Scenario`
- `Expected Result`
- `Actual Result`
- `Status`
- `Severity`
- `Screenshot / Video`
- `Notes`

## 5. UAT Execution Order
1. Operations workflow
2. Submit to R&D
3. R&D queue and testing
4. Review / approval
5. Packet ledger + retest
6. Traceability
7. Document retrieval
8. Manager oversight
9. Admin settings
10. Mobile/tablet check

## 6. Operations UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| OP-01 | Operations Team | Job Creation | Create a job with existing client from master | Job created, job number generated, assignee visible, deadline visible |  | Not Tested |  |  |  |
| OP-02 | Operations Team | Job Creation | Create job when client is not in master | Add New Client drawer opens, new client created inline, selectable immediately |  | Not Tested |  |  |  |
| OP-03 | Operations Team | Job Creation | Check job fields | Necessary fields shown first, description optional, client details retained for docs |  | Not Tested |  |  |  |
| OP-04 | Operations Team | Job Creation | Verify auto assignment logic | Creator becomes assignee by default if no assignee selected |  | Not Tested |  |  |  |
| OP-05 | Operations Team | Job Creation | Verify deadline behavior | Deadline saved and shown clearly |  | Not Tested |  |  |  |
| OP-06 | Operations Team | Lot Creation | Create lot manually | Lot added under correct job, lot number visible, linked correctly |  | Not Tested |  |  |  |
| OP-07 | Operations Team | Lot Creation | Create lot with auto lot numbering enabled | System auto-generates lot number |  | Not Tested |  |  |  |
| OP-08 | Operations Team | Lot Creation | Create multi-weight lot | Bag row entry shown, no forced gross/net/tare at lot level |  | Not Tested |  |  |  |
| OP-09 | Operations Team | Lot Creation | Create multiple lots in one job | All lots visible, current lot context clear |  | Not Tested |  |  |  |
| OP-10 | Operations Team | Images / Proof | Upload/capture required proof images | Required image cards and statuses visible, capture/upload/retake work |  | Not Tested |  |  |  |
| OP-11 | Operations Team | Images / Proof | Check timestamp behavior if enabled | Timestamp appears on image when enabled |  | Not Tested |  |  |  |
| OP-12 | Operations Team | Images / Proof | Leave required image missing | Blocker shown, cannot proceed where required |  | Not Tested |  |  |  |
| OP-13 | Operations Team | Images / Proof | Check optional image handling | Not Used/optional behavior follows admin settings, no confusing blank state |  | Not Tested |  |  |  |
| OP-14 | Operations Team | Final Decision | Submit for final decision | Can submit to Manager/Admin, clear submitted state |  | Not Tested |  |  |  |
| OP-15 | Manager Team/Admin Team | Final Decision | Pass decision | Workflow moves forward correctly |  | Not Tested |  |  |  |
| OP-16 | Manager Team/Admin Team | Final Decision | Hold decision | Notes required, downstream blocked |  | Not Tested |  |  |  |
| OP-17 | Manager Team/Admin Team | Final Decision | Reject decision | Notes required, downstream blocked |  | Not Tested |  |  |  |
| OP-18 | Operations Team | Sampling | Create sample after pass | Sample ID auto-generated, linked to lot and job |  | Not Tested |  |  |  |
| OP-19 | Operations Team | Sampling | Verify container type dropdown | Values visible, selection saved |  | Not Tested |  |  |  |
| OP-20 | Operations Team | Sampling | Check homogeneous proof flow | Homogeneous proof required if configured, no homogeneous weight field |  | Not Tested |  |  |  |
| OP-21 | Operations Team | Sampling | Capture sampling photos | During Sampling Photo and Sample Completion work |  | Not Tested |  |  |  |
| OP-22 | Operations Team | Seal | Seal on Bag with seal available | Scan option shown, POS-style scan flow works |  | Not Tested |  |  |  |
| OP-23 | Operations Team | Seal | Seal not available path | Alternate path shown, no immediate hard failure |  | Not Tested |  |  |  |
| OP-24 | Operations Team | Seal | Generate seal numbers after sampling | Table includes Lot No, Bag No, Weight, Gross, Net, Seal No |  | Not Tested |  |  |  |
| OP-25 | Admin Team | Seal | Admin-only edit behavior | Only admin can edit generated/scanned seal when rule enabled |  | Not Tested |  |  |  |
| OP-26 | Operations Team | Packet Creation | Create packet rows | Packets created correctly, IDs visible |  | Not Tested |  |  |  |
| OP-27 | Operations Team | Packet Creation | Packet requires weight | Cannot complete packet without weight |  | Not Tested |  |  |  |
| OP-28 | Operations Team | Packet Creation | Packet unit saved correctly | Unit required and visible |  | Not Tested |  |  |  |
| OP-29 | Operations Team | Packet Creation / Handoff | Submit to R&D | Flow ends correctly, packet submitted, no duplicate child job on repeat |  | Not Tested |  |  |  |

## 7. R&D UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| RD-01 | R&D Team | /rnd Queue | Open R&D queue | Canonical `/rnd` works, bucket structure visible |  | Not Tested |  |  |  |
| RD-02 | R&D Team | /rnd Queue | Queue rows fields | R&D job no, parent job no, lot, sample, packet, weight, use, received, assignee, priority, due |  | Not Tested |  |  |  |
| RD-03 | R&D Team | Redirects | Legacy `/userrd` redirects | Correct redirect behavior, no broken navigation |  | Not Tested |  |  |  |
| RD-04 | R&D Team | R&D Job Detail | Open newly submitted R&D job | Correct lineage with source packet/lot/sample visible |  | Not Tested |  |  |  |
| RD-05 | R&D Team | R&D Job Detail | Use assignee picker | Searchable picker works, no raw user ID entry |  | Not Tested |  |  |  |
| RD-06 | R&D Team | Test Setup | Set packet use | Testing/Retain/Backup/Reference/Retest options work |  | Not Tested |  |  |  |
| RD-07 | R&D Team | Test Setup | Save setup details | Test type/method/assignment/deadline/priority save correctly |  | Not Tested |  |  |  |
| RD-08 | R&D Team | Testing | Start testing | Status updates correctly |  | Not Tested |  |  |  |
| RD-09 | R&D Team | Readings | Enter readings/values | Values save correctly, do not overwrite other R&D jobs |  | Not Tested |  |  |  |
| RD-10 | R&D Team | Attachments | Upload attachments | Attachments visible and linked correctly |  | Not Tested |  |  |  |
| RD-11 | R&D Team | Review | Submit results for review | Status becomes awaiting review |  | Not Tested |  |  |  |
| RD-12 | Admin Team/Approver | Review | Approve result | Approved status set, active result/report logic updates |  | Not Tested |  |  |  |
| RD-13 | Admin Team/Approver | Review | Reject/rework result | Notes required, rework state visible |  | Not Tested |  |  |  |
| RD-14 | R&D Team | Retest | Create retest job | Retest links to previous R&D job, lineage preserved |  | Not Tested |  |  |  |
| RD-15 | R&D Team | Packet Ledger | View usage ledger | Allocation/use history visible and understandable |  | Not Tested |  |  |  |
| RD-16 | R&D Team | Packet Ledger | Verify packet balance | No invalid overuse, usage summary accurate |  | Not Tested |  |  |  |

## 8. Manager UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| MG-01 | Manager Team | Decision Queue/Workflow | See submitted final decisions | Submitted items visible |  | Not Tested |  |  |  |
| MG-02 | Manager Team | Decision Queue/Workflow | Pass/Hold/Reject | Correct state transitions, notes mandatory where required |  | Not Tested |  |  |  |
| MG-03 | Manager Team | Manager Home | Oversight sections | Active jobs, lot aging, bottlenecks, missing docs, dispatch delays, missing COA visible |  | Not Tested |  |  |  |
| MG-04 | Manager Team | Manager Home | Open traceability quickly | Lot-centric traceability quickly accessible |  | Not Tested |  |  |  |
| MG-05 | Manager Team | Reports/Documents | Distinguish active vs previous reports | Clear labels, no current output ambiguity |  | Not Tested |  |  |  |
| MG-06 | Manager Team | Reports/Documents | Identify dispatch-default report/COA | Current for dispatch is obvious |  | Not Tested |  |  |  |

## 9. Admin UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| AD-01 | Admin Team | User/Access | Create user | User created, role assigned, module access configurable |  | Not Tested |  |  |  |
| AD-02 | Admin Team | User/Access | Control module permissions | Access changes work correctly |  | Not Tested |  |  |  |
| AD-03 | Admin Team | User/Access | Initial password/login flow | Admin-controlled onboarding works |  | Not Tested |  |  |  |
| AD-04 | Admin Team | Workflow Settings | Open workflow/module settings | Page loads, grouped sections visible |  | Not Tested |  |  |  |
| AD-05 | Admin Team | Workflow Settings | Change required image settings | Required/optional/hidden behavior works, self-heal stays valid |  | Not Tested |  |  |  |
| AD-06 | Admin Team | Workflow Settings | Restore recommended image defaults | Default image buckets restored correctly |  | Not Tested |  |  |  |
| AD-07 | Admin Team | Workflow Settings | Enable image timestamp | Timestamps appear after enablement |  | Not Tested |  |  |  |
| AD-08 | Admin Team | Workflow Settings | Enable auto lot numbering | Lot numbering follows setting |  | Not Tested |  |  |  |
| AD-09 | Admin Team | Workflow Settings | Enable auto sample ID | Sample ID auto-generates correctly |  | Not Tested |  |  |  |
| AD-10 | Admin Team | Workflow Settings | Set final decision owner | Manager/Admin routing behaves correctly |  | Not Tested |  |  |  |
| AD-11 | Admin Team | Workflow Settings | Seal settings behavior | Scan/generate/admin-edit follows settings |  | Not Tested |  |  |  |
| AD-12 | Admin Team | Company Profile | Open company profile | Company details and branding controls visible |  | Not Tested |  |  |  |
| AD-13 | Admin Team | Company Profile | Upload logo | Logo saved, branding preview visible |  | Not Tested |  |  |  |
| AD-14 | Admin Team | Company Profile | Logo-based color suggestion | Suggested colors or clear fallback behavior |  | Not Tested |  |  |  |
| AD-15 | Admin Team | Company Profile | Document branding preview | Report/packing/COA preview visible |  | Not Tested |  |  |  |

## 10. Traceability UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TR-01 | Operations Team/Manager Team | Lot Traceability | Open Lot Traceability page | Inspection, samples, R&D tests, packets, documents, dispatches visible |  | Not Tested |  |  |  |
| TR-02 | Operations Team | Packet -> Traceability | Navigate from packet to lot traceability | Correct linked record opens |  | Not Tested |  |  |  |
| TR-03 | Operations Team/Manager Team | Lot Traceability | Check linked records clarity | Job/lot/sample/packet/report/dispatch clearly connected |  | Not Tested |  |  |  |
| TR-04 | Manager Team/Admin Team | Lot Traceability | Check audit timeline | Lifecycle events visible and ordered |  | Not Tested |  |  |  |

## 11. Document Retrieval UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| DC-01 | Operations Team/R&D Team/Manager Team | Document Registry | Open registry | Filters and table-first retrieval work |  | Not Tested |  |  |  |
| DC-02 | Operations Team/R&D Team/Manager Team | Document Registry | Filter by lot/packet/job/type/status | Correct records shown |  | Not Tested |  |  |  |
| DC-03 | Manager Team/Admin Team | Document Registry | Check active vs previous labels | `Active Report`, `Active COA`, `Previous Report`, `Current for Dispatch` shown correctly |  | Not Tested |  |  |  |
| DC-04 | Operations Team/R&D Team | Packet Detail | Verify active/default output | Active report/COA clear, previous reports visible |  | Not Tested |  |  |  |
| DC-05 | Manager Team/Admin Team | Lot Traceability | Verify output lineage | Active and historical outputs visible |  | Not Tested |  |  |  |
| DC-06 | Operations Team/Manager Team | Dispatch Retrieval | Dispatch default output retrieval | Dispatch uses correct active output by default |  | Not Tested |  |  |  |

## 12. Route / Label UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| RL-01 | All Roles | Routes/Breadcrumbs/Titles | Route purpose clarity | Route/title/breadcrumb are understandable |  | Not Tested |  |  |  |
| RL-02 | All Roles | UI Labels | Business-friendly labels | No raw enum/internal wording on user-facing screens |  | Not Tested |  |  |  |
| RL-03 | All Roles | Document Actions | PDF action clarity | `View PDF`, `Download Report PDF`, `Download Packing List PDF`, `Share PDF`, `Print PDF` consistent |  | Not Tested |  |  |  |

## 13. Mobile / Tablet UAT Checklist
| Test ID | Role | Module / Page | Scenario | Expected Result | Actual Result | Status | Severity | Screenshot / Video | Notes |
|---|---|---|---|---|---|---|---|---|---|
| MB-01 | Operations Team | Mobile Operations Flow | Task-first workflow on mobile | No dashboard clutter, one section at a time, clear CTA |  | Not Tested |  |  |  |
| MB-02 | Operations Team/R&D Team | Tablet Layout | Tablet usability | No broken spacing, forms/tables usable, context accessible |  | Not Tested |  |  |  |
| MB-03 | Operations Team/R&D Team | Image Capture | Capture on tablet/mobile | Capture and retake work; proof flow easy |  | Not Tested |  |  |  |
| MB-04 | Operations Team | Seal Scan | Seal scan on tablet/mobile | Scan flow usable, fallback clear |  | Not Tested |  |  |  |

## 14. Release Readiness Gates
| Gate ID | Check | Owner | Result | Notes |
|---|---|---|---|---|
| RR-01 | Lint passes | QA Engineering | Not Tested |  |
| RR-02 | Typecheck passes | QA Engineering | Not Tested |  |
| RR-03 | Build passes | QA Engineering | Not Tested |  |
| RR-04 | Critical traceability tests pass | QA Engineering | Not Tested |  |
| RR-05 | Submit-to-R&D handoff test passes | QA Engineering | Not Tested |  |
| RR-06 | R&D lineage / ledger tests pass | QA Engineering | Not Tested |  |
| RR-07 | Active/default report logic works | QA + Product | Not Tested |  |
| RR-08 | Document retrieval works | QA + Product | Not Tested |  |
| RR-09 | No critical role access issue remains | QA + Security | Not Tested |  |
| RR-10 | No critical mobile/tablet blocker remains | QA + Product | Not Tested |  |

## 15. Release Gate Policy
- Release is blocked if any `Critical` issue remains open.
- Release is blocked if any `RR-*` gate fails.
- `Low/Medium` issues may be deferred only with explicit approval, owner, and ETA.

## 16. Evidence Rules
- Every `Fail` or `Blocked` item must include screenshot/video evidence.
- Every defect must include tested route and role.
- Keep actual result concise, reproducible, and tied to expected behavior.
