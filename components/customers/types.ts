export type Customer = {
  id: string;

  full_name: string;

  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  automated_communications_enabled: boolean;
  preferred_communication_channel: "none" | "email" | "sms" | "both";
  lead_followups_enabled: boolean;
  estimate_followups_enabled: boolean;

  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
};
