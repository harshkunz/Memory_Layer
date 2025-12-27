import { MemoryStore, MemoryRecord } from "./memoryStore";

export interface ResolutionMemoryData {
  discrepancyType: string; // e.g. "tax_mismatch", "duplicate"
  approvals: number;
  rejections: number;
  lastDecision: "approved" | "rejected" | "corrected";
  notes?: string;
}

function resolutionPrefix(vendor: string): string {
  return `resolution:${vendor}`;
}

function resolutionKey(vendor: string, discrepancyType: string): string {
  return `${resolutionPrefix(vendor)}:${discrepancyType}`;
}

// Fetch resolution history for a vendor
export async function getResolutions(
  store: MemoryStore,
  vendor: string
): Promise<MemoryRecord<ResolutionMemoryData>[]> {
  return store.getAllByPrefix(resolutionPrefix(vendor), "resolution");
}


// Update resolution memory.
// approved  -> system was correct
// corrected -> system fix was accepted
// rejected  -> system was wrong
export async function upsertResolution(
  store: MemoryStore,
  vendor: string,
  discrepancyType: string,
  decision: "approved" | "rejected" | "corrected",
  note?: string
): Promise<MemoryRecord<ResolutionMemoryData>> {

  const key = resolutionKey(vendor, discrepancyType);
  const existing = await store.getByKeyAndType(key, "resolution");
  const isApproval = decision === "approved" || decision === "corrected";

  const updated: ResolutionMemoryData = existing
    ? {
      discrepancyType,
      approvals: isApproval
        ? existing.data.approvals + 1
        : existing.data.approvals,

      rejections:
        decision === "rejected"
          ? existing.data.rejections + 1
          : existing.data.rejections,

      lastDecision: decision,
      notes: note
          ? [existing.data.notes, note].filter(Boolean).join(" | ")
          : existing.data.notes,
    }
  : {
      discrepancyType,
      approvals: isApproval ? 1 : 0,
      rejections: decision === "rejected" ? 1 : 0,
      lastDecision: decision,
      notes: note,
    };

  // Confidence derived from resolution history:
  // approval-dominant → closer to 1, rejection-dominant → closer to 0.
  const total = updated.approvals + updated.rejections;
  const confidence = total === 0 ? 0.5 : updated.approvals / total;

  return store.upsert({
    key,
    type: "resolution",
    data: updated,
    confidence,
    invoiceId: undefined,
  }) as Promise<MemoryRecord<ResolutionMemoryData>>;
}
