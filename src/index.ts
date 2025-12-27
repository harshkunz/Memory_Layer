// src/index.ts

import fs from "fs";
import path from "path";
import { Invoice } from "./models/invoiceModel";
import { MemoryStore } from "./memory/memoryStore";
import { recallMemory } from "./logic/recallMemory";
import { applyMemory } from "./logic/applyMemory";
import { decisionLogic } from "./logic/decisionLogic";
import { TableMemory } from './logic/tableMemory';
import { learnMemory } from './logic/learnMemory';

function loadInvoices(fileName: string): Invoice[] {
  const p = path.join(process.cwd(), "data", fileName);
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as Invoice[];
}

async function processInvoice(invoice: Invoice, store: MemoryStore) {
  const recalled = await recallMemory(store, invoice);
  const applyResult = applyMemory(invoice, recalled);
  //console.log(applyResult);

  const tableResult = await TableMemory(applyResult, invoice.vendor); 
  //console.log(tableResult);

  const decision = await decisionLogic(invoice, recalled, tableResult, store);
  const humanApproved = decision.finalDecision === "approved";

  const memoryUpdates = await learnMemory(
      invoice,
      tableResult,
      recalled,
      decision.confidenceScore,
      store,
      humanApproved,
      decision.finalDecision
    );

  // Auto run
  invoice.context = {
    ...(invoice.context || {}),
    fromHumanRun: false,
  };

  let requiresHumanReview = decision.finalDecision !== "approved";

  await store.saveProcessedInvoice(invoice);

  const output = {
    invoiceId: invoice.invoiceId,
    vendor: invoice.vendor,
    normalizedInvoice: tableResult.normalizedInvoice,
    proposedCorrections: applyResult.proposedCorrections,
    requiresHumanReview: requiresHumanReview,
    reasoning: decision.reasoning,
    confidenceScore: decision.confidenceScore,
    memoryUpdates: memoryUpdates as string[],
    auditTrail: decision.auditTrail,
  };

  console.log(`\n --- Result for ${invoice.invoiceId} (${invoice.vendor}) ---`);
  console.log(JSON.stringify(output, null, 2));
}

async function main() {
  const store = new MemoryStore();
  const invoices = loadInvoices("invoices_extracted.json");

  /*
  for (const inv of invoices) {
    await processInvoice(inv, store);
  }
  */

  // Local test
  await processInvoice(invoices[0], store);

  store.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
