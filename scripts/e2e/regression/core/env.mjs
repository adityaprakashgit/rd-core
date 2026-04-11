import { spawn } from "node:child_process";
import net from "node:net";

export async function isHttpReady(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.status > 0;
  } catch {
    return false;
  }
}

export async function checkDbReachable(host = "127.0.0.1", port = 5432, timeoutMs = 3500) {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    const done = (ok, message) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ ok, message });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true, `Connected to ${host}:${port}`));
    socket.once("timeout", () => done(false, `Timeout connecting to ${host}:${port}`));
    socket.once("error", (error) => done(false, error?.message || `Connection error to ${host}:${port}`));
    socket.connect(port, host);
  });
}

export async function startDevServerIfNeeded({ cwd, baseUrl, onTerminalLine }) {
  const alreadyReady = await isHttpReady(`${baseUrl}/login`);
  if (alreadyReady) {
    return { ok: true, usedExistingServer: true, devServer: null, message: "Using existing local server." };
  }

  return await new Promise((resolve) => {
    const child = spawn("npm", ["run", "dev"], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const emitLines = (chunk, source) => {
      const lines = String(chunk)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const line of lines) {
        onTerminalLine?.({ source, line, at: new Date().toISOString() });
      }
    };

    child.stdout.on("data", (chunk) => emitLines(chunk, "stdout"));
    child.stderr.on("data", (chunk) => emitLines(chunk, "stderr"));

    const startedAt = Date.now();
    const timeoutMs = 120000;

    const timer = setInterval(async () => {
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        resolve({
          ok: false,
          usedExistingServer: false,
          devServer: child,
          message: "Timed out waiting for app readiness at http://localhost:3000.",
        });
        return;
      }
      const ready = await isHttpReady(`${baseUrl}/login`);
      if (ready) {
        clearInterval(timer);
        resolve({ ok: true, usedExistingServer: false, devServer: child, message: "App is ready." });
      }
    }, 1000);

    child.on("exit", (code) => {
      clearInterval(timer);
      resolve({
        ok: false,
        usedExistingServer: false,
        devServer: child,
        message: `Dev server exited early with code ${code}.`,
      });
    });
  });
}

export async function stopDevServer(child) {
  if (!child) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (!child.killed) {
    child.kill("SIGKILL");
  }
}
