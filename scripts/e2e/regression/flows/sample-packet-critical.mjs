import { prepareSampleAndPacketFixture } from "../core/setup.mjs";

const FLOW_NAME = "sample-packet-critical";

export async function runSamplePacketCriticalFlow(ctx) {
  const { page, step, assert, domFill, domClick, ensureAuthenticated, failSetupBlocked, sharedState } = ctx;

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
  await step("Prepare sample+packet fixture", async () => {
    try {
      fixture = await prepareSampleAndPacketFixture(ctx);
      sharedState.samplePacketFixture = fixture;
    } catch (error) {
      await failSetupBlocked(
        "Prepare sample+packet fixture",
        error instanceof Error ? error.message : String(error),
        "body",
      );
    }
  });
  if (!fixture) return;

  await step("Open sampling section", async () => {
    await page.goto(`${ctx.baseUrl}/jobs/${fixture.jobId}/workflow?section=sampling&lotId=${fixture.lotId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await assert(
      await page.getByRole("heading", { name: /5\. Sampling/i }).isVisible(),
      "Sampling section did not render for fixture job.",
      {
        step: "Open sampling section",
        classification: "stale route/navigation bug",
        rootCauseHint: "Workflow route failed to load sampling panel.",
        domSelector: "h2",
      },
    );
  });

  await step("Save minimal sampling details", async () => {
    const sampleTypeInput = page.getByLabel(/Sample Type/i).first();
    const samplingMethodInput = page.getByLabel(/Sampling Method/i).first();
    const saveSamplingButton = page.getByRole("button", { name: /^Save Sampling$/i }).first();

    if (!(await assert(await saveSamplingButton.isVisible(), "Save Sampling action is missing.", {
      step: "Save minimal sampling details",
      classification: "frontend render error",
      rootCauseHint: "Sampling actions are not rendered in canonical sampling panel.",
      domSelector: "button:has-text('Save Sampling')",
    }))) {
      return;
    }

    await domFill(sampleTypeInput, `Composite ${Date.now()}`);
    await domFill(samplingMethodInput, "Manual");
    await domClick(saveSamplingButton);

    const successToast = page.locator("[role='alert'], [role='status']").filter({ hasText: /Sample details saved/i }).first();
    await assert(await successToast.isVisible({ timeout: 10000 }).catch(() => false), "Sample save success feedback did not appear.", {
      step: "Save minimal sampling details",
      classification: "state management bug",
      rootCauseHint: "Sample save action completed without state confirmation.",
      domSelector: "button:has-text('Save Sampling')",
    });
  });

  await step("Open packet section and create a packet draft", async () => {
    await page.goto(`${ctx.baseUrl}/jobs/${fixture.jobId}/workflow?section=packets&lotId=${fixture.lotId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    if (!(await assert(await page.getByRole("heading", { name: /7\. Packet Creation/i }).isVisible(), "Packet Creation section did not render.", {
      step: "Open packet section and create a packet draft",
      classification: "stale route/navigation bug",
      rootCauseHint: "Workflow packet panel route did not resolve.",
      domSelector: "h2",
    }))) {
      return;
    }

    const blockerBanner = page.getByText(/Packet blockers/i).first();
    if (await blockerBanner.isVisible().catch(() => false)) {
      await ctx.stopWithFailure({
        step: "Open packet section and create a packet draft",
        error: "Packet blockers are present for setup fixture expected to be ready.",
        classification: "missing API data",
        rootCauseHint: "Fixture setup did not meet packet readiness gates.",
        domSelector: "text=Packet blockers",
      });
      return;
    }

    const manualAddButton = page.getByRole("button", { name: /Manual Add Packet/i }).first();
    await domClick(manualAddButton);

    const draftRow = page.locator("tbody tr").filter({ hasText: /Draft Packet/i }).first();
    if (!(await assert(await draftRow.isVisible(), "Draft packet row did not appear after Manual Add Packet.", {
      step: "Open packet section and create a packet draft",
      classification: "state management bug",
      rootCauseHint: "Draft row state did not materialize in packet table.",
      domSelector: "tbody tr",
    }))) {
      return;
    }

    await domFill(draftRow.locator("input").first(), "0.5");
    await draftRow.locator("select").nth(1).selectOption({ label: /Testing/i }).catch(async () => {
      await draftRow.locator("select").nth(1).selectOption("TESTING");
    });

    await domClick(page.getByRole("button", { name: /^Create Packets$/i }).first());

    const createdToast = page.locator("[role='alert'], [role='status']").filter({ hasText: /Packets created/i }).first();
    await assert(await createdToast.isVisible({ timeout: 12000 }).catch(() => false), "Packet creation success feedback did not appear.", {
      step: "Open packet section and create a packet draft",
      classification: "server/API failure",
      rootCauseHint: "Packet create API/save pipeline failed from packet panel.",
      domSelector: "button:has-text('Create Packets')",
    });
  });

  await step("Update existing packet details", async () => {
    const packetRow = page.locator("tbody tr").filter({ hasText: /PKT|Packet/i }).first();
    const savePacketButton = packetRow.getByRole("button", { name: /^Save Packet$/i }).first();

    if (!(await assert(await savePacketButton.isVisible().catch(() => false), "Save Packet action not found for packet row.", {
      step: "Update existing packet details",
      classification: "frontend render error",
      rootCauseHint: "Persisted packet row actions failed to render.",
      domSelector: "button:has-text('Save Packet')",
    }))) {
      return;
    }

    await domFill(packetRow.locator("input").first(), "1.25");
    await domClick(savePacketButton);

    const updatedToast = page.locator("[role='alert'], [role='status']").filter({ hasText: /Packet updated/i }).first();
    await assert(await updatedToast.isVisible({ timeout: 10000 }).catch(() => false), "Packet update success feedback did not appear.", {
      step: "Update existing packet details",
      classification: "server/API failure",
      rootCauseHint: "Packet PATCH save path did not complete successfully.",
      domSelector: "button:has-text('Save Packet')",
    });
  });
}

export const samplePacketCriticalFlow = {
  name: FLOW_NAME,
  prerequisites: ["Job + lot + decision-ready sampling fixture"],
  run: runSamplePacketCriticalFlow,
};
