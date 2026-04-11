#!/usr/bin/env node
// HEADED VISIBLE REPRO VERSION (compatibility wrapper):
// Delegates to the canonical regression runner using the create-job flow.

import { spawn } from "node:child_process";

const passthroughArgs = process.argv.slice(2);
const hasFlowArg = passthroughArgs.includes("--flow");
const runnerArgs = hasFlowArg ? passthroughArgs : ["--flow", "create-job", ...passthroughArgs];

const child = spawn("node", ["scripts/e2e/recycos-regression-pack.mjs", ...runnerArgs], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
