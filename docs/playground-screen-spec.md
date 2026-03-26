# Playground Screen-Wise Product Spec (MVP)

## 1. Screen: Playground Board (`/playground`)

Purpose: Build, validate, execute, trial, finalize in one workspace.

### Sections

- Header
- Left Rail (Resource Library)
- Center Canvas (Process Flow)
- Right Inspector (Context Editor)
- Bottom Trial Lane

### Header Actions

- Save Draft
- Validate
- Start Execution
- Select Final Trial
- Lock

### Phase Indicator

- BUILDING
- READY_TO_RUN
- RUNNING
- STEPS_COMPLETED
- TRIALS_IN_PROGRESS
- RESULT_SELECTED
- LOCKED

## 2. Left Rail: Resource Library

### Tabs

- Steps
- Chemicals
- Assets
- Packets
- Templates
- Measurement Sets

### Behaviors

- Searchable
- Filterable by category/type
- Drag source only
- Stock/availability visibility

### Card States

- Chemicals: In Stock / Low Stock / Out of Stock
- Assets: Available / In Use / Maintenance / Unavailable
- Packets: Eligible / Blocked by stage

## 3. Center Canvas: Process Flow

### Purpose

Construct and visualize ordered experiment steps.

### Supports

- Add step via drag-and-drop
- Reorder step (build stage)
- Delete step (build stage)
- Attach chemicals/assets to step
- Step status transitions
- Progress visibility

### Step Card Fields

- Name
- Order number
- Duration seconds
- Resource badges
- Status
- Action CTA

## 4. Right Inspector: Context Panel

Shows selected object details with inline editing.

### Step Fields

- Name
- Duration seconds
- Instructions
- Notes
- Timer-required indicator
- Validation errors

### Chemical Assignment Fields

- Chemical
- Quantity
- Unit
- Usage notes
- Stock check result

### Asset Assignment Fields

- Asset
- Availability
- Calibration status
- Usage notes

### Trial Fields

- Trial number
- Packet reference
- Measurement rows
- Completeness
- Selected flag

## 5. Trial Lane (Post-Step Execution)

### Unlock Condition

All steps are DONE.

### Actions

- Drag packet to create trial
- Open trial measurements
- Select final trial

### Trial Statuses

- Draft
- Incomplete
- Complete
- Selected

## 6. Settings Dependencies

### Step Master

- name
- category
- default_duration_seconds
- requires_timer
- allows_chemical_assignment
- allows_asset_assignment
- requires_asset
- default_instructions
- is_active

### Chemical Master

- name
- code
- category
- base_unit
- allowed_units
- stock_quantity
- reserved_quantity
- reorder_threshold
- location
- is_active

### Asset Master

- name
- code
- category
- availability_status
- location
- calibration_due_date
- is_active
- notes

### Unit Master

- unit_code
- category
- conversion_to_base
- is_active

### Template Master

- template metadata
- ordered steps
- default durations
- default resource suggestions
- expected measurements

## 7. Button-Level Behavior

### Validate

Runs build-stage checks and surfaces blocking items in inspector.

### Start Execution

Enabled only when validation passes.

### Start Step

Moves step READY -> RUNNING.

### Complete Step

Allowed only when timer has elapsed for timer-required steps.

### Create Trial

Packet drop in trial lane creates a trial and opens measurements.

### Select Final Trial

Manual only. Can change before lock.

### Lock

Runs final validations; on success, board becomes read-only.

## 8. Field-Level Rules

### Chemical

- Quantity required
- Quantity > 0
- Unit must be allowed for chemical
- Internal conversion to base unit for stock logic

### Asset

- Asset must be active
- Asset must be available
- Calibration policy check if enforced

### Measurements

- No duplicate element per trial
- Required elements must be present before completion

### Freeze Rules after Execution Start

- No step reorder
- No step delete
- No template apply
- No structural reassignment unless policy explicitly allows

## 9. Validation Rules

### Build Stage

- At least one step required
- Continuous unique step order
- Required duration present for timer-required steps
- Required resources attached per step policy
- Inactive resources not allowed

### Trial Stage

- No trial without packet
- Packet belongs to sample
- No duplicate element per trial

### Finalization Stage

- All steps DONE
- At least one trial exists
- Final trial selected
- Final trial complete
- Experiment not already locked

## 10. Audit Events (MVP)

- Experiment created
- Template applied
- Step add/delete/reorder
- Step property edit
- Chemical assignment/edit
- Asset assignment/edit
- Validation run
- Execution started
- Step started/completed
- Trial created
- Measurement create/edit/delete
- Final trial selected
- Experiment locked

## 11. MVP Acceptance Criteria

- User can build and configure steps via drag-and-drop before run
- Validation blocks execution on missing requirements
- Execution is sequential; only one RUNNING step
- Timer-required steps cannot complete early
- Chemical assignment enforces quantity/unit rules
- Asset assignment enforces availability rules
- Trials unlock only after steps complete
- Final result selection is manual
- Lock makes the experiment read-only
- Core events are auditable
