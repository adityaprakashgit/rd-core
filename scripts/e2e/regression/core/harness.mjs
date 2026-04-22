import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const LABEL_TO_CATEGORY_KEY_MAP = {
  "Bag photo with visible bag no": "BAG_WITH_LOT_NO",
  "Material in bag": "MATERIAL_VISIBLE",
  "During Sampling Photo": "SAMPLING_IN_PROGRESS",
  "Sample Completion": "SEALED_BAG",
  "Seal on bag": "SEAL_CLOSEUP",
  "Bag condition": "BAG_CONDITION",
  "Whole batch photo": "LOT_OVERVIEW",
  "Bag with lot number": "BAG_WITH_LOT_NO",
  "Material visible": "MATERIAL_VISIBLE",
  "Sampling in progress": "SAMPLING_IN_PROGRESS",
  "Sealed bag": "SEALED_BAG",
  "Seal close-up": "SEAL_CLOSEUP",
  "Lot overview photo": "LOT_OVERVIEW",
  "Sampling before photo": "BEFORE",
  "Sampling during photo": "DURING",
  "Sampling after photo": "AFTER",
  "Bag photo": "BAG",
  "Seal photo": "SEAL",
};

function clip(text, max = 1600) {
  if (typeof text !== "string") return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function toCategoryKey(label) {
  if (LABEL_TO_CATEGORY_KEY_MAP[label]) return LABEL_TO_CATEGORY_KEY_MAP[label];
  return label.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function installInteractionShield(page, enabled) {
  if (!enabled) return;
  await page.addInitScript(() => {
    const shieldId = "__codex_interaction_shield__";
    const styleId = "__codex_interaction_shield_style__";
    function mountTarget() {
      return document.head || document.body || document.documentElement;
    }
    function ensureShield() {
      const root = mountTarget();
      if (!root) return;
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          #${shieldId} {
            position: fixed;
            inset: 0;
            background: rgba(16, 24, 40, 0.02);
            z-index: 2147483647;
            pointer-events: auto;
            cursor: not-allowed;
          }
        `;
        root.appendChild(style);
      }
      if (!document.getElementById(shieldId)) {
        const shield = document.createElement("div");
        shield.id = shieldId;
        shield.setAttribute("data-codex-shield", "true");
        shield.setAttribute("aria-hidden", "true");
        (document.body || root).appendChild(shield);
      }
      window.__codexInteractionShieldActive = true;
    }
    ensureShield();
    window.addEventListener("DOMContentLoaded", ensureShield);
    window.addEventListener("load", ensureShield);
  });
  await page.evaluate(() => {
    const shieldId = "__codex_interaction_shield__";
    const styleId = "__codex_interaction_shield_style__";
    const root = document.head || document.body || document.documentElement;
    if (!root) return;
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #${shieldId} {
          position: fixed;
          inset: 0;
          background: rgba(16, 24, 40, 0.02);
          z-index: 2147483647;
          pointer-events: auto;
          cursor: not-allowed;
        }
      `;
      root.appendChild(style);
    }
    if (!document.getElementById(shieldId)) {
      const shield = document.createElement("div");
      shield.id = shieldId;
      shield.setAttribute("data-codex-shield", "true");
      shield.setAttribute("aria-hidden", "true");
      (document.body || root).appendChild(shield);
    }
    window.__codexInteractionShieldActive = true;
  }).catch(() => {});
}

async function removeInteractionShield(page) {
  await page.evaluate(() => {
    const shield = document.getElementById("__codex_interaction_shield__");
    const style = document.getElementById("__codex_interaction_shield_style__");
    shield?.remove();
    style?.remove();
    window.__codexInteractionShieldActive = false;
  }).catch(() => {});
}

async function isShieldActive(page) {
  return await page
    .evaluate(() => {
      return Boolean(window.__codexInteractionShieldActive) && Boolean(document.getElementById("__codex_interaction_shield__"));
    })
    .catch(() => false);
}

async function domClick(locator) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.evaluate((el) => {
    if (el instanceof HTMLElement) el.click();
  });
}

async function domFill(locator, value) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.evaluate((el, inputValue) => {
    const nextValue = String(inputValue);
    if (el instanceof HTMLInputElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      el.focus();
      valueSetter?.call(el, nextValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
      return;
    }
    if (el instanceof HTMLTextAreaElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      el.focus();
      valueSetter?.call(el, nextValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    }
  }, value);
}

async function waitForUiStability(page, delayMs) {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(Math.max(250, delayMs));
}

async function captureDomSnippet(page, selectorHint) {
  const selector = selectorHint || "body";
  try {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      const html = await locator.evaluate((el) => el.outerHTML);
      return { selector, html: clip(html, 12000) };
    }
  } catch {}
  const fallback = await page.evaluate(() => document.body?.outerHTML || "").catch(() => "");
  return { selector: "body", html: clip(fallback, 12000) };
}

export async function executeFlow({ flowName, flowFn, options, baseUrl, cwd, sharedState }) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactDir = path.join(cwd, "tmp", "repro", flowName, runId);
  fs.mkdirSync(artifactDir, { recursive: true });

  const events = {
    console: [],
    pageErrors: [],
    requestFailures: [],
    apiFailures: [],
    uncaughtExceptions: [],
    terminal: sharedState?.terminalEvents ?? [],
  };

  const runtimeState = {
    failed: false,
    firstFailingStep: null,
    exactError: null,
    classification: null,
    rootCauseHint: null,
    domSelector: null,
    screenshotFile: null,
    domSnippetFile: null,
    activeUser: null,
    currentUrl: null,
  };

  let browser;
  let context;
  let page;

  const writeJson = (name, payload) => {
    const target = path.join(artifactDir, name);
    fs.writeFileSync(target, JSON.stringify(payload, null, 2));
    return target;
  };

  const log = (message) => {
    console.log(`[FLOW:${flowName}] ${message}`);
  };

  const stopWithFailure = async ({ step, error, classification, rootCauseHint, domSelector, stack, networkFailure }) => {
    if (runtimeState.failed) return;
    runtimeState.failed = true;
    runtimeState.firstFailingStep = step;
    runtimeState.exactError = error;
    runtimeState.classification = classification;
    runtimeState.rootCauseHint = rootCauseHint || null;
    runtimeState.currentUrl = page ? page.url() : null;
    runtimeState.domSelector = domSelector || "body";

    if (page) {
      runtimeState.activeUser = await page
        .evaluate(async () => {
          try {
            const response = await fetch("/api/session/me");
            const payload = await response.json().catch(() => ({}));
            return { status: response.status, role: payload?.role ?? null, email: payload?.email ?? null };
          } catch (e) {
            return { status: null, role: null, email: null, error: e instanceof Error ? e.message : String(e) };
          }
        })
        .catch(() => null);

      runtimeState.screenshotFile = path.join(artifactDir, "failure.png");
      await page.screenshot({ path: runtimeState.screenshotFile, fullPage: true }).catch(() => {});

      const dom = await captureDomSnippet(page, domSelector);
      runtimeState.domSnippetFile = path.join(artifactDir, "dom-snippet.html");
      fs.writeFileSync(runtimeState.domSnippetFile, dom.html || "");
    }

    const summary = {
      result: "FAIL",
      flowName,
      firstFailingStep: runtimeState.firstFailingStep,
      exactError: runtimeState.exactError,
      classification: runtimeState.classification,
      rootCauseHint: runtimeState.rootCauseHint,
      currentUrl: runtimeState.currentUrl,
      activeUser: runtimeState.activeUser,
      stackTrace: stack || null,
      networkFailure: networkFailure || null,
      domSelector: runtimeState.domSelector,
      screenshotFile: runtimeState.screenshotFile,
      domSnippetFile: runtimeState.domSnippetFile,
      eventsFile: path.join(artifactDir, "events.json"),
      traceFile: path.join(artifactDir, "trace.zip"),
      interactionShieldEnabled: options.interactionShield,
      shieldActiveAtFailure: page ? await isShieldActive(page) : null,
      artifactPaths: {
        root: artifactDir,
        summary: path.join(artifactDir, "summary.json"),
        events: path.join(artifactDir, "events.json"),
        trace: path.join(artifactDir, "trace.zip"),
        screenshot: runtimeState.screenshotFile,
        domSnippet: runtimeState.domSnippetFile,
      },
    };

    writeJson("events.json", events);
    writeJson("summary.json", summary);

    console.error(`[FLOW:${flowName}] FIRST_BLOCKING_ERROR`);
    console.error(`[FLOW:${flowName}] STEP=${summary.firstFailingStep}`);
    console.error(`[FLOW:${flowName}] ERROR=${summary.exactError}`);
    console.error(`[FLOW:${flowName}] URL=${summary.currentUrl ?? "n/a"}`);
    console.error(`[FLOW:${flowName}] SELECTOR=${summary.domSelector ?? "n/a"}`);
    console.error(`[FLOW:${flowName}] ROOT_CAUSE_HINT=${summary.rootCauseHint ?? "n/a"}`);
    console.error(`[FLOW:${flowName}] ARTIFACTS=${artifactDir}`);
  };

  const step = async (name, fn) => {
    if (runtimeState.failed) return;
    log(`[STEP] ${name}`);
    try {
      await fn();
      await waitForUiStability(page, options.stepDelayMs);
    } catch (error) {
      await stopWithFailure({
        step: name,
        error: error instanceof Error ? error.message : String(error),
        classification: "flow_runtime_error",
        rootCauseHint: "Step threw unexpectedly.",
        domSelector: "body",
        stack: error instanceof Error ? error.stack : null,
      });
    }
  };

  try {
    browser = await chromium.launch({ headless: options.headless, slowMo: options.slowMoMs });
    context = await browser.newContext({ viewport: { width: options.viewportWidth, height: options.viewportHeight } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await context.newPage();

    page.on("console", (msg) => {
      events.console.push({
        type: msg.type(),
        text: clip(msg.text(), 3000),
        location: msg.location(),
        at: new Date().toISOString(),
      });
    });

    page.on("pageerror", (error) => {
      events.pageErrors.push({
        message: error?.message || String(error),
        stack: error?.stack || null,
        at: new Date().toISOString(),
      });
    });

    page.on("requestfailed", (request) => {
      events.requestFailures.push({
        url: request.url(),
        method: request.method(),
        failureText: request.failure()?.errorText || "Unknown request failure",
        at: new Date().toISOString(),
      });
    });

    page.on("response", async (response) => {
      const status = response.status();
      const url = response.url();
      if (!url.includes("/api/") || status < 400) return;
      let bodySnippet = "";
      try {
        bodySnippet = clip(await response.text(), 1200);
      } catch {}
      events.apiFailures.push({
        url,
        method: response.request().method(),
        status,
        bodySnippet,
        at: new Date().toISOString(),
      });
    });

    await installInteractionShield(page, options.interactionShield);

    const apiRequest = async (apiPath, { method = "GET", body, headers } = {}) => {
      return await page.evaluate(
        async ({ pathArg, methodArg, bodyArg, headersArg }) => {
          try {
            const response = await fetch(pathArg, {
              method: methodArg,
              headers: {
                ...(bodyArg !== undefined ? { "Content-Type": "application/json" } : {}),
                ...(headersArg || {}),
              },
              ...(bodyArg !== undefined ? { body: JSON.stringify(bodyArg) } : {}),
            });
            const text = await response.text();
            let json = null;
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              json = null;
            }
            return { ok: response.ok, status: response.status, text, json };
          } catch (e) {
            return {
              ok: false,
              status: 0,
              text: e instanceof Error ? e.message : String(e),
              json: null,
            };
          }
        },
        { pathArg: apiPath, methodArg: method, bodyArg: body, headersArg: headers },
      );
    };

    const ensureAuthenticated = async () => {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForUiStability(page, options.stepDelayMs);
      await page.goto(`${baseUrl}/rd`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForUiStability(page, options.stepDelayMs);

      if (page.url().includes("/login")) {
        const suffix = Date.now().toString();
        await page.goto(`${baseUrl}/signup`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await domFill(page.getByLabel(/Company Name/i), `Repro Company ${suffix}`);
        await domFill(page.getByLabel(/Login Code/i), `repro${suffix.slice(-6)}`);
        await domFill(page.getByLabel(/Admin Email/i), `admin+${suffix}@test.local`);
        await domFill(page.getByLabel(/Password/i), "Passw0rd!");
        await domClick(page.getByRole("button", { name: /Create Workspace/i }));
        await page.waitForURL(/\/admin/, { timeout: 30000 });
        await page.goto(`${baseUrl}/rd`, { waitUntil: "domcontentloaded", timeout: 60000 });
      }
    };

    const ctx = {
      flowName,
      baseUrl,
      artifactDir,
      page,
      context,
      events,
      options,
      sharedState,
      step,
      log,
      apiRequest,
      ensureAuthenticated,
      domClick,
      domFill,
      toCategoryKey,
      stopWithFailure,
      waitForUiStability: async () => waitForUiStability(page, options.stepDelayMs),
      assert: async (condition, message, payload = {}) => {
        if (condition) return true;
        await stopWithFailure({
          step: payload.step || "assertion",
          error: message,
          classification: payload.classification || "assertion_failed",
          rootCauseHint: payload.rootCauseHint || null,
          domSelector: payload.domSelector || "body",
        });
        return false;
      },
      failSetupBlocked: async (stepName, details, domSelector = "body") => {
        await stopWithFailure({
          step: stepName,
          error: details,
          classification: "setup_blocked",
          rootCauseHint: "Prerequisite setup could not be established for this flow.",
          domSelector,
        });
      },
    };

    await flowFn(ctx);

    if (!runtimeState.failed) {
      await removeInteractionShield(page);
      const summary = {
        result: "PASS",
        flowName,
        firstFailingStep: null,
        exactError: null,
        classification: null,
        rootCauseHint: null,
        currentUrl: page.url(),
        activeUser: await page
          .evaluate(async () => {
            try {
              const response = await fetch("/api/session/me");
              const payload = await response.json().catch(() => ({}));
              return { status: response.status, role: payload?.role ?? null, email: payload?.email ?? null };
            } catch {
              return null;
            }
          })
          .catch(() => null),
        eventsFile: path.join(artifactDir, "events.json"),
        traceFile: path.join(artifactDir, "trace.zip"),
        interactionShieldEnabled: options.interactionShield,
        shieldActiveAtEnd: await isShieldActive(page),
        artifactPaths: {
          root: artifactDir,
          summary: path.join(artifactDir, "summary.json"),
          events: path.join(artifactDir, "events.json"),
          trace: path.join(artifactDir, "trace.zip"),
        },
      };
      writeJson("events.json", events);
      writeJson("summary.json", summary);
      return summary;
    }

    return JSON.parse(fs.readFileSync(path.join(artifactDir, "summary.json"), "utf8"));
  } finally {
    if (context) {
      await context.tracing.stop({ path: path.join(artifactDir, "trace.zip") }).catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
