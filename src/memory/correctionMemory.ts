
import { MemoryStore, MemoryRecord } from "./memoryStore";

export interface CorrectionMemoryData {
  patternId: string;           // e.g. "qty_mismatch_dn", "vat_inclusive"
  description: string;
  correctionRule: string;      // e.g. "adjust qty to delivery note"
  discrepancyType?: string;    // optional, used to link to resolution memory
}

function correctionKey(vendor: string, patternId: string): string {
  return `correction:${vendor}:${patternId}`;
}

function correctionPrefix(vendor: string): string {
  return `correction:${vendor}`;
}

export async function getCorrections(
  store: MemoryStore,
  vendor: string
): Promise<MemoryRecord<CorrectionMemoryData>[]> {
  return store.getAllByPrefix(correctionPrefix(vendor), "correction");
}

export async function upsertCorrection(
  store: MemoryStore,
  vendor: string,
  data: CorrectionMemoryData,
  confidenceDelta: number,
  invoiceId?: string
): Promise<MemoryRecord<CorrectionMemoryData>> {
  const key = correctionKey(vendor, data.patternId);
  const existing = await store.getByKeyAndType(key, "correction");
  const merged: CorrectionMemoryData = existing
    ? { ...existing.data, ...data }
    : data;

  const newConfidence = clamp((existing?.confidence ?? 0.6) + confidenceDelta);

  return store.upsert({
    key,
    type: "correction",
    data: merged,
    confidence: newConfidence,
    invoiceId,
  }) as Promise<MemoryRecord<CorrectionMemoryData>>;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
