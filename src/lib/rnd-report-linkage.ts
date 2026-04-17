import type { PrismaClient, ResultPrecedenceStatus, RndJobStatus } from "@prisma/client";

type RndLineageDb = Pick<PrismaClient, "rndJob" | "rndReportVersion">;

export type LineageResultRow = {
  id: string;
  rndJobNumber: string;
  status: RndJobStatus;
  resultPrecedence: ResultPrecedenceStatus;
  reviewedAt: Date | null;
  updatedAt: Date;
};

export type LineageReportRow = {
  id: string;
  precedence: ResultPrecedenceStatus;
  rndJobId: string;
  reportSnapshotId: string;
  updatedAt: Date;
  createdAt: Date;
  rndJob: {
    id: string;
    rndJobNumber: string;
    status: RndJobStatus;
  };
  reportSnapshot: {
    id: string;
    createdAt: Date;
  };
};

export type RndLineageLinkage = {
  activeResult: LineageResultRow | null;
  supersededResults: LineageResultRow[];
  activeReport: LineageReportRow | null;
  previousReports: LineageReportRow[];
  defaultReportUrl: string | null;
  defaultCoaUrl: string | null;
};

export type ActiveOutputSelectionSource = "LINEAGE" | "LEGACY_FALLBACK";

export type ActiveOutputRef = {
  snapshotId: string;
  url: string;
  generatedAt: string | null;
  rndJobNumber: string | null;
};

export type PreviousOutputRef = {
  snapshotId: string;
  url: string;
  generatedAt: string | null;
  rndJobNumber: string;
  status: "Previous Report";
};

export type LineageActiveOutputSelection = {
  activeReport: ActiveOutputRef | null;
  activeCoa: ActiveOutputRef | null;
  currentForDispatch: ActiveOutputRef | null;
  previousReports: PreviousOutputRef[];
  selectionSource: ActiveOutputSelectionSource | null;
};

function sortResults(rows: LineageResultRow[]) {
  return [...rows].sort((left, right) => {
    const leftTs = left.reviewedAt?.getTime() ?? left.updatedAt.getTime();
    const rightTs = right.reviewedAt?.getTime() ?? right.updatedAt.getTime();
    return rightTs - leftTs;
  });
}

function sortReports(rows: LineageReportRow[]) {
  return [...rows].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function loadRndLineageLinkage(
  db: RndLineageDb,
  input: { companyId: string; parentJobId: string; sampleId: string },
): Promise<RndLineageLinkage> {
  const [resultRowsRaw, reportRowsRaw] = await Promise.all([
    db.rndJob.findMany({
      where: {
        companyId: input.companyId,
        parentJobId: input.parentJobId,
        sampleId: input.sampleId,
        status: { in: ["APPROVED", "COMPLETED"] },
      },
      orderBy: [{ reviewedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        rndJobNumber: true,
        status: true,
        resultPrecedence: true,
        reviewedAt: true,
        updatedAt: true,
      },
    }),
    db.rndReportVersion.findMany({
      where: {
        companyId: input.companyId,
        parentJobId: input.parentJobId,
        sampleId: input.sampleId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        precedence: true,
        rndJobId: true,
        reportSnapshotId: true,
        updatedAt: true,
        createdAt: true,
        rndJob: {
          select: {
            id: true,
            rndJobNumber: true,
            status: true,
          },
        },
        reportSnapshot: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const resultRows = sortResults(resultRowsRaw);
  const activeResult = resultRows.find((row) => row.resultPrecedence === "ACTIVE") ?? resultRows[0] ?? null;
  const supersededResults = resultRows.filter((row) => row.id !== activeResult?.id);

  const reportRows = sortReports(reportRowsRaw);
  const activeReport = reportRows.find((row) => row.precedence === "ACTIVE") ?? null;
  const previousReports = reportRows.filter((row) => row.id !== activeReport?.id);
  const defaultSnapshotId = activeReport?.reportSnapshotId ?? null;

  return {
    activeResult,
    supersededResults,
    activeReport,
    previousReports,
    defaultReportUrl: defaultSnapshotId ? `/api/report/export?snapshotId=${defaultSnapshotId}&format=pdf&documentType=EXPORT` : null,
    defaultCoaUrl: defaultSnapshotId ? `/api/report/export?snapshotId=${defaultSnapshotId}&format=pdf&documentType=COA` : null,
  };
}

export async function resolveActiveOutputForLineage(
  db: RndLineageDb,
  input: {
    companyId: string;
    parentJobId: string;
    sampleId: string;
    fallbackSnapshots?: Array<{ id: string; createdAt: Date }>;
  },
): Promise<LineageActiveOutputSelection> {
  const linkage = await loadRndLineageLinkage(db, {
    companyId: input.companyId,
    parentJobId: input.parentJobId,
    sampleId: input.sampleId,
  });

  const sortedFallback = [...(input.fallbackSnapshots ?? [])].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
  const fallbackActive = sortedFallback[0] ?? null;

  const hasLineageActive = Boolean(linkage.activeReport?.reportSnapshotId);
  const activeSnapshotId = linkage.activeReport?.reportSnapshotId ?? fallbackActive?.id ?? null;
  const activeGeneratedAt = linkage.activeReport?.reportSnapshot?.createdAt ?? fallbackActive?.createdAt ?? null;
  const activeRndJobNumber = linkage.activeReport?.rndJob?.rndJobNumber ?? null;

  if (!activeSnapshotId) {
    return {
      activeReport: null,
      activeCoa: null,
      currentForDispatch: null,
      previousReports: linkage.previousReports.map((row) => ({
        snapshotId: row.reportSnapshotId,
        url: `/api/report/export?snapshotId=${row.reportSnapshotId}&format=pdf&documentType=EXPORT`,
        generatedAt: row.reportSnapshot.createdAt.toISOString(),
        rndJobNumber: row.rndJob.rndJobNumber,
        status: "Previous Report",
      })),
      selectionSource: null,
    };
  }

  const activeRef: ActiveOutputRef = {
    snapshotId: activeSnapshotId,
    url: `/api/report/export?snapshotId=${activeSnapshotId}&format=pdf&documentType=EXPORT`,
    generatedAt: activeGeneratedAt ? activeGeneratedAt.toISOString() : null,
    rndJobNumber: activeRndJobNumber,
  };

  return {
    activeReport: activeRef,
    activeCoa: activeRef,
    currentForDispatch: activeRef,
    previousReports: linkage.previousReports.map((row) => ({
      snapshotId: row.reportSnapshotId,
      url: `/api/report/export?snapshotId=${row.reportSnapshotId}&format=pdf&documentType=EXPORT`,
      generatedAt: row.reportSnapshot.createdAt.toISOString(),
      rndJobNumber: row.rndJob.rndJobNumber,
      status: "Previous Report",
    })),
    selectionSource: hasLineageActive ? "LINEAGE" : "LEGACY_FALLBACK",
  };
}
