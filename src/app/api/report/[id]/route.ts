import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const snapshot = await prisma.reportSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Not Found", details: "Snapshot not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(snapshot);
  } catch (err: any) {
    return NextResponse.json(
      { error: "System Error", details: err.message },
      { status: 500 }
    );
  }
}
