import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import DocumentRegistryPage from "@/app/documents/page";
import { appTheme } from "@/theme";

vi.mock("@/components/layout/ControlTowerLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@chakra-ui/react", async () => {
  const actual = await vi.importActual<typeof import("@chakra-ui/react")>("@chakra-ui/react");
  return {
    ...actual,
    useToast: () => vi.fn(),
  };
});

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

const payload = {
  rows: [{ id: "r1" }],
  total: 1,
  grouped: {
    jobs: [
      {
        jobId: "job-1",
        jobNumber: "INS-2026-0002",
        client: "Peakamp",
        lotCount: 1,
        documentCount: 5,
        missingDocuments: 1,
        lastUpdated: "2026-04-11T10:00:00.000Z",
        actions: { reportsUrl: "/reports?jobId=job-1" },
        groups: {
          testReports: {
            key: "testReports",
            label: "Test Reports",
            status: "Active",
            sourceStatus: "Active Report",
            count: 1,
            linkedActionUrl: "https://example.com/report.pdf",
          },
          coa: {
            key: "coa",
            label: "COA",
            status: "Superseded",
            sourceStatus: "Previous Report",
            count: 1,
            linkedActionUrl: "https://example.com/coa.pdf",
          },
        },
        lots: [
          {
            lotId: "lot-1",
            lotNumber: "Lot 1",
            packetCount: 2,
            documentCount: 5,
            missingDocuments: 1,
            lastUpdated: "2026-04-11T09:00:00.000Z",
            actions: { workflowUrl: "/jobs/job-1/workflow?lotId=lot-1&section=lots" },
            groups: {
              inspectionUploads: {
                key: "inspectionUploads",
                label: "Inspection Uploads",
                status: "Available",
                sourceStatus: "Available",
                count: 1,
                linkedActionUrl: "https://example.com/inspection.pdf",
              },
              testReports: {
                key: "testReports",
                label: "Test Reports",
                status: "Missing",
                sourceStatus: null,
                count: 0,
                linkedActionUrl: null,
              },
              coa: {
                key: "coa",
                label: "COA",
                status: "Missing",
                sourceStatus: null,
                count: 0,
                linkedActionUrl: null,
              },
              packingList: {
                key: "packingList",
                label: "Packing List",
                status: "Current for Dispatch",
                sourceStatus: "Current for Dispatch",
                count: 1,
                linkedActionUrl: "https://example.com/packing.pdf",
              },
              dispatchDocuments: {
                key: "dispatchDocuments",
                label: "Dispatch Documents",
                status: "Missing",
                sourceStatus: null,
                count: 0,
                linkedActionUrl: null,
              },
            },
          },
        ],
      },
    ],
    totalJobs: 1,
    totalLots: 1,
    totalDocuments: 5,
    totalMissingDocuments: 1,
  },
};

function renderPage() {
  return render(
    <ChakraProvider theme={appTheme}>
      <DocumentRegistryPage />
    </ChakraProvider>,
  );
}

describe("documents page", () => {
  it("renders jobs and opens lot groups from compact mobile flow", async () => {
    const fetchMock = vi.fn(async () => createResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect((await screen.findAllByText("INS-2026-0002")).length).toBeGreaterThan(0);
    fireEvent.click((await screen.findAllByRole("button", { name: "Open Lots" }))[0]);

    expect(await screen.findByText("Lot 1")).toBeInTheDocument();
    expect(screen.getByText("Inspection Uploads")).toBeInTheDocument();
    expect(screen.getByText("Dispatch Documents")).toBeInTheDocument();
  });

  it("shows normalized statuses in lot groups", async () => {
    const fetchMock = vi.fn(async () => createResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    expect((await screen.findAllByText("Active", { selector: "span" })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Superseded", { selector: "span" }).length).toBeGreaterThan(0);
    fireEvent.click((await screen.findAllByRole("button", { name: "Open Lots" }))[0]);
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Current for Dispatch", { selector: "span" })).toBeInTheDocument();
  });

  it("opens group action menu with four actions and disables missing urls", async () => {
    const fetchMock = vi.fn(async () => createResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Open Lots" }))[0]);

    const drawer = await screen.findByRole("dialog");
    const buttons = await within(drawer).findAllByLabelText(/actions$/i);
    const enabledButton = buttons.find((button) => !button.hasAttribute("disabled"));
    expect(enabledButton).toBeTruthy();
    fireEvent.click(enabledButton as HTMLElement);

    expect(await screen.findByRole("menuitem", { name: "View PDF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Download Report PDF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Share PDF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Print PDF" })).toBeInTheDocument();

    const missingButton = buttons.find((button) => button.hasAttribute("disabled"));
    expect(missingButton).toBeTruthy();
  });

  it("opens mobile lots drawer from Open Lots action", async () => {
    const fetchMock = vi.fn(async () => createResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    const openLotsButtons = await screen.findAllByRole("button", { name: "Open Lots" });
    fireEvent.click(openLotsButtons[0]);

    await waitFor(() => {
      const drawer = screen.getByRole("dialog");
      expect(within(drawer).getByText("Lots")).toBeInTheDocument();
      expect(within(drawer).getByText("Lot 1")).toBeInTheDocument();
      expect(within(drawer).getByRole("link", { name: "Open Lot Workflow" })).toBeInTheDocument();
    });
  });
});
