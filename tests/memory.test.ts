// tests/memory.test.ts

import { MemoryStore } from "../src/memory/memoryStore";
import {
  upsertVendorMemory,
  VendorMemoryData,
} from "../src/memory/vendorMemory";

describe("Vendor Memory", () => {
  test("vendor memory upsert and fetch", async () => {
    // Use in-memory SQLite DB for tests
    const store = new MemoryStore(":memory:");

    const data: VendorMemoryData = {
      vendor: "TestVendor",
      mappings: {
        serviceDateField: "Leistungsdatum",
        defaultCurrency: "EUR",
      },
      poMatchingStrategy: "single-po-prefer",
    };

    /* -------- upsert -------- */
    const saved = await upsertVendorMemory(
      store,
      "TestVendor",
      data,
      0.9
    );

    expect(saved).toBeDefined();
    expect(saved.key).toBe("vendor:TestVendor");
    expect(saved.type).toBe("vendor");
    expect(saved.confidence).toBeCloseTo(0.9);

    /* -------- fetch -------- */
    const fetched = await store.getByKeyAndType<VendorMemoryData>(
      "vendor:TestVendor",
      "vendor"
    );

    expect(fetched).not.toBeNull();
    expect(fetched!.data.vendor).toBe("TestVendor");
    expect(fetched!.data.mappings.defaultCurrency).toBe("EUR");
    expect(fetched!.data.mappings.serviceDateField).toBe("Leistungsdatum");

    store.close();
  });
});
