import { NextResponse } from "next/server";
import { mapTwilioStatus } from "@/lib/services/sms-delivery";
import { validateTwilioWebhook } from "@/lib/services/sms-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    if (!(await validateTwilioWebhook(request, formData))) return new NextResponse("Invalid Twilio signature", { status: 403 });
    const providerMessageId = text(formData, "MessageSid");
    const providerStatus = text(formData, "MessageStatus");
    if (!providerMessageId || !providerStatus) return new NextResponse("Missing Twilio message status", { status: 400 });
    const errorCode = text(formData, "ErrorCode");
    const status = mapTwilioStatus(providerStatus);
    const admin = createAdminClient();
    const payload = formPayload(formData);
    const { error: eventError } = await admin.from("communication_webhook_events").upsert({
      provider: "twilio",
      provider_event_id: `${providerMessageId}:${providerStatus}`,
      event_type: `message.${providerStatus}`,
      provider_message_id: providerMessageId,
      payload,
      processed_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
    if (eventError) throw new Error(eventError.message);

    const deliveredAt = status === "delivered" ? new Date().toISOString() : null;
    const { data: currentDelivery, error: currentError } = await admin.from("communication_deliveries")
      .select("id, status").eq("provider", "twilio").eq("provider_message_id", providerMessageId).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!currentDelivery) return NextResponse.json({ ok: true });
    const finalStatus = laterStatus(currentDelivery.status, status);
    const { error: updateError } = await admin.from("communication_deliveries").update({
      status: finalStatus,
      provider_status: providerStatus,
      provider_error_code: errorCode,
      failure_reason: finalStatus === "failed" || finalStatus === "undelivered"
        ? `Twilio could not deliver this message${errorCode ? ` (error ${errorCode})` : ""}.`
        : null,
      ...(deliveredAt && finalStatus === "delivered" ? { delivered_at: deliveredAt } : {}),
    }).eq("id", currentDelivery.id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Unable to process Twilio status." }, { status: 500 });
  }
}

function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" && value ? value : null; }
function formPayload(formData: FormData) { return Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")); }
function laterStatus(current: string, incoming: string) {
  if (["failed", "undelivered", "canceled"].includes(incoming)) return incoming;
  if (["failed", "undelivered", "canceled"].includes(current)) return current;
  const rank: Record<string, number> = { queued: 0, processing: 1, sent: 2, delivered: 3 };
  return (rank[incoming] ?? 0) >= (rank[current] ?? 0) ? incoming : current;
}
