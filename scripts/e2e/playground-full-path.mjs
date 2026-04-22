#!/usr/bin/env node

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

function hasArg(argv, flag) {
  return argv.includes(flag);
}

async function waitForVisible(locator, timeout = 15000) {
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

async function clickFirstEnabledByRole(page, namePattern) {
  const buttons = page.getByRole("button", { name: namePattern });
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
  const pauseAfter = !hasArg(argv, "--no-pause");
  const jobId = getArgValue(argv, "--job-id");

  const browser = await chromium.launch({
    headless: false,
    slowMo: Number.isFinite(slowMoMs) ? slowMoMs : 250,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    const url = jobId ? `${baseUrl}/playground?jobId=${encodeURIComponent(jobId)}` : `${baseUrl}/playground`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForVisible(page.getByRole("heading", { name: /Sample Process Control/i }).first());
    console.log(`[PLAYGROUND-FULL] Opened ${page.url()}`);

    const openWork = page.getByRole("button", { name: /Open Work/i }).first();
    if (await openWork.isVisible().catch(() => false)) {
      await openWork.click();
      console.log("[PLAYGROUND-FULL] Opened accepted work queue item");
    }

    const applyTemplate = page.getByRole("button", { name: /^Apply$/i }).first();
    if (await applyTemplate.isVisible().catch(() => false)) {
      await applyTemplate.click();
      console.log("[PLAYGROUND-FULL] Applied whole-process template");
    }

    const addStepProcess = page.getByRole("button", { name: /Add Step \/ Process/i }).first();
    if (await addStepProcess.isVisible().catch(() => false)) {
      await addStepProcess.click();
      console.log("[PLAYGROUND-FULL] Opened process drawer");

      const durationInputs = page.locator("input[type='number']");
      const durationCount = await durationInputs.count();
      if (durationCount > 0) {
        await durationInputs.first().fill("1");
        console.log("[PLAYGROUND-FULL] Normalized first visible duration to 1s");
      }
    }

    const validate = page.getByRole("button", { name: /Validate Process/i }).first();
    if (await validate.isVisible().catch(() => false)) {
      await validate.click();
      console.log("[PLAYGROUND-FULL] Validated process");
    }

    const startProcessing = page.getByRole("button", { name: /Start Processing/i }).first();
    if (await startProcessing.isVisible().catch(() => false)) {
      await startProcessing.click();
      console.log("[PLAYGROUND-FULL] Started processing");
    }

    for (const stepName of TEMPLATE_STEPS) {
      const stepCard = page.getByText(stepName, { exact: true }).first();
      if (await stepCard.isVisible().catch(() => false)) {
        await stepCard.click();
        console.log(`[PLAYGROUND-FULL] Selected step: ${stepName}`);
      }

      const startClicked = await clickFirstEnabledByRole(page, /^Start$/i);
      if (startClicked) {
        console.log(`[PLAYGROUND-FULL] Started current step: ${stepName}`);
      }

      await page.waitForTimeout(1200);

      const completeClicked = await clickFirstEnabledByRole(page, /^Complete$/i);
      if (completeClicked) {
        console.log(`[PLAYGROUND-FULL] Completed current step: ${stepName}`);
      }

      await page.waitForTimeout(500);
    }

    const createResult = page.getByRole("button", { name: /Create Result/i }).first();
    if (await createResult.isVisible().catch(() => false)) {
      await createResult.click();
      console.log("[PLAYGROUND-FULL] Created result record");
    }

    const selectResult = page.getByRole("button", { name: /Select Result/i }).first();
    if (await selectResult.isVisible().catch(() => false)) {
      await selectResult.click();
      console.log("[PLAYGROUND-FULL] Selected final result");
    }

    const releaseRecord = page.getByRole("button", { name: /Release Record/i }).first();
    if (await releaseRecord.isVisible().catch(() => false)) {
      await releaseRecord.click();
      console.log("[PLAYGROUND-FULL] Released record");
    }

    const domText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    console.log("[PLAYGROUND-FULL] DOM snapshot:");
    console.log(domText.slice(0, 1400));

    if (pauseAfter) {
      console.log("[PLAYGROUND-FULL] Pausing browser for interactive inspection.");
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
