
import { Invoice } from "../models/invoiceModel";
import { ApplyResult } from "./applyMemory";
import { RecalledMemory } from "./recallMemory";
import { AuditTrail, AuditEntry } from "../utils/auditTrail";
import { ConfidenceTracker } from "../utils/confidenceTracker";
import { MemoryStore } from "../memory/memoryStore";
import { isDuplicate } from "../utils/duplicateDetector";
import { table_flag } from "./tableMemory";

export interface DecisionOutput {
  vendorName: string;
  invoiceId: string;
  requiresHumanReview: boolean;
  reasoning: string;
  confidenceScore: number;
  finalDecision: "approved" | "rejected" | "corrected";
  auditTrail: AuditEntry[];
}

export async function decisionLogic(
  invoice: Invoice,
  recalled: RecalledMemory,
  applyResult: ApplyResult,
  store: MemoryStore
): Promise<DecisionOutput> {
  const audit = new AuditTrail();
  const vendorName = invoice.vendor;
  const invoiceId = invoice.invoiceId;

  audit.add(
    "recall",
    `Vendor memory: ${recalled.vendorMemory ? "found" : "none"}, corrections: ${recalled.correctionMemory.length}`
  );

  audit.add(
    "apply",
    `Applied ${applyResult.proposedCorrections.length} memory-based corrections.`
  );

  const tracker = new ConfidenceTracker(invoice.confidence ?? 0.5);

  
  // 1. Duplicate Check
  if (isDuplicate(invoice)) {
    tracker.apply("duplicate");

    audit.add(
      "decide",
      "blocking auto-accept and learning; Invoice detected as duplicate."
    );

    return {
      vendorName,
      invoiceId,
      requiresHumanReview: true,
      finalDecision: "rejected",
      reasoning:
        "Duplicate invoice detected (same vendor + invoiceNumber + close dates).",
      confidenceScore: tracker.value(),
      auditTrail: audit.toArray(),
    };
  }


  // 2. Confidence
  if (applyResult.proposedCorrections.length > 0) {
    tracker.apply("auto_correct");
  } else {
    tracker.apply("auto_accept");
  }

  const score = tracker.value();

  const hasRejectionHistory = recalled.resolutionMemory.some(
    (r) => r.data.lastDecision === "rejected"
  );


  // 3. Mandatory fields
  const filledByMemory = new Set(applyResult.filledByMemory ?? []);
  const vendor = invoice.vendor;

  const serviceDateRequired = vendor !== "Freight & Co";

  const serviceDateMissing = serviceDateRequired &&
    !invoice.fields.serviceDate &&
    !filledByMemory.has("serviceDate");

  const invoiceDateMissing =
    !invoice.fields.invoiceDate &&
    !filledByMemory.has("invoiceDate");

  const hasMissingMandatory =
    serviceDateMissing || invoiceDateMissing;


  // 4. Heuristics
  const hasPoSuggestion =
    table_flag ||
    applyResult.proposedCorrections.some((c) =>
      c.toLowerCase().includes("suggested po")
    );

  const vatAmbiguous = applyResult.proposedCorrections.some((c) =>
    c.toLowerCase().includes("vat")
  );

  const vendorPoStrategy =
    (recalled.vendorMemory?.data as any)?.poMatchingStrategy;

  const poStrategyConf = recalled.vendorMemory?.confidence ?? 0;

  const hasStrongPoStrategy =
    vendorPoStrategy === "single-po-prefer" && poStrategyConf >= 0.75;


  // 5. Final Decision
  let requiresHumanReview = true;
  let finalDecision: "approved" | "rejected" | "corrected";
  let decisionReason = "";

  if (hasRejectionHistory) {
    finalDecision = "corrected";
    decisionReason =
      "Similar discrepancies were previously rejected by humans; review required.";
  } else if (hasMissingMandatory) {
    finalDecision = "corrected";
    decisionReason =
      "auto-correct with moderate confidence.";
  } else if (hasPoSuggestion && !hasStrongPoStrategy) {
    finalDecision = "corrected";
    decisionReason =
      "auto-correct with high confidence; Known Purchase_Order/Delivery_Note data for this vendor.";
  } else if (hasPoSuggestion && hasStrongPoStrategy && score >= 0.75) {
    finalDecision = "approved";
    requiresHumanReview = false;
    decisionReason =
      "auto-correct; Filled information by Vendor Memory with decent confidence.";
  } else if (vatAmbiguous && score < 0.85) {
    finalDecision = "corrected";
    decisionReason =
      "auto-correct with less confidence; Filled information by Vendor Memory.";
  } else if (score >= 0.85) {
    finalDecision =
      applyResult.proposedCorrections.length > 0
        ? "corrected"
        : "approved";
    requiresHumanReview = applyResult.proposedCorrections.length > 0;
    decisionReason =
      applyResult.proposedCorrections.length > 0
        ? "High confidence memory-based corrections applied."
        : "High confidence, no discrepancies detected.";
  } else {
    finalDecision = "corrected";
    decisionReason =
      "Low confidence or first-time correction; human review required.";
  }

  audit.add("decide", decisionReason);

  const reasoning = [
    applyResult.reasoning.join(", "),
    decisionReason,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    vendorName,
    invoiceId,
    requiresHumanReview,
    reasoning,
    confidenceScore: score,
    finalDecision,
    auditTrail: audit.toArray(),
  };
}
