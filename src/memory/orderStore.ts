
import sqlite3 from "sqlite3";
import path from "path";
import { PurchaseOrder, DeliveryNote, PurchaseOrderItem, DeliveryNoteItem } from "../models/orderModel";


export class OrderStore {
  private db: sqlite3.Database;
  
  constructor() {
    this.db = new sqlite3.Database(path.join(process.cwd(), "data", "memory.db"));
    this.initialize();
  }

  private initialize() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          po_number TEXT PRIMARY KEY,
          vendor    TEXT NOT NULL,
          date      TEXT NOT NULL,
          items     TEXT NOT NULL          -- JSON: PurchaseOrderItem[]
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS delivery_notes (
          dn_number TEXT PRIMARY KEY,
          po_number TEXT NOT NULL,
          vendor    TEXT NOT NULL,
          date      TEXT NOT NULL,
          items     TEXT NOT NULL          -- JSON: DeliveryNoteItem[]
        );
      `);
    });
  }


  async getPurchaseOrder(poNumber: string): Promise<PurchaseOrder | undefined> {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT po_number, vendor, date, items FROM purchase_orders WHERE po_number = ?`,
        [poNumber],
        (err, row: any) => {
          if (err) {
            console.error(err);
            return resolve(undefined);
          }
          if (!row) return resolve(undefined);

          const items: PurchaseOrderItem[] = JSON.parse(row.items ?? '[]');

          resolve({
            poNumber: row.po_number,
            vendor: row.vendor,
            date: row.date,
            items,
          });
        }
      );
    });
  }

  async getPurchaseOrdersByVendor(vendor: string): Promise<PurchaseOrder[]> {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT po_number, vendor, date, items FROM purchase_orders WHERE LOWER(TRIM(vendor)) = LOWER(TRIM(?))`,
        [vendor],
        (err, rows: any[]) => {
          if (err) {
            console.error(err);
            return resolve([]);
          }
          if (!rows || rows.length === 0) return resolve([]);

          const results: PurchaseOrder[] = rows.map((row) => ({
            poNumber: row.po_number,
            vendor: row.vendor,
            date: row.date,
            items: JSON.parse(row.items ?? '[]') as PurchaseOrderItem[],
          }));

          //console.log(results);
          resolve(results);
        }
      );
    });
  }

  async getDeliveryNoteByPo(poNumber: string): Promise<DeliveryNote | undefined> {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT dn_number, po_number, vendor, date, items
        FROM delivery_notes
        WHERE po_number = ?`,
        [poNumber],
        (err, row: any) => {
          if (err) {
            console.error(err);
            return resolve(undefined);
          }
          if (!row) return resolve(undefined);

          const items: DeliveryNoteItem[] = JSON.parse(row.items ?? '[]');

          resolve({
            dnNumber: row.dn_number,
            poNumber: row.po_number,
            vendor: row.vendor,
            date: row.date,
            items,
          });
        }
      );
    });
  }
  
  close(): void {
    this.db.close();
  }
}
