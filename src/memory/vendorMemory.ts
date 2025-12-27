import { MemoryStore, MemoryRecord } from "./memoryStore";

export interface VendorMappings {
  serviceDateField?: string; // "Leistungsdatum"
  defaultCurrency?: string; // "EUR"
  vatInclusiveHints?: string[]; // ["MwSt. inkl.", "VAT included"]
  freightSkuDescriptions?: string[]; // ["Seefracht", "Shipping"]
  skontoPatterns?: string[]; // ["Skonto"]
}

export interface VendorMemoryData {
  vendor: string;
  mappings: VendorMappings;
  poMatchingStrategy?: "single-po-prefer" | "none";
}

function vendorKey(vendor: string): string {
  return `vendor:${vendor}`;
}

export async function getVendorMemory(
  store: MemoryStore,
  vendor: string
): Promise<MemoryRecord<VendorMemoryData> | null> {
  return store.getByKeyAndType(vendorKey(vendor), "vendor");
}

export async function upsertVendorMemory(
  store: MemoryStore,
  vendor: string,
  newData: VendorMemoryData,
  confidenceDelta: number,
  invoiceId?: string
): Promise<MemoryRecord<VendorMemoryData>> {
  const existing = await getVendorMemory(store, vendor);

  const merged: VendorMemoryData = existing
    ? {
        vendor,
        poMatchingStrategy:
          newData.poMatchingStrategy ?? existing.data.poMatchingStrategy,
        mappings: {
          ...existing.data.mappings,
          ...newData.mappings,
          vatInclusiveHints: mergeArray(
            existing.data.mappings.vatInclusiveHints,
            newData.mappings.vatInclusiveHints
          ),
          freightSkuDescriptions: mergeArray(
            existing.data.mappings.freightSkuDescriptions,
            newData.mappings.freightSkuDescriptions
          ),
          skontoPatterns: mergeArray(
            existing.data.mappings.skontoPatterns,
            newData.mappings.skontoPatterns
          ),
        },
      }
    : newData;

  const newConfidence = clamp((existing?.confidence ?? 0.6) + confidenceDelta);

  return store.upsert({
    key: vendorKey(vendor),
    type: "vendor",
    data: merged,
    confidence: newConfidence,
    invoiceId,
  }) as Promise<MemoryRecord<VendorMemoryData>>;
}

function mergeArray(a?: string[], b?: string[]): string[] | undefined {
  if (!a && !b) return undefined;
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]));
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
