import "server-only";

import type {
  AppointmentNotificationAudience,
  AppointmentNotificationChannel,
  AppointmentNotificationDelivery,
  AppointmentNotificationKind,
  CalendarCommunicationData,
} from "@/components/calendar/communication-types";
import { normalizeUsPhone } from "@/lib/phone-number";
import { getCompanySettings } from "@/lib/services/company-settings";
import { requirePermission } from "@/lib/services/employees";
import { sendProviderEmail } from "@/lib/services/email-provider";
import { mapTwilioStatus } from "@/lib/services/sms-delivery";
import { sendProviderSms } from "@/lib/services/sms-provider";
import { createAdminClient } from "@/lib/supabase/admin";

const historyColumns = "id,appointment_id,direction,recipient_type,recipient_address,sender_address,body,subject,channel,status,failure_reason,provider_error_code,created_at";

export async function getCalendarCommunicationData(appointmentIds: string[]): Promise<CalendarCommunicationData> {
  await requirePermission("communications.view");
  const admin = createAdminClient();
  const [settingsResult, deliveryResult] = await Promise.all([
    admin.from("communication_settings").select("email_notifications_enabled,sms_enabled,calendar_customer_notifications_enabled,calendar_employee_notifications_enabled,calendar_installer_notifications_enabled").eq("singleton_key", true).single(),
    appointmentIds.length
      ? admin.from("communication_deliveries").select(historyColumns).in("appointment_id", appointmentIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (deliveryResult.error) throw new Error(deliveryResult.error.message);
  const deliveriesByAppointment: Record<string, AppointmentNotificationDelivery[]> = {};
  for (const delivery of (deliveryResult.data ?? []) as AppointmentNotificationDelivery[]) {
    deliveriesByAppointment[delivery.appointment_id] = [...(deliveriesByAppointment[delivery.appointment_id] ?? []), delivery];
  }
  return {
    controls: {
      customer: settingsResult.data.calendar_customer_notifications_enabled,
      employee: settingsResult.data.calendar_employee_notifications_enabled,
      installer: settingsResult.data.calendar_installer_notifications_enabled,
      email: settingsResult.data.email_notifications_enabled,
      sms: settingsResult.data.sms_enabled,
    },
    deliveriesByAppointment,
  };
}

export async function sendAppointmentNotification(input: {
  appointmentId: string;
  audience: AppointmentNotificationAudience;
  channel: AppointmentNotificationChannel;
  kind: AppointmentNotificationKind;
}) {
  const actor = await requirePermission("communications.send");
  const admin = createAdminClient();
  const [settingsResult, appointmentResult, company] = await Promise.all([
    admin.from("communication_settings").select("email_notifications_enabled,sms_enabled,calendar_customer_notifications_enabled,calendar_employee_notifications_enabled,calendar_installer_notifications_enabled").eq("singleton_key", true).single(),
    admin.from("appointments").select(`id,job_id,assigned_employee_id,installer_crew_id,title,appointment_type,starts_at,location,
      job:jobs!appointments_job_id_fkey(id,customer_id,customer_name,phone,email,project_contact_phone,
        customer:customers!jobs_customer_id_fkey(id,full_name,phone,email),
        company_contact:customer_contacts!jobs_company_contact_id_fkey(id,first_name,last_name,mobile_phone,email),
        project_contact:customer_contacts!jobs_project_contact_id_fkey(id,first_name,last_name,mobile_phone,email),
        job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey(id,first_name,last_name,mobile_phone,email))`).eq("id", input.appointmentId).single(),
    getCompanySettings(),
  ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (appointmentResult.error) throw new Error(appointmentResult.error.message);
  const settings = settingsResult.data;
  if (!settings[controlColumn(input.audience)]) throw new Error(`${audienceLabel(input.audience)} appointment notifications are paused in Communication Settings.`);
  if (input.channel === "email" && !settings.email_notifications_enabled) throw new Error("Notification Emails are paused in Communication Settings.");
  if (input.channel === "sms" && !settings.sms_enabled) throw new Error("Text Messages are paused in Communication Settings.");

  const appointment = appointmentResult.data;
  const recipients = await resolveRecipients(admin, appointment, input.audience, input.channel, input.kind);
  if (!recipients.length) throw new Error(noRecipientMessage(input.audience, input.channel));
  const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || company.email;
  if (input.channel === "email" && !emailFromAddress) {
    throw new Error("No sender email is configured. Add a company email address or EMAIL_FROM_ADDRESS before sending appointment emails.");
  }
  const content = notificationContent(appointment, company, input.kind, input.channel);
  const results: { id: string; status: string }[] = [];

  for (const recipient of recipients) {
    if (input.channel === "sms") await requireSmsConsent(admin, recipient.address);
    const { data: delivery, error: insertError } = await admin.from("communication_deliveries").insert({
      channel: input.channel,
      direction: "outbound",
      recipient_type: input.audience,
      recipient_id: recipient.id,
      recipient_address: recipient.address,
      sender_address: input.channel === "email" ? emailFromAddress : null,
      subject: input.channel === "email" ? content.subject : null,
      body: content.body,
      status: "queued",
      job_id: appointment.job_id,
      appointment_id: appointment.id,
      recipient_employee_id: input.audience === "employee" ? recipient.id : null,
      sent_by_employee_id: actor.id,
      idempotency_key: `appointment-${appointment.id}-${input.audience}-${input.channel}-${recipient.id ?? "unlinked"}-${crypto.randomUUID()}`,
      consent_status: input.channel === "sms" ? "opted_in" : "not_required",
      is_automated: false,
    }).select("id").single();
    if (insertError) throw new Error(insertError.message);
    try {
      const provider = input.channel === "sms"
        ? await sendProviderSms({ to: recipient.address, body: content.body })
        : await sendProviderEmail({
          idempotencyKey: `appointment-email-${delivery.id}`,
          from: `${process.env.EMAIL_FROM_NAME || company.company_name} <${emailFromAddress}>`,
          to: recipient.address,
          subject: content.subject,
          text: content.body,
        });
      const providerStatus = "providerStatus" in provider && typeof provider.providerStatus === "string" ? provider.providerStatus : "sent";
      const status = input.channel === "sms" ? mapTwilioStatus(providerStatus) : "sent";
      await admin.from("communication_deliveries").update({
        status,
        provider: provider.provider,
        provider_message_id: provider.providerMessageId,
        provider_status: providerStatus,
        sent_at: new Date().toISOString(),
        attempt_count: 1,
      }).eq("id", delivery.id);
      results.push({ id: delivery.id, status });
      if (appointment.job_id) await admin.from("job_activities").insert({
        job_id: appointment.job_id,
        activity_type: "appointment_notification_sent",
        description: `${actor.name} sent an appointment ${input.kind} by ${input.channel} to ${recipient.name}.`,
        old_value: appointment.id,
        new_value: delivery.id,
      });
    } catch (caught) {
      const failure = providerFailure(caught);
      await admin.from("communication_deliveries").update({ status: "failed", failure_reason: failure.message, provider_error_code: failure.code, attempt_count: 1 }).eq("id", delivery.id);
      throw new Error(failure.message);
    }
  }
  return { count: results.length, statuses: results.map((item) => item.status) };
}

type Recipient = { id: string | null; name: string; address: string };

async function resolveRecipients(admin: ReturnType<typeof createAdminClient>, appointment: Record<string, unknown>, audience: AppointmentNotificationAudience, channel: AppointmentNotificationChannel, kind: AppointmentNotificationKind): Promise<Recipient[]> {
  if (audience === "employee") {
    if (!appointment.assigned_employee_id) return [];
    const { data, error } = await admin.from("employees").select("id,name,email,phone,preference:employee_communication_preferences(email_enabled,sms_enabled,appointment_notifications)").eq("id", appointment.assigned_employee_id).eq("active", true).maybeSingle();
    if (error) throw new Error(error.message);
    const preference = relation(data?.preference);
    const address = channel === "email" ? data?.email : normalizeUsPhone(data?.phone);
    const enabled = preference?.appointment_notifications !== false && (channel === "email" ? preference?.email_enabled !== false : preference?.sms_enabled === true);
    return data && address && enabled ? [{ id: data.id, name: data.name, address }] : [];
  }
  if (audience === "installer") {
    if (!appointment.installer_crew_id) return [];
    const { data, error } = await admin.from("installer_contacts").select("id,name,email,mobile_phone,preferred_channel,appointment_confirmations,appointment_reminders").eq("installer_crew_id", appointment.installer_crew_id).eq("active", true);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((item) => {
      const topicEnabled = kind === "confirmation" ? item.appointment_confirmations : item.appointment_reminders;
      const channelEnabled = channel === "email" ? ["email", "both"].includes(item.preferred_channel) : ["sms", "both"].includes(item.preferred_channel);
      const address = channel === "email" ? item.email : normalizeUsPhone(item.mobile_phone);
      return topicEnabled && channelEnabled && address ? [{ id: item.id, name: item.name, address }] : [];
    });
  }
  const job = relation(appointment.job);
  if (!job) return [];
  const project = relation(job.project_contact);
  const company = relation(job.company_contact);
  const customer = relation(job.customer);
  const address = channel === "email"
    ? project?.email ?? job.email ?? company?.email ?? customer?.email
    : normalizeUsPhone(project?.mobile_phone ?? job.project_contact_phone ?? job.phone ?? company?.mobile_phone ?? customer?.phone);
  const name = contactName(project) ?? customer?.full_name ?? job.customer_name ?? "Customer";
  return address ? [{ id: job.customer_id ?? null, name, address }] : [];
}

async function requireSmsConsent(admin: ReturnType<typeof createAdminClient>, phone: string) {
  const { data, error } = await admin.from("communication_consents").select("status").eq("phone_number", phone).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.status === "opted_out") throw new Error(`${phone} opted out. The recipient must text START before another message can be sent.`);
  if (data?.status !== "opted_in") throw new Error(`${phone} has not opted in to text messages.`);
}

function notificationContent(appointment: Record<string, unknown>, company: { company_name: string; timezone: string }, kind: AppointmentNotificationKind, channel: AppointmentNotificationChannel) {
  const startsAt = new Date(String(appointment.starts_at));
  const date = new Intl.DateTimeFormat("en-US", { timeZone: company.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: company.timezone, hour: "numeric", minute: "2-digit" }).format(startsAt);
  const title = String(appointment.title || "Appointment");
  const location = appointment.location ? ` Location: ${appointment.location}.` : "";
  return {
    subject: `${kind === "reminder" ? "Reminder: " : ""}${title} on ${date}`,
    body: `${company.company_name}: ${kind === "reminder" ? "Reminder — " : ""}${title} is scheduled for ${date} at ${time}.${location}${kind === "reminder" ? "" : " Please reply if anything has changed."}${channel === "sms" ? " Reply STOP to opt out or HELP for help." : ""}`,
  };
}

function controlColumn(audience: AppointmentNotificationAudience) {
  return `calendar_${audience}_notifications_enabled` as "calendar_customer_notifications_enabled" | "calendar_employee_notifications_enabled" | "calendar_installer_notifications_enabled";
}
function audienceLabel(audience: AppointmentNotificationAudience) { return audience === "installer" ? "Installer" : audience === "employee" ? "Employee" : "Customer"; }
function noRecipientMessage(audience: AppointmentNotificationAudience, channel: AppointmentNotificationChannel) { return `No eligible ${audience} ${channel === "sms" ? "text recipient" : "email recipient"} is configured for this appointment.`; }
type RelatedRecord = Record<string, unknown> & {
  appointment_notifications?: boolean;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  customer_name?: string | null;
  customer_id?: string | null;
  project_contact_phone?: string | null;
  project_contact?: unknown;
  company_contact?: unknown;
  customer?: unknown;
};
function relation(value: unknown): RelatedRecord | null { return (Array.isArray(value) ? value[0] : value) as RelatedRecord | null; }
function contactName(contact: RelatedRecord | null) { return contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || null : null; }
function providerFailure(caught: unknown) { const error = caught as { message?: string; code?: string | number }; return { message: error?.message || "The provider rejected the appointment notification.", code: error?.code ? String(error.code) : null }; }
