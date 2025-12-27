
export interface InvoiceContext {
  detectedDuplicate?: boolean;
  humanApproved?: boolean;
  finalDecision?: "approved" | "rejected" | "corrected";
  fromHumanRun?: boolean; 
}

export interface RawExtractedInvoice {
  invoiceNumber: string;
  serviceDate?: string;
  currency?: string;
  poNumber?: string;
  sku?: string;
  lineDescription?: string;
  netAmount?: number;
  taxAmount?: number;
  grossAmount?: number;
  [key: string]: unknown;
}

export interface Invoice {
  invoiceId: string;
  vendor: string;    // "Supplier GmbH", "Parts AG", ...

  // Normalized fields
  fields: {
    invoiceNumber: string;
    invoiceDate: string;
    serviceDate?: string | null;
    currency?: string | null;
    poNumber?: string | null;
    netTotal: number;
    taxRate: number;
    taxTotal: number;
    grossTotal: number;
    discountTerms?: string;
    lineItems: Array<{
      sku?: string | null;
      description?: string;
      qty: number;
      unitPrice: number;
    }>;
  };
  rawText: string;
  confidence: number;

  // Helper for PO matching logic
  possiblePoNumbers?: string[];

  // Optional runtime-only helpers
  context?: InvoiceContext;

  // Raw reference (not used for learning)
  rawExtracted?: RawExtractedInvoice;
}
