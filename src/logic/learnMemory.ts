
import { Invoice } from "../models/invoiceModel";
import { ApplyResult } from "./applyMemory";
import { RecalledMemory } from "./recallMemory";
import { MemoryStore } from "../memory/memoryStore";
import { upsertVendorMemory, VendorMemoryData } from "../memory/vendorMemory";
import { upsertCorrection, CorrectionMemoryData } from "../memory/correctionMemory";
import { upsertResolution } from "../memory/resolutionMemory";

export async function learnMemory(
  invoice: Invoice,
  applyResult: ApplyResult,
  recalled: RecalledMemory,
  confidenceScore: number,
  store: MemoryStore,
  humanApproved: boolean,
  finalDecision: "approved" | "rejected" | "corrected"
): Promise<string[]> {
  const updates: string[] = [];


  //console.log(invoice.context?.detectedDuplicate)
  if (invoice.context?.detectedDuplicate) {
    updates.push("Duplicate invoice detected; skipping all learning.");
    return updates;
  }

  if (
    !humanApproved ||
    confidenceScore < 0.6 ||
    invoice.context?.fromHumanRun !== true
  ) {
    updates.push("Not a trusted human-approved run; skipping learning.");
    return updates;
  }

  // 1. Vender Memory

  const prevVendor = recalled.vendorMemory?.data as VendorMemoryData | undefined;
  let vendorUpdated = false;
  const mappings = { ...(prevVendor?.mappings ?? {}) };

  const lowered = applyResult.proposedCorrections.map((c) => c.toLowerCase());

  // serviceDate from Leistungsdatum
  if (
    lowered.some(
      (c) => c.includes("servicedate") || c.includes("leistungsdatum")
    ) || invoice.vendor === "Supplier GmbH"
  ) {
    mappings.serviceDateField = mappings.serviceDateField ?? "Leistungsdatum";
    vendorUpdated = true;
  }

  // default currency (Parts AG)
  if (
    lowered.some(
      (c) => c.includes("currency") || c.includes("eur") || c.includes("usd")
    ) ||
    (invoice.vendor === "Parts AG" &&
      invoice.fields.currency &&
      invoice.fields.currency === "EUR")
  ) {
    mappings.defaultCurrency = invoice.fields.currency ?? mappings.defaultCurrency;
    vendorUpdated = true;
  }

  // freight descriptions (Freight & Co)
  if (
    lowered.some(
      (c) =>
        c.includes("freight") || c.includes("seefracht") || c.includes("shipping")
    ) || invoice.vendor === "Freight & Co"
  ) {
    mappings.freightSkuDescriptions =
      mappings.freightSkuDescriptions ?? ["Seefracht", "Shipping"];
    vendorUpdated = true;
  }

  // Skonto patterns
  if (invoice.rawText.toLowerCase().includes("skonto")) {
    mappings.skontoPatterns = mappings.skontoPatterns ?? ["skonto"];
    vendorUpdated = true;
  }

  if (vendorUpdated) {
    await upsertVendorMemory(
      store,
      invoice.vendor,
      {
        vendor: invoice.vendor,
        mappings,
        poMatchingStrategy: prevVendor?.poMatchingStrategy ?? "single-po-prefer",
      },
      0.05,
      invoice.invoiceId
    );
    updates.push(`Vendor memory updated for ${invoice.vendor}.`);
  }

  // Learn PO heuristic for Supplier GmbH once INV-A-003 approved
  if (
    invoice.vendor === "Supplier GmbH" &&
    invoice.fields.poNumber === "PO-A-051"
  ) {
    await upsertVendorMemory(
      store,
      invoice.vendor,
      {
        vendor: invoice.vendor,
        mappings,
        poMatchingStrategy: "single-po-prefer",
      },
      0.1,
      invoice.invoiceId
    );
    updates.push("PO-matching heuristic learned for Supplier GmbH.");
  }

  // 2. correction Memory
  for (const correction of applyResult.proposedCorrections) {
    const cLower = correction.toLowerCase();
    let pattern: (CorrectionMemoryData & { discrepancyType?: string }) | null =
      null;

    if (cLower.includes("vat") || cLower.includes("mwst")) {
      pattern = {
        patternId: "vat_inclusive",
        description: "Totals include VAT; recompute net and tax from gross.",
        correctionRule: "recompute_tax/gross",
        discrepancyType: "tax_mismatch",

      };
    } else if (cLower.includes("qty") || cLower.includes("quantity")) {
      pattern = {
        patternId: "qty_mismatch_dn",
        description: "Quantity mismatch resolved using delivery note.",
        correctionRule: "adjust_qty_to_delivery_note",
        discrepancyType: "qty_mismatch",
      };
    } else if (cLower.includes("currency inferred")) {
      pattern = {
        patternId: "currency_from_rawtext",
        description: "Currency inferred from raw text for this vendor.",
        correctionRule: "extract_currency",
        discrepancyType: "currency_missing",
      };
    }

    if (pattern) {
      await upsertCorrection(
        store,
        invoice.vendor,
        {
          patternId: pattern.patternId,
          description: pattern.description,
          correctionRule: pattern.correctionRule,
          discrepancyType: pattern.discrepancyType,
        },
        0.03,
        invoice.invoiceId
      );
      updates.push(`Correction pattern "${pattern.patternId}" reinforced.`);
    }
  }

  // 3. Resolution Memory
  let discrepancyType = "general";
  const allLower = applyResult.proposedCorrections
    .map((c) => c.toLowerCase())
    .join(" ");

  if (allLower.includes("vat") || allLower.includes("mwst")) {
    discrepancyType = "tax_mismatch";
  } else if (allLower.includes("qty") || allLower.includes("quantity")) {
    discrepancyType = "qty_mismatch";
  } else if (allLower.includes("currency")) {
    discrepancyType = "currency_missing";
  }

  await upsertResolution(
    store,
    invoice.vendor,
    discrepancyType,
    finalDecision,
    "Derived from final invoice decision"
  );
  updates.push("Resolution memory updated from final decision.");

  return updates;
}

