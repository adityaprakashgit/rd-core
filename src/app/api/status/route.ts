import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StatusPayload = {
  ok: boolean;
  checkedAt: string;
  services: {
    api: {
      ok: boolean;
      latencyMs: number;
    };
    database: {
      ok: boolean;
      latencyMs: number;
      error?: string;
    };
  };
  checks: {
    migrationsApplied?: number;
    requiredTablesOk?: boolean;
    usersWithPassword?: number;
  };
};

const REQUIRED_TABLES = ["User", "UserProfile", "InspectionJob", "InspectionLot", "Sampling", "AuditLog"] as const;

export async function GET() {
  const apiStart = Date.now();

  const payload: StatusPayload = {
    ok: false,
    checkedAt: new Date().toISOString(),
    services: {
      api: {
        ok: true,
        latencyMs: 0,
      },
      database: {
        ok: false,
        latencyMs: 0,
      },
    },
    checks: {},
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    payload.services.database.ok = true;
    payload.services.database.latencyMs = Date.now() - dbStart;

    const migrations = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      'SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"'
    );
    payload.checks.migrationsApplied = Number(migrations[0]?.count ?? 0);

    const tableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    );
    const existing = new Set(tableRows.map((row) => row.table_name));
    payload.checks.requiredTablesOk = REQUIRED_TABLES.every((name) => existing.has(name));

    const usersWithPassword = await prisma.user.count({
      where: {
        passwordHash: {
          not: null,
        },
      },
    });
    payload.checks.usersWithPassword = usersWithPassword;
  } catch (error) {
    payload.services.database.ok = false;
    payload.services.database.latencyMs = 0;
    payload.services.database.error = error instanceof Error ? error.message : "Database check failed.";
  }

  payload.services.api.latencyMs = Date.now() - apiStart;
  payload.ok = payload.services.api.ok && payload.services.database.ok && payload.checks.requiredTablesOk !== false;

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}
