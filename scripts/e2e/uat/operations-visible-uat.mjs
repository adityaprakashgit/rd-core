#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.REPRO_BASE_URL || 'http://localhost:3000';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const rootDir = path.join(process.cwd(), 'tmp', 'uat', 'operations', runId);
const screenshotDir = path.join(rootDir, 'screenshots');
const videoDir = path.join(rootDir, 'videos');
const trackerPath = path.join(process.cwd(), 'docs', 'uat', 'final-revamp-uat-tracker.md');
const issueTemplatePath = path.join(process.cwd(), 'docs', 'uat', 'uat-issue-template.md');
const batchIssuePath = path.join(rootDir, 'batch-1-operations-issues.md');
const summaryPath = path.join(rootDir, 'operations-summary.json');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z8m0AAAAASUVORK5CYII=',
  'base64',
);
const uploadPngPath = path.join(rootDir, 'uat-upload.png');
fs.writeFileSync(uploadPngPath, tinyPng);

const results = [];
const issues = [];

function clip(text, max = 600) {
  if (typeof text !== 'string') return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function logStepOutput(step, route, action, result, evidence, issueSummary) {
  console.log(`1. Current UAT step running: ${step}`);
  console.log(`2. Route opened: ${route || 'n/a'}`);
  console.log(`3. Action performed: ${action}`);
  console.log(`4. Result: ${result}`);
  console.log(`5. Evidence saved path: ${evidence || 'n/a'}`);
  if (issueSummary) {
    console.log(`6. Short issue summary if failed: ${issueSummary}`);
  }
  console.log('');
}

function nowIso() {
  return new Date().toISOString();
}

async function installInteractionShield(page) {
  await page.addInitScript(() => {
    const shieldId = '__codex_interaction_shield__';
    const styleId = '__codex_interaction_shield_style__';
    const mount = () => {
      const root = document.head || document.body || document.documentElement;
      if (!root) return;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          #${shieldId} {
            position: fixed;
            inset: 0;
            background: rgba(16,24,40,0.02);
            z-index: 2147483647;
            pointer-events: auto;
            cursor: not-allowed;
          }
        `;
        root.appendChild(style);
      }
      if (!document.getElementById(shieldId)) {
        const shield = document.createElement('div');
        shield.id = shieldId;
        shield.setAttribute('aria-hidden', 'true');
        (document.body || root).appendChild(shield);
      }
      window.__codexInteractionShieldActive = true;
    };
    mount();
    window.addEventListener('DOMContentLoaded', mount);
    window.addEventListener('load', mount);
  });
  await page.evaluate(() => {
    const shieldId = '__codex_interaction_shield__';
    const styleId = '__codex_interaction_shield_style__';
    const root = document.head || document.body || document.documentElement;
    if (!root) return;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #${shieldId} {
          position: fixed;
          inset: 0;
          background: rgba(16,24,40,0.02);
          z-index: 2147483647;
          pointer-events: auto;
          cursor: not-allowed;
        }
      `;
      root.appendChild(style);
    }
    if (!document.getElementById(shieldId)) {
      const shield = document.createElement('div');
      shield.id = shieldId;
      shield.setAttribute('aria-hidden', 'true');
      (document.body || root).appendChild(shield);
    }
    window.__codexInteractionShieldActive = true;
  }).catch(() => {});
}

async function waitStable(page, ms = 800) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function domClick(locator) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.evaluate((el) => {
    if (el instanceof HTMLElement) el.click();
  });
}

async function domFill(locator, value) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.evaluate((el, v) => {
    const next = String(v);
    if (el instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      el.focus();
      setter?.call(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
      return;
    }
    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      el.focus();
      setter?.call(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    }
  }, value);
}

function asIssue(result) {
  return `- Test ID: ${result.id}\n- Role: ${result.role}\n- Page / Route: ${result.route}\n- Expected Result: ${result.expected}\n- Actual Result: ${result.actual}\n- Severity: \`${result.severity || 'Medium'}\`\n- Screenshot / Video: ${result.evidence || 'n/a'}\n- Repro Steps: ${result.action}\n- Notes: ${result.notes || ''}\n`;
}

function upsertTrackerRows(allResults) {
  const src = fs.readFileSync(trackerPath, 'utf8').split('\n');
  const byId = new Map(allResults.map((r) => [r.id, r]));
  const out = src.map((line) => {
    const m = line.match(/^\|\s*(OP-\d+)\s*\|/);
    if (!m) return line;
    const id = m[1];
    const result = byId.get(id);
    if (!result) return line;
    const cells = line.split('|');
    if (cells.length < 12) return line;
    cells[6] = ` ${result.actual || ''} `;
    cells[7] = ` ${result.status} `;
    cells[8] = ` ${result.severity || ''} `;
    cells[9] = ` ${result.evidence || ''} `;
    cells[10] = ` ${result.notes || ''} `;
    return cells.join('|');
  });
  fs.writeFileSync(trackerPath, out.join('\n'));
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await installInteractionShield(page);

  const state = {
    currentJobId: null,
    secondJobId: null,
    currentLotId: null,
  };

  async function runCase(input) {
    const { id, role, scenario, expected, route, actionText, severityOnFail = 'High', fn, criticalOnFail = false } = input;
    const routeLabel = route || page.url() || 'n/a';

    try {
      const actual = await fn();
      const result = {
        id,
        role,
        scenario,
        expected,
        actual: actual || 'Observed behavior matched expected result.',
        status: 'Pass',
        severity: '',
        evidence: '',
        notes: '',
        route: page.url() || routeLabel,
        action: actionText,
      };
      results.push(result);
      logStepOutput(`${id} - ${scenario}`, page.url() || routeLabel, actionText, 'Pass', 'n/a', '');
      return { blocked: false };
    } catch (error) {
      const screenshot = path.join(screenshotDir, `${id}.png`);
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      const message = clip(error instanceof Error ? error.message : String(error));
      const status = criticalOnFail ? 'Blocked' : 'Fail';
      const result = {
        id,
        role,
        scenario,
        expected,
        actual: message,
        status,
        severity: severityOnFail,
        evidence: screenshot,
        notes: criticalOnFail ? 'Critical blocker in prerequisite path.' : 'Failure observed in UAT step.',
        route: page.url() || routeLabel,
        action: actionText,
      };
      results.push(result);
      if (status !== 'Pass') {
        issues.push(asIssue(result));
      }
      logStepOutput(`${id} - ${scenario}`, page.url() || routeLabel, actionText, status, screenshot, message);
      await page.waitForTimeout(2500);
      return { blocked: criticalOnFail };
    }
  }

  // Preflight and auth
  const preflight = await runCase({
    id: 'OP-00',
    role: 'Operations Team',
    scenario: 'Preflight + authenticate for Operations UAT',
    expected: 'App opens and user session is available.',
    route: `${baseUrl}/rd`,
    actionText: 'Open /rd and resolve session (signup if redirected).',
    severityOnFail: 'Critical',
    criticalOnFail: true,
    fn: async () => {
      await page.goto(`${baseUrl}/rd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1200);
      if (page.url().includes('/login')) {
        const suffix = Date.now().toString();
        await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await domFill(page.getByLabel(/Company Name/i), `UAT Company ${suffix}`);
        await domFill(page.getByLabel(/Login Code/i), `uat${suffix.slice(-6)}`);
        await domFill(page.getByLabel(/Admin Email/i), `admin+${suffix}@test.local`);
        await domFill(page.getByLabel(/Password/i), 'Passw0rd!');
        await domClick(page.getByRole('button', { name: /Create Workspace/i }));
        await page.waitForURL(/\/admin|\/rd|\/jobs/, { timeout: 45000 });
        await page.goto(`${baseUrl}/rd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      await waitStable(page);
      return `Authenticated at ${page.url()}.`;
    },
  });
  if (preflight.blocked) {
    await finalize(context, browser);
    return;
  }

  await runCase({
    id: 'OP-01',
    role: 'Operations Team',
    scenario: 'Create a job with existing client from master',
    expected: 'Job created, job number generated, assignee visible, deadline visible.',
    route: `${baseUrl}/rd`,
    actionText: 'Open Create Job drawer, use existing client/material, submit.',
    severityOnFail: 'Critical',
    criticalOnFail: true,
    fn: async () => {
      await page.goto(`${baseUrl}/rd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1200);

      const clientRes = await page.evaluate(async () => {
        const response = await fetch('/api/masters/clients');
        const rows = await response.json().catch(() => []);
        return Array.isArray(rows) ? rows : [];
      });
      const itemRes = await page.evaluate(async () => {
        const response = await fetch('/api/masters/items');
        const rows = await response.json().catch(() => []);
        return Array.isArray(rows) ? rows : [];
      });
      if (!clientRes.length || !itemRes.length) {
        throw new Error('Master data missing (clients/items), cannot execute OP-01 with existing masters.');
      }

      await domClick(page.getByRole('button', { name: /^Create Job$/i }).first());
      await waitStable(page, 800);

      const customerInput = page.getByPlaceholder(/Type customer name/i).first();
      const materialInput = page.getByPlaceholder(/Type material name/i).first();
      const saveButton = page.locator("[role='dialog'] button:has-text('Create Job')").first();

      await domFill(customerInput, clientRes[0].clientName);
      await domFill(materialInput, itemRes[0].itemName);

      const materialType = String(itemRes[0].materialType || 'INHOUSE').toUpperCase();
      const mtButton = materialType === 'TRADED'
        ? page.getByRole('button', { name: /Traded material/i }).first()
        : page.getByRole('button', { name: /In-house material/i }).first();
      await domClick(mtButton);

      await domClick(saveButton);
      await page.waitForURL(/\/jobs\/[^/]+\/workflow/, { timeout: 30000 });
      await waitStable(page, 1000);

      const m = page.url().match(/\/jobs\/([^/]+)\/workflow/);
      state.currentJobId = m?.[1] || null;
      if (!state.currentJobId) throw new Error('Job created but workflow jobId not found in URL.');

      const assigned = await page.getByLabel(/Assigned user/i).first().inputValue().catch(() => '');
      if (!assigned) throw new Error('Assigned user field is empty after job creation.');
      return `Created job ${state.currentJobId}; assigned user visible.`;
    },
  });

  await runCase({
    id: 'OP-02',
    role: 'Operations Team',
    scenario: 'Create job when client is not in master',
    expected: 'Add New Client inline appears and new client is selectable immediately.',
    route: `${baseUrl}/rd`,
    actionText: 'Create second job by adding a new inline customer in drawer.',
    severityOnFail: 'High',
    fn: async () => {
      await page.goto(`${baseUrl}/rd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1000);
      await domClick(page.getByRole('button', { name: /^Create Job$/i }).first());
      const uniqueName = `UAT New Client ${Date.now()}`;
      await domFill(page.getByPlaceholder(/Type customer name/i).first(), uniqueName);

      const addButton = page.getByRole('button', { name: /Add ".*" as new customer/i }).first();
      if (!(await addButton.isVisible().catch(() => false))) {
        throw new Error('Inline Add New Client action did not appear for unknown customer name.');
      }
      await domClick(addButton);
      await waitStable(page, 1500);

      const items = await page.evaluate(async () => {
        const response = await fetch('/api/masters/items');
        const rows = await response.json().catch(() => []);
        return Array.isArray(rows) ? rows : [];
      });
      if (!items.length) throw new Error('No material master available for OP-02.');
      await domFill(page.getByPlaceholder(/Type material name/i).first(), items[0].itemName);
      await domClick(page.getByRole('button', { name: /In-house material|Traded material/i }).first());
      await domClick(page.locator("[role='dialog'] button:has-text('Create Job')").first());
      await page.waitForURL(/\/jobs\/[^/]+\/workflow/, { timeout: 30000 });
      const m = page.url().match(/\/jobs\/([^/]+)\/workflow/);
      state.secondJobId = m?.[1] || null;
      return `Inline new client created and job ${state.secondJobId || ''} submitted.`;
    },
  });

  await runCase({
    id: 'OP-03',
    role: 'Operations Team',
    scenario: 'Check job fields',
    expected: 'Necessary fields shown first; client/material/type present and usable.',
    route: `${baseUrl}/rd`,
    actionText: 'Open Create Job drawer and verify key fields and save gating.',
    severityOnFail: 'Medium',
    fn: async () => {
      await page.goto(`${baseUrl}/rd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 800);
      await domClick(page.getByRole('button', { name: /^Create Job$/i }).first());
      const customer = page.getByPlaceholder(/Type customer name/i).first();
      const material = page.getByPlaceholder(/Type material name/i).first();
      const mt = page.getByRole('button', { name: /In-house material/i }).first();
      const save = page.locator("[role='dialog'] button:has-text('Create Job')").first();
      if (!(await customer.isVisible())) throw new Error('Customer field missing in drawer.');
      if (!(await material.isVisible())) throw new Error('Material field missing in drawer.');
      if (!(await mt.isVisible())) throw new Error('Material type button missing.');
      if (!(await save.isDisabled())) throw new Error('Create Job save should be disabled before required fields.');
      await domClick(page.locator("[role='dialog'] button:has-text('Cancel')").first());
      return 'Core job creation fields and disabled gating present.';
    },
  });

  await runCase({
    id: 'OP-04',
    role: 'Operations Team',
    scenario: 'Verify auto assignment logic',
    expected: 'Creator becomes assignee by default if no assignee selected.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=job`,
    actionText: 'Open Job Basics and verify Assigned user is populated by default.',
    severityOnFail: 'High',
    fn: async () => {
      if (!state.currentJobId) throw new Error('No job available from OP-01 for assignment check.');
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=job`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1000);
      const assigned = await page.getByLabel(/Assigned user/i).first().inputValue().catch(() => '');
      if (!assigned || /not available/i.test(assigned)) {
        throw new Error('Assigned user is empty/unavailable.');
      }
      return `Assigned user populated as '${assigned}'.`;
    },
  });

  await runCase({
    id: 'OP-05',
    role: 'Operations Team',
    scenario: 'Verify deadline behavior',
    expected: 'Deadline saves and remains visible after reload.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=job`,
    actionText: 'Set deadline, save job basics, reload and verify deadline persisted.',
    severityOnFail: 'High',
    fn: async () => {
      if (!state.currentJobId) throw new Error('No job available for deadline test.');
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=job`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      const deadlineInput = page.locator("input[type='date']").first();
      const deadline = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await domFill(deadlineInput, deadline);
      await domClick(page.getByRole('button', { name: /^Save Job$/i }).first());
      await waitStable(page, 1200);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1200);
      const saved = await deadlineInput.inputValue();
      if (saved !== deadline) throw new Error(`Deadline mismatch. expected=${deadline} actual=${saved}`);
      return `Deadline ${deadline} persisted after reload.`;
    },
  });

  await runCase({
    id: 'OP-06',
    role: 'Operations Team',
    scenario: 'Create lot manually',
    expected: 'Lot added under correct job with visible lot number.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=lots`,
    actionText: 'Open lots section, enter lot details, click Add Lot.',
    severityOnFail: 'Critical',
    criticalOnFail: true,
    fn: async () => {
      if (!state.currentJobId) throw new Error('No job available for lot creation.');
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=lots`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1000);
      const lotNo = `LOT-UAT-${Date.now().toString().slice(-5)}`;
      await domFill(page.getByLabel(/Lot Number/i).first(), lotNo);
      await domFill(page.getByLabel(/Material Name/i).first(), `Lot Material ${Date.now().toString().slice(-4)}`);
      await domFill(page.getByLabel(/Total Bags/i).first(), '1');
      await domClick(page.getByRole('button', { name: /^Add Lot$/i }).first());
      await waitStable(page, 1500);
      const lotButton = page.getByRole('button', { name: new RegExp(lotNo) }).first();
      if (!(await lotButton.isVisible().catch(() => false))) throw new Error(`Lot ${lotNo} not visible after creation.`);
      const wf = await page.evaluate(async (jobId) => {
        const r = await fetch(`/api/jobs/${jobId}/workflow`);
        return r.ok ? await r.json() : null;
      }, state.currentJobId);
      const lot = wf?.job?.lots?.find((l) => l.lotNumber === lotNo);
      state.currentLotId = lot?.id || null;
      return `Manual lot ${lotNo} created and linked.`;
    },
  });

  await runCase({
    id: 'OP-07',
    role: 'Operations Team',
    scenario: 'Create lot with auto lot numbering enabled',
    expected: 'System auto-generates lot number when setting enabled.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=lots`,
    actionText: 'Check whether lot number input is read-only (auto numbering enabled).',
    severityOnFail: 'Low',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=lots`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 700);
      const lotInput = page.getByLabel(/Lot Number/i).first();
      const readonly = await lotInput.isEditable().then((editable) => !editable).catch(() => false);
      if (!readonly) {
        throw new Error('Auto lot numbering is not enabled in current environment (input editable).');
      }
      return 'Auto lot numbering appears enabled (Lot Number read-only).';
    },
  });

  await runCase({
    id: 'OP-08',
    role: 'Operations Team',
    scenario: 'Create multi-weight lot',
    expected: 'Multi-weight mode shows bag-row guidance and saves lot.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=lots`,
    actionText: 'Set Quantity Mode to Multi-weight and verify guidance.',
    severityOnFail: 'Medium',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=lots`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 700);
      await page.getByLabel(/Quantity Mode/i).first().selectOption('MULTI_WEIGHT');
      await waitStable(page, 400);
      const guidance = page.getByText(/Multi-weight lots capture gross\/net\/tare per bag row/i).first();
      if (!(await guidance.isVisible().catch(() => false))) throw new Error('Multi-weight guidance text missing.');
      return 'Multi-weight mode guidance visible.';
    },
  });

  await runCase({
    id: 'OP-09',
    role: 'Operations Team',
    scenario: 'Create multiple lots in one job',
    expected: 'All lots visible and current lot context is clear.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=lots`,
    actionText: 'Create another lot and verify multiple lot chips/buttons.',
    severityOnFail: 'Medium',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=lots`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      const lotNo = `LOT-UAT-${Date.now().toString().slice(-5)}`;
      await page.getByLabel(/Quantity Mode/i).first().selectOption('SINGLE_PIECE');
      await domFill(page.getByLabel(/Lot Number/i).first(), lotNo);
      await domFill(page.getByLabel(/Material Name/i).first(), `Second Lot Material`);
      await domFill(page.getByLabel(/Total Bags/i).first(), '1');
      await domClick(page.getByRole('button', { name: /^Add Lot$/i }).first());
      await waitStable(page, 1300);
      const lotButtons = await page.locator("button").filter({ hasText: /LOT-/i }).count();
      if (lotButtons < 2) throw new Error(`Expected multiple lots, found ${lotButtons}.`);
      return `Multiple lots visible (${lotButtons}).`;
    },
  });

  await runCase({
    id: 'OP-10',
    role: 'Operations Team',
    scenario: 'Upload/capture required proof images',
    expected: 'Required image cards/statuses visible; upload works.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=images`,
    actionText: 'Open images section and upload first required image.',
    severityOnFail: 'High',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=images`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1000);
      const uploadBtn = page.getByRole('button', { name: /Upload Images/i }).first();
      if (!(await uploadBtn.isVisible().catch(() => false))) throw new Error('No Upload Images action visible.');
      await domClick(uploadBtn);
      const fileInput = page.locator("input[type='file']").first();
      await fileInput.setInputFiles(uploadPngPath);
      await waitStable(page, 2000);
      return 'Image upload action executed for one required category.';
    },
  });

  await runCase({
    id: 'OP-11',
    role: 'Operations Team',
    scenario: 'Check timestamp behavior if enabled',
    expected: 'Timestamp appears on image when enabled.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=images`,
    actionText: 'Check timestamp requirement indicator and infer behavior.',
    severityOnFail: 'Low',
    fn: async () => {
      const tsText = page.getByText(/Timestamp overlay is enabled/i).first();
      if (!(await tsText.isVisible().catch(() => false))) {
        throw new Error('Timestamp setting appears disabled; timestamp behavior not verifiable in this run.');
      }
      return 'Timestamp enabled indicator is visible.';
    },
  });

  await runCase({
    id: 'OP-12',
    role: 'Operations Team',
    scenario: 'Leave required image missing',
    expected: 'Missing proof blocker shown; cannot proceed.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=decision`,
    actionText: 'Open Final Decision and verify missing-proof blocker or disabled submit.',
    severityOnFail: 'High',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=decision`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      const blocker = page.getByText(/Missing required proof:/i).first();
      const submit = page.getByRole('button', { name: /Submit for Decision/i }).first();
      const blockerVisible = await blocker.isVisible().catch(() => false);
      const submitDisabled = await submit.isDisabled().catch(() => false);
      if (!blockerVisible && !submitDisabled) {
        throw new Error('No missing-proof blocker and submit not disabled while required images are still missing.');
      }
      return 'Missing proof blocker behavior observed.';
    },
  });

  await runCase({
    id: 'OP-13',
    role: 'Operations Team',
    scenario: 'Check optional image handling',
    expected: 'Optional image section follows settings without confusing blank state.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=images`,
    actionText: 'Inspect optional image section visibility/clarity.',
    severityOnFail: 'Low',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=images`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 700);
      const optionalHeader = page.getByText(/Optional Images/i).first();
      const hasOptional = await optionalHeader.isVisible().catch(() => false);
      return hasOptional ? 'Optional images section shown with labels.' : 'Optional images section hidden by settings; no broken blank state.';
    },
  });

  await runCase({
    id: 'OP-14',
    role: 'Operations Team',
    scenario: 'Submit for final decision',
    expected: 'Lot can be submitted for decision with clear state.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=decision`,
    actionText: 'Upload required images then submit for decision.',
    severityOnFail: 'High',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=images`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 800);
      const uploadButtons = page.getByRole('button', { name: /Upload Images/i });
      const count = await uploadButtons.count();
      for (let i = 0; i < count; i += 1) {
        await domClick(uploadButtons.nth(i));
        await page.locator("input[type='file']").first().setInputFiles(uploadPngPath);
        await waitStable(page, 300);
      }
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=decision`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 1000);
      const submit = page.getByRole('button', { name: /Submit for Decision/i }).first();
      if (await submit.isDisabled().catch(() => false)) {
        throw new Error('Submit for Decision remains disabled after image upload attempt.');
      }
      await domClick(submit);
      await waitStable(page, 900);
      return 'Submit for Decision action executed.';
    },
  });

  await runCase({
    id: 'OP-15',
    role: 'Manager Team/Admin Team',
    scenario: 'Pass decision',
    expected: 'Workflow moves forward correctly after Pass.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=decision`,
    actionText: 'Click Pass and verify current decision reflects READY_FOR_SAMPLING.',
    severityOnFail: 'High',
    fn: async () => {
      await domClick(page.getByRole('button', { name: /^Pass$/i }).first());
      await waitStable(page, 900);
      const current = page.getByText(/Current Decision:\s*READY FOR SAMPLING/i).first();
      if (!(await current.isVisible().catch(() => false))) {
        throw new Error('Pass decision did not update current decision display.');
      }
      return 'Pass decision updated current decision state.';
    },
  });

  await runCase({
    id: 'OP-16',
    role: 'Manager Team/Admin Team',
    scenario: 'Hold decision',
    expected: 'Hold applies and downstream becomes blocked.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=decision`,
    actionText: 'Click Hold and check hold state/gating.',
    severityOnFail: 'Medium',
    fn: async () => {
      await domClick(page.getByRole('button', { name: /^Hold$/i }).first());
      await waitStable(page, 900);
      const hold = page.getByText(/Current Decision:\s*ON HOLD/i).first();
      if (!(await hold.isVisible().catch(() => false))) throw new Error('Hold decision state not shown.');
      return 'Hold decision state shown.';
    },
  });

  await runCase({
    id: 'OP-17',
    role: 'Manager Team/Admin Team',
    scenario: 'Reject decision',
    expected: 'Reject applies and downstream becomes blocked.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=decision`,
    actionText: 'Click Reject and verify reject state.',
    severityOnFail: 'Medium',
    fn: async () => {
      await domClick(page.getByRole('button', { name: /^Reject$/i }).first());
      await waitStable(page, 900);
      const rejected = page.getByText(/Current Decision:\s*REJECTED/i).first();
      if (!(await rejected.isVisible().catch(() => false))) throw new Error('Reject decision state not shown.');
      // restore pass for downstream sampling tests
      await domClick(page.getByRole('button', { name: /^Pass$/i }).first());
      await waitStable(page, 900);
      return 'Reject decision tested and pass restored for downstream flow.';
    },
  });

  await runCase({
    id: 'OP-18',
    role: 'Operations Team',
    scenario: 'Create sample after pass',
    expected: 'Sample starts and links to lot/job.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=sampling`,
    actionText: 'Open sampling and click Start Sampling.',
    severityOnFail: 'Critical',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=sampling`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      const start = page.getByRole('button', { name: /Start Sampling/i }).first();
      if (await start.isVisible().catch(() => false)) {
        await domClick(start);
        await waitStable(page, 1000);
      }
      const sampleId = await page.getByLabel(/Sample ID/i).first().inputValue().catch(() => '');
      if (!sampleId) throw new Error('Sample ID not present after starting sampling.');
      return `Sample initialized with ID ${sampleId}.`;
    },
  });

  await runCase({
    id: 'OP-19',
    role: 'Operations Team',
    scenario: 'Verify container type dropdown',
    expected: 'Container type values visible and selection saves.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=sampling`,
    actionText: 'Pick container type and save sampling.',
    severityOnFail: 'Medium',
    fn: async () => {
      const select = page.getByLabel(/Container Type/i).first();
      const options = await select.locator('option').count();
      if (options < 2) throw new Error('Container type options are not available.');
      await select.selectOption({ index: 1 });
      await domClick(page.getByRole('button', { name: /^Save Sampling$/i }).first());
      await waitStable(page, 900);
      return `Container type options available (${options}) and save action executed.`;
    },
  });

  await runCase({
    id: 'OP-20',
    role: 'Operations Team',
    scenario: 'Check homogeneous proof flow',
    expected: 'Homogeneous proof requirement behavior is clear.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=sampling`,
    actionText: 'Inspect homogeneous proof button state.',
    severityOnFail: 'Low',
    fn: async () => {
      const btn = page.getByRole('button', { name: /Mark Homogeneous Proof/i }).first();
      if (!(await btn.isVisible().catch(() => false))) throw new Error('Homogeneous proof action is not visible.');
      return (await btn.isDisabled().catch(() => false))
        ? 'Homogeneous proof action shown but disabled by settings.'
        : 'Homogeneous proof action shown and enabled.';
    },
  });

  await runCase({
    id: 'OP-21',
    role: 'Operations Team',
    scenario: 'Capture sampling photos',
    expected: 'During Sampling Photo and Sample Completion can be captured.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=sampling`,
    actionText: 'Attempt to identify sampling photo capture controls.',
    severityOnFail: 'Medium',
    fn: async () => {
      const hasCapture = await page.getByRole('button', { name: /Upload|Capture/i }).count();
      if (hasCapture === 0) {
        throw new Error('No explicit sampling photo capture control found in this section for automated run.');
      }
      return 'Sampling photo capture/upload controls are present.';
    },
  });

  await runCase({
    id: 'OP-22',
    role: 'Operations Team',
    scenario: 'Seal on bag with seal available',
    expected: 'Scan seal flow is visible and usable.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=seal`,
    actionText: 'Open seal section and verify scan/manual controls appear.',
    severityOnFail: 'High',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=seal`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      const hasScan = (await page.getByText(/Scan Seal|scan/i).count()) > 0;
      const hasManual = (await page.getByText(/Manual/i).count()) > 0 || (await page.locator("input[placeholder*='seal' i]").count()) > 0;
      if (!hasScan && !hasManual) throw new Error('Seal scan/manual controls not visible.');
      return 'Seal scan/fallback controls are visible.';
    },
  });

  await runCase({
    id: 'OP-23',
    role: 'Operations Team',
    scenario: 'Seal not available path',
    expected: 'Fallback path available without immediate hard failure.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=seal`,
    actionText: 'Validate manual/fallback seal entry path exists.',
    severityOnFail: 'Medium',
    fn: async () => {
      const manualInputCount = await page.locator("input[placeholder*='seal' i], input[aria-label*='seal' i]").count();
      if (manualInputCount === 0) throw new Error('Manual seal fallback path not detected.');
      return 'Manual fallback path for seal entry detected.';
    },
  });

  await runCase({
    id: 'OP-24',
    role: 'Operations Team',
    scenario: 'Generate seal numbers after sampling',
    expected: 'Seal table contains Lot No, Bag No, Weight, Gross, Net, Seal No.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=seal`,
    actionText: 'Validate seal table headers and optionally trigger Generate Seal Numbers.',
    severityOnFail: 'Medium',
    fn: async () => {
      const headers = ['Lot No', 'Bag No', 'Weight', 'Gross', 'Net', 'Seal No'];
      for (const h of headers) {
        if (!(await page.getByRole('columnheader', { name: new RegExp(h, 'i') }).first().isVisible().catch(() => false))) {
          throw new Error(`Missing seal table header: ${h}`);
        }
      }
      const generate = page.getByRole('button', { name: /Generate Seal Numbers/i }).first();
      if (await generate.isVisible().catch(() => false)) {
        await domClick(generate);
        await waitStable(page, 900);
      }
      return 'Seal table columns verified.';
    },
  });

  await runCase({
    id: 'OP-25',
    role: 'Admin Team',
    scenario: 'Admin-only edit behavior',
    expected: 'Only admin can edit generated/scanned seal when rule enabled.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=seal`,
    actionText: 'Check current role and note inability to validate non-admin restriction in single-role run.',
    severityOnFail: 'Low',
    fn: async () => {
      const me = await page.evaluate(async () => {
        const r = await fetch('/api/session/me');
        return r.ok ? await r.json() : null;
      });
      if (!me?.role) throw new Error('Session role unavailable for admin-only behavior check.');
      if (String(me.role).toUpperCase() === 'ADMIN') {
        throw new Error('Running as Admin only; non-admin restriction cannot be validated in this session.');
      }
      return `Non-admin role '${me.role}' session available for restriction check.`;
    },
  });

  await runCase({
    id: 'OP-26',
    role: 'Operations Team',
    scenario: 'Create packet rows',
    expected: 'Packet rows are created correctly and IDs visible.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=packets`,
    actionText: 'Open packets section and add a manual draft packet row.',
    severityOnFail: 'High',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=packets`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      await domClick(page.getByRole('button', { name: /Manual Add Packet/i }).first());
      await waitStable(page, 600);
      const row = page.locator('tbody tr').filter({ hasText: /Draft Packet/i }).first();
      if (!(await row.isVisible().catch(() => false))) throw new Error('Draft packet row was not created.');
      return 'Draft packet row created.';
    },
  });

  await runCase({
    id: 'OP-27',
    role: 'Operations Team',
    scenario: 'Packet requires weight',
    expected: 'Cannot create packet without packet weight.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=packets`,
    actionText: 'Attempt Create Packets with incomplete draft row.',
    severityOnFail: 'High',
    fn: async () => {
      await domClick(page.getByRole('button', { name: /^Create Packets$/i }).first());
      await waitStable(page, 700);
      const warn = page.getByText(/Packet draft incomplete|requires weight|requires weight, unit, and packet use/i).first();
      if (!(await warn.isVisible().catch(() => false))) {
        throw new Error('No validation warning shown for missing packet weight/use.');
      }
      return 'Packet validation warning shown when required fields missing.';
    },
  });

  await runCase({
    id: 'OP-28',
    role: 'Operations Team',
    scenario: 'Packet unit saved correctly',
    expected: 'Unit required and visible after packet creation.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=packets`,
    actionText: 'Fill draft weight/use/unit and create packets.',
    severityOnFail: 'High',
    fn: async () => {
      const row = page.locator('tbody tr').filter({ hasText: /Draft Packet/i }).first();
      await domFill(row.locator('input').first(), '1.5');
      const selects = row.locator('select');
      const selectCount = await selects.count();
      if (selectCount < 2) throw new Error('Expected unit and packet-use selects in draft row.');
      await selects.nth(0).selectOption('KG');
      await selects.nth(1).selectOption('TESTING');
      await domClick(page.getByRole('button', { name: /^Create Packets$/i }).first());
      await waitStable(page, 1200);
      const created = page.getByText(/Packets created/i).first();
      if (!(await created.isVisible().catch(() => false))) {
        throw new Error('Packet creation success confirmation not visible.');
      }
      return 'Packet created with unit and use populated.';
    },
  });

  await runCase({
    id: 'OP-29',
    role: 'Operations Team',
    scenario: 'Submit to R&D',
    expected: 'Flow ends correctly, packets submitted to R&D.',
    route: `${baseUrl}/jobs/${state.currentJobId || ''}/workflow?section=handover`,
    actionText: 'Open Submit to R&D section, choose assignee and submit.',
    severityOnFail: 'Critical',
    fn: async () => {
      await page.goto(`${baseUrl}/jobs/${state.currentJobId}/workflow?section=handover`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitStable(page, 900);
      const assignee = page.getByLabel(/Hand Over To/i).first();
      const options = await assignee.locator('option').count();
      if (options < 2) throw new Error('No R&D assignee options available for handoff.');
      await assignee.selectOption({ index: 1 });
      const submit = page.getByRole('button', { name: /Submit to R&D/i }).first();
      if (await submit.isDisabled().catch(() => true)) {
        throw new Error('Submit to R&D is disabled after selecting assignee (packet readiness may be incomplete).');
      }
      await domClick(submit);
      await waitStable(page, 1200);
      const ok = page.getByText(/Submitted to R&D/i).first();
      if (!(await ok.isVisible().catch(() => false))) {
        throw new Error('Submit to R&D confirmation not visible.');
      }
      return 'Submit to R&D succeeded.';
    },
  });

  async function finalize(contextObj, browserObj) {
    const statusCount = results.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      { Pass: 0, Fail: 0, Blocked: 0 },
    );

    const summary = {
      runId,
      startedAt: runId,
      finishedAt: nowIso(),
      baseUrl,
      statusCount,
      resultRows: results,
      issueCount: issues.length,
      artifactRoot: rootDir,
      trackerPath,
      issueTemplatePath,
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    const issueDoc = [
      '# Batch 1: Operations issues',
      '',
      `Run artifact root: ${rootDir}`,
      '',
      ...(issues.length ? issues : ['No Fail/Blocked issue entries in this run.']),
      '',
    ].join('\n');
    fs.writeFileSync(batchIssuePath, issueDoc);

    upsertTrackerRows(results.filter((r) => r.id.startsWith('OP-')));

    await contextObj.close().catch(() => {});
    await browserObj.close().catch(() => {});

    console.log(`UAT artifacts root: ${rootDir}`);
    console.log(`Tracker updated: ${trackerPath}`);
    console.log(`Issue batch file: ${batchIssuePath}`);
    console.log(`Summary JSON: ${summaryPath}`);
  }

  await finalize(context, browser);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
