### ☐ Memory Layer for Invoice Automation
This project implements a memory-driven layer on top of invoice extraction Method. It stores and reuses vendor, correction, and resolution memories to improve automation and provide explainable decisions for each invoice.

<p align="center">
  <img src="./assets/Memory Layer System Architecture.png" alt="_picture" height="630">
  Architecture Diagram
</p>

Video Link - https://drive.google.com/drive/folders/1WFKXhTIDk0Kf44pvw7qIek7MwzrxZrFM?usp=sharing

### ☐ Working
`Recall → Apply → Decide → Learn`
#### Learning
1. Input Invoice
- serviceDate, currency, poNumber ? `null`
- Confidence = `0.72`

`data/invoices_extracted.json`
```bash
  {
    "invoiceId": "INV-A-001",
    "vendor": "Supplier GmbH",
    "confidence": 0.72,
    "rawText": "Rechnungsnr: INV-2024-001\nLeistungsdatum: 01.01.2024\nMwSt: 19%",
    "fields": {
      "invoiceNumber": "INV-2024-001",
      "invoiceDate": "02.01.2024",
      "serviceDate": null,
      "currency": null,
      "poNumber": null,
      "netTotal": 1000,
      "taxRate": 0.19,
      "taxTotal": 190,
      "grossTotal": 1190,
      "lineItems": []
    },
    "possiblePoNumbers": ["PO-A-050"]
  }

```
2. Recall Memory
`recallMemory(invoice, store)`
- no data

```bash
  {
    vendorMemory: null,
    correctionMemory: [],
    resolutionMemory: []
  }
```
3. Apply Memory
`applyMemory(invoice, recalled)`
- Clone invoice fields
- No vendor memory → nothing auto-filled
- No correction patterns → no auto-correct
```bash
  {
    "normalizedInvoice": {
      "serviceDate": null,
      "currency": null,
      "poNumber": null
    },
    "proposedCorrections": [],
    "reasoning": [],
    "confidenceContribution": 0
  }
```
4. Decision Logic
`decisionLogic(invoice, recalled, applyResult, store)`
- no change in Confidence
```bash
  {
    "requiresHumanReview": true,
    "reasoning": "Missing service date and currency",
    "confidenceScore": 0.72
  }
```

5. Human Correction
`data/human_corrections.json`
```bash
  {
    "invoiceId": "INV-A-001",
    "humanApproved": true,
    "correctedFields": {
      "serviceDate": "01.01.2024",
      "currency": "EUR",
      "poNumber": "PO-A-050"
    }
  }
```
6. Learn Memory
`learnMemory(invoice, applyResult, recalled, confidenceScore, store, humanApproved)`
✔ not duplicate
✔ humanApproved === true
✔ confidenceScore >= 0.7
```bash
  Vendor Memory WRITE

  {
    "key": "vendor:Supplier GmbH",
    "type": "vendor",
    "data": {
      "vendor": "Supplier GmbH",
      "mappings": {
        "serviceDateField": "Leistungsdatum"
      },
      "defaultCurrency": "EUR",
      "poMatchingStrategy": "single-po-prefer"
    },
    "confidence": 0.7,
    "invoiceId": "INV-A-001"
  }
```
```bash
  Correction Memory WRITE
  {
    "key": "correction:Supplier GmbH:service_date_mapping",
    "type": "correction",
    "data": {
      "patternId": "service_date_from_rawtext",
      "description": "Extract service date from vendor-specific label",
      "correctionRule": "extract_date_from_rawtext"
    },
    "confidence": 0.6
  }
```
```bash
  Resolution Memory WRITE
  {
    "key": "resolution:Supplier GmbH:invoice_decision",
    "type": "resolution",
    "data": {
      "lastDecision": "approved"
    },
    "confidence": 0.72
  }
```

#### Testing
1. Input Invoice
- serviceDate, currency, poNumber ? `null`
- Confidence = `0.69`

`data/invoices_extracted.json`
```bash
  {
    "invoiceId": "INV-A-003",
    "vendor": "Supplier GmbH",
    "confidence": 0.69,
    "rawText": "Leistungsdatum: 20.01.2024",
    "fields": {
      "serviceDate": null,
      "currency": null,
      "poNumber": null,
      "grossTotal": 595,
      "taxRate": 0.19,
      "netTotal": 500,
      "taxTotal": 95
    },
    "possiblePoNumbers": ["PO-A-051"]
  }
```
2. Recall Memory
- return data (based on matching logic)
```bash
  {
    vendorMemory: {
      mappings: { serviceDateField: "Leistungsdatum" },
      defaultCurrency: "EUR",
      poMatchingStrategy: "single-po-prefer"
    },
    correctionMemory: [...],
    resolutionMemory: [...]
  }
```
3. Apply Memory
- serviceDate from rawText `{ serviceDateField: "Leistungsdatum" }`
- currency = EUR
- poNumber auto-correct
```bash
  {
    "normalizedInvoice": {
      "serviceDate": "20.01.2024",
      "currency": "EUR",
      "poNumber": "PO-A-051"
    },
    "proposedCorrections": [
      "Filled serviceDate using vendor mapping",
      "Recovered currency using vendor default",
      "Auto-selected PO using single-po strategy"
    ],
    "confidenceContribution": 0.13
  }
```

4. Decision Logic
- start = 0.69
- + memory boost = 0.82
- final = 0.

```bash
  {
    "requiresHumanReview": false,
    "confidenceScore": 0.9,
    "reasoning": "Vendor memory applied with high confidence",
    "auditTrail": [
      "Vendor memory recalled",
      "Service date auto-filled",
      "Currency auto-recovered",
      "PO auto-selected"
    ]
  }
```

```bash
  Correction Memory WRITE
  {
    "key": "correction:Supplier GmbH:service_date_mapping",
    "type": "correction",
    "data": {
      "patternId": "service_date_from_rawtext",
      "description": "Extract service date from vendor-specific label",
      "correctionRule": "extract_date_from_rawtext"
    },
    "confidence": 0.6
  }
```
```bash
  Resolution Memory WRITE
  {
    "key": "resolution:Supplier GmbH:invoice_decision",
    "type": "resolution",
    "data": {
      "lastDecision": "approved"
    },
    "confidence": 0.72
  }
```
5. Console Output:

```bash
  {
    "invoiceId": "INV-A-003",
    "normalizedInvoice": {
      "serviceDate": "20.01.2024",
      "currency": "EUR",
      "poNumber": "PO-A-051"
    },
    "decision": "AUTO_CORRECT",
    "confidenceScore": 0.9,
    "memoryUsed": ["vendor", "correction", "resolution"],
    "auditTrail": [...]
  }
}
```

### ☐ Tech Stack
- TypeScript (strict-mode)
- Node.js
- SQLite 3

### ☐ Folder Structure
``` Java
Memory_Layer/
│
├── 📁 data/
│   ├── delivery_notes.json
│   ├── human_corrections.json
│   ├── invoices_extracted.json
│   ├── purchase_orders.json
│   └── memory.db
│
├── 📁 scripts/
│   ├── setup-db.ts
│   ├── seed-po-dn.ts
│   └── apply-human-corrections.ts
│
├── 📁 src/
│   ├── 📁 logic/
│   │   ├── recallMemory.ts
│   │   ├── applyMemory.ts
│   │   ├── decisionLogic.ts
│   │   ├── learnMemory.ts
│   │   └── tableMemory.ts
│   │
│   ├── 📁 memory/
│   │   ├── memoryStore.ts
│   │   ├── vendorMemory.ts
│   │   ├── correctionMemory.ts
│   │   ├── resolutionMemory.ts
│   │   └── orderStore.ts
│   │
│   ├── 📁 models/
│   │   ├── invoiceModel.ts
│   │   ├── humanCorrection.ts
│   │   └── orderModel.ts
│   │
│   ├── 📁 utils/
│   │   ├── auditTrail.ts
│   │   ├── confidenceTracker.ts
│   │   └── duplicateDetector.ts
│   │
│   └── index.ts
│
├── 📁 tests/
│   └── memory.test.ts
│
├── .gitignore
├── package.json
├── package-lock.json
└── tsconfig.json

```

### ☐ Installation
#### 1. Clone the repository
```bash
  git clone https://github.com/harshkunz/Memory_Layer
  cd Memory Layer
```

#### 2. Running the application
```bash
  npm install             # Install Dependencies
  npm run setup-db        # Reset Database
  npm run seed-po-dn      # Add Purchase Orders and Delivery Notes
  npm run apply-human     # Apply Human Corrections
  npm run start           # Start
```

### ☐ Contributing
Open to contributions!
- Fork the repository  
- Create a new branch (`git checkout -b feature-name`)  
- Commit your changes (`git commit -m 'Add feature'`)  
- Push to the branch (`git push origin feature-name`)  
- Create a Pull Request
