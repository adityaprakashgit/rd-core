# User Step Process for Admin Sharing

## Purpose

This document gives admins a simple, shareable operating flow for how users should access and use the platform from workspace setup through reporting.

## Admin Setup Process

1. Open `/signup` and create the company workspace.
2. Enter the company name, unique login code, admin email, and password.
3. Sign in through `/login` using the same login code, email, and password.
4. Open `/settings` and confirm workspace identity, default queue view, report defaults, and workflow guardrails.
5. Open `/master` and create the required reference data:
   - Clients
   - Transporters
   - Items
6. Share the company login code with the operational team.
7. Confirm that end users already exist in the system before rollout.

Note: the current product flow creates the initial company admin through `/signup`, but it does not expose a separate in-app user creation or invite screen for additional users.

## User Login Process

1. Open `/login`.
2. Enter the company login code.
3. Enter the assigned email and password.
4. After login, the system routes the user to the correct workspace based on role:
   - `ADMIN` goes to `/admin`
   - `OPERATIONS` goes to `/userinsp`
   - `RND` goes to `/userrd`

## Standard User Workflow

1. Start in the assigned workspace and review the current queue.
2. If a new job is required, open `/rd`.
3. Create the job using:
   - Source or customer
   - Material category
   - Optional location
4. Open the created job and add the first lot.
5. Complete the lot intake wizard in this order:
   - Lot basics
   - Quantity mode
   - Quantity entry
   - Required photos
   - Review and save
6. For every lot, make sure the required photo evidence is captured:
   - Bag with lot number
   - Material visible
   - During sampling
   - Sealed bag
   - Bag condition
7. Continue execution until the lot is fully captured:
   - Register bag rows or weights if applicable
   - Complete sampling evidence
   - Assign the seal
   - Upload closure photos
8. Repeat the same process for all lots in the job.
9. Once all lots are complete, hand the job to lab or R&D review.
10. R&D users continue the job in `/userrd` until analysis and QA are complete.
11. When the job reaches report-ready or locked status, open `/reports`.
12. Select the job, review the lots, and generate the required output documents.

Note:
- Some workflow surfaces now use Batch/Bag wording in navigation or step labels.
- Job Number and Lot Number remain the canonical identifiers when sharing work or documenting a traceability issue.

## Admin Monitoring Process

1. Use `/admin` to move between control, execution, lab, reports, reference data, and settings.
2. Use company view when you need full queue visibility across users.
3. Assign jobs or lots when work needs to be redistributed.
4. Track jobs by stage:
   - Intake
   - Lot capture
   - Sampling
   - Lab review
   - Reporting
   - Complete
5. Check that jobs do not move to reporting until field evidence, sealing, and lab review are complete.

## Short Version to Share with Users

1. Log in with your company login code, email, and password.
2. Open your assigned queue and pick the next pending job.
3. Create the job if it does not already exist.
4. Add each lot and complete all lot details, weights, and required photos.
5. Finish sampling and seal the lot.
6. Complete all lots in the job.
7. Send the job to lab or R&D review.
8. Generate the final documents only after the job is report-ready.
