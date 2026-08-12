import { NextResponse } from "next/server";
import { validateTwilioWebhook } from "@/lib/services/sms-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsPhone } from "@/lib/phone-number";

const optOutWords = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const optInWords = new Set(["START", "UNSTOP", "YES"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    if (!(await validateTwilioWebhook(request, formData))) return new NextResponse("Invalid Twilio signature", { status: 403 });
    const providerMessageId = text(formData, "MessageSid");
    const from = text(formData, "From");
    const to = text(formData, "To");
    const body = text(formData, "Body") ?? "";
    if (!providerMessageId || !from || !to) return new NextResponse("Missing Twilio message fields", { status: 400 });
    const admin = createAdminClient();
    const { data: existing } = await admin.from("communication_webhook_events")
      .select("id").eq("provider", "twilio").eq("provider_event_id", providerMessageId).maybeSingle();
    if (existing) return twiml();

    const identity = await resolveInboundIdentity(admin, from);
    const optOutType = (text(formData, "OptOutType") ?? "").toUpperCase();
    const normalizedBody = body.trim().toUpperCase();
    const consentStatus = optOutType === "STOP" || optOutWords.has(normalizedBody)
      ? "opted_out"
      : optOutType === "START" || optInWords.has(normalizedBody)
        ? "opted_in"
        : null;

    if (consentStatus) {
      const now = new Date().toISOString();
      const { data: consentRows } = await admin.from("communication_consents").select("id").eq("phone_number", from);
      if (consentRows?.length) {
        await admin.from("communication_consents").update({
          status: consentStatus,
          consent_method: "sms_keyword",
          consent_recorded_at: consentStatus === "opted_in" ? now : null,
          opted_out_at: consentStatus === "opted_out" ? now : null,
          evidence: { provider_message_id: providerMessageId, keyword: normalizedBody || optOutType },
        }).eq("phone_number", from);
      } else if (identity.recipientId) {
        await admin.from("communication_consents").insert({
          recipient_type: identity.recipientType, recipient_id: identity.recipientId, phone_number: from, status: consentStatus,
          consent_method: "sms_keyword", consent_recorded_at: consentStatus === "opted_in" ? now : null,
          opted_out_at: consentStatus === "opted_out" ? now : null,
          evidence: { provider_message_id: providerMessageId, keyword: normalizedBody || optOutType },
        });
      }
    }

    const { error: deliveryError } = await admin.from("communication_deliveries").insert({
      channel: "sms", direction: "inbound", recipient_type: identity.recipientType, recipient_id: identity.recipientId,
      recipient_address: to, sender_address: from, body, status: "delivered", provider: "twilio",
      provider_message_id: providerMessageId, provider_status: "received", delivered_at: new Date().toISOString(),
      consent_status: consentStatus, job_id: identity.jobId, appointment_id: identity.appointmentId,
    });
    if (deliveryError) throw new Error(deliveryError.message);
    if (identity.jobId) {
      const description = consentStatus === "opted_out"
        ? "Customer opted out of text messages."
        : consentStatus === "opted_in"
          ? "Customer opted in to text messages."
          : "Customer text reply received.";
      await admin.from("job_activities").insert({
        job_id: identity.jobId,
        activity_type: consentStatus ? `customer_sms_${consentStatus}` : "customer_sms_received",
        description,
        old_value: null,
        new_value: providerMessageId,
      });
    }
    const { error: eventError } = await admin.from("communication_webhook_events").insert({
      provider: "twilio", provider_event_id: providerMessageId, event_type: consentStatus ? `consent.${consentStatus}` : "message.received",
      provider_message_id: providerMessageId, payload: formPayload(formData), processed_at: new Date().toISOString(),
    });
    if (eventError) throw new Error(eventError.message);
    return twiml();
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Unable to process inbound Twilio message." }, { status: 500 });
  }
}

function twiml() { return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", { headers: { "Content-Type": "application/xml" } }); }
function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" && value ? value : null; }
function formPayload(formData: FormData) { return Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")); }

async function resolveInboundIdentity(admin: ReturnType<typeof createAdminClient>, from: string) {
  const { data: recent, error: recentError } = await admin.from("communication_deliveries")
    .select("job_id,appointment_id,recipient_type,recipient_id")
    .eq("channel", "sms")
    .eq("direction", "outbound")
    .eq("recipient_address", from)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentError) throw new Error(recentError.message);
  if (recent) return { jobId: recent.job_id as string | null, appointmentId: recent.appointment_id as string | null, recipientType: recent.recipient_type as "customer" | "employee" | "installer", recipientId: recent.recipient_id as string | null };

  const { data: employees, error: employeeError } = await admin.from("employees")
    .select("id,phone")
    .eq("active", true)
    .not("phone", "is", null);
  if (employeeError) throw new Error(employeeError.message);
  const employee = (employees ?? []).find((item) => normalizeUsPhone(item.phone) === from);
  if (employee) return { jobId: null, appointmentId: null, recipientType: "employee" as const, recipientId: employee.id };

  const { data: installers, error: installerError } = await admin.from("installer_contacts")
    .select("id,mobile_phone")
    .eq("active", true)
    .not("mobile_phone", "is", null);
  if (installerError) throw new Error(installerError.message);
  const installer = (installers ?? []).find((item) => normalizeUsPhone(item.mobile_phone) === from);
  if (installer) return { jobId: null, appointmentId: null, recipientType: "installer" as const, recipientId: installer.id };

  const [{ data: contacts, error: contactError }, { data: customers, error: customerError }, { data: jobs, error: jobError }] = await Promise.all([
    admin.from("customer_contacts").select("customer_id,mobile_phone").eq("active", true).is("archived_at", null).not("mobile_phone", "is", null),
    admin.from("customers").select("id,phone").is("archived_at", null).not("phone", "is", null),
    admin.from("jobs").select("id,customer_id,phone,project_contact_phone,created_at").is("archived_at", null).order("created_at", { ascending: false }),
  ]);
  if (contactError || customerError || jobError) throw new Error(contactError?.message ?? customerError?.message ?? jobError?.message ?? "Unable to match inbound sender.");
  const customerId = (contacts ?? []).find((item) => normalizeUsPhone(item.mobile_phone) === from)?.customer_id
    ?? (customers ?? []).find((item) => normalizeUsPhone(item.phone) === from)?.id
    ?? (jobs ?? []).find((item) => normalizeUsPhone(item.project_contact_phone) === from || normalizeUsPhone(item.phone) === from)?.customer_id
    ?? null;
  return { jobId: null, appointmentId: null, recipientType: "customer" as const, recipientId: customerId };
}
