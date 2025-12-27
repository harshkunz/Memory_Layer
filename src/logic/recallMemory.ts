
import { Invoice } from "../models/invoiceModel";
import { MemoryStore, MemoryRecord } from "../memory/memoryStore";
import { VendorMemoryData, getVendorMemory } from "../memory/vendorMemory";
import { CorrectionMemoryData, getCorrections } from "../memory/correctionMemory";
import { ResolutionMemoryData,getResolutions } from "../memory/resolutionMemory";

export interface RecalledMemory {
  vendorMemory: MemoryRecord<VendorMemoryData> | null;
  correctionMemory: MemoryRecord<CorrectionMemoryData>[];
  resolutionMemory: MemoryRecord<ResolutionMemoryData>[];
}

export async function recallMemory(
  store: MemoryStore,
  invoice: Invoice
): Promise<RecalledMemory> {
  const vendors = await getVendorMemory(store, invoice.vendor);
  const Corrections = await getCorrections(store, invoice.vendor);
  const resolutions = await getResolutions(store, invoice.vendor);

  const resolutionMap = new Map<string, ResolutionMemoryData>();
  resolutions.forEach((r) => {
    resolutionMap.set(r.data.discrepancyType, r.data);
  });

  const usableCorrections = Corrections.filter(
    (corr: MemoryRecord<CorrectionMemoryData>) => {
      if (corr.confidence < 0.6) return false;
      const discrepancyType =
        corr.data.discrepancyType ?? corr.data.patternId;
      const resolution = resolutionMap.get(discrepancyType);
      if (!resolution) return true;
      return resolution.approvals >= resolution.rejections;
    }
  );

  invoice.context = {
    ...invoice.context,
    humanApproved: false,
  };

  return {
    vendorMemory: vendors && vendors.confidence >= 0.6 ? vendors : null,
    correctionMemory: usableCorrections,
    resolutionMemory: resolutions,
  };
}
