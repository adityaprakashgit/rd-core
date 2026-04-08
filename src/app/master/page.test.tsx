import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MasterPage from "@/app/master/page";
import { appTheme } from "@/theme";

vi.mock("@/components/layout/ControlTowerLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

type Client = {
  clientName: string;
  billToAddress: string;
  shipToAddress: string;
  gstOrId: string | null;
};

type Transporter = {
  transporterName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstOrId: string | null;
};

type Item = {
  itemName: string;
  materialType: string | null;
  description: string | null;
  uom: string | null;
};

type Warehouse = {
  warehouseName: string;
  description: string | null;
};

type MasterFixture = {
  clients?: Client[];
  transporters?: Transporter[];
  items?: Item[];
  warehouses?: Warehouse[];
  inactiveClients?: Client[];
  inactiveTransporters?: Transporter[];
  inactiveItems?: Item[];
  inactiveWarehouses?: Warehouse[];
};

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

function setupFetchMock(fixture: MasterFixture = {}) {
  const clients = fixture.clients ?? [
    { clientName: "Acme", billToAddress: "B-1", shipToAddress: "S-1", gstOrId: "GST-1" },
    { clientName: "Beta", billToAddress: "B-2", shipToAddress: "S-2", gstOrId: "GST-2" },
  ];
  const transporters = fixture.transporters ?? [];
  const items = fixture.items ?? [{ itemName: "Resin", materialType: "INHOUSE", description: "Primary", uom: "kg" }];
  const warehouses = fixture.warehouses ?? [{ warehouseName: "Main WH", description: "North zone" }];
  const inactiveClients = fixture.inactiveClients ?? [{ clientName: "Dormant Co", billToAddress: "B-X", shipToAddress: "S-X", gstOrId: null }];
  const inactiveTransporters = fixture.inactiveTransporters ?? [];
  const inactiveItems = fixture.inactiveItems ?? [];
  const inactiveWarehouses = fixture.inactiveWarehouses ?? [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (method === "POST") {
      return createResponse({});
    }
    if (url === "/api/masters/clients") return createResponse(clients);
    if (url === "/api/masters/transporters") return createResponse(transporters);
    if (url === "/api/masters/items") return createResponse(items);
    if (url === "/api/masters/warehouses") return createResponse(warehouses);
    if (url === "/api/masters/clients?status=inactive") return createResponse(inactiveClients);
    if (url === "/api/masters/transporters?status=inactive") return createResponse(inactiveTransporters);
    if (url === "/api/masters/items?status=inactive") return createResponse(inactiveItems);
    if (url === "/api/masters/warehouses?status=inactive") return createResponse(inactiveWarehouses);
    return createResponse({ details: "Unknown endpoint" }, false);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, fixture: { clients, transporters, items, warehouses, inactiveClients, inactiveTransporters, inactiveItems, inactiveWarehouses } };
}

function renderMasterPage() {
  return render(
    <ChakraProvider theme={appTheme}>
      <MasterPage />
    </ChakraProvider>
  );
}

describe("master registry page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("switches tabs and opens drawer with matching fields", async () => {
    setupFetchMock();
    renderMasterPage();

    await screen.findAllByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "Items" }));
    fireEvent.click(screen.getByRole("button", { name: "New Item" }));

    expect(screen.getByText("Create Item")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Item name")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Material type").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("button", { name: "In-house" })).toBeInTheDocument();
  });

  it("opens edit drawer with prefilled values and resets on new", async () => {
    setupFetchMock();
    renderMasterPage();

    await screen.findAllByText("Acme");

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(screen.getByText("Edit Client")).toBeInTheDocument();
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByDisplayValue("Acme")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "New Client" }));

    expect(screen.getByText("Create Client")).toBeInTheDocument();
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByDisplayValue("Acme")).not.toBeInTheDocument();
    const drawerInputs = within(dialog).getAllByRole("textbox") as HTMLInputElement[];
    expect(drawerInputs.every((input) => input.value === "")).toBe(true);
  });

  it("filters records by search across active and inactive views", async () => {
    setupFetchMock();
    renderMasterPage();

    await screen.findAllByText("Acme");

    const search = screen.getByPlaceholderText("Search names, addresses, phone numbers, GST, UOM...");
    fireEvent.change(search, { target: { value: "zzz-no-match" } });
    expect((await screen.findAllByText("No active client records found.")).length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: "Dormant" } });
    fireEvent.click(screen.getByRole("button", { name: "Inactive" }));

    await waitFor(() => {
      expect(screen.getAllByText("Dormant Co").length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Set active" }).length).toBeGreaterThan(0);
    });
  });
});
