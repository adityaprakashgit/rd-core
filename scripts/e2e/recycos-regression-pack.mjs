#!/usr/bin/env node

import { checkDbReachable, startDevServerIfNeeded, stopDevServer } from "./regression/core/env.mjs";
import { executeFlow } from "./regression/core/harness.mjs";
import { createJobFlow } from "./regression/flows/create-job.mjs";
import { jobBasicsUpdateFlow } from "./regression/flows/job-basics-update.mjs";
import { samplePacketCriticalFlow } from "./regression/flows/sample-packet-critical.mjs";
import { reportCriticalFlow } from "./regression/flows/report-critical.mjs";
import { qaDecisionFlow } from "./regression/flows/qa-decision.mjs";

const FLOW_MAP = new Map([
  [createJobFlow.name, createJobFlow],
  [jobBasicsUpdateFlow.name, jobBasicsUpdateFlow],
  [samplePacketCriticalFlow.name, samplePacketCriticalFlow],
  [reportCriticalFlow.name, reportCriticalFlow],
  [qaDecisionFlow.name, qaDecisionFlow],
]);

const DEFERRED_FLOW = {
  name: "dispatch-document",
  reason: "Deferred in v1: dispatch/document generation path is still changing and not yet automation-stable.",
};

function getArgValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function hasArg(argv, flag) {
  return argv.includes(flag);
}

function resolveRunConfig(argv) {
  const requestedFlow = getArgValue(argv, "--flow");
  const runAll = hasArg(argv, "--all");
  const headed = hasArg(argv, "--headed");
  const headless = hasArg(argv, "--headless") || !headed;

  if (runAll && requestedFlow) {
    throw new Error("Use either --all or --flow <name>, not both.");
  }

  const baseUrl = getArgValue(argv, "--base-url") || process.env.REPRO_BASE_URL || "http://localhost:3000";
  const slowMoArg = getArgValue(argv, "--slow-mo") || process.env.REPRO_SLOW_MO_MS || null;
  const slowMoMs = Number(slowMoArg ?? (headed ? "400" : "0"));

  if (!Number.isFinite(slowMoMs) || slowMoMs < 0) {
    throw new Error("--slow-mo must be a non-negative number.");
  }

  let selectedFlowNames;
  if (runAll) {
    selectedFlowNames = [...Array.from(FLOW_MAP.keys()), DEFERRED_FLOW.name];
  } else if (requestedFlow) {
    if (requestedFlow === DEFERRED_FLOW.name) {
      selectedFlowNames = [requestedFlow];
    } else if (FLOW_MAP.has(requestedFlow)) {
      selectedFlowNames = [requestedFlow];
    } else {
      const supported = `${Array.from(FLOW_MAP.keys()).join(", ")}, ${DEFERRED_FLOW.name}`;
      throw new Error(`Unsupported flow '${requestedFlow}'. Supported flows: ${supported}`);
    }
  } else {
    throw new Error("Missing target flow. Use --flow <name> or --all.");
  }

  return {
    selectedFlowNames,
    runAll,
    options: {
      headless,
      slowMoMs,
      stepDelayMs: headed ? 900 : 300,
      viewportWidth: 1440,
      viewportHeight: 900,
      interactionShield: true,
    },
    baseUrl,
  };
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/e2e/recycos-regression-pack.mjs --flow <name> [--headed|--headless] [--slow-mo 400] [--base-url http://localhost:3000]");
  console.log("  node scripts/e2e/recycos-regression-pack.mjs --all [--headed|--headless] [--slow-mo 400] [--base-url http://localhost:3000]");
  console.log(`Flows: ${Array.from(FLOW_MAP.keys()).join(", ")}`);
  console.log(`Deferred: ${DEFERRED_FLOW.name} (${DEFERRED_FLOW.reason})`);
}

async function run() {
  const argv = process.argv.slice(2);
  if (hasArg(argv, "--help") || hasArg(argv, "-h")) {
    printUsage();
    return 0;
  }

  const config = resolveRunConfig(argv);
  const cwd = process.cwd();
  const sharedState = { terminalEvents: [] };
  const flowResults = [];

  console.log("[REGRESSION] Starting Recycos critical-flow browser regression pack");
  console.log(`[REGRESSION] baseUrl=${config.baseUrl}`);
  console.log(`[REGRESSION] mode=${config.options.headless ? "headless" : "headed"} slowMo=${config.options.slowMoMs}ms`);

  const db = await checkDbReachable();
  if (!db.ok) {
    console.error(`[REGRESSION] Preflight failed: ${db.message}`);
    return 1;
  }

  const startup = await startDevServerIfNeeded({
    cwd,
    baseUrl: config.baseUrl,
    onTerminalLine: (event) => {
      sharedState.terminalEvents.push(event);
    },
  });

  if (!startup.ok) {
    console.error(`[REGRESSION] Startup failed: ${startup.message}`);
    return 1;
  }

  let exitCode = 0;
  try {
    for (const flowName of config.selectedFlowNames) {
      if (flowName === DEFERRED_FLOW.name) {
        const skipped = {
          result: "SKIP",
          flowName,
          firstFailingStep: null,
          exactError: null,
          rootCauseHint: DEFERRED_FLOW.reason,
          currentUrl: null,
          activeUser: null,
          artifactPaths: null,
        };
        flowResults.push(skipped);
        console.log(`[FLOW:${flowName}] RESULT=SKIP`);
        console.log(`[FLOW:${flowName}] REASON=${DEFERRED_FLOW.reason}`);
        continue;
      }

      const flow = FLOW_MAP.get(flowName);
      if (!flow) {
        const missing = {
          result: "FAIL",
          flowName,
          firstFailingStep: "runner:flow-resolution",
          exactError: `Flow module '${flowName}' could not be resolved.`,
          rootCauseHint: "Runner flow registry mismatch.",
          currentUrl: null,
          activeUser: null,
          artifactPaths: null,
        };
        flowResults.push(missing);
        exitCode = 1;
        continue;
      }

      console.log(`[FLOW:${flowName}] Prerequisites: ${flow.prerequisites.join("; ")}`);
      const summary = await executeFlow({
        flowName,
        flowFn: flow.run,
        options: config.options,
        baseUrl: config.baseUrl,
        cwd,
        sharedState,
      });

      flowResults.push(summary);
      console.log(`[FLOW:${flowName}] RESULT=${summary.result}`);
      console.log(`[FLOW:${flowName}] FIRST_FAILING_STEP=${summary.firstFailingStep ?? "n/a"}`);
      console.log(`[FLOW:${flowName}] EXACT_ERROR=${summary.exactError ?? "n/a"}`);
      console.log(`[FLOW:${flowName}] ROOT_CAUSE_HINT=${summary.rootCauseHint ?? "n/a"}`);
      console.log(`[FLOW:${flowName}] ARTIFACT_ROOT=${summary.artifactPaths?.root ?? "n/a"}`);

      if (summary.result !== "PASS") {
        exitCode = 1;
      }
    }
  } finally {
    if (!startup.usedExistingServer) {
      await stopDevServer(startup.devServer);
    }
  }

  console.log("\n[REGRESSION] Flow Matrix");
  for (const result of flowResults) {
    const shortError = result.exactError ? String(result.exactError).slice(0, 140) : "";
    console.log(`- ${result.flowName}: ${result.result}${shortError ? ` | ${shortError}` : ""}`);
  }

  const failed = flowResults.filter((result) => result.result === "FAIL").length;
  const passed = flowResults.filter((result) => result.result === "PASS").length;
  const skipped = flowResults.filter((result) => result.result === "SKIP").length;
  console.log(`[REGRESSION] Totals: pass=${passed} fail=${failed} skip=${skipped}`);

  return exitCode;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error("[REGRESSION] Runner crashed");
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    printUsage();
    process.exitCode = 1;
  });
