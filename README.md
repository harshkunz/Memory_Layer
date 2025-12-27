# Memory Layer for Invoice Automation

## Overview

This project implements a memory-driven layer on top of invoice extraction. It stores and reuses **vendor**, **correction**, and **resolution** memories to improve automation and provide explainable decisions for each invoice[web:55].

For every invoice, the system outputs:

```bash
{
"normalizedInvoice": { "...": "..." },
"proposedCorrections": ["..."],
"requiresHumanReview": true,
"reasoning": "Explain why memory was applied and why actions were taken",
"confidenceScore": 0.0,
"memoryUpdates": ["..."],
"auditTrail": [
        {
            "step": "recall|apply|decide|learn",
            "timestamp": "...",
            "details": "..."
        }
    ]
}
```


## Tech Stack

- Node.js runtime
- TypeScript (strict mode)
- SQLite for persistent memory storage[web:56]

## Project Structure

- `src/memory`: vendor, correction, and resolution memory backed by `MemoryStore`
- `src/logic`: `recall`, `apply`, `decide`, `learn` pipeline
- `src/utils`: audit trail and confidence tracking helpers
- `src/models`: `Invoice` and related types
- `demo`: demo runner showing learning across invoices
- `data`: sample invoices and SQLite DB file

## Installation

```bash
npm install
npm run setup-db
```

## Running the Demo
```bash
npm run demo
```

This runs multiple invoices (e.g., `INV-A-001` then `INV-A-002`) and demonstrates how memory increases confidence and reduces human review over time[web:55][web:10].

## Tests

```bash
npm test
```

## Demo Video

Record your terminal running `npm run demo` and explain the JSON output and memory evolution, then attach the video link as required by the assignment.


package.json

"scripts": {
    "start": "ts-node src/index.ts",
    # which runs:
    # npx ts-node src/index.ts

    "demo": "ts-node demo/demo-runner.ts",
    # which is effectively:
    # npx ts-node demo/demo-runner.ts

    "setup-db": "ts-node scripts/setup-db.ts", 
    # optional, just ensures SQLite file exists

    "build": "tsc",
    "test": "jest"
  },

"keywords": [
    "typescript",
    "node",
    "memory-layer",
    "invoices"
],

"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.ts"]
}

"dependencies": {
    "sqlite3": "^5.1.7"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^22.0.0",
    "@types/sqlite3": "^3.1.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.0"
  }