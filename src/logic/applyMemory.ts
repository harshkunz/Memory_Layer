
import { Invoice } from "../models/invoiceModel";
import { RecalledMemory } from "./recallMemory";
import { VendorMemoryData } from "../memory/vendorMemory";

export interface ApplyResult {
  normalizedInvoice: Invoice["fields"];
  proposedCorrections: string[];
  reasoning: string[];
  confidenceContribution: number;
  filledByMemory: string[];
}

export let a = 0;
export let b = 0;
export let c = 0;
export let d = 0;
export let e = 0;

function textHasAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

export function applyMemory(
  invoice: Invoice,
  memory: RecalledMemory
): ApplyResult {

  const normalized: Invoice["fields"] = JSON.parse(
    JSON.stringify(invoice.fields)
  );

  const proposedCorrections: string[] = [];
  const reasoning: string[] = [];
  const filledByMemory: string[] = [];
  let confidenceContribution = 0;

  const vendorRecord = memory.vendorMemory;
  const vendorData = vendorRecord?.data as VendorMemoryData | undefined;


 // 1. ServiceDate mapping
  if (!normalized.serviceDate) {
    if (vendorData?.mappings?.serviceDateField) {
      const match = invoice.rawText.match(/\d{2}\.\d{2}\.\d{4}/);
      if (match) {
        normalized.serviceDate = match[0];
        proposedCorrections.push(
          `serviceDate auto-filled from "${vendorData.mappings.serviceDateField}".`
        );
        reasoning.push(
          `Vendor memory maps "${vendorData.mappings.serviceDateField}" to serviceDate with sufficient confidence.`
        );
        a = 1;
        filledByMemory.push("serviceDate");
        confidenceContribution += (vendorRecord?.confidence ?? 0.4) * 0.3;
      }
    } else {
      a = 2;
      proposedCorrections.push(
        "Mandatory field serviceDate missing; no vendor memory present."
      );
      reasoning.push(
        "Mandatory field serviceDate missing and no prior vendor memory exists."
      );
    }
  }

  // 2. Currency recovery
  if (
    !normalized.currency &&
    vendorData?.mappings?.defaultCurrency &&
    invoice.rawText.includes(vendorData.mappings.defaultCurrency)
  ) {
    //console.log(vendorData.mappings.defaultCurrency);
    normalized.currency = vendorData.mappings.defaultCurrency;
    proposedCorrections.push(
      `Currency inferred from rawText as ${normalized.currency}.`
    );
    b = 1;
    reasoning.push("Currency inferred from rawText but not yet learned.");
  }


  // 3. Freight SKU mapping
  const freightPatterns =
    vendorData?.mappings?.freightSkuDescriptions ?? [
      "Seefracht",
      "Shipping",
    ];

  for (const item of normalized.lineItems) {
    if (!item.sku && item.description) {
      if (textHasAny(item.description, freightPatterns)) {
        item.sku = "FREIGHT";
        proposedCorrections.push(
          `Line item "${item.description}" mapped to SKU FREIGHT.`
        );
        reasoning.push(
          "Freight-like description matched vendor freight patterns."
        );
        c = 1;
        confidenceContribution += (vendorRecord?.confidence ?? 0.4) * 0.25;
      }
    }
  }

  // 4. skonto Pattern mapping
  const skontoHint = textHasAny(invoice.rawText, vendorData?.mappings?.skontoPatterns ?? ["skonto"]);
  if(skontoHint){
    const lines = invoice.rawText.split(/\r?\n/);
    const skontoLine = lines.find(line => /skonto/i.test(line))?.trim();

    if (skontoLine) {
      normalized.discountTerms = skontoLine;
      d = 1;
      reasoning.push("Skonto terms extracted from raw text.");
    }
  }

  // 5. VAT inclusive recompute
  const VatHint = textHasAny(invoice.rawText, vendorData?.mappings?.vatInclusiveHints ?? ["MwSt. inkl.", "VAT included"]);
  const VatMemory = memory.correctionMemory.some(
    (c) => c.data.patternId === "vat_inclusive" && c.confidence >= 0.6
  );

  if (VatHint && normalized.grossTotal > 0 && normalized.taxRate > 0) {
    if (VatMemory) {
      const rate = normalized.taxRate;
      const recomputedGross = Number(
        (normalized.netTotal * (1 + rate)).toFixed(2)
      );
      const recomputedTax = Number(
        (recomputedGross - normalized.netTotal).toFixed(2)
      );

      if (recomputedGross !== normalized.grossTotal || recomputedTax !== normalized.taxTotal) {
        normalized.grossTotal = recomputedGross;
        normalized.taxTotal = recomputedTax;
        e = 1;
        proposedCorrections.push(
          "VAT-inclusive totals detected; recomputed gross and tax."
        );
        reasoning.push(
          'Correction pattern "vat_inclusive" available (confidence ' +
            memory.correctionMemory
              .find((c) => c.data.patternId === "vat_inclusive")
              ?.confidence.toFixed(2) +
            ")."
        );
      }

      else {
        proposedCorrections.push(
          "VAT-inclusive totals detected; recomputed gross and tax are already correct"
        );
        reasoning.push(
          'Correction pattern "vat_inclusive" available & Increase Confidence Score.'
        );
      }

      confidenceContribution += (vendorRecord?.confidence ?? 0.4) * 0.3;

    } else {
      e = 2;
      proposedCorrections.push(
        "VAT-inclusive indication detected; totals may need recompute (no prior correction memory)."
      );
      reasoning.push(
        "VAT inclusive indication with no prior correction memory (recompute may be false positive)."
      );
    }
  }


  // 6. Generic corrections
  for (const corr of memory.correctionMemory) {
    reasoning.push(
      `Correction pattern "${corr.data.patternId}" available (confidence ${corr.confidence.toFixed(
        2
      )}).`
    );
  }

  return {
    normalizedInvoice: normalized,
    proposedCorrections,
    reasoning,
    confidenceContribution: Math.min(confidenceContribution, 0.4),
    filledByMemory,
  };
}
