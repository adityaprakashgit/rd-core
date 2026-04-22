#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

function detectLanHost() {
  if (process.env.LAN_HOST && process.env.LAN_HOST.trim()) {
    return process.env.LAN_HOST.trim();
  }

  return "localhost";
}

const [, , nextCommand = "dev", ...extraArgs] = process.argv;
const host = detectLanHost();
const nextBinary = process.platform === "win32"
  ? path.join(process.cwd(), "node_modules", ".bin", "next.cmd")
  : path.join(process.cwd(), "node_modules", ".bin", "next");

const commandArgs = [nextCommand, "--hostname", host, ...extraArgs];

const appUrl = `http://${host}:3000`;

console.log("");
console.log(`[next-lan] binding ${nextCommand} to ${host}`);
console.log(`[next-lan] Open locally: ${appUrl}`);
console.log("");

const child = spawn(nextBinary, commandArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
