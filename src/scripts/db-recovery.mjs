#!/usr/bin/env node
import "dotenv/config";

import net from "node:net";
import { spawnSync } from "node:child_process";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

function log(message) {
  console.log(`[db-recovery] ${message}`);
}

function fail(message, hints = []) {
  console.error(`[db-recovery] ERROR: ${message}`);
  for (const hint of hints) {
    console.error(`[db-recovery] HINT: ${hint}`);
  }
  process.exit(1);
}

function parseDatabaseUrl() {
  if (!DATABASE_URL) {
    fail("DATABASE_URL is missing.", [
      "Set DATABASE_URL in .env before running database commands.",
      'Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rd_core"',
    ]);
  }

  let parsed;
  try {
    parsed = new URL(DATABASE_URL);
  } catch {
    fail("DATABASE_URL is not a valid URL.", [
      'Expected format: postgresql://user:password@host:5432/database',
    ]);
  }

  if (!parsed.protocol.startsWith("postgres")) {
    fail(`DATABASE_URL must use PostgreSQL protocol. Received: ${parsed.protocol}`);
  }

  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) {
    fail("DATABASE_URL must include a database name in the path.");
  }

  return {
    parsed,
    host: parsed.hostname || "localhost",
    port: Number(parsed.port || 5432),
    databaseName,
  };
}

function checkTcpReachability(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2500);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function runPrismaDbExecute(url, sql) {
  const command = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--url", url, "--stdin"],
    { input: sql, encoding: "utf8" },
  );
  return {
    ok: command.status === 0,
    status: command.status ?? 1,
    stdout: command.stdout ?? "",
    stderr: command.stderr ?? "",
  };
}

function runCommand(label, cmd, args) {
  log(`Running ${label}...`);
  const result = spawnSync(cmd, args, { stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${label} failed.`, [
      "Fix the database issue and rerun: npm run db:bootstrap",
    ]);
  }
}

function classifyConnectionError(text, databaseName) {
  const lower = text.toLowerCase();
  if (lower.includes("does not exist") && lower.includes(`"${databaseName.toLowerCase()}"`)) {
    return "MISSING_DATABASE";
  }
  if (lower.includes("authentication failed") || lower.includes("password authentication failed")) {
    return "AUTH_FAILED";
  }
  if (lower.includes("can't reach database server") || lower.includes("connection refused")) {
    return "SERVER_UNREACHABLE";
  }
  return "UNKNOWN";
}

async function doctor() {
  const { host, port, databaseName } = parseDatabaseUrl();
  log(`Checking DATABASE_URL target ${host}:${port}/${databaseName}...`);

  const reachable = await checkTcpReachability(host, port);
  if (!reachable) {
    fail(`Postgres is not reachable at ${host}:${port}.`, [
      "Start PostgreSQL and rerun: npm run db:doctor",
      "Then run: npm run db:bootstrap",
    ]);
  }

  const probe = runPrismaDbExecute(DATABASE_URL, "SELECT 1;");
  if (!probe.ok) {
    const output = `${probe.stderr}\n${probe.stdout}`;
    const reason = classifyConnectionError(output, databaseName);
    if (reason === "MISSING_DATABASE") {
      fail(`Database "${databaseName}" is missing.`, [
        "Run: npm run db:bootstrap",
      ]);
    }
    if (reason === "AUTH_FAILED") {
      fail("Database authentication failed.", [
        "Verify DATABASE_URL username/password and role permissions.",
      ]);
    }
    fail("Database is reachable but query probe failed.", [
      "Run: npm run db:bootstrap",
      "If it still fails, inspect Prisma output above for details.",
    ]);
  }

  log("Database connectivity check passed.");
}

async function bootstrap() {
  const { parsed, databaseName, host, port } = parseDatabaseUrl();
  const reachable = await checkTcpReachability(host, port);
  if (!reachable) {
    fail(`Postgres is not reachable at ${host}:${port}.`, [
      "Start PostgreSQL first, then run: npm run db:bootstrap",
    ]);
  }

  let probe = runPrismaDbExecute(DATABASE_URL, "SELECT 1;");
  if (!probe.ok) {
    const output = `${probe.stderr}\n${probe.stdout}`;
    const reason = classifyConnectionError(output, databaseName);

    if (reason === "MISSING_DATABASE") {
      log(`Database "${databaseName}" missing. Attempting create...`);
      const adminUrl = new URL(parsed.toString());
      adminUrl.pathname = "/postgres";
      const createResult = runPrismaDbExecute(
        adminUrl.toString(),
        `CREATE DATABASE "${databaseName.replace(/"/g, "\"\"")}";`,
      );
      if (!createResult.ok) {
        const createOutput = `${createResult.stderr}\n${createResult.stdout}`.toLowerCase();
        if (!createOutput.includes("already exists")) {
          fail(`Could not create database "${databaseName}".`, [
            "Ensure the configured DB user can create databases, or create it manually.",
          ]);
        }
      }

      probe = runPrismaDbExecute(DATABASE_URL, "SELECT 1;");
      if (!probe.ok) {
        fail(`Database "${databaseName}" still not reachable after create attempt.`, [
          "Verify DATABASE_URL and Postgres permissions.",
        ]);
      }
    } else if (reason === "AUTH_FAILED") {
      fail("Authentication failed while bootstrapping.", [
        "Fix DATABASE_URL credentials and rerun bootstrap.",
      ]);
    } else {
      fail("Bootstrap probe failed before migrations.", [
        "Inspect Prisma output and resolve connectivity/config issues.",
      ]);
    }
  }

  runCommand("Prisma migrate deploy", "npx", ["prisma", "migrate", "deploy"]);
  runCommand("Prisma generate", "npx", ["prisma", "generate"]);

  log("Bootstrap complete. You can now run: npm run dev");
}

async function predev() {
  try {
    await doctor();
  } catch {
    fail("Database predev guard failed.", [
      "Run: npm run db:doctor",
      "Then: npm run db:bootstrap",
      "Then: npm run dev",
    ]);
  }
}

const mode = process.argv[2] ?? "doctor";
if (mode === "doctor") {
  await doctor();
} else if (mode === "bootstrap") {
  await bootstrap();
} else if (mode === "predev") {
  await predev();
} else {
  fail(`Unknown mode "${mode}".`, ["Use one of: doctor | bootstrap | predev"]);
}
