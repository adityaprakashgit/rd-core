export type ExpectedUpdatedAtParseResult =
  | { ok: true; value: Date }
  | { ok: false; message: string };

export function parseExpectedUpdatedAt(raw: unknown): ExpectedUpdatedAtParseResult {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, message: "expectedUpdatedAt is required." };
  }

  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: "expectedUpdatedAt must be a valid ISO date string." };
  }

  return { ok: true, value: parsed };
}

export function isLotVersionConflict(currentUpdatedAt: string | Date, expectedUpdatedAt: Date): boolean {
  const currentMs = new Date(currentUpdatedAt).getTime();
  const expectedMs = expectedUpdatedAt.getTime();

  if (Number.isNaN(currentMs)) {
    return true;
  }

  return currentMs !== expectedMs;
}
