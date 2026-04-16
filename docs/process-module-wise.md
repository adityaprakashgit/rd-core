# Process Module-Wise

## Module 1: Job Creation

### Objective
Create a new inspection job with company scope, assignment, serial generation, and audit logging.

### Entry Points
- UI: `/rd` (job creation form)
- API: `POST /api/jobs`

### Actors
- Primary: `ADMIN`, `OPERATIONS`, `RND` users who have `CREATE_JOB` permission

### Preconditions
1. User is authenticated.
2. User belongs to a valid company workspace.
3. User has permission `CREATE_JOB`.
4. Reference masters (client/source and material category) are already available/known.

### Input Fields
1. `sourceName` (fallback: `clientName`) - required
2. `materialCategory` (fallback: `commodity`) - required
3. `sourceLocation` (fallback: `plantLocation`) - optional
4. `materialType` - optional (`INHOUSE` or `TRADED`)

### Process Flow
1. User submits job creation form from `/rd`.
2. API resolves current user from session.
3. Authorization check enforces `CREATE_JOB`.
4. Payload shape is validated as JSON object.
5. Required fields are validated:
   - `sourceName/clientName`
   - `materialCategory/commodity`
6. Scope guard runs:
   - If `companyId` provided, it must match current user company.
   - If `userId` provided, it must match current user.
7. System generates `inspectionSerialNumber`.
8. Transaction creates `InspectionJob` with:
   - `companyId = currentUser.companyId`
   - `createdByUserId = currentUser.id`
   - `assignedToId = currentUser.id`
   - `assignedById = currentUser.id`
   - `assignedAt = now`
   - mapped and trimmed business fields
9. Audit entry is written with action `JOB_CREATED` and metadata.
10. API returns created job payload.

### System Outputs
- New `InspectionJob` row is created.
- Job is assigned to creator by default.
- Audit log exists for lineage review.
- Response returns workspace-ready job data (`workspaceJobSelect`).

### Error Handling
1. `401` Unauthorized: session user cannot be resolved.
2. `403` Forbidden:
   - missing `CREATE_JOB` permission
   - payload `companyId`/`userId` mismatch
3. `400` Bad Request:
   - non-object payload
   - missing required fields
4. `500` Internal/DB error: serial generation, Prisma, or unexpected failures.

### Business Rules
1. Job is always company-scoped.
2. Job cannot be created for another user/company through payload spoofing.
3. Only valid `materialType` values are recognized (`INHOUSE`, `TRADED`).
4. Serial number generation is mandatory for operational tracking.
5. Every creation event must be auditable.

### Completion Criteria (DoD)
1. User can create job from `/rd` with required fields.
2. Created job is visible in `/api/jobs?view=my` for creator.
3. Admin/company viewers can see it via `/api/jobs?view=all` (with permission).
4. Audit trail shows `JOB_CREATED` for that job.
5. Invalid payloads return correct HTTP errors and messages.

### Test Checklist
1. Create with `sourceName + materialCategory` succeeds.
2. Create with fallback keys `clientName + commodity` succeeds.
3. Missing required fields returns `400`.
4. Mismatched `companyId`/`userId` returns `403`.
5. Created job contains creator assignment and serial number.
6. Audit log row is written with expected metadata.

### Source References
- `src/app/api/jobs/route.ts`
- `docs/admin-user-step-process.md`

## Module 2: Lot Intake (Lot Registration)

### Objective
Register lots under a job with mandatory lot identity, quantity capture mode, and required intake evidence so downstream sampling and inspection can proceed.

### Entry Points
- UI: Lot Intake Wizard from job workspace (`/operations/job/[jobId]`, `/userinsp/job/[jobId]`)
- API:
  - `POST /api/inspection/lots` (create lot)
  - `POST /api/inspection/bags` (multi-weight bag rows)
  - `POST /api/media/upload` (lot evidence images)
  - `GET /api/inspection/lots?jobId=...` (refresh queue)

### Actors
- Primary: users with `CREATE_LOT` permission (`ADMIN`, `OPERATIONS`, role-config dependent)

### Preconditions
1. User is authenticated.
2. User has access to the job company scope.
3. Job is active and not in locked terminal statuses (`CLOSED`, `CANCELLED`, `COMPLETED`, `DISPATCHED`, `LOCKED`).
4. Job already exists (Module 1 complete).

### Input Fields
1. `jobId` - required
2. `lotNumber` - required
3. `materialName` - required
4. `materialCategory` - optional
5. `quantityMode` - optional, normalized to:
   - `SINGLE_PIECE` (default)
   - `MULTI_WEIGHT`
6. Quantity details:
   - Single Piece path: `bagCount` / `pieceCount` / `grossWeight` / `netWeight` (any meaningful value)
   - Multi Weight path: `totalBags` + per-bag weight rows (`/api/inspection/bags`)
7. `weightUnit` - optional
8. `remarks` - optional
9. Evidence photos (wizard required categories) - required before wizard completion

### Process Flow
1. User opens lot intake wizard for a selected job.
2. Wizard enforces step order:
   - Lot basics
   - Quantity mode
   - Quantity capture
   - Photos
   - Review
3. On save, client sends lot payload to `POST /api/inspection/lots`.
4. API validates required fields (`jobId`, `lotNumber`, `materialName`) and user permission `CREATE_LOT`.
5. API enforces job company scope and rejects cross-company access.
6. API blocks lot creation for locked/closed job states.
7. API normalizes quantity mode and derives `totalBags`.
8. API derives lot status:
   - `CREATED` when details are insufficient
   - `DETAILS_CAPTURED` when quantity-ready details exist
   - preserves higher-progress statuses when editing
9. Transaction creates lot and writes audit logs:
   - `LOT_CREATED`
   - `QUANTITY_MODE_SELECTED` (when mode is present)
10. If mode is `MULTI_WEIGHT`, wizard posts weight rows to `/api/inspection/bags`.
11. Wizard uploads captured photo files to `/api/media/upload` per evidence category.
12. UI refreshes lot list (`GET /api/inspection/lots`) and surfaces lot in intake queue.

### System Outputs
- New `InspectionLot` row tied to `jobId` and `companyId`.
- Derived quantity summary values (`totalBags`) persisted.
- Audit trail entries for lot creation and mode selection.
- Bag rows and media files linked to lot when provided.

### Error Handling
1. `401` Unauthorized: session user unresolved.
2. `403` Forbidden:
   - missing `CREATE_LOT` permission
   - cross-company job/lot access
   - job does not accept lot changes (locked states)
3. `400` Validation:
   - missing `jobId` / `lotNumber` / `materialName`
   - invalid multi-weight `totalBags` (< 1)
4. `409` Conflict: duplicate `lotNumber` within same job.
5. `500` Internal/DB: unexpected persistence failures.

### Business Rules
1. Lots are always scoped to the creator's company workspace.
2. Lot registration is blocked once job reaches terminal/locked workflow states.
3. `quantityMode` defaults to `SINGLE_PIECE` unless explicitly set to `MULTI_WEIGHT`.
4. Multi-weight lots must maintain at least one weight entry path.
5. Required intake evidence photos must be present to complete wizard progression.
6. Every lot creation must create auditable events.

### Completion Criteria (DoD)
1. User can add a lot to an active job from the intake wizard.
2. Lot appears in lot queue with derived intake status.
3. Multi-weight flow supports adding bag weight rows.
4. Required evidence photos are uploaded and linked to lot.
5. Duplicate lot number and scope violations return correct API errors.
6. Audit entries exist for `LOT_CREATED` and quantity mode selection.

### Test Checklist
1. Create single-piece lot with required fields succeeds.
2. Create multi-weight lot with rows succeeds and bag records are created.
3. Missing required fields returns `400`.
4. Duplicate lot number under same job returns `409`.
5. Attempt on locked job status returns `403`.
6. Cross-company access attempt returns `403`.
7. Required photo step blocks wizard progression until satisfied.
8. Lot list refresh includes new lot with expected status and evidence metadata.

### Source References
- `src/app/api/inspection/lots/route.ts`
- `src/components/inspection/LotIntakeWizard.tsx`
- `src/lib/intake-workflow.ts`

## Module 3: Sampling & Seal Assignment

### Objective
Capture sample lifecycle evidence for an approved lot, complete seal-label evidence, and transition the lot/sample to packet-ready state.

### Entry Points
- UI: Sample Management workspace (`/operations/job/[jobId]/lot/[lotId]`, `/userinsp/job/[jobId]/lot/[lotId]`)
- API:
  - `POST|GET|PATCH /api/inspection/sample-management`
  - `POST|GET|PATCH /api/inspection/sampling` (legacy-compatible sampling endpoint)
  - `POST /api/seal/generate` (seal number generation)
  - `POST /api/lots/[id]/seal` (immutable lot seal assignment)
  - `POST /api/media/upload` (sample evidence uploads)

### Actors
- Primary: users operating sampling workflow within company scope
- Permission-sensitive:
  - `CREATE_LOT` for `/api/seal/generate`
  - `ASSIGN_LOT` for `/api/lots/[id]/seal`

### Preconditions
1. User is authenticated and company-scoped.
2. Lot exists and belongs to user company.
3. Job is not `LOCKED` for write actions.
4. Lot inspection is approved for sampling (`inspectionStatus = COMPLETED` and `decisionStatus = READY_FOR_SAMPLING`) for sample-management writes.

### Input Fields
1. Required to start/update sample: `lotId`
2. Sample details:
   - `sampleType`, `samplingMethod`, `sampleQuantity`, `sampleUnit`, `containerType`, `remarks`, `samplingDate`
3. Sample evidence media entries:
   - `mediaEntries[]` with `mediaType` + `fileUrl`
4. Seal/label data:
   - `sealNo`, `labelText`, `sealAuto`
   - progression flags: `markSealed`, `markLabeled`, `markHomogenized`, `markReadyForPacketing`
5. Lot seal endpoint payload:
   - `auto` and optional `sealNumber` (manual mode)

### Process Flow
1. User opens sample management for a lot; system loads inspection context + existing sample state.
2. User starts sampling (`POST /api/inspection/sample-management`).
3. System ensures sample exists (`ensureSampleStarted`) and records initial sample events/audit.
4. User captures details, uploads evidence files, marks homogenized, and saves seal-label details via `PATCH /api/inspection/sample-management`.
5. System recalculates readiness from:
   - required sample details
   - required sample media
   - homogenized marker
   - complete seal-label evidence
6. If `markReadyForPacketing = true`, system blocks transition unless readiness is fully satisfied.
7. On success, sample status advances to `READY_FOR_PACKETING`, readiness timestamp is stored, sample events are appended, and sample audit is written.
8. Legacy sync updates lot-level fields (`samplingPhotoUrl`, `sealPhotoUrl`, `sealNumber`, lot status progression).
9. Seal number can be generated (`/api/seal/generate`) and then persisted either:
   - through sample-management seal label save, or
   - immutable lot-level assignment via `/api/lots/[id]/seal`.
10. Lot-level seal assignment validates prerequisites and blocks reassignment once seal exists.

### System Outputs
- `Sample` record with progressive status:
  - `SAMPLING_IN_PROGRESS` -> `DETAILS_CAPTURED` -> `HOMOGENIZED` -> `SEALED` -> `READY_FOR_PACKETING`
- `SampleEvent` history (created, collected, details, homogenized, sealed/labeled, ready).
- `SampleSealLabel` evidence row.
- Updated lot evidence fields (sampling/seal photos, seal number, sealAuto, status).
- Audit logs for sample updates/readiness and seal generation/assignment actions.

### Error Handling
1. `401` Unauthorized: unresolved session user.
2. `403` Forbidden:
   - cross-company access
   - locked job write attempt
   - missing required role permission on seal endpoints
3. `422` Validation:
   - lot not approved for sampling
   - inspection prerequisite missing
   - readiness blocked when trying `markReadyForPacketing`
4. `400` Validation:
   - missing `lotId`
   - invalid sample quantity (`<= 0`)
   - invalid seal format (must be 16 digits)
5. `409` Conflict:
   - duplicate/immutable seal assignment
   - resampling conflict on legacy endpoint
6. `500` System/DB failures.

### Business Rules
1. Sampling can proceed only after lot inspection approval for sampling.
2. Ready-for-packeting is gated by complete details, required media, homogenization, and seal-label evidence.
3. Seal number format must be exactly 16 numeric digits.
4. Lot-level seal is immutable once assigned.
5. All sampling and seal transitions must be auditable.

### Completion Criteria (DoD)
1. User can start sampling for an approved lot.
2. User can save sample details and required evidence.
3. User can generate or enter seal, save label, and persist seal evidence.
4. System prevents `READY_FOR_PACKETING` transition until readiness gates are satisfied.
5. On readiness success, sample status and lot sync fields are updated correctly.
6. Audit/event trails reflect key transitions.

### Test Checklist
1. Start sampling on approved lot creates sample and initial events.
2. Start/update on non-approved lot returns `422`.
3. Invalid sample quantity returns `400`.
4. Upload required sample media and verify readiness missing list shrinks.
5. Mark homogenized + save seal/label updates status progression.
6. Mark ready without prerequisites returns `422` with missing reasons.
7. Mark ready with all prerequisites sets status `READY_FOR_PACKETING`.
8. Auto/manual seal assignment validates format, uniqueness, and immutability.
9. Cross-company and locked-job write attempts return `403`.

### Source References
- `src/app/api/inspection/sample-management/route.ts`
- `src/app/api/inspection/sampling/route.ts`
- `src/app/api/lots/[id]/seal/route.ts`
- `src/app/api/seal/generate/route.ts`
- `src/components/inspection/SampleManagementWorkspace.tsx`
- `src/lib/sample-management.ts`
