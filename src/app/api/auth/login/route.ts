import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeCompanyId(input: string): string {
  return input.trim().toLowerCase();
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}

const RATE_LIMIT_MAX_ATTEMPTS = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LOCK_MAX_FAILED_ATTEMPTS = 5;
const ACCOUNT_LOCK_WINDOW_MS = 15 * 60 * 1000;

async function recordLoginAttempt(input: {
  companyId: string;
  email: string;
  ipAddress: string;
  userId?: string;
  success: boolean;
  outcome: string;
}): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      companyId: input.companyId,
      email: input.email,
      ipAddress: input.ipAddress,
      userId: input.userId,
      success: input.success,
      outcome: input.outcome,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      loginCode?: string;
      email?: string;
      password?: string;
    };

    const loginCode = body.loginCode?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";

    if (!loginCode || !email || !password) {
      return jsonError("ValidationError", "Login code, email, and password are required.", 400);
    }

    const companyId = normalizeCompanyId(loginCode);
    const ip = getClientIp(request);

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentFailedAttempts = await prisma.loginAttempt.count({
      where: {
        companyId,
        email,
        ipAddress: ip,
        success: false,
        createdAt: {
          gte: windowStart,
        },
      },
    });

    if (recentFailedAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      await recordLoginAttempt({
        companyId,
        email,
        ipAddress: ip,
        success: false,
        outcome: "RATE_LIMITED",
      });
      return jsonError("RateLimited", "Too many login attempts. Please retry later.", 429);
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        passwordHash: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        role: true,
        profile: {
          select: {
            displayName: true,
            companyName: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      await recordLoginAttempt({
        companyId,
        email,
        ipAddress: ip,
        success: false,
        outcome: "INVALID_CREDENTIALS",
      });
      return jsonError("Unauthorized", "Invalid credentials.", 401);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await recordLoginAttempt({
        companyId,
        email,
        ipAddress: ip,
        userId: user.id,
        success: false,
        outcome: "ACCOUNT_LOCKED",
      });
      return jsonError("AccountLocked", "Account temporarily locked due to repeated failed attempts.", 423);
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      const nextFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = nextFailedAttempts >= ACCOUNT_LOCK_MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : nextFailedAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + ACCOUNT_LOCK_WINDOW_MS) : null,
        },
      });
      await recordLoginAttempt({
        companyId,
        email,
        ipAddress: ip,
        userId: user.id,
        success: false,
        outcome: shouldLock ? "LOCK_APPLIED" : "INVALID_CREDENTIALS",
      });
      if (shouldLock) {
        return jsonError("AccountLocked", "Account temporarily locked due to repeated failed attempts.", 423);
      }
      return jsonError("Unauthorized", "Invalid credentials.", 401);
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }
    await recordLoginAttempt({
      companyId,
      email,
      ipAddress: ip,
      userId: user.id,
      success: true,
      outcome: "SUCCESS",
    });

    return NextResponse.json({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      profile: {
        displayName: user.profile?.displayName ?? user.email ?? "User",
        companyName: user.profile?.companyName ?? user.companyId,
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Login failed.";
    return jsonError("ServerError", details, 500);
  }
}
