#!/usr/bin/env node

import { chromium } from "playwright";

function getArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

function hasArg(argv, flag) {
  return argv.includes(flag);
}

async function waitForVisible(page, locator, timeout = 15000) {
  await locator.waitFor({ state: "visible", timeout });
  return locator;
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

    const title = page.getByRole("heading", { name: /Sample Process Control/i }).first();
    await waitForVisible(page, title);

    console.log(`[PLAYGROUND] Opened ${page.url()}`);

    const workCard = page.getByRole("button", { name: /Open Work/i }).first();
    if (await workCard.isVisible().catch(() => false)) {
      await workCard.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      console.log("[PLAYGROUND] Opened first accepted work item");
    }

    const processTemplateCard = page.getByRole("button", { name: /^Apply$/i }).first();
    if (await processTemplateCard.isVisible().catch(() => false)) {
      await processTemplateCard.click();
      console.log("[PLAYGROUND] Applied first whole-process template");
    }

    const addStepButton = page.getByRole("button", { name: /Add Step \/ Process/i }).first();
    if (await addStepButton.isVisible().catch(() => false)) {
      await addStepButton.click();
      await page.getByText(/Process Stages/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      console.log("[PLAYGROUND] Opened process builder drawer");
    }

    const inspectButton = page.getByRole("button", { name: /Inspect/i }).first();
    if (await inspectButton.isVisible().catch(() => false)) {
      await inspectButton.click();
      await page.getByText(/Inspector/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      console.log("[PLAYGROUND] Opened inspector drawer");
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    console.log("[PLAYGROUND] DOM snapshot:");
    console.log(bodyText.slice(0, 1200));

    if (pauseAfter) {
      console.log("[PLAYGROUND] Pausing browser for interactive inspection. Resume/close the inspector to continue.");
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
