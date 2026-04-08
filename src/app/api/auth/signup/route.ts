import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createRandomId } from "@/lib/random-id";

function jsonError(error: string, details: string, status: number) {
  return NextResponse.json({ error, details }, { status });
}

function normalizeCompanyId(input: string): string {
  return input.trim().toLowerCase();
}

function deriveDisplayName(email: string): string {
  const [local] = email.split("@");
  return local ? local.replace(/[._-]/g, " ").replace(/\b\w/g, (v) => v.toUpperCase()) : "Admin";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyName?: string;
      loginCode?: string;
      adminEmail?: string;
      password?: string;
    };

    const companyName = body.companyName?.trim() ?? "";
    const loginCode = body.loginCode?.trim() ?? "";
    const adminEmail = body.adminEmail?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";

    if (!companyName || !loginCode || !adminEmail || !password) {
      return jsonError("ValidationError", "Company name, login code, admin email, and password are required.", 400);
    }

    const companyId = normalizeCompanyId(loginCode);
    const passwordHash = await hashPassword(password);

    const existingEmail = await prisma.user.findFirst({
      where: {
        email: adminEmail,
      },
      select: { id: true },
    });

    if (existingEmail) {
      return jsonError("Conflict", "Admin email already exists.", 409);
    }

    const userId = createRandomId();

    await prisma.user.create({
      data: {
        id: userId,
        companyId,
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        profile: {
          create: {
            displayName: deriveDisplayName(adminEmail),
            companyName,
            jobTitle: "Admin",
          },
        },
      },
    });

    return NextResponse.json({
      userId,
      companyId,
      role: "ADMIN",
      email: adminEmail,
      profile: {
        displayName: deriveDisplayName(adminEmail),
        companyName,
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Signup failed.";
    return jsonError("ServerError", details, 500);
  }
}
