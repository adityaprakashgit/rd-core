const FLOW_NAME = "create-job";

function classifyFromHttpStatus(status) {
  if (status === 401 || status === 403) return "permission/role issue";
  if (status === 400 || status === 409 || status === 422) return "validation bug";
  if (status >= 500) return "server/API failure";
  return "server/API failure";
}

export async function runCreateJobFlow(ctx) {
  const { page, domClick, domFill, step, assert, stopWithFailure, events, ensureAuthenticated, sharedState } = ctx;

  await step("Authenticate and open /rd", async () => {
    await ensureAuthenticated();
    await page.goto(`${ctx.baseUrl}/rd`, { waitUntil: "domcontentloaded", timeout: 60000 });
  });

  const createJobButton = page.getByRole("button", { name: /^Create Job$/i }).first();
  await step("Verify Create Job trigger visible/enabled", async () => {
    if (!(await assert(await createJobButton.isVisible(), "Create Job button is not visible on /rd.", {
      step: "Verify Create Job trigger visible/enabled",
      classification: "frontend render error",
      rootCauseHint: "Primary registry action is missing in job list view.",
      domSelector: "button:has-text('Create Job')",
    }))) return;

    await assert(await createJobButton.isEnabled(), "Create Job button is visible but disabled on /rd.", {
      step: "Verify Create Job trigger visible/enabled",
      classification: "state management bug",
      rootCauseHint: "Entry action disabled unexpectedly before interaction.",
      domSelector: "button:has-text('Create Job')",
    });
  });

  await step("Open Create Job drawer", async () => {
    await domClick(createJobButton);
    await page.getByText(/^Create Job$/i).first().waitFor({ state: "visible", timeout: 10000 });
  });

  const customerInput = page.getByPlaceholder(/Type customer name/i).first();
  const materialInput = page.getByPlaceholder(/Type material name/i).first();
  const warehouseInput = page.getByPlaceholder(/Select or type warehouse/i).first();
  const materialTypeButton = page.getByRole("button", { name: /In-house material/i }).first();
  const saveButton = page
    .locator(".chakra-drawer__content button:has-text('Create Job'), [role='dialog'] button:has-text('Create Job')")
    .first();

  await step("Verify required fields render", async () => {
    if (!(await assert(await customerInput.isVisible(), "Customer field is missing in Create Job drawer.", {
      step: "Verify required fields render",
      classification: "frontend render error",
      rootCauseHint: "Create Job form did not render customer control.",
      domSelector: "[role='dialog']",
    }))) return;

    if (!(await assert(await materialInput.isVisible(), "Material field is missing in Create Job drawer.", {
      step: "Verify required fields render",
      classification: "frontend render error",
      rootCauseHint: "Create Job form did not render material control.",
      domSelector: "[role='dialog']",
    }))) return;

    if (!(await assert(await materialTypeButton.isVisible(), "Material type selector is missing in Create Job drawer.", {
      step: "Verify required fields render",
      classification: "frontend render error",
      rootCauseHint: "Material type choices failed to render.",
      domSelector: "[role='dialog']",
    }))) return;

    await warehouseInput.isVisible().catch(() => false);
  });

  await step("Verify save disabled initially", async () => {
    await assert(await saveButton.isDisabled(), "Create Job save is enabled before required fields are complete.", {
      step: "Verify save disabled initially",
      classification: "validation bug",
      rootCauseHint: "Caller-level required-field gating is missing/broken.",
      domSelector: "button:has-text('Create Job')",
    });
  });

  await step("Verify save remains disabled with partial fields", async () => {
    await domFill(customerInput, `Partial Customer ${Date.now()}`);
    await domFill(materialInput, "");
    if (!(await assert(await saveButton.isDisabled(), "Create Job save enabled with only Customer filled.", {
      step: "Verify save remains disabled with partial fields",
      classification: "validation bug",
      rootCauseHint: "Save gating ignores missing material/material type.",
      domSelector: "button:has-text('Create Job')",
    }))) {
      return;
    }

    await domFill(materialInput, `Partial Material ${Date.now()}`);
    await assert(await saveButton.isDisabled(), "Create Job save enabled before material type selection.", {
      step: "Verify save remains disabled with partial fields",
      classification: "validation bug",
      rootCauseHint: "Save gating does not enforce material type.",
      domSelector: "button:has-text('Create Job')",
    });
  });

  const unique = `${Date.now()}`;
  const customer = `Auto Customer ${unique}`;
  const material = `Auto Material ${unique}`;

  await step("Fill minimal valid data", async () => {
    await domFill(customerInput, customer);
    await domFill(materialInput, material);
    await domClick(materialTypeButton);
  });

  await step("Verify save enabled with valid required fields", async () => {
    await assert(await saveButton.isEnabled(), "Create Job save remains disabled after required fields are valid.", {
      step: "Verify save enabled with valid required fields",
      classification: "state management bug",
      rootCauseHint: "Form state is not syncing with required-field validation.",
      domSelector: "button:has-text('Create Job')",
    });
  });

  await step("Submit Create Job and verify workflow navigation", async () => {
    const apiFailCountBefore = events.apiFailures.length;
    await domClick(saveButton);

    const navigated = await page
      .waitForURL(/\/jobs\/[^/]+\/workflow/, { timeout: 25000 })
      .then(() => true)
      .catch(() => false);

    if (navigated) {
      const match = page.url().match(/\/jobs\/([^/]+)\/workflow/);
      if (match?.[1]) {
        sharedState.createdJobId = match[1];
      }
      return;
    }

    const apiFailure = events.apiFailures.slice(apiFailCountBefore)[0] || null;
    if (apiFailure) {
      await stopWithFailure({
        step: "Submit Create Job and verify workflow navigation",
        error: `API request failed: ${apiFailure.method} ${apiFailure.url} -> ${apiFailure.status}`,
        classification: classifyFromHttpStatus(apiFailure.status),
        rootCauseHint:
          apiFailure.status >= 500
            ? "Backend create-job endpoint failed while saving."
            : "Submission rejected by API authorization or validation.",
        networkFailure: apiFailure,
        domSelector: "body",
      });
      return;
    }

    const toastError = page
      .locator("[role='alert'], [role='status']")
      .filter({ hasText: /failed|error|missing|warning/i })
      .first();
    if (await toastError.isVisible().catch(() => false)) {
      const text = (await toastError.textContent().catch(() => "")) || "Unknown UI error";
      await stopWithFailure({
        step: "Submit Create Job and verify workflow navigation",
        error: `UI error after submit: ${text.trim()}`,
        classification: "validation bug",
        rootCauseHint: "Client/server validation failed during submit.",
        domSelector: "[role='alert']",
      });
      return;
    }

    await stopWithFailure({
      step: "Submit Create Job and verify workflow navigation",
      error: "Create Job submit did not navigate and surfaced no explicit API/UI error.",
      classification: "stale route/navigation bug",
      rootCauseHint: "Post-submit workflow route transition did not complete.",
      domSelector: "body",
    });
  });
}

export const createJobFlow = {
  name: FLOW_NAME,
  prerequisites: ["Authenticated admin/ops session"],
  run: runCreateJobFlow,
};
