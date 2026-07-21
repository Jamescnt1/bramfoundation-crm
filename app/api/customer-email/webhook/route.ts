import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type ResendEvent = { type: string; created_at: string; data: { email_id: string; from?: string; to?: string[]; subject?: string } };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verify(raw, request.headers)) return new NextResponse("Invalid webhook", { status: 400 });
  const event = JSON.parse(raw) as ResendEvent; const webhookId = request.headers.get("svix-id")!; const admin = createAdminClient();
  const { data: existing } = await admin.from("email_webhook_events").select("webhook_id").eq("webhook_id", webhookId).maybeSingle();
  if (existing) return NextResponse.json({ ok: true });
  await admin.from("email_webhook_events").insert({ webhook_id: webhookId, event_type: event.type, provider_message_id: event.data.email_id, payload: event });
  if (event.type === "email.sent" || event.type === "email.delivered" || event.type === "email.failed" || event.type === "email.bounced") {
    const status = event.type === "email.delivered" ? "delivered" : event.type === "email.sent" ? "sent" : "failed";
    await admin.from("customer_emails").update({ status, delivered_at: status === "delivered" ? event.created_at : undefined,
      failure_reason: status === "failed" ? event.type.replace("email.", "Email ") : null }).eq("provider_message_id", event.data.email_id);
  }
  if (event.type === "email.received") await recordInbound(event);
  return NextResponse.json({ ok: true });
}

async function recordInbound(event: ResendEvent) {
  const apiKey = process.env.RESEND_API_KEY; if (!apiKey) return;
  const response = await fetch(`https://api.resend.com/emails/receiving/${event.data.email_id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error("Unable to retrieve inbound email.");
  const email = await response.json() as { from: string; to: string[]; subject: string; text: string | null; html: string | null };
  const jobId = email.to.map((address) => address.match(/job\+([0-9a-f-]{36})@/i)?.[1]).find(Boolean); if (!jobId) return;
  const admin = createAdminClient(); const { data: job } = await admin.from("jobs").select("id,customer_id").eq("id", jobId).maybeSingle(); if (!job) return;
  const { data: inserted } = await admin.from("customer_emails").insert({ job_id: job.id, customer_id: job.customer_id,
    direction: "inbound", sender: email.from, recipient: email.to.join(", "), subject: email.subject,
    body: email.text || stripHtml(email.html || ""), status: "delivered", provider: "resend",
    provider_message_id: event.data.email_id, delivered_at: event.created_at }).select("id").single();
  if (inserted) await admin.from("job_activities").insert({ job_id: job.id, activity_type: "customer_email_received",
    description: `Customer email received: ${email.subject}.`, old_value: null, new_value: inserted.id });
}

function verify(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET; const id = headers.get("svix-id"); const timestamp = headers.get("svix-timestamp"); const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return signatures.split(" ").some((entry) => { const value = entry.split(",")[1]; if (!value) return false; const a = Buffer.from(value); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); });
}
function stripHtml(value: string) { return value.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
