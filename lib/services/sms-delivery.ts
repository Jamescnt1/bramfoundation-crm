import "server-only";

import { requireAdministrator } from "@/lib/services/employees";
import { sendProviderSms } from "@/lib/services/sms-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendInstallerTrialSms(installerContactId: string, consentConfirmed: boolean) {
  const actor = await requireAdministrator();
  if (!consentConfirmed) throw new Error("Confirm that this installer agreed to receive scheduling text messages.");
  const admin = createAdminClient();
  const [settingsResult, contactResult, templateResult] = await Promise.all([
    admin.from("communication_settings").select("sms_enabled, trial_mode").eq("singleton_key", true).single(),
    admin.from("installer_contacts").select("id, name, mobile_phone, preferred_channel, trial_recipient_verified, active").eq("id", installerContactId).single(),
    admin.from("communication_templates").select("id, body").eq("name", "Installer Connection Test").eq("channel", "sms").eq("active", true).single(),
  ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (contactResult.error) throw new Error(contactResult.error.message);
  if (templateResult.error) throw new Error(templateResult.error.message);
  const contact = contactResult.data;
  if (!settingsResult.data.sms_enabled) throw new Error("Turn on Text Messages under Company safety controls before sending a test.");
  if (!contact.active) throw new Error("This installer contact is retired.");
  if (!contact.mobile_phone) throw new Error("Add a mobile number before sending a test.");
  if (contact.preferred_channel !== "sms" && contact.preferred_channel !== "both") {
    throw new Error("Choose Text only or Email and text as this installer's preferred delivery method.");
  }
  if (settingsResult.data.trial_mode && !contact.trial_recipient_verified) {
    throw new Error("Mark this number as verified for the Twilio trial before sending a test.");
  }

  const consentRecordedAt = new Date().toISOString();
  const { error: consentError } = await admin.from("communication_consents").upsert({
    recipient_type: "installer",
    recipient_id: contact.id,
    phone_number: contact.mobile_phone,
    status: "opted_in",
    consent_method: "administrator_confirmation",
    consent_recorded_at: consentRecordedAt,
    opted_out_at: null,
    evidence: { confirmed_by_employee_id: actor.id, purpose: "installer_scheduling" },
  }, { onConflict: "recipient_type,recipient_id,phone_number" });
  if (consentError) throw new Error(consentError.message);

  const idempotencyKey = `installer-test-${contact.id}-${crypto.randomUUID()}`;
  const { data: delivery, error: deliveryError } = await admin.from("communication_deliveries").insert({
    channel: "sms",
    direction: "outbound",
    recipient_type: "installer",
    recipient_id: contact.id,
    recipient_address: contact.mobile_phone,
    body: templateResult.data.body,
    status: "queued",
    template_id: templateResult.data.id,
    sent_by_employee_id: actor.id,
    idempotency_key: idempotencyKey,
    consent_status: "opted_in",
    is_automated: false,
  }).select("id").single();
  if (deliveryError) throw new Error(deliveryError.message);

  try {
    const result = await sendProviderSms({ to: contact.mobile_phone, body: templateResult.data.body });
    const sentAt = new Date().toISOString();
    const { error } = await admin.from("communication_deliveries").update({
      status: mapTwilioStatus(result.providerStatus),
      provider: result.provider,
      provider_message_id: result.providerMessageId,
      provider_status: result.providerStatus,
      sent_at: sentAt,
      attempt_count: 1,
    }).eq("id", delivery.id);
    if (error) throw new Error(error.message);
    return { deliveryId: delivery.id, recipientName: contact.name, status: result.providerStatus };
  } catch (caught) {
    const failure = twilioFailure(caught);
    await admin.from("communication_deliveries").update({
      status: "failed", failure_reason: failure.message, provider_error_code: failure.code, attempt_count: 1,
    }).eq("id", delivery.id);
    throw new Error(failure.message);
  }
}

export function mapTwilioStatus(status: string | null | undefined) {
  if (status === "delivered" || status === "read") return "delivered";
  if (status === "sent") return "sent";
  if (status === "failed") return "failed";
  if (status === "undelivered") return "undelivered";
  if (status === "canceled") return "canceled";
  if (status === "sending") return "processing";
  return "queued";
}

function twilioFailure(caught: unknown) {
  const error = caught as { message?: string; code?: string | number };
  return {
    message: error?.message || "Twilio rejected the text message.",
    code: error?.code ? String(error.code) : null,
  };
}
