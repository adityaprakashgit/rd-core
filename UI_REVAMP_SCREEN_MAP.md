# UI_REVAMP_SCREEN_MAP

## Canonical Rules
- Stage flow: `Job Creation -> Lot -> Images -> Final Pass -> Lab Testing -> Report -> Packing List`
- Roles: Production, R&D, Manager, Admin
- Runtime mapping: Production -> `OPERATIONS`, R&D -> `RND`, Manager -> `VIEWER` (scoped), Admin -> `ADMIN`
- Core object: Lot is the primary traceable object
- Exclude Playground
- No KPI/dashboard clutter on operational screens
- One screen = one clear task
- PDF labels used everywhere:
  - `Download Report PDF`
  - `Download Packing List PDF`
  - `View PDF`
  - `Share PDF`
  - `Print PDF`

## 1. Proposed IA
- Workflow-first information architecture with lot-centric traceability as the backbone.
- Enterprise density with predictable patterns (Zoho-style structure, not visual mimicry).
- Record linkage must remain explicit across Job, Lot, Sample, Packet, Dispatch, and Documents.
- Operator surfaces stay task-first and uncluttered.
- Device policy:
  - Desktop-first enterprise shell.
  - Tablet-responsive split and table layouts.
  - Mobile limited to focused task completion.

## 2. Navigation Map
### Primary Navigation (Desktop, Locked)
- `Home`
- `Job Registry`
- `Lot Registry`
- `Inspection`
- `Lab Testing`
- `Packet Management`
- `Documents`
- `Exceptions`
- `Administration`

No Playground entry is allowed in primary navigation.

### Cross-Navigation Quick Links
From lot context:
- `Open Inspection`
- `Open Sample`
- `Open Packet`
- `Open Documents`
- `Open Traceability`

From documents context:
- `Back to Lot`
- `Back to Job`

## 3. Shared Shell Structure
- Left rail:
  - Primary navigation
  - Role/workspace context switch
- Top bar:
  - Global search
  - Saved views/filters
  - Company and role context
  - Quick actions
- Page frame:
  - `PageHeader`
  - `Filter/Search/Action Bar`
  - Main content area
  - Optional right context panel
- Mobile shell:
  - Condensed header + task CTA rail
  - No full enterprise analytics shell

## 4. Module/Page Hierarchy
- `Home`
  - `Production Home`
  - `R&D Home`
  - `Manager Home`
  - `Admin Home`
- `Job Registry`
  - `Job List` (table-first)
  - `Job Detail` (summary + linked lot table)
- `Lot Registry`
  - `Lot List` (table-first default)
  - `Lot Detail` (traceability timeline + linked records)
  - `Lot Traceability` (dedicated lineage page)
- `Inspection`
  - `Lot Inspection Task` (Images + Final Pass task pages)
- `Lab Testing`
  - `Sample Task`
  - `Trial Task`
- `Packet Management`
  - `Packet List by Lot`
  - `Packet Detail`
- `Documents`
  - `Document Registry` (Report, Packing List, COA)
  - `Document Detail / Preview`
- `Exceptions`
  - `Exception Queue`
  - `Exception Detail`
- `Administration`
  - `Masters`
  - `Settings`
  - `Role & Access`
  - `Audit Review`

## 5. List Page Structure
- Table-first for enterprise desktop by default.
- Required pinned columns:
  - `Job Number`
  - `Lot Number`
  - `Current Step`
  - `Status`
  - `Updated`
- Row interaction:
  - Row click opens detail.
  - Row actions open drawer (modal only for destructive confirmation).
- Operator list pages:
  - No KPI tiles.
  - No dashboard widget stacks.
- Manager/Admin list pages:
  - Compact aggregate chips allowed where decision-relevant.

## 6. Detail Page Structure
- Shared detail composition:
  - Header with key identifiers, state, and one primary CTA.
  - Main tabbed content surface.
  - Right context rail with blockers, next actions, and trace links.
- Panel behavior:
  - Drawers for edit/supporting flows to preserve context.
  - Modals only for hard confirmations and full-screen PDF preview.

## 7. Tab Strategy
- Stable detail tabs across modules:
  - `Overview`
  - `Workflow`
  - `Traceability`
  - `Documents`
  - `Audit`

### Lot Detail Tab Order (Strict)
`Overview -> Inspection -> Sample -> Packets -> Dispatch -> Documents -> Audit`

## 8. Filter/Search/Action Bar Strategy
- Standardized bar on all list pages:
  - Left: saved view + filter chips
  - Center: contextual search input
  - Right: one primary CTA + secondary bulk actions
- Default filters include:
  - status
  - stage
  - assignee
  - date
  - client
  - `Lot Number`
- Keep one dominant primary CTA per page.

## 9. Global Search Behavior
- Unified searchable entities:
  - `Job Number`
  - `Lot Number`
  - packet code
  - seal number
  - document number
  - client
  - material
- Search result groups:
  - `Lots` (first)
  - `Jobs`
  - `Documents`
  - `Exceptions`
- Each result provides direct deep-link actions to detail pages.

## 10. Lot Traceability Page Structure
- Dedicated lot-centric lineage view.
- Header identifiers:
  - `Job Number`
  - `Lot Number`
  - `Material Name`
  - `Current Step`
- Lineage chain blocks:
  - Job -> Lot -> Inspection -> Sample -> Packet -> Dispatch -> Documents
- Required sections:
  - Evidence gallery
  - Seal history
  - Event timeline (audit events)
  - Linked-record jump actions from every chain block

## 11. Document Registry Structure
- Table-first document registry.
- First-class document types:
  - `Report`
  - `Packing List`
  - `COA`
- Required columns:
  - `Doc Type`
  - `Job Number`
  - `Lot Number`
  - `Version`
  - `Status`
  - `Generated At`
  - `Generated By`
- Document detail actions:
  - `Download Report PDF`
  - `Download Packing List PDF`
  - `View PDF`
  - `Share PDF`
  - `Print PDF`
- COA discoverability rule:
  - COA must be visible as a first-class document type with explicit lot linkage.

## 12. Exception Queue Structure
- Queue defaults to actionable exceptions sorted by severity and priority.
- Required columns:
  - `Exception Type`
  - `Job Number`
  - `Lot Number`
  - `Blocking Stage`
  - `Age`
  - `Owner`
  - `SLA State`
- Exception detail split view:
  - Left: issue context + evidence
  - Right: resolution actions + audit notes
- Role usage:
  - Manager/Admin: triage and resolution ownership
  - Production: assigned actionable exceptions only

## 13. Role-Specific Homepage Structure
### Production Home
- `Pending inspections`
- `Lots needing action`
- `Packet-related pending work`
- `Dispatch preparation items`
- No KPI-heavy cards

### R&D Home
- `Pending samples`
- `In-progress tests`
- `Awaiting Review`
- `Overdue testing items`

### Manager Home
- `Active jobs`
- `Lot aging`
- `Workflow bottlenecks`
- `Missing documents`
- `Dispatch delays`
- `Missing COA`

### Admin Home
- `User and role management`
- `Master data`
- `Workflow configuration`
- `Audit logs`
- `Document templates`

All role homepages remain queue-first and table-first, not dashboard-widget-first.

## Final Closure Notes
- Detail tabs are standardized on shared `DetailTabsLayout` for:
  - Inspection Job Detail
  - Packet Detail
  - R&D Job Detail
- Packet `Dispatch` tab explicitly maps blockers and next actions for:
  - Missing COA
  - Missing dispatch document artifact
  - Incomplete required packet evidence
  - Stage not ready
- Dispatch-document linkage remains derived in this phase; persisted linkage is tracked as Phase-2 backlog.
