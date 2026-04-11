import { createJobViaApi, createLotViaApi } from "../core/setup.mjs";

const FLOW_NAME = "report-critical";

export async function runReportCriticalFlow(ctx) {
  const { page, step, assert, domClick, ensureAuthenticated, failSetupBlocked, sharedState } = ctx;

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

  let fixture;
  await step("Prepare report fixture (job + lot)", async () => {
    try {
      const job = await createJobViaApi(ctx);
      const lot = await createLotViaApi(ctx, job.id);
      fixture = { jobId: job.id, lotId: lot.id };
      sharedState.reportFixture = fixture;
    } catch (error) {
      await failSetupBlocked(
        "Prepare report fixture (job + lot)",
        error instanceof Error ? error.message : String(error),
        "body",
      );
    }
  });
  if (!fixture) return;

  await step("Open reports workspace", async () => {
    await page.goto(`${ctx.baseUrl}/reports`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator(".chakra-spinner").first().waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});

    const emptyState = page.getByText(/No jobs are ready for documents/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await failSetupBlocked(
        "Open reports workspace",
        "No report-eligible jobs are available in current workspace view.",
        "text=No jobs are ready for documents",
      );
      return;
    }

    const stickerButtons = page.getByRole("button", { name: /View Sticker PDF/i });
    await stickerButtons.first().waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
    const visibleStickerButtons = page.locator("button:has-text('View Sticker PDF'):visible");

    await assert(
      (await visibleStickerButtons.count()) > 0,
      "Reports workspace did not render document preview actions.",
      {
        step: "Open reports workspace",
        classification: "stale route/navigation bug",
        rootCauseHint: "Reports route loaded but no visible preview action was available.",
        domSelector: "button:has-text('View Sticker PDF'):visible",
      },
    );
  });

  await step("Select fixture job and generate sticker preview", async () => {
    const jobSelect = page.locator(`select:has(option[value="${fixture.jobId}"])`).first();
    if (!(await assert(await jobSelect.isVisible({ timeout: 15000 }).catch(() => false), "Job selector with fixture option is not visible.", {
      step: "Select fixture job and generate sticker preview",
      classification: "setup_blocked",
      rootCauseHint: "Fixture job is not present in reports job selector options.",
      domSelector: `select:has(option[value="${fixture.jobId}"])`,
    }))) {
      return;
    }
    await jobSelect.selectOption(fixture.jobId);

    const viewStickerButton = page.getByRole("button", { name: /View Sticker PDF/i }).first();
    if (!(await assert(await viewStickerButton.isEnabled(), "View Sticker PDF button is disabled for valid job fixture.", {
      step: "Select fixture job and generate sticker preview",
      classification: "validation bug",
      rootCauseHint: "Document readiness gating is stricter than expected for sticker preview.",
      domSelector: "button:has-text('View Sticker PDF')",
    }))) {
      return;
    }

    await domClick(viewStickerButton);

    const modalHeading = page.getByRole("heading", { name: /Sticker preview/i }).first();
    await assert(await modalHeading.isVisible({ timeout: 15000 }).catch(() => false), "Sticker preview modal did not open after generation.", {
      step: "Select fixture job and generate sticker preview",
      classification: "server/API failure",
      rootCauseHint: "Sticker generation endpoint or preview modal state failed.",
      domSelector: "[role='dialog']",
    });
  });

  await step("Validate preview readiness and close modal", async () => {
    const previewFrame = page.locator("iframe[title]").first();
    await assert(await previewFrame.isVisible().catch(() => false), "PDF preview iframe is missing in preview modal.", {
      step: "Validate preview readiness and close modal",
      classification: "frontend render error",
      rootCauseHint: "Preview blob URL did not bind to modal iframe.",
      domSelector: "iframe[title]",
    });

    const backButton = page.getByRole("button", { name: /Back to workflow/i }).first();
    await domClick(backButton);

    await assert(!(await previewFrame.isVisible().catch(() => false)), "Preview modal did not close after Back to workflow.", {
      step: "Validate preview readiness and close modal",
      classification: "state management bug",
      rootCauseHint: "Modal close handler failed to clear preview state.",
      domSelector: "[role='dialog']",
    });
  });
}

export const reportCriticalFlow = {
  name: FLOW_NAME,
  prerequisites: ["Job + lot fixture present in reports job list"],
  run: runReportCriticalFlow,
};
