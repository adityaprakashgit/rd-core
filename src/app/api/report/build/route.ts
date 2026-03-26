import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId is required." },
        { status: 400 }
      );
    }

    // 1. Fetch data for calculations
    const job = await prisma.inspectionJob.findUnique({
      where: { id: jobId },
      include: {
        lots: {
          include: {
            bags: true,
            sampling: true,
          },
        },
        experiments: {
          include: {
            trials: {
              include: {
                measurements: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Not Found", details: "Job not found." }, { status: 404 });
    }

    // 2. Compute Total Weight (Sum of all Bag Net Weights)
    let totalNetWeight = 0;
    let totalBagsFound = 0;
    job.lots.forEach(lot => {
      lot.bags.forEach(bag => {
        totalNetWeight += bag.netWeight || 0;
        totalBagsFound++;
      });
    });

    // 3. Compute Average Composition
    const elementTotals: Record<string, { sum: number; count: number }> = {};
    job.experiments.forEach(exp => {
      exp.trials.forEach(trial => {
        trial.measurements.forEach(m => {
          const el = m.element.toUpperCase().trim();
          if (!elementTotals[el]) {
            elementTotals[el] = { sum: 0, count: 0 };
          }
          // Decimal type handling (prisma Decimal to number)
          elementTotals[el].sum += Number(m.value) || 0;
          elementTotals[el].count += 1;
        });
      });
    });

    const averageComposition = Object.entries(elementTotals).map(([element, data]) => ({
      element,
      average: data.count > 0 ? data.sum / data.count : 0,
      count: data.count,
    }));

    // 4. Validate Missing Data
    const validationErrors: string[] = [];
    if (job.lots.length === 0) {
      validationErrors.push("No lots recorded.");
    }
    
    job.lots.forEach(lot => {
      if (!lot.sampling || (lot.sampling.length === 0)) {
        validationErrors.push(`Lot ${lot.lotNumber}: Missing sampling data.`);
      }
      if (lot.bags.length === 0) {
        validationErrors.push(`Lot ${lot.lotNumber}: No bags recorded.`);
      }
    });

    if (Object.keys(elementTotals).length === 0) {
      validationErrors.push("No lab measurements recorded.");
    }

    return NextResponse.json({
      jobId,
      timestamp: new Date().toISOString(),
      metrics: {
        totalNetWeight: Number(totalNetWeight.toFixed(2)),
        totalBags: totalBagsFound,
        averageComposition,
      },
      validation: {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
      },
      summary: {
        client: job.clientName,
        commodity: job.commodity,
        reference: job.jobReferenceNumber,
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: "System Error", details: err.message },
      { status: 500 }
    );
  }
}
