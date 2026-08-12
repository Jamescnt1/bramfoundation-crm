export type JobSmsDelivery = {
  id: string;
  direction: "inbound" | "outbound";
  recipient_address: string;
  sender_address: string | null;
  body: string;
  status: string;
  failure_reason: string | null;
  provider_error_code: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type JobSmsRecipient = {
  label: string;
  name: string;
  phone: string;
};
