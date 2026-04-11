# Recycos Critical-Flow Browser Regression Pack

Harness-based Playwright regression pack for high-signal operational flows. The suite uses first-blocking-failure semantics per flow and captures debug artifacts automatically.

## Flows (v1)

1. `create-job`
- Prerequisites: authenticated admin/ops session
- Key steps: open `/rd`, open create drawer, validate required-field gating, submit
- Critical assertions: save disabled initial/partial, enabled only when valid, navigate to `/jobs/:id/workflow`

2. `job-basics-update`
- Prerequisites: existing job fixture
- Key steps: open workflow Job Basics section, update deadline, save, reload
- Critical assertions: save action present, success feedback visible, value persists after reload

3. `sample-packet-critical`
- Prerequisites: deterministic sample+packet setup via APIs
- Key steps: open sampling panel, save sampling data, open packet panel, create/update packet
- Critical assertions: packet blockers clear, packet create/update success feedback

4. `report-critical`
- Prerequisites: report-eligible job/lot fixture
- Key steps: open `/reports`, select fixture job, generate sticker preview, close modal
- Critical assertions: preview actions visible, modal opens, iframe preview visible, modal closes correctly

5. `qa-decision`
- Prerequisites: decision-ready fixtures with required proof
- Key steps: open decision panel on dedicated fixtures, trigger pass/reject paths
- Critical assertions: decision actions available, decision updates succeed, reject gate warning visible

## Deferred (intentionally skipped in v1)

- `dispatch-document`
- Reason: route/workflow is currently changing and not stable enough for deterministic harness automation.

## Runner interface

- Single flow:
  - `node scripts/e2e/recycos-regression-pack.mjs --flow <flow-name> --headless`
  - `node scripts/e2e/recycos-regression-pack.mjs --flow <flow-name> --headed --slow-mo 400`
- All flows:
  - `node scripts/e2e/recycos-regression-pack.mjs --all --headless`
  - `node scripts/e2e/recycos-regression-pack.mjs --all --headed --slow-mo 400`

npm shortcuts:
- `npm run repro:flow -- --flow create-job --headed --slow-mo 400`
- `npm run repro:critical`
- `npm run repro:critical:headed`

## Artifact layout

Per flow run:

- `tmp/repro/<flow-name>/<timestamp>/summary.json`
- `tmp/repro/<flow-name>/<timestamp>/events.json`
- `tmp/repro/<flow-name>/<timestamp>/trace.zip`
- On failure:
  - `tmp/repro/<flow-name>/<timestamp>/failure.png`
  - `tmp/repro/<flow-name>/<timestamp>/dom-snippet.html`

## Logging/failure contract

Each step logs as:
- `[FLOW:<name>] [STEP] ...`

On first blocker the runner logs:
- flow name
- failing step
- exact error
- URL
- selector/action
- root-cause hint
- artifact root
