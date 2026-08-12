import "server-only";

import type { JobSmsDelivery } from "@/components/sms/types";
import { normalizeUsPhone } from "@/lib/phone-number";
import { requirePermission } from "@/lib/services/employees";
import { sendProviderSms } from "@/lib/services/sms-provider";
import { mapTwilioStatus } from "@/lib/services/sms-delivery";
import { createAdminClient } from "@/lib/supabase/admin";

const deliveryColumns = "id,direction,recipient_address,sender_address,body,status,failure_reason,provider_error_code,sent_at,delivered_at,created_at";

export async function getJobCustomerSms(jobId: string): Promise<JobSmsDelivery[]> {
  await requirePermission("communications.view");
  const admin = createAdminClient();
  const { data, error } = await admin.from("communication_deliveries")
    .select(deliveryColumns)
    .eq("job_id", jobId)
    .eq("channel", "sms")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobSmsDelivery[];
}

export async function sendJobCustomerSms(input: { jobId: string; recipient: string; body: string }) {
  const actor = await requirePermission("communications.send");
  const admin = createAdminClient();
  const [{ data: settings, error: settingsError }, { data: job, error: jobError }] = await Promise.all([
    admin.from("communication_settings").select("sms_enabled,scheduled_communications_enabled,automated_communications_enabled").eq("singleton_key", true).single(),
    admin.from("jobs").select(`id,customer_id,customer_name,phone,project_contact_phone,
      company_contact:customer_contacts!jobs_company_contact_id_fkey(mobile_phone),
      project_contact:customer_contacts!jobs_project_contact_id_fkey(mobile_phone),
      job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey(mobile_phone),
      customer:customers!jobs_customer_id_fkey(phone)`).eq("id", input.jobId).is("archived_at", null).single(),
  ]);
  if (settingsError) throw new Error(settingsError.message);
  if (jobError) throw new Error(jobError.message);
  if (!settings.sms_enabled) throw new Error("Text Messages are paused in Communication Settings.");

  const recipient = normalizeUsPhone(input.recipient);
  if (!recipient) throw new Error("Choose a valid customer mobile number.");
  const allowedPhones = jobPhones(job).map(normalizeUsPhone).filter(Boolean);
  if (!allowedPhones.includes(recipient)) throw new Error("Choose a phone number saved on this job or its customer contacts.");

  const body = input.body.trim();
  if (!body) throw new Error("Write a text message before sending.");
  if (body.length > 1200) throw new Error("Keep the text message under 1,200 characters.");

  const { data: consent, error: consentError } = await admin.from("communication_consents")
    .select("id,status")
    .eq("phone_number", recipient)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consentError) throw new Error(consentError.message);
  if (consent?.status === "opted_out") throw new Error("This number opted out. Ask the recipient to text START before sending another message.");
  if (consent?.status !== "opted_in") throw new Error("This number has not opted in. Ask the recipient to text START to (623) 233-0122 first.");

  const { data: delivery, error: deliveryError } = await admin.from("communication_deliveries").insert({
    channel: "sms",
    direction: "outbound",
    recipient_type: "customer",
    recipient_id: job.customer_id,
    recipient_address: recipient,
    body,
    status: "queued",
    job_id: job.id,
    sent_by_employee_id: actor.id,
    idempotency_key: `job-sms-${job.id}-${crypto.randomUUID()}`,
    consent_status: "opted_in",
    is_automated: false,
  }).select("id").single();
  if (deliveryError) throw new Error(deliveryError.message);

  try {
    const result = await sendProviderSms({ to: recipient, body });
    const sentAt = new Date().toISOString();
    const status = mapTwilioStatus(result.providerStatus);
    const { error: updateError } = await admin.from("communication_deliveries").update({
      status,
      provider: result.provider,
      provider_message_id: result.providerMessageId,
      provider_status: result.providerStatus,
      sent_at: sentAt,
      attempt_count: 1,
    }).eq("id", delivery.id);
    if (updateError) throw new Error(updateError.message);
    await admin.from("job_activities").insert({
      job_id: job.id,
      activity_type: "customer_sms_sent",
      description: `${actor.name} sent a customer text message.`,
      old_value: null,
      new_value: delivery.id,
    });
    return { id: delivery.id, status };
  } catch (caught) {
    const failure = providerFailure(caught);
    await admin.from("communication_deliveries").update({
      status: "failed",
      failure_reason: failure.message,
      provider_error_code: failure.code,
      attempt_count: 1,
    }).eq("id", delivery.id);
    throw new Error(failure.message);
  }
}

function jobPhones(job: Record<string, unknown>) {
  return [
    job.phone,
    job.project_contact_phone,
    relationPhone(job.company_contact),
    relationPhone(job.project_contact),
    relationPhone(job.job_site_contact),
    relationPhone(job.customer),
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

function relationPhone(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return null;
  const phone = (relation as { mobile_phone?: unknown; phone?: unknown }).mobile_phone ?? (relation as { phone?: unknown }).phone;
  return typeof phone === "string" ? phone : null;
}

function providerFailure(caught: unknown) {
  const error = caught as { message?: string; code?: string | number };
  return { message: error?.message || "Twilio rejected the text message.", code: error?.code ? String(error.code) : null };
}
