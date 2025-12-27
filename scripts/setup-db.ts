
import path from "path";
import fs from "fs";
import { MemoryStore } from "../src/memory/memoryStore";
import { OrderStore } from "../src/memory/orderStore";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "memory.db");


  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Delete Old db
  if (fs.existsSync(dbPath)) {
    try {
      console.log("Removing existing memory.db for a clean run...");
      fs.unlinkSync(dbPath);
    } catch (e) {
      console.warn(
        "Could not delete existing memory.db (maybe in use); continuing:",
        e
      );
    }
  }

  // Init New db
  const store = new MemoryStore(dbPath);
  const orderStore = new OrderStore();

  console.log("Initialized fresh SQLite memory database at:", dbPath);

  // close
  orderStore.close();
  store.close();
}

main().catch((err) => {
  console.error("DB setup failed:", err);
  process.exit(1);
});
