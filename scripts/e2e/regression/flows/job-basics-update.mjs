import { createJobViaApi } from "../core/setup.mjs";

const FLOW_NAME = "job-basics-update";

function tomorrowIsoDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function runJobBasicsUpdateFlow(ctx) {
  const { page, step, assert, domFill, domClick, ensureAuthenticated, sharedState } = ctx;

  await step("Authenticate session", async () => {
    await ensureAuthenticated();
  });

  await step("Switch to Company View", async () => {
    const workspaceView = page.getByLabel(/Workspace view/i).first();
    if (await workspaceView.isVisible().catch(() => false)) {
      await workspaceView.selectOption("all");
      await ctx.waitForUiStability();
    }
  });

  let jobId = sharedState.createdJobId || null;
  await step("Prepare job fixture for basics update", async () => {
    if (!jobId) {
      const created = await createJobViaApi(ctx, { materialType: "INHOUSE" });
      jobId = created.id;
      sharedState.jobBasicsJobId = jobId;
    }
  });

  await step("Open workflow Job Basics section", async () => {
    await page.goto(`${ctx.baseUrl}/jobs/${jobId}/workflow?section=job`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.locator(".chakra-spinner").first().waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});

    const saveJobButton = page.getByRole("button", { name: /^Save Job$/i }).first();
    await assert(
      await saveJobButton.isVisible({ timeout: 15000 }).catch(() => false),
      "Job Basics panel actions did not render on workflow page.",
      {
        step: "Open workflow Job Basics section",
        classification: "stale route/navigation bug",
        rootCauseHint: "Workflow route did not resolve the Job Basics interaction panel.",
        domSelector: "button:has-text('Save Job')",
      },
    );
  });

  const deadlineInput = page.locator("input[type='date']").first();
  const saveJobButton = page.getByRole("button", { name: /^Save Job$/i }).first();
  const nextDeadline = tomorrowIsoDate();

  await step("Update deadline and save basics", async () => {
    if (!(await assert(await deadlineInput.isVisible(), "Deadline date input is missing in Job Basics section.", {
      step: "Update deadline and save basics",
      classification: "frontend render error",
      rootCauseHint: "Job Basics form controls are incomplete.",
      domSelector: "input[type='date']",
    }))) {
      return;
    }

    await domFill(deadlineInput, nextDeadline);
    await domClick(saveJobButton);

    const successToast = page.locator("[role='alert'], [role='status']").filter({ hasText: /Job basics saved/i }).first();
    await assert(await successToast.isVisible({ timeout: 10000 }).catch(() => false), "Job basics save success feedback did not appear.", {
      step: "Update deadline and save basics",
      classification: "state management bug",
      rootCauseHint: "Save action completed without surfacing success state.",
      domSelector: "button:has-text('Save Job')",
    });
  });

  await step("Reload and verify persisted deadline", async () => {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await assert((await deadlineInput.inputValue()) === nextDeadline, `Deadline did not persist after reload. Expected ${nextDeadline}.`, {
      step: "Reload and verify persisted deadline",
      classification: "server/API failure",
      rootCauseHint: "PATCH workflow response did not persist job basics fields.",
      domSelector: "input[type='date']",
    });
  });
}

export const jobBasicsUpdateFlow = {
  name: FLOW_NAME,
  prerequisites: ["Existing job fixture"],
  run: runJobBasicsUpdateFlow,
};
