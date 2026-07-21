export const EMAIL_MERGE_FIELDS = [
  "customer_name", "job_name", "qf_number", "appointment_date",
  "appointment_time", "assigned_employee", "company_name", "company_phone",
] as const;

export type EmailDeliveryStatus = "draft" | "queued" | "sent" | "delivered" | "failed";
export type EmailDirection = "inbound" | "outbound";

export type EmailTemplate = {
  id: string; name: string; category: string; subject: string; body: string;
  active: boolean; created_at: string; updated_at: string;
};

export type CustomerEmail = {
  id: string; job_id: string; customer_id: string | null; template_id: string | null;
  sent_by_employee_id: string | null; direction: EmailDirection; sender: string;
  recipient: string; subject: string; body: string; status: EmailDeliveryStatus;
  is_automated: boolean; provider_message_id: string | null; failure_reason: string | null;
  sent_at: string | null; delivered_at: string | null; created_at: string;
  sent_by: { id: string; name: string } | null;
  attachments: { id: string; file_name: string; mime_type: string; signed_url: string }[];
};
