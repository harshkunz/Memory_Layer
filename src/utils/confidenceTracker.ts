// src/utils/confidenceTracker.ts

export type ConfidenceSignal =
  | "human_approved"
  | "auto_correct"
  | "auto_accept"
  | "human_rejected"
  | "duplicate"
  | "no_change";

export class ConfidenceTracker {
  private base: number;
  private current: number;
  private readonly max: number;

  constructor(base: number = 0.3, max: number = 1.0) {
    this.base = base;
    this.current = base;
    this.max = max;
  }

  /**
   * Apply a confidence signal.
   * Positive signals reinforce, negative signals decay.
   */
  apply(signal: ConfidenceSignal): void {
    switch (signal) {
      case "human_approved":
        this.current += 0.15;
        break;

      case "auto_correct":
        this.current += 0.1;
        break;

      case "auto_accept":
        this.current += 0.05;
        break;

      case "human_rejected":
        this.current -= 0.25;
        break;

      case "duplicate":
        this.current -= 0.3;
        break;

      case "no_change":
        // small natural decay
        this.current -= 0.05;
        break;
    }

    this.current = clamp(this.current, 0, this.max);
  }

  /**
   * Get final confidence value
   */
  value(): number {
    return this.current;
  }

  /**
   * Reset tracker (important between invoices)
   */
  reset(base?: number): void {
    this.base = base ?? this.base;
    this.current = this.base;
  }
}

/* -------- helper -------- */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
