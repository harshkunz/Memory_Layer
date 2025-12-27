
import { OrderStore } from "../memory/orderStore";
import { PurchaseOrder, DeliveryNote } from "../models/orderModel";

const orderStore = new OrderStore();
export let table_flag = false;

function daysDiff(d1: string, d2: string): number {
  return (
    Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) /
    (1000 * 60 * 60 * 24)
  );
}

async function autoMatchPoNumber(
  vender: string,
  innnerData: any,
  orderStore: OrderStore,
  reasoning: string[],
): Promise<string | null> {

  const position = await orderStore.getPurchaseOrdersByVendor(vender);
  //console.log(position, 'position');

  const matches = position.filter((po: PurchaseOrder) => {
    if (!innnerData.invoiceDate || !po.date) return false;
    if (daysDiff(innnerData.invoiceDate, po.date) > 30) return false;

    return innnerData.lineItems?.some((li: any) =>
      po.items.some((pi) => pi.sku === li.sku)
    );
  });

  if (matches.length === 1) {
    reasoning.push(
      "PO auto-filled: single matching PO within 30 days and matching item."
    );
    table_flag = true;
    return matches[0].poNumber;
  }

  return null;
}


function fillLineItems(
  innnerData: any,
  dataTable?: DeliveryNote,
  reasoning?: string[]
) {
  if (!dataTable) return;
  if (innnerData.lineItems.sku != null) return;
  //console.log(dataTable);

  innnerData.lineItems = dataTable.items.map((i: any) => ({
    sku: i.sku,
    qty: i.qtyDelivered ?? i.qty,
  }));

  table_flag = true;
  reasoning?.push("Line items filled from Delivery Note.");
}


export async function TableMemory(invoice: any, vender: string) {
  const reasoning: string[] = [];
  const innnerData = invoice.normalizedInvoice ?? invoice;

  if (!innnerData.poNumber) {
    const matchedPo = await autoMatchPoNumber(
      vender,
      innnerData,
      orderStore,
      reasoning
    );
    if (matchedPo) {
      innnerData.poNumber = matchedPo;
    }
  }

  if (innnerData.poNumber) {
    const dataTable = await orderStore.getDeliveryNoteByPo(innnerData.poNumber);
    fillLineItems(innnerData, dataTable, reasoning);
  }

  if (invoice.normalizedInvoice) {
    invoice.normalizedInvoice = innnerData;
  }

  return invoice;
}

