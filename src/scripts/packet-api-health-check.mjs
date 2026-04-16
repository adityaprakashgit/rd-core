#!/usr/bin/env node
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const args = {
    sampleId: null,
    jobId: null,
    baseUrl: "http://localhost:3000",
    sessionCookie: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1] ?? null;
    if (token === "--sampleId") {
      args.sampleId = value;
      index += 1;
      continue;
    }
    if (token === "--jobId") {
      args.jobId = value;
      index += 1;
      continue;
    }
    if (token === "--baseUrl") {
      args.baseUrl = value || args.baseUrl;
      index += 1;
      continue;
    }
    if (token === "--sessionCookie") {
      args.sessionCookie = value;
      index += 1;
      continue;
    }
  }
  return args;
}

async function run() {
  const { sampleId, jobId, baseUrl, sessionCookie } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[packet-api-health] DB query check: OK");
  } finally {
    await prisma.$disconnect();
  }

  if (!sampleId && !jobId) {
    console.log("[packet-api-health] Endpoint check skipped (provide --sampleId or --jobId).");
    return;
  }
  if (!sessionCookie) {
    console.log("[packet-api-health] Endpoint check skipped (provide --sessionCookie for authenticated API call).");
    return;
  }

  const url = new URL("/api/rd/packet", baseUrl);
  if (sampleId) {
    url.searchParams.set("sampleId", sampleId);
  } else if (jobId) {
    url.searchParams.set("jobId", jobId);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: sessionCookie,
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`[packet-api-health] Endpoint check failed: ${response.status}`);
    console.error(payload);
    process.exit(1);
  }
  if (!Array.isArray(payload)) {
    console.error("[packet-api-health] Unexpected payload shape: expected array.");
    console.error(payload);
    process.exit(1);
  }

  const first = payload[0] ?? null;
  console.log("[packet-api-health] Endpoint check: OK");
  console.log(
    JSON.stringify(
      {
        count: payload.length,
        firstPacketShape: first
          ? {
              id: typeof first.id,
              sampleId: typeof first.sampleId,
              packetCode: typeof first.packetCode,
              packetStatus: typeof first.packetStatus,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("[packet-api-health] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
