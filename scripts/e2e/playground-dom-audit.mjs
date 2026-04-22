#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const TEMPLATE_STEPS = [
  "Sample Intake & Custody",
  "Sample Characterization",
  "Pre-treatment",
  "Leaching",
  "Solid-Liquid Separation",
  "Impurity Removal",
  "Ni / Co Separation",
  "Lithium Recovery",
  "Purification & Polishing",
  "Concentration / Crystallization",
  "Product Quality Check",
  "Release / Archive",
];

function getArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

async function writeSnapshot(rootDir, name, page) {
  const body = page.locator("body");
  const text = await body.innerText({ timeout: 10000 }).catch(() => "");
  const html = await body.evaluate((el) => el.outerHTML).catch(() => "");
  const fileBase = name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase();
  const textPath = path.join(rootDir, `${fileBase}.txt`);
  const htmlPath = path.join(rootDir, `${fileBase}.html`);
  fs.writeFileSync(textPath, text);
  fs.writeFileSync(htmlPath, html);
  console.log(`[PLAYGROUND-DOM] snapshot=${name}`);
  console.log(text.slice(0, 1200));
  console.log("");
}

async function clickFirstEnabled(page, pattern) {
  const buttons = page.getByRole("button", { name: pattern });
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (await button.isEnabled().catch(() => false)) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function main() {
  const argv = process.argv.slice(2);
  const baseUrl = getArgValue(argv, "--base-url") || process.env.REPRO_BASE_URL || "http://127.0.0.1:3000";
  const slowMoMs = Number(getArgValue(argv, "--slow-mo") || "250");
  const jobId = getArgValue(argv, "--job-id");
  const pauseAfter = true;

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const rootDir = path.join(process.cwd(), "tmp", "playground-dom-audit", runId);
  fs.mkdirSync(rootDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    slowMo: Number.isFinite(slowMoMs) ? slowMoMs : 250,
    env: {
      ...process.env,
      HOME: "/tmp/codex-playwright-home",
      XDG_CONFIG_HOME: "/tmp/codex-playwright-home/.config",
      XDG_CACHE_HOME: "/tmp/codex-playwright-home/.cache",
    },
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    const url = jobId ? `${baseUrl}/playground?jobId=${encodeURIComponent(jobId)}` : `${baseUrl}/playground`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("heading", { name: /Sample Process Control/i }).waitFor({ state: "visible", timeout: 15000 });
    await writeSnapshot(rootDir, "01-loaded", page);

    const workButton = page.getByRole("button", { name: /Open Work/i }).first();
    if (await workButton.isVisible().catch(() => false)) {
      await workButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await writeSnapshot(rootDir, "02-opened-work", page);
    }

    const applyButton = page.getByRole("button", { name: /^Apply$/i }).first();
    if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click();
      await writeSnapshot(rootDir, "03-template-applied", page);
    }

    const addProcessButton = page.getByRole("button", { name: /Add Step \/ Process/i }).first();
    if (await addProcessButton.isVisible().catch(() => false)) {
      await addProcessButton.click();
      await writeSnapshot(rootDir, "04-builder-opened", page);
    }

    const validateButton = page.getByRole("button", { name: /Validate Process/i }).first();
    if (await validateButton.isVisible().catch(() => false)) {
      await validateButton.click();
      await writeSnapshot(rootDir, "05-validated", page);
    }

    const startButton = page.getByRole("button", { name: /Start Processing/i }).first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await writeSnapshot(rootDir, "06-started-processing", page);
    }

    for (const stepName of TEMPLATE_STEPS.slice(0, 4)) {
      const stepNode = page.getByText(stepName, { exact: true }).first();
      if (await stepNode.isVisible().catch(() => false)) {
        await stepNode.click();
      }

      await clickFirstEnabled(page, /^Start$/i);
      await page.waitForTimeout(1000);
      await writeSnapshot(rootDir, `step-${stepName}`, page);

      await clickFirstEnabled(page, /^Complete$/i);
      await page.waitForTimeout(600);
      await writeSnapshot(rootDir, `step-${stepName}-complete`, page);
    }

    const createResultButton = page.getByRole("button", { name: /Create Result/i }).first();
    if (await createResultButton.isVisible().catch(() => false)) {
      await createResultButton.click();
      await writeSnapshot(rootDir, "07-result-created", page);
    }

    const selectResultButton = page.getByRole("button", { name: /Select Result/i }).first();
    if (await selectResultButton.isVisible().catch(() => false)) {
      await selectResultButton.click();
      await writeSnapshot(rootDir, "08-result-selected", page);
    }

    const releaseButton = page.getByRole("button", { name: /Release Record/i }).first();
    if (await releaseButton.isVisible().catch(() => false)) {
      await releaseButton.click();
      await writeSnapshot(rootDir, "09-released", page);
    }

    console.log(`[PLAYGROUND-DOM] captured to ${rootDir}`);

    if (pauseAfter) {
      console.log("[PLAYGROUND-DOM] Browser paused for manual inspection.");
      await page.pause();
    }
  } finally {
    if (!pauseAfter) {
      await browser.close().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
