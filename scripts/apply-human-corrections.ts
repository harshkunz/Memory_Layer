
import fs from "fs";
import path from "path";
import { Invoice } from "../src/models/invoiceModel";
import { MemoryStore } from "../src/memory/memoryStore";
import { recallMemory } from "../src/logic/recallMemory";
import { applyMemory } from "../src/logic/applyMemory";
import { decisionLogic } from "../src/logic/decisionLogic";
import { learnMemory } from "../src/logic/learnMemory";
import { HumanCorrection } from "../src/models/humanCorrection";

async function main() {
  //console.log("Here");
  const store = new MemoryStore();

  const invPath = path.join(process.cwd(), "data", "invoices_extracted.json");
  const hcPath = path.join(process.cwd(), "data", "human_corrections.json");

  const invoices: Invoice[] = JSON.parse(fs.readFileSync(invPath, "utf-8"));
  const humanCorrections: HumanCorrection[] = JSON.parse(
    fs.readFileSync(hcPath, "utf-8")
  );

  for (const hc of humanCorrections) {
    const invoice = invoices.find((i) => i.invoiceId === hc.invoiceId);
    if (!invoice) continue;

    // System Run
    const recalled = await recallMemory(store, invoice);
    const applyResult = applyMemory(invoice, recalled);
    const decision = await decisionLogic(invoice, recalled, applyResult, store);

    console.log("\n System decision BEFORE human Correction:");
    console.log({
      requiresHumanReview: decision.requiresHumanReview,
      proposedCorrections: applyResult.proposedCorrections,
    });

    // Apply human corrections to fields
    /*
    for (const c of hc.corrections) {
      if (c.field === "serviceDate") {
        invoice.fields.serviceDate = c.to as any;
      } else if (c.field === "poNumber") {
        invoice.fields.poNumber = c.to as any;
      } else if (c.field === "grossTotal") {
        invoice.fields.grossTotal = c.to as any;
      } else if (c.field === "taxTotal") {
        invoice.fields.taxTotal = c.to as any;
      } else if (c.field === "currency") {
        invoice.fields.currency = c.to as any;
      } else if (c.field === "discountTerms") {
        (invoice as any).discountTerms = c.to;
      } else if (c.field === "lineItems[0].sku") {
        invoice.fields.lineItems[0].sku = c.to as any;
      }
    }
    */

  // Local test
   let c = hc.corrections[0];
    if (c.field === "serviceDate") {
        invoice.fields.serviceDate = c.to as any;
      } else if (c.field === "poNumber") {
        invoice.fields.poNumber = c.to as any;
      } else if (c.field === "grossTotal") {
        invoice.fields.grossTotal = c.to as any;
      } else if (c.field === "taxTotal") {
        invoice.fields.taxTotal = c.to as any;
      } else if (c.field === "currency") {
        invoice.fields.currency = c.to as any;
      } else if (c.field === "discountTerms") {
        (invoice as any).discountTerms = c.to;
      } else if (c.field === "lineItems[0].sku") {
        invoice.fields.lineItems[0].sku = c.to as any;
      }

    const finalDecision: "approved" | "rejected" | "corrected" = hc.finalDecision ?? "approved";
    const humanApproved = finalDecision === "approved";

    if (!humanApproved) {
      console.log(
        `Invoice ${invoice.invoiceId} not approved; skipping learning.`
      );
      continue;
    }

    // Mark this as a human run
    invoice.context = {
      ...(invoice.context || {}),
      humanApproved: true,
      fromHumanRun: true,
      finalDecision,
    };

    await store.saveProcessedInvoice(invoice);

    const memoryUpdates = await learnMemory(
      invoice,
      applyResult,
      recalled,
      decision.confidenceScore,
      store,
      humanApproved,
      finalDecision
    );

    console.log("\n System decision AFTER human Correction:");
    console.log(
      `${hc.invoiceId}:`,
      {
        memoryUpdates,
        humanApproved,
        confidenceScore: decision.confidenceScore
      }
    );

    if(c == hc.corrections[0]){
      break;
    }
  }

  store.close();
  console.log("All human_corrections.json applied into memory.db");
}

main().catch((err) => {
  console.error("Failed to apply human corrections:", err);
  process.exit(1);
});
