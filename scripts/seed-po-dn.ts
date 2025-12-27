
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

const baseDir = process.cwd();
const dbPath = path.join(baseDir, "data", "memory.db");
const db = new sqlite3.Database(dbPath);

interface PoJson {
  poNumber: string;
  vendor: string;
  date: string;
  lineItems: { sku: string; qty: number; unitPrice: number }[];
}

interface DnJson {
  dnNumber: string;
  vendor: string;
  poNumber: string;
  date: string;
  lineItems: { sku: string; qtyDelivered: number }[];
}

function loadJson<T>(file: string): T[] {
  const filePath = path.join(baseDir, "data", file);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function seed() {
  const pos = loadJson<PoJson>("purchase_orders.json");
  const dns = loadJson<DnJson>("delivery_notes.json");

  db.serialize(() => {
    db.run("DELETE FROM delivery_notes");
    db.run("DELETE FROM purchase_orders");

    const insertPO = db.prepare(
      `INSERT INTO purchase_orders (po_number, vendor, date, items)
       VALUES (?, ?, ?, ?)`
    );

    for (const po of pos) {
      const itemsJson = JSON.stringify(
        po.lineItems.map((li) => ({
          sku: li.sku,
          qty: li.qty,
          unitPrice: li.unitPrice,
        }))
      );

      insertPO.run(po.poNumber, po.vendor, po.date, itemsJson);
    }

    insertPO.finalize();

    const insertDN = db.prepare(
      `INSERT INTO delivery_notes
       (dn_number, vendor, po_number, date, items)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const dn of dns) {
      const itemsJson = JSON.stringify(
        dn.lineItems.map((li) => ({
          sku: li.sku,
          qtyDelivered: li.qtyDelivered,
        }))
      );

      insertDN.run(
        dn.dnNumber,
        dn.vendor,
        dn.poNumber,
        dn.date,
        itemsJson
      );
    }

    insertDN.finalize();
  });

  db.close();
  console.log("Seeded purchase_orders and delivery_notes with JSON items.");
}

seed().catch((e) => {
  console.error("Error seeding PO/DN:", e);
  db.close();
});
