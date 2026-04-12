import fs from "node:fs";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.use({
  launchOptions: {
    slowMo: 250,
  },
});

test.setTimeout(180_000);

type BrowserConsoleEntry = {
  type: string;
  text: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
  timestamp: string;
};

type BrowserPageErrorEntry = {
  message: string;
  stack?: string;
  timestamp: string;
};

type BrowserRequestFailureEntry = {
  url: string;
  method: string;
  errorText: string;
  timestamp: string;
};

type BrowserDiagnostics = {
  console: BrowserConsoleEntry[];
  pageErrors: BrowserPageErrorEntry[];
  requestFailures: BrowserRequestFailureEntry[];
};

type AuthCredentials = {
  companyName: string;
  loginCode: string;
  adminEmail: string;
  password: string;
};

type ApiResult<T> = {
  ok: boolean;
  status: number;
  text: string;
  json: T | null;
};

function nowSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function tinyPngBase64(): string {
  return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z8m0AAAAASUVORK5CYII=";
}

async function waitForUiStability(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function authedFetch<T = unknown>(
  page: Page,
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  return await page.evaluate(
    async ({ requestUrl, requestInit }) => {
      try {
        const response = await fetch(requestUrl, requestInit);
        const text = await response.text();
        let json: unknown = null;
        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
        }
        return { ok: response.ok, status: response.status, text, json };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          text: error instanceof Error ? error.message : String(error),
          json: null,
        };
      }
    },
    { requestUrl: url, requestInit: init },
  );
}

async function attachDiagnostics(testInfo: TestInfo, diagnostics: BrowserDiagnostics): Promise<void> {
  const outputPath = testInfo.outputPath("browser-diagnostics.json");
  fs.writeFileSync(outputPath, JSON.stringify(diagnostics, null, 2));
  await testInfo.attach("browser-diagnostics", {
    path: outputPath,
    contentType: "application/json",
  });
}

async function setupBrowserDiagnostics(page: Page): Promise<BrowserDiagnostics> {
  const diagnostics: BrowserDiagnostics = {
    console: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on("console", (message) => {
    diagnostics.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
      timestamp: new Date().toISOString(),
    });
  });

  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  });

  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push({
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText ?? "Unknown failure",
      timestamp: new Date().toISOString(),
    });
  });

  return diagnostics;
}

test("reliable full-path smoke flow", async ({ page }, testInfo) => {
  const diagnostics = await setupBrowserDiagnostics(page);
  const stamp = nowSuffix();
  const auth: AuthCredentials = {
    companyName: `QA Company ${stamp}`,
    loginCode: `qa${stamp.slice(-6)}`,
    adminEmail: `admin+${stamp}@test.local`,
    password: "Passw0rd!23",
  };
  const job = {
    customerName: `Customer ${stamp}`,
    materialName: `Material ${stamp}`,
    lotNumber: `LOT-${stamp.slice(-6).toUpperCase()}`,
    sampleCode: `SAMPLE-${stamp.slice(-6).toUpperCase()}`,
    sampleType: "Composite",
    samplingMethod: "Manual",
    sampleQuantity: "5",
    sampleUnit: "KG",
  };

  let jobId: string | null = null;
  let lotId: string | null = null;

  try {
    await test.step("Bootstrap workspace through signup", async () => {
      await page.goto("/signup", { waitUntil: "domcontentloaded" });
      await waitForUiStability(page);

      await expect(page.getByText(/Create Company Account/i)).toBeVisible();

      await page.getByLabel(/Company Name/i).fill(auth.companyName);
      await page.getByLabel(/Login Code/i).fill(auth.loginCode);
      await page.getByLabel(/Admin Email/i).fill(auth.adminEmail);
      await page.getByPlaceholder(/At least 8 characters/i).fill(auth.password);
      await expect(page.getByRole("button", { name: /^Create Workspace$/i })).toBeEnabled();
      await page.getByRole("button", { name: /^Create Workspace$/i }).click();

      await page.waitForURL(/\/admin(?:\?.*)?$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: /Admin Workspace/i })).toBeVisible();
    });

    await test.step("Re-authenticate through login", async () => {
      await page.evaluate(() => window.localStorage.removeItem("erp_auth"));
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await waitForUiStability(page);

      await expect(page.getByText(/Sign In/i)).toBeVisible();
      await page.getByLabel(/Login Code/i).fill(auth.loginCode);
      await page.getByLabel(/Email/i).fill(auth.adminEmail);
      await page.getByPlaceholder(/Enter password/i).fill(auth.password);
      await expect(page.getByRole("button", { name: /Continue to Workspace/i })).toBeEnabled();
      await page.getByRole("button", { name: /Continue to Workspace/i }).click();

      await page.waitForURL(/\/admin(?:\?.*)?$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: /Admin Workspace/i })).toBeVisible();
    });

    await test.step("Open job registry", async () => {
      await page.goto("/rd", { waitUntil: "domcontentloaded" });
      await waitForUiStability(page);

      await expect(page.getByRole("heading", { name: /Job Registry/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Create Job$/i })).toBeVisible();
    });

    await test.step("Create a new job", async () => {
      await page.getByRole("button", { name: /^Create Job$/i }).click();

      const customerInput = page.getByPlaceholder(/Type customer name/i);
      const materialInput = page.getByPlaceholder(/Type material name/i);
      const warehouseInput = page.getByPlaceholder(/Select or type warehouse/i);
      const materialTypeInHouse = page.getByRole("button", { name: /In-house material/i });
      const materialTypeTraded = page.getByRole("button", { name: /Traded material/i });
      const saveButton = page.getByRole("button", { name: /^Create Job$/i }).last();

      await expect(customerInput).toBeVisible();
      await expect(materialInput).toBeVisible();
      await expect(warehouseInput).toBeVisible();
      await expect(materialTypeInHouse).toBeVisible();
      await expect(materialTypeTraded).toBeVisible();
      await expect(saveButton).toBeDisabled();

      await customerInput.fill(job.customerName);
      const addCustomerButton = page.getByRole("button", {
        name: `Add "${job.customerName}" as new customer`,
      });
      await expect(addCustomerButton).toBeVisible();
      await addCustomerButton.click();
      await expect(customerInput).toHaveValue(job.customerName);

      await materialTypeInHouse.click();

      await materialInput.fill(job.materialName);
      const addMaterialButton = page.getByRole("button", {
        name: `Add "${job.materialName}" as new material`,
      });
      await expect(addMaterialButton).toBeVisible();
      await addMaterialButton.click();
      await expect(materialInput).toHaveValue(job.materialName);

      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      await page.waitForURL(/\/jobs\/[^/]+\/workflow(?:\?.*)?$/, { timeout: 30_000 });
      const match = page.url().match(/\/jobs\/([^/]+)\/workflow/);
      jobId = match?.[1] ?? null;
      expect(jobId, "Job ID was not present in workflow URL.").toBeTruthy();
      await expect(page.getByRole("heading", { name: /Job Workflow/i })).toBeVisible();
    });

    await test.step("Verify the created job appears in the registry", async () => {
      await page.goto("/rd", { waitUntil: "domcontentloaded" });
      await waitForUiStability(page);

      await expect(page.getByRole("heading", { name: /Job Registry/i })).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: job.customerName }).first()).toBeVisible();
    });

    await test.step("Create a lot in the workflow", async () => {
      if (!jobId) {
        throw new Error("Cannot create lot without a job ID.");
      }

      await page.goto(`/jobs/${jobId}/workflow?section=lots`, { waitUntil: "domcontentloaded" });
      await waitForUiStability(page);

      await expect(page.getByRole("heading", { name: /2\. Lots/i })).toBeVisible();

      const lotNumberInput = page.getByLabel(/Lot Number/i).first();
      if (await lotNumberInput.isEditable().catch(() => false)) {
        await lotNumberInput.fill(job.lotNumber);
      } else {
        await expect(lotNumberInput).not.toBeEditable();
      }

      await page.getByLabel(/Material Name/i).fill(job.materialName);
      await page.getByLabel(/Total Bags/i).fill("1");
      const addLotButton = page.getByRole("button", { name: /^Add Lot$/i }).first();
      await expect(addLotButton).toBeEnabled();
      await addLotButton.click();

      await expect(page.getByRole("row").filter({ hasText: job.materialName }).first()).toBeVisible();
    });

    await test.step("Prepare decision prerequisites with a small API bridge", async () => {
      if (!jobId) {
        throw new Error("Cannot prepare sampling without a job ID.");
      }

      const workflow = await authedFetch<{
        settings?: {
          images?: { requiredImageCategories?: string[] };
          workflow?: { autoSampleIdGeneration?: boolean };
        };
        job?: {
          lots?: Array<{
            id: string;
            lotNumber?: string | null;
            materialName?: string | null;
          }>;
        };
        containerTypes?: Array<{ id: string; name: string }>;
      }>(page, `/api/jobs/${jobId}/workflow`);

      expect(workflow.ok, `Workflow payload was not readable: ${workflow.status} ${workflow.text}`).toBeTruthy();
      const requiredCategories = workflow.json?.settings?.images?.requiredImageCategories ?? [];
      lotId = workflow.json?.job?.lots?.find((entry) => entry.materialName === job.materialName)?.id ?? workflow.json?.job?.lots?.[0]?.id ?? null;
      expect(lotId, "Lot ID was not present in workflow payload.").toBeTruthy();

      const inspectionStart = await authedFetch<{ inspection?: { id?: string } }>(page, "/api/inspection/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId }),
      });
      expect(
        inspectionStart.ok,
        `Inspection bootstrap failed: ${inspectionStart.status} ${inspectionStart.text}`,
      ).toBeTruthy();

      const inspectionId = inspectionStart.json?.inspection?.id ?? null;
      expect(inspectionId, "Inspection ID was not returned for readiness setup.").toBeTruthy();

      for (const category of requiredCategories) {
        const upload = await authedFetch(page, "/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lotId,
            inspectionId,
            category,
            base64: tinyPngBase64(),
            fileName: `${String(category).toLowerCase()}.png`,
            mimeType: "image/png",
          }),
        });

        expect(
          upload.ok,
          `Required proof upload failed for ${category}: ${upload.status} ${upload.text}`,
        ).toBeTruthy();
      }

      await page.goto(`/jobs/${jobId}/workflow?section=decision&lotId=${lotId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForUiStability(page);

      await expect(page.getByRole("heading", { name: /4\. Final Decision/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Pass$/i })).toBeEnabled();
      await page.getByRole("button", { name: /^Pass$/i }).click();

      await expect(page.getByText(/Current Decision:\s*READY FOR SAMPLING/i)).toBeVisible();
    });

    await test.step("Start sampling and save sample details", async () => {
      if (!jobId || !lotId) {
        throw new Error("Cannot continue to sampling without job and lot IDs.");
      }

      const workflow = await authedFetch<{
        settings?: { workflow?: { autoSampleIdGeneration?: boolean } };
        containerTypes?: Array<{ id: string; name: string }>;
      }>(page, `/api/jobs/${jobId}/workflow?lotId=${lotId}`);

      expect(workflow.ok, `Sampling workflow payload was not readable: ${workflow.status} ${workflow.text}`).toBeTruthy();

      await page.goto(`/jobs/${jobId}/workflow?section=sampling&lotId=${lotId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForUiStability(page);

      await expect(page.getByRole("heading", { name: /5\. Sampling/i })).toBeVisible();

      const sampleIdInput = page.getByLabel(/Sample ID/i).first();
      if (await sampleIdInput.isEditable().catch(() => false)) {
        await sampleIdInput.fill(job.sampleCode);
      }

      const startSamplingButton = page.getByRole("button", { name: /^Start Sampling$/i }).first();
      await expect(startSamplingButton).toBeEnabled();
      await startSamplingButton.click();

      await waitForUiStability(page);
      await expect(page.getByText(/Current saved sample/i)).toBeVisible();
      await expect(sampleIdInput).toHaveValue(/^SMP-/i);

      await page.getByLabel(/Sample Type/i).fill(job.sampleType);
      await page.getByLabel(/Sampling Method/i).fill(job.samplingMethod);
      await page.getByLabel(/Sample Quantity/i).fill(job.sampleQuantity);

      const containerTypeSelect = page.getByLabel(/Container Type/i);
      const containerTypes = workflow.json?.containerTypes ?? [];
      const firstContainerType = containerTypes[0]?.name ?? "";
      if (firstContainerType) {
        await containerTypeSelect.selectOption({ label: firstContainerType });
      }

      const saveSampleButton = page.getByRole("button", { name: /^Save Sample Details$/i }).first();
      await expect(saveSampleButton).toBeEnabled();
      await saveSampleButton.click();

      await waitForUiStability(page);
      await expect(page.getByText(/Sample readiness/i)).toBeVisible();
      await expect(page.getByText(new RegExp(`Quantity:\\s*${job.sampleQuantity}\\s*${job.sampleUnit}`, "i"))).toBeVisible();
      if (firstContainerType) {
        await expect(page.getByText(new RegExp(`Container Type:\\s*${firstContainerType}`, "i"))).toBeVisible();
      }
    });

    await page.waitForTimeout(6_000);
  } catch (error) {
    const diagnosticsFile = testInfo.outputPath("browser-diagnostics.json");
    fs.writeFileSync(diagnosticsFile, JSON.stringify(diagnostics, null, 2));
    await testInfo.attach("browser-diagnostics", {
      path: diagnosticsFile,
      contentType: "application/json",
    });
    throw error;
  } finally {
    if (testInfo.status === testInfo.expectedStatus) {
      const diagnosticsFile = testInfo.outputPath("browser-diagnostics.json");
      fs.writeFileSync(diagnosticsFile, JSON.stringify(diagnostics, null, 2));
      await testInfo.attach("browser-diagnostics", {
        path: diagnosticsFile,
        contentType: "application/json",
      });
    }
  }
});
