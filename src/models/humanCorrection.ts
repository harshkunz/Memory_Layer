
export type FinalDecision = "approved" | "rejected";

export interface HumanFieldCorrection {
  field: string;
  from: any;
  to: any;
  reason: string;
}

export interface HumanCorrection {
  invoiceId: string;
  vendor: string;
  corrections: HumanFieldCorrection[];
  finalDecision: FinalDecision;
}
