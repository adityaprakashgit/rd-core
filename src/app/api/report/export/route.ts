import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// Declaration for jspdf-autotable to avoid TS errors on the 'autoTable' property
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, format } = await req.json();

    if (!jobId || !format) {
      return NextResponse.json(
        { error: "Validation Error", details: "jobId and format ('pdf' or 'excel') are required." },
        { status: 400 }
      );
    }

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

    // --- REUSE REPORT BUILDER LOGIC FOR SUMMARY ---
    let totalNetWeight = 0;
    let totalBagsFound = 0;
    job.lots.forEach(lot => {
      lot.bags.forEach(bag => {
        totalNetWeight += bag.netWeight || 0;
        totalBagsFound++;
      });
    });

    const elementTotals: Record<string, { sum: number; count: number }> = {};
    job.experiments.forEach(exp => {
      exp.trials.forEach(trial => {
        trial.measurements.forEach(m => {
          const el = m.element.toUpperCase().trim();
          if (!elementTotals[el]) {
            elementTotals[el] = { sum: 0, count: 0 };
          }
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
    // ----------------------------------------------

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      
      // 1. ANALYSIS SUMMARY SHEET
      const analysisSheet = workbook.addWorksheet("Analysis Summary");
      analysisSheet.columns = [
        { header: "Metric", key: "metric", width: 25 },
        { header: "Value", key: "value", width: 30 },
      ];
      analysisSheet.addRow({ metric: "Client Name", value: job.clientName });
      analysisSheet.addRow({ metric: "Reference #", value: job.jobReferenceNumber });
      analysisSheet.addRow({ metric: "Total Bags", value: totalBagsFound });
      analysisSheet.addRow({ metric: "Total Net Weight", value: `${totalNetWeight.toFixed(2)} kg` });
      analysisSheet.addRow({}); // spacer
      analysisSheet.addRow({ metric: "AVERAGE COMPOSITION" });
      averageComposition.forEach(comp => {
        analysisSheet.addRow({ metric: comp.element, value: comp.average.toFixed(4) });
      });

      // 2. LOT REGISTRY SHEET
      const lotSheet = workbook.addWorksheet("Lot Registry");
      lotSheet.columns = [
        { header: "Lot #", key: "lotNumber", width: 15 },
        { header: "Bags", key: "bags", width: 10 },
        { header: "Gross Weight (kg)", key: "gross", width: 20 },
        { header: "Net Weight (kg)", key: "net", width: 20 },
      ];
      job.lots.forEach(lot => {
        const netSum = lot.bags.reduce((acc, b) => acc + (b.netWeight || 0), 0);
        lotSheet.addRow({
          lotNumber: lot.lotNumber,
          bags: lot.bags.length,
          gross: Number(lot.grossWeightKg) || 0,
          net: netSum,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=Report_${job.jobReferenceNumber}.xlsx`,
        },
      });
    }

    if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setTextColor(63, 81, 181); // Purple-ish
      doc.text("INSPECTION & ANALYSIS REPORT", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Certificate No: ${job.jobReferenceNumber.slice(0, 12).toUpperCase()}`, 20, 30);
      doc.text(`Timestamp: ${new Date().toLocaleString()}`, 190, 30, { align: "right" });

      // Job Details
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 35, 190, 35);

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`CLIENT:`, 20, 45);
      doc.text(job.clientName, 50, 45);
      doc.text(`COMMODITY:`, 20, 52);
      doc.text(job.commodity, 50, 52);

      // ANALYSIS SUMMARY TABLE
      doc.setFontSize(13);
      doc.text("ANALYSIS SUMMARY", 20, 65);
      doc.autoTable({
        startY: 70,
        head: [["Metric", "Value"]],
        body: [
          ["Total Recorded Bags", totalBagsFound],
          ["Aggregated Net Weight", `${totalNetWeight.toFixed(2)} kg`],
          ...averageComposition.map(c => [`Avg ${c.element}`, c.average.toFixed(4)])
        ],
        theme: "striped",
        headStyles: { fillColor: [63, 81, 181] },
      });

      // LOT REGISTRY
      const lotY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("LOT REGISTRY", 20, lotY);
      doc.autoTable({
        startY: lotY + 5,
        head: [["Lot #", "Bags", "Net Weight (kg)"]],
        body: job.lots.map(lot => [
          lot.lotNumber,
          lot.bags.length,
          lot.bags.reduce((acc, b) => acc + (b.netWeight || 0), 0).toFixed(2),
        ]),
        headStyles: { fillColor: [100, 100, 100] },
      });

      const pdfOutput = doc.output("arraybuffer");
      return new NextResponse(pdfOutput, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=Report_${job.jobReferenceNumber}.pdf`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid Format", details: "Supported formats: pdf, excel" }, { status: 400 });

  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: "System Error", details: error.message },
      { status: 500 }
    );
  }
}

