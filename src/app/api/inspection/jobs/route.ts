import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInspectionSerial } from "@/lib/serial";

// Cache GET jobs for 30 seconds to prevent refetching on every render
export const revalidate = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { companyId, userId, clientName, commodity } = body;

    if (!companyId || !userId || !clientName || !commodity) {
      return NextResponse.json({ error: "Missing required fields.", details: "companyId, userId, clientName, and commodity are required." }, { status: 400 });
    }

    const serial = await generateInspectionSerial();

    const job = await prisma.inspectionJob.create({
      data: {
        companyId,
        createdByUserId: userId,
        clientName,
        commodity,
        inspectionSerialNumber: serial ?? "",
      },
    });

    return NextResponse.json(job);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create Inspection Job.", details: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const jobs = await prisma.inspectionJob.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(jobs);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch Inspection Jobs.", details: error?.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
