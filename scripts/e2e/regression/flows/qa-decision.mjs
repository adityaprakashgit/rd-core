import { prepareDecisionFixture } from "../core/setup.mjs";

const FLOW_NAME = "qa-decision";

async function runDecisionPath(ctx, fixture, targetDecision) {
  const { page, domClick, assert } = ctx;

  await page.goto(`${ctx.baseUrl}/jobs/${fixture.jobId}/workflow?section=decision&lotId=${fixture.lotId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator(".chakra-spinner").first().waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});

  const button = page.getByRole("button", { name: new RegExp(`^${targetDecision}$`, "i") }).first();
  if (!(await assert(await button.isVisible({ timeout: 15000 }).catch(() => false), `${targetDecision} action is not visible in decision panel.`, {
    step: `${targetDecision} path: open decision section`,
    classification: "stale route/navigation bug",
    rootCauseHint: "Decision panel did not render expected action controls.",
    domSelector: `button:has-text('${targetDecision}')`,
  }))) {
    return;
  }

  if (!(await assert(await button.isEnabled(), `${targetDecision} action is disabled unexpectedly.`, {
    step: `${targetDecision} path: trigger decision action`,
    classification: "permission/role issue",
    rootCauseHint: "Session role/policy blocks expected decision action.",
    domSelector: `button:has-text('${targetDecision}')`,
  }))) {
    return;
  }

  await domClick(button);

  const successToast = page.locator("[role='alert'], [role='status']").filter({ hasText: /Decision updated/i }).first();
  if (!(await assert(await successToast.isVisible({ timeout: 10000 }).catch(() => false), `${targetDecision} decision did not show success feedback.`, {
    step: `${targetDecision} path: verify decision update`,
    classification: "server/API failure",
    rootCauseHint: "Decision PATCH request failed or did not surface completion.",
    domSelector: `button:has-text('${targetDecision}')`,
  }))) {
    return;
  }

  const expected = targetDecision.toUpperCase();
  await assert(await page.getByText(new RegExp(`Current Decision:\\s*${expected.replace("_", " ")}`, "i")).isVisible().catch(() => false), `Current Decision text did not change to ${expected}.`, {
    step: `${targetDecision} path: verify decision update`,
    classification: "state management bug",
    rootCauseHint: "Decision state updated in backend but UI did not refresh current decision.",
    domSelector: "text=Current Decision",
  });
}

export async function runQaDecisionFlow(ctx) {
  const { step, ensureAuthenticated, failSetupBlocked, sharedState, page, assert } = ctx;

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

  let passFixture;
  let rejectFixture;

  await step("Prepare decision fixtures", async () => {
    try {
      passFixture = await prepareDecisionFixture(ctx);
      rejectFixture = await prepareDecisionFixture(ctx);
      sharedState.qaDecisionFixtures = { passFixture, rejectFixture };
    } catch (error) {
      await failSetupBlocked(
        "Prepare decision fixtures",
        error instanceof Error ? error.message : String(error),
        "body",
      );
    }
  });
  if (!passFixture || !rejectFixture) return;

  await step("Approve path (Pass)", async () => {
    await runDecisionPath(ctx, passFixture, "Pass");
  });

  await step("Reject path", async () => {
    await runDecisionPath(ctx, rejectFixture, "Reject");

    await page.goto(`${ctx.baseUrl}/jobs/${rejectFixture.jobId}/workflow?section=sampling&lotId=${rejectFixture.lotId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await assert(
      await page.getByText(/Decision blocks progression/i).isVisible().catch(() => false),
      "Reject decision did not enforce visible workflow gate warning.",
      {
        step: "Reject path",
        classification: "state management bug",
        rootCauseHint: "Reject/Hold gating banner is not rendered after decision transition.",
        domSelector: "text=Decision blocks progression",
      },
    );
  });
}

export const qaDecisionFlow = {
  name: FLOW_NAME,
  prerequisites: ["Decision-ready fixtures with inspection proof"],
  run: runQaDecisionFlow,
};
