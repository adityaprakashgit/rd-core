import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type MasterType = "STEP" | "CHEMICAL" | "ASSET" | "UNIT" | "TEMPLATE";

export type StepMasterRecord = {
  id: string;
  name: string;
  category: string;
  defaultDurationSeconds: number;
  requiresTimer: boolean;
  allowsChemicals: boolean;
  allowsAssets: boolean;
  requiresAsset: boolean;
  isActive: boolean;
};

export type ChemicalMasterRecord = {
  id: string;
  name: string;
  code: string;
  category: string;
  baseUnit: string;
  allowedUnits: string[];
  stockQuantity: number;
  reorderLevel: number;
  location: string;
  isActive: boolean;
};

export type AssetMasterRecord = {
  id: string;
  name: string;
  code: string;
  category: string;
  availability: "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "UNAVAILABLE";
  location: string;
  calibrationDate: string;
  isActive: boolean;
};

export type UnitMasterRecord = {
  id: string;
  unitCode: string;
  category: "VOLUME" | "WEIGHT" | "COUNT";
  conversionToBase: number;
  isActive: boolean;
};

export type TemplateMasterRecord = {
  id: string;
  name: string;
  notes: string;
  stepNames: string[];
  expectedMeasurements: string[];
  isActive: boolean;
};

type StoreShape = {
  step: StepMasterRecord[];
  chemical: ChemicalMasterRecord[];
  asset: AssetMasterRecord[];
  unit: UnitMasterRecord[];
  template: TemplateMasterRecord[];
};

const storePath = path.join(process.cwd(), "tmp", "playground-masters.json");

const defaultStore: StoreShape = {
  step: [
    {
      id: "step-heating",
      name: "Heating",
      category: "Thermal",
      defaultDurationSeconds: 900,
      requiresTimer: true,
      allowsChemicals: true,
      allowsAssets: true,
      requiresAsset: true,
      isActive: true,
    },
  ],
  chemical: [
    {
      id: "chem-sulfuric-acid",
      name: "Sulfuric Acid",
      code: "CHEM-SA",
      category: "Acids",
      baseUnit: "ml",
      allowedUnits: ["ml", "l"],
      stockQuantity: 4200,
      reorderLevel: 1000,
      location: "Rack A1",
      isActive: true,
    },
  ],
  asset: [
    {
      id: "asset-reactor-01",
      name: "Reactor 01",
      code: "AST-R01",
      category: "Reaction",
      availability: "AVAILABLE",
      location: "Lab Floor 1",
      calibrationDate: "",
      isActive: true,
    },
  ],
  unit: [
    { id: "unit-ml", unitCode: "ml", category: "VOLUME", conversionToBase: 1, isActive: true },
    { id: "unit-l", unitCode: "l", category: "VOLUME", conversionToBase: 1000, isActive: true },
  ],
  template: [
    {
      id: "tpl-leach",
      name: "Leaching Standard",
      notes: "Base template for acid leaching flow.",
      stepNames: ["Heating", "Stirring", "Filtration"],
      expectedMeasurements: ["Fe", "SiO2"],
      isActive: true,
    },
  ],
};

function isMissingTableError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

function typeToKey(type: MasterType): keyof StoreShape {
  switch (type) {
    case "STEP":
      return "step";
    case "CHEMICAL":
      return "chemical";
    case "ASSET":
      return "asset";
    case "UNIT":
      return "unit";
    case "TEMPLATE":
      return "template";
    default:
      return "step";
  }
}

function normalizeRecord(type: MasterType, input: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case "STEP":
      return {
        id: String(input.id ?? ""),
        name: String(input.name ?? ""),
        category: String(input.category ?? ""),
        defaultDurationSeconds: Number(input.defaultDurationSeconds ?? 0),
        requiresTimer: Boolean(input.requiresTimer),
        allowsChemicals: Boolean(input.allowsChemicals),
        allowsAssets: Boolean(input.allowsAssets),
        requiresAsset: Boolean(input.requiresAsset),
        isActive: input.isActive === undefined ? true : Boolean(input.isActive),
      };
    case "CHEMICAL":
      return {
        id: String(input.id ?? ""),
        name: String(input.name ?? ""),
        code: String(input.code ?? ""),
        category: String(input.category ?? ""),
        baseUnit: String(input.baseUnit ?? ""),
        allowedUnits: Array.isArray(input.allowedUnits) ? input.allowedUnits.map((v) => String(v)) : [],
        stockQuantity: Number(input.stockQuantity ?? 0),
        reorderLevel: Number(input.reorderLevel ?? 0),
        location: String(input.location ?? ""),
        isActive: input.isActive === undefined ? true : Boolean(input.isActive),
      };
    case "ASSET":
      return {
        id: String(input.id ?? ""),
        name: String(input.name ?? ""),
        code: String(input.code ?? ""),
        category: String(input.category ?? ""),
        availability: String(input.availability ?? "AVAILABLE"),
        location: String(input.location ?? ""),
        calibrationDate: String(input.calibrationDate ?? ""),
        isActive: input.isActive === undefined ? true : Boolean(input.isActive),
      };
    case "UNIT":
      return {
        id: String(input.id ?? ""),
        unitCode: String(input.unitCode ?? ""),
        category: String(input.category ?? "COUNT"),
        conversionToBase: Number(input.conversionToBase ?? 1),
        isActive: input.isActive === undefined ? true : Boolean(input.isActive),
      };
    case "TEMPLATE":
      return {
        id: String(input.id ?? ""),
        name: String(input.name ?? ""),
        notes: String(input.notes ?? ""),
        stepNames: Array.isArray(input.stepNames) ? input.stepNames.map((v) => String(v)) : [],
        expectedMeasurements: Array.isArray(input.expectedMeasurements) ? input.expectedMeasurements.map((v) => String(v)) : [],
        isActive: input.isActive === undefined ? true : Boolean(input.isActive),
      };
    default:
      return input;
  }
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      step: Array.isArray(parsed.step) ? parsed.step : [],
      chemical: Array.isArray(parsed.chemical) ? parsed.chemical : [],
      asset: Array.isArray(parsed.asset) ? parsed.asset : [],
      unit: Array.isArray(parsed.unit) ? parsed.unit : [],
      template: Array.isArray(parsed.template) ? parsed.template : [],
    };
  } catch {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify(defaultStore, null, 2), "utf8");
    return defaultStore;
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

async function listFileRecords(type: MasterType): Promise<Record<string, unknown>[]> {
  const store = await readStore();
  const key = typeToKey(type);
  return store[key] as unknown as Record<string, unknown>[];
}

async function createFileRecord(type: MasterType, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const store = await readStore();
  const key = typeToKey(type);
  const id = String(input.id ?? `${key}-${Date.now()}`);
  const record = normalizeRecord(type, { ...input, id });
  (store[key] as unknown as Record<string, unknown>[]).push(record);
  await writeStore(store);
  return record;
}

async function updateFileRecord(type: MasterType, id: string, input: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const store = await readStore();
  const key = typeToKey(type);
  const rows = store[key] as unknown as Record<string, unknown>[];
  const index = rows.findIndex((row) => String(row.id) === id);
  if (index < 0) return null;

  const next = normalizeRecord(type, { ...rows[index], ...input, id });
  rows[index] = next;
  await writeStore(store);
  return next;
}

async function removeFileRecord(type: MasterType, id: string): Promise<boolean> {
  const store = await readStore();
  const key = typeToKey(type);
  const rows = store[key] as unknown as Record<string, unknown>[];
  const next = rows.filter((row) => String(row.id) !== id);
  if (next.length === rows.length) return false;
  store[key] = next as never;
  await writeStore(store);
  return true;
}

async function listDbRecords(type: MasterType, companyId: string): Promise<Record<string, unknown>[]> {
  switch (type) {
    case "STEP": {
      const rows = await prisma.rDStepMaster.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } });
      return rows;
    }
    case "CHEMICAL": {
      const rows = await prisma.rDChemicalMaster.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } });
      return rows;
    }
    case "ASSET": {
      const rows = await prisma.rDAssetMaster.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } });
      return rows;
    }
    case "UNIT": {
      const rows = await prisma.rDUnitMaster.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } });
      return rows;
    }
    case "TEMPLATE": {
      const rows = await prisma.rDTemplateMaster.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } });
      return rows;
    }
    default:
      return [];
  }
}

async function createDbRecord(type: MasterType, input: Record<string, unknown>, companyId: string): Promise<Record<string, unknown>> {
  const normalized = normalizeRecord(type, input);

  switch (type) {
    case "STEP":
      return prisma.rDStepMaster.create({
        data: {
          id: String(normalized.id || undefined),
          companyId,
          name: String(normalized.name),
          category: String(normalized.category),
          defaultDurationSeconds: Number(normalized.defaultDurationSeconds),
          requiresTimer: Boolean(normalized.requiresTimer),
          allowsChemicals: Boolean(normalized.allowsChemicals),
          allowsAssets: Boolean(normalized.allowsAssets),
          requiresAsset: Boolean(normalized.requiresAsset),
          isActive: Boolean(normalized.isActive),
        },
      });
    case "CHEMICAL":
      return prisma.rDChemicalMaster.create({
        data: {
          id: String(normalized.id || undefined),
          companyId,
          name: String(normalized.name),
          code: String(normalized.code),
          category: String(normalized.category),
          baseUnit: String(normalized.baseUnit),
          allowedUnits: Array.isArray(normalized.allowedUnits) ? normalized.allowedUnits.map((v) => String(v)) : [],
          stockQuantity: Number(normalized.stockQuantity),
          reorderLevel: Number(normalized.reorderLevel),
          location: String(normalized.location),
          isActive: Boolean(normalized.isActive),
        },
      });
    case "ASSET":
      return prisma.rDAssetMaster.create({
        data: {
          id: String(normalized.id || undefined),
          companyId,
          name: String(normalized.name),
          code: String(normalized.code),
          category: String(normalized.category),
          availability: String(normalized.availability),
          location: String(normalized.location),
          calibrationDate: String(normalized.calibrationDate),
          isActive: Boolean(normalized.isActive),
        },
      });
    case "UNIT":
      return prisma.rDUnitMaster.create({
        data: {
          id: String(normalized.id || undefined),
          companyId,
          unitCode: String(normalized.unitCode),
          category: String(normalized.category),
          conversionToBase: Number(normalized.conversionToBase),
          isActive: Boolean(normalized.isActive),
        },
      });
    case "TEMPLATE":
      return prisma.rDTemplateMaster.create({
        data: {
          id: String(normalized.id || undefined),
          companyId,
          name: String(normalized.name),
          notes: String(normalized.notes),
          stepNames: Array.isArray(normalized.stepNames) ? normalized.stepNames.map((v) => String(v)) : [],
          expectedMeasurements: Array.isArray(normalized.expectedMeasurements)
            ? normalized.expectedMeasurements.map((v) => String(v))
            : [],
          isActive: Boolean(normalized.isActive),
        },
      });
    default:
      return normalized;
  }
}

async function updateDbRecord(type: MasterType, id: string, input: Record<string, unknown>, companyId: string): Promise<Record<string, unknown> | null> {
  const normalized = normalizeRecord(type, input);

  switch (type) {
    case "STEP": {
      const row = await prisma.rDStepMaster.findFirst({ where: { id, companyId } });
      if (!row) return null;
      return prisma.rDStepMaster.update({
        where: { id },
        data: {
          name: String(normalized.name),
          category: String(normalized.category),
          defaultDurationSeconds: Number(normalized.defaultDurationSeconds),
          requiresTimer: Boolean(normalized.requiresTimer),
          allowsChemicals: Boolean(normalized.allowsChemicals),
          allowsAssets: Boolean(normalized.allowsAssets),
          requiresAsset: Boolean(normalized.requiresAsset),
          isActive: Boolean(normalized.isActive),
        },
      });
    }
    case "CHEMICAL": {
      const row = await prisma.rDChemicalMaster.findFirst({ where: { id, companyId } });
      if (!row) return null;
      return prisma.rDChemicalMaster.update({
        where: { id },
        data: {
          name: String(normalized.name),
          code: String(normalized.code),
          category: String(normalized.category),
          baseUnit: String(normalized.baseUnit),
          allowedUnits: Array.isArray(normalized.allowedUnits) ? normalized.allowedUnits.map((v) => String(v)) : [],
          stockQuantity: Number(normalized.stockQuantity),
          reorderLevel: Number(normalized.reorderLevel),
          location: String(normalized.location),
          isActive: Boolean(normalized.isActive),
        },
      });
    }
    case "ASSET": {
      const row = await prisma.rDAssetMaster.findFirst({ where: { id, companyId } });
      if (!row) return null;
      return prisma.rDAssetMaster.update({
        where: { id },
        data: {
          name: String(normalized.name),
          code: String(normalized.code),
          category: String(normalized.category),
          availability: String(normalized.availability),
          location: String(normalized.location),
          calibrationDate: String(normalized.calibrationDate),
          isActive: Boolean(normalized.isActive),
        },
      });
    }
    case "UNIT": {
      const row = await prisma.rDUnitMaster.findFirst({ where: { id, companyId } });
      if (!row) return null;
      return prisma.rDUnitMaster.update({
        where: { id },
        data: {
          unitCode: String(normalized.unitCode),
          category: String(normalized.category),
          conversionToBase: Number(normalized.conversionToBase),
          isActive: Boolean(normalized.isActive),
        },
      });
    }
    case "TEMPLATE": {
      const row = await prisma.rDTemplateMaster.findFirst({ where: { id, companyId } });
      if (!row) return null;
      return prisma.rDTemplateMaster.update({
        where: { id },
        data: {
          name: String(normalized.name),
          notes: String(normalized.notes),
          stepNames: Array.isArray(normalized.stepNames) ? normalized.stepNames.map((v) => String(v)) : [],
          expectedMeasurements: Array.isArray(normalized.expectedMeasurements)
            ? normalized.expectedMeasurements.map((v) => String(v))
            : [],
          isActive: Boolean(normalized.isActive),
        },
      });
    }
    default:
      return null;
  }
}

async function removeDbRecord(type: MasterType, id: string, companyId: string): Promise<boolean> {
  switch (type) {
    case "STEP": {
      const deleted = await prisma.rDStepMaster.deleteMany({ where: { id, companyId } });
      return deleted.count > 0;
    }
    case "CHEMICAL": {
      const deleted = await prisma.rDChemicalMaster.deleteMany({ where: { id, companyId } });
      return deleted.count > 0;
    }
    case "ASSET": {
      const deleted = await prisma.rDAssetMaster.deleteMany({ where: { id, companyId } });
      return deleted.count > 0;
    }
    case "UNIT": {
      const deleted = await prisma.rDUnitMaster.deleteMany({ where: { id, companyId } });
      return deleted.count > 0;
    }
    case "TEMPLATE": {
      const deleted = await prisma.rDTemplateMaster.deleteMany({ where: { id, companyId } });
      return deleted.count > 0;
    }
    default:
      return false;
  }
}

export async function listMasterRecords(type: MasterType, companyId?: string): Promise<Record<string, unknown>[]> {
  if (companyId) {
    try {
      return await listDbRecords(type, companyId);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  return listFileRecords(type);
}

export async function createMasterRecord(
  type: MasterType,
  input: Record<string, unknown>,
  companyId?: string
): Promise<Record<string, unknown>> {
  if (companyId) {
    try {
      return await createDbRecord(type, input, companyId);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  return createFileRecord(type, input);
}

export async function updateMasterRecord(
  type: MasterType,
  id: string,
  input: Record<string, unknown>,
  companyId?: string
): Promise<Record<string, unknown> | null> {
  if (companyId) {
    try {
      return await updateDbRecord(type, id, input, companyId);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  return updateFileRecord(type, id, input);
}

export async function removeMasterRecord(type: MasterType, id: string, companyId?: string): Promise<boolean> {
  if (companyId) {
    try {
      return await removeDbRecord(type, id, companyId);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  return removeFileRecord(type, id);
}
