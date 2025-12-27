
export type AuditStep = "recall" | "apply" | "decide" | "learn";

export interface AuditEntry {
  step: AuditStep;
  timestamp: string;

  // Human-readable explanation
  message: string;

  // Optional Structured metadata (for deep audit / debugging)
  invoiceId?: string;
  vendor?: string;
  memoryKey?: string;
  memoryType?: "vendor" | "correction" | "resolution";
  confidenceBefore?: number;
  confidenceAfter?: number;
}

export class AuditTrail {
  private entries: AuditEntry[] = [];

  add(
    step: AuditStep,
    message: string,
    meta?: Omit<AuditEntry, "step" | "timestamp" | "message">
  ): void {
    this.entries.push({
      step,
      timestamp: new Date().toISOString(),
      message,
      ...(meta ?? {}),
    });
  }

  toArray(): AuditEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }
}
