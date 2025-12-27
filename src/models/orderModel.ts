
export interface PurchaseOrderItem {
  sku: string;
  qty: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  poNumber: string;
  vendor: string;
  date: string;
  items: PurchaseOrderItem[];
}

export interface DeliveryNoteItem {
  sku: string;
  qtyDelivered: number;
}

export interface DeliveryNote {
  dnNumber: string;
  poNumber: string;
  vendor: string;
  date: string;
  items: DeliveryNoteItem[];
}
