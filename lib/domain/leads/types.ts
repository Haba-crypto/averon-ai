export type LeadRecord = {
  id: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  status?: string | null;
  intent_score?: number | null;
  urgency?: string | null;
  deal_risk?: string | null;
  recommendation?: string | null;
  ai_notes?: string | null;
  close_probability?: number | null;
};

export type RevenueAction = {
  type: string;
  message: string;
};
