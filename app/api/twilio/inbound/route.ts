import { NextResponse } from "next/server";
import { validateTwilioWebhook } from "@/lib/services/sms-provider";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const { data: contact } = await admin.from("installer_contacts")
      .select("id").eq("mobile_phone", from).eq("active", true).maybeSingle();
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
      } else if (contact) {
        await admin.from("communication_consents").insert({
          recipient_type: "installer", recipient_id: contact.id, phone_number: from, status: consentStatus,
          consent_method: "sms_keyword", consent_recorded_at: consentStatus === "opted_in" ? now : null,
          opted_out_at: consentStatus === "opted_out" ? now : null,
          evidence: { provider_message_id: providerMessageId, keyword: normalizedBody || optOutType },
        });
      }
    }

    const { error: deliveryError } = await admin.from("communication_deliveries").insert({
      channel: "sms", direction: "inbound", recipient_type: "installer", recipient_id: contact?.id ?? null,
      recipient_address: to, sender_address: from, body, status: "delivered", provider: "twilio",
      provider_message_id: providerMessageId, provider_status: "received", delivered_at: new Date().toISOString(),
      consent_status: consentStatus,
    });
    if (deliveryError) throw new Error(deliveryError.message);
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
