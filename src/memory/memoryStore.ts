
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { Invoice } from "../models/invoiceModel";

export type MemoryType = "vendor" | "correction" | "resolution";

export interface MemoryRecord<T = any> {
  id?: number;
  key: string;
  type: MemoryType;
  data: T;
  confidence: number;
  invoiceId?: string; // for audit
  createdAt: string;
  updatedAt: string;
}

export class MemoryStore {
  private db: sqlite3.Database;

  constructor(
    dbFilePath: string = path.join(process.cwd(), "data", "memory.db")
  ) {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbFilePath);
    this.initialize();
  }

  private initialize(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        confidence REAL NOT NULL,
        invoiceId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(key, type)
      );

      CREATE TABLE IF NOT EXISTS processed_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor TEXT NOT NULL,
        invoiceNumber TEXT NOT NULL,
        invoiceDate TEXT,
        invoiceId TEXT,
        invoice_obj TEXT NOT NULL,
        UNIQUE(vendor, invoiceNumber)
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories (type);
      CREATE INDEX IF NOT EXISTS idx_invoice_vendor ON processed_invoices (vendor);
    `;
    this.db.exec(sql);
  }

  // Check duplicate invoices
  async saveProcessedInvoice(invoice: Invoice): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR IGNORE INTO processed_invoices
          (vendor, invoiceNumber, invoiceDate, invoiceId, invoice_obj)
        VALUES (?, ?, ?, ?, ?)
      `;
      this.db.run(
        sql,
        [
          invoice.vendor,
          invoice.fields.invoiceNumber,
          invoice.fields.invoiceDate,
          invoice.invoiceId,
          JSON.stringify(invoice),
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  async getInvoicesByVendor(vendor: string): Promise<Invoice[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT invoice_obj FROM processed_invoices WHERE vendor = ?`;
      this.db.all(sql, [vendor], (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows.map((row) => JSON.parse(row.invoice_obj)));
      });
    });
  }


  async upsert(
    record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<MemoryRecord> {
    const now = new Date().toISOString();
    const payload = JSON.stringify(record.data);

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO memories (key, type, data, confidence, invoiceId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key, type) DO UPDATE SET
          data = excluded.data,
          confidence = excluded.confidence,
          invoiceId = excluded.invoiceId,
          updatedAt = excluded.updatedAt
      `;
      this.db.run(
        sql,
        [
          record.key,
          record.type,
          payload,
          record.confidence,
          record.invoiceId ?? null,
          now,
          now,
        ],
        (err) => {
          if (err) return reject(err);
          resolve({
            ...record,
            createdAt: now,
            updatedAt: now,
          });
        }
      );
    });
  }

  async getByKeyAndType(
    key: string,
    type: MemoryType
  ): Promise<MemoryRecord | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM memories WHERE key = ? AND type = ? LIMIT 1`;
      this.db.get(sql, [key, type], (err, row: any) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({
          id: row.id,
          key: row.key,
          type: row.type,
          data: JSON.parse(row.data),
          confidence: row.confidence,
          invoiceId: row.invoiceId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      });
    });
  }

  async getAllByPrefix(
    prefix: string,
    type: MemoryType
  ): Promise<MemoryRecord[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM memories WHERE key LIKE ? AND type = ?`;
      this.db.all(sql, [`${prefix}%`, type], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(
          rows.map((row) => ({
            id: row.id,
            key: row.key,
            type: row.type,
            data: JSON.parse(row.data),
            confidence: row.confidence,
            invoiceId: row.invoiceId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }))
        );
      });
    });
  }

  close(): void {
    this.db.close();
  }
}
