import { Invoice } from "../models/invoiceModel";

const seen = new Map<string, string>(); // key -> invoiceDate

export function isDuplicate(invoice: Invoice): boolean {
  const invoiceNumber = invoice.fields.invoiceNumber;
  const invoiceDate = invoice.fields.invoiceDate;

  if (!invoiceNumber || !invoiceDate) return false;

  const key = `${invoice.vendor}|${invoiceNumber}`;

  const prevDateStr = seen.get(key);

  // first time → remember
  if (!prevDateStr) {
    seen.set(key, invoiceDate);
    return false;
  }

  const d1 = parseDate(prevDateStr);
  const d2 = parseDate(invoiceDate);

  // if date parse fails → assume duplicate
  if (!d1 || !d2) {
    markDuplicate(invoice);
    return true;
  }

  const diffDays =
    Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays <= 5) {
    markDuplicate(invoice);
    return true;
  }

  return false;
}

function markDuplicate(invoice: Invoice) {
  invoice.context = { ...invoice.context, detectedDuplicate: true };
}

function parseDate(value: string): Date | null {
  if (!value) return null;

  // DD.MM.YYYY
  if (value.includes(".")) {
    const [dd, mm, yyyy] = value.split(".");
    return new Date(`${yyyy}-${mm}-${dd}`);
  }

  // DD-MM-YYYY
  if (value.includes("-")) {
    const parts = value.split("-");
    if (parts.length === 3 && parts[0].length === 2) {
      const [dd, mm, yyyy] = parts;
      return new Date(`${yyyy}-${mm}-${dd}`);
    }
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
