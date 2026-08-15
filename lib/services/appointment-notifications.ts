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

export async function processScheduledAppointmentReminders() {
  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin.from("communication_settings").select("email_notifications_enabled,sms_enabled,scheduled_communications_enabled,automated_communications_enabled,trial_mode,calendar_customer_notifications_enabled,calendar_employee_notifications_enabled,calendar_installer_notifications_enabled,calendar_customer_reminder_hours_before,calendar_employee_reminder_hours_before,calendar_installer_reminder_hours_before,calendar_customer_reminder_channel,calendar_employee_reminder_channel,calendar_installer_reminder_channel").eq("singleton_key", true).single();
  if (settingsError) throw new Error(settingsError.message);
  if (!settings.scheduled_communications_enabled || !settings.automated_communications_enabled) {
    return { appointments: 0, sent: 0, failed: 0, skipped: "Scheduled reminders or automated communications are paused." };
  }

  const now = Date.now();
  const windowStart = new Date(now).toISOString();
  const windowEnd = new Date(now + (720 * 60 + 15) * 60 * 1000).toISOString();
  const { data: appointments, error: appointmentError } = await admin.from("appointments").select(`id,job_id,assigned_employee_id,installer_crew_id,title,appointment_type,starts_at,location,customer_notifications_enabled,confirmation_notification_enabled,reminder_notification_enabled,preferred_communication_channel,reminder_hours_before,
    job:jobs!appointments_job_id_fkey(id,customer_id,customer_name,phone,email,project_contact_phone,customer_communication_mode,preferred_communication_channel,
      customer:customers!jobs_customer_id_fkey(id,full_name,phone,email,automated_communications_enabled,preferred_communication_channel),
      company_contact:customer_contacts!jobs_company_contact_id_fkey(id,first_name,last_name,mobile_phone,email),
      project_contact:customer_contacts!jobs_project_contact_id_fkey(id,first_name,last_name,mobile_phone,email),
      job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey(id,first_name,last_name,mobile_phone,email))`).neq("status", "cancelled").gte("starts_at", windowStart).lt("starts_at", windowEnd).order("starts_at");
  if (appointmentError) throw new Error(appointmentError.message);
  const company = await getAutomationCompanySettings(admin);
  const audiences: Array<{ audience: AppointmentNotificationAudience; channel: AppointmentNotificationChannel; enabled: boolean; reminderHours: number }> = [
    { audience: "customer", channel: settings.calendar_customer_reminder_channel, enabled: settings.calendar_customer_notifications_enabled, reminderHours: settings.calendar_customer_reminder_hours_before },
    { audience: "employee", channel: settings.calendar_employee_reminder_channel, enabled: settings.calendar_employee_notifications_enabled, reminderHours: settings.calendar_employee_reminder_hours_before },
    { audience: "installer", channel: settings.calendar_installer_reminder_channel, enabled: settings.calendar_installer_notifications_enabled, reminderHours: settings.calendar_installer_reminder_hours_before },
  ];
  let sent = 0;
  let failed = 0;
  for (const appointment of appointments ?? []) {
    const appointmentAudiences = [
      ...audiences.filter((item) => item.audience !== "customer"),
      ...resolvedCustomerChannels(appointment, settings.calendar_customer_reminder_channel).map((channel) => ({ audience: "customer" as const, channel, enabled: settings.calendar_customer_notifications_enabled, reminderHours: typeof appointment.reminder_hours_before === "number" ? appointment.reminder_hours_before : settings.calendar_customer_reminder_hours_before })),
    ];
    for (const item of appointmentAudiences) {
      const sendAt = new Date(appointment.starts_at).getTime() - item.reminderHours * 60 * 60 * 1000;
      if (sendAt > now || sendAt <= now - 20 * 60 * 1000) continue;
      if (!item.enabled || (item.channel === "email" ? !settings.email_notifications_enabled : !settings.sms_enabled)) continue;
      if (item.audience === "customer" && !customerAutomationEligible(appointment, "reminder")) continue;
      const result = await sendAutomatedAppointmentNotification(admin, appointment, company, item.audience, item.channel, settings.trial_mode, "reminder");
      sent += result.sent;
      failed += result.failed;
    }
  }
  return { appointments: appointments?.length ?? 0, sent, failed };
}

async function sendAutomatedAppointmentNotification(
  admin: ReturnType<typeof createAdminClient>,
  appointment: Record<string, unknown>,
  company: { company_name: string; email: string | null; timezone: string },
  audience: AppointmentNotificationAudience,
  channel: AppointmentNotificationChannel,
  trialMode: boolean,
  kind: AppointmentNotificationKind,
  automationRuleId?: string,
  eventId?: string,
) {
  const recipients = await resolveRecipients(admin, appointment, audience, channel, kind);
  const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || company.email;
  const content = notificationContent(appointment, company, kind, channel);
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    if (channel === "email" && !emailFromAddress) { failed += 1; continue; }
    if (channel === "sms" && trialMode && !recipient.trialVerified) continue;
    try {
      if (channel === "sms") await requireSmsConsent(admin, recipient.address);
      const idempotencyKey = eventId
        ? `appointment-automation-${eventId}-${automationRuleId ?? "appointment"}-${audience}-${channel}-${recipient.id ?? recipient.address}`
        : `appointment-reminder-${appointment.id}-${audience}-${channel}-${recipient.id ?? recipient.address}`;
      const { data: delivery, error: insertError } = await admin.from("communication_deliveries").insert({
        channel,
        direction: "outbound",
        recipient_type: audience,
        recipient_id: recipient.id,
        recipient_address: recipient.address,
        sender_address: channel === "email" ? emailFromAddress : null,
        subject: channel === "email" ? content.subject : null,
        body: content.body,
        status: "queued",
        job_id: appointment.job_id,
        appointment_id: appointment.id,
        recipient_employee_id: audience === "employee" ? recipient.id : null,
        idempotency_key: idempotencyKey,
        consent_status: channel === "sms" ? "opted_in" : "not_required",
        is_automated: true,
        automation_rule_id: automationRuleId ?? null,
        scheduled_for: new Date().toISOString(),
      }).select("id").single();
      if (insertError?.code === "23505") continue;
      if (insertError) throw new Error(insertError.message);
      try {
        const provider = channel === "sms"
          ? await sendProviderSms({ to: recipient.address, body: content.body })
          : await sendProviderEmail({ idempotencyKey: `appointment-email-${delivery.id}`, from: `${process.env.EMAIL_FROM_NAME || company.company_name} <${emailFromAddress}>`, to: recipient.address, subject: content.subject, text: content.body });
        const providerStatus = "providerStatus" in provider && typeof provider.providerStatus === "string" ? provider.providerStatus : "sent";
        const status = channel === "sms" ? mapTwilioStatus(providerStatus) : "sent";
        await admin.from("communication_deliveries").update({ status, provider: provider.provider, provider_message_id: provider.providerMessageId, provider_status: providerStatus, sent_at: new Date().toISOString(), attempt_count: 1 }).eq("id", delivery.id);
        sent += 1;
        if (appointment.job_id) await admin.from("job_activities").insert({ job_id: appointment.job_id, activity_type: "appointment_reminder_sent", description: `Foundation CRM sent an automated appointment reminder by ${channel} to ${recipient.name}.`, old_value: appointment.id, new_value: delivery.id });
      } catch (caught) {
        const failure = providerFailure(caught);
        await admin.from("communication_deliveries").update({ status: "failed", failure_reason: failure.message, provider_error_code: failure.code, attempt_count: 1 }).eq("id", delivery.id);
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function processCommunicationAutomationEvents() {
  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin.from("communication_settings").select("email_notifications_enabled,sms_enabled,automated_communications_enabled,trial_mode,calendar_customer_notifications_enabled,calendar_employee_notifications_enabled,calendar_installer_notifications_enabled,calendar_customer_reminder_channel").eq("singleton_key", true).single();
  if (settingsError) throw new Error(settingsError.message);
  if (!settings.automated_communications_enabled) return { events: 0, sent: 0, failed: 0, skipped: "Automated communications are paused." };
  const { data: events, error: eventError } = await admin.from("communication_automation_events").select("id,trigger_event,trigger_value,appointment_id").is("processed_at", null).order("created_at").limit(50);
  if (eventError) throw new Error(eventError.message);
  const company = await getAutomationCompanySettings(admin);
  let sent = 0;
  let failed = 0;
  for (const event of events ?? []) {
    try {
      const { data: rules, error: ruleError } = await admin.from("automation_rules").select("id,notification_audience,notification_channel").eq("active", true).eq("action_type", "send_notification").eq("trigger_event", event.trigger_event).or(`trigger_value.is.null,trigger_value.eq.${event.trigger_value}`);
      if (ruleError) throw new Error(ruleError.message);
      if (event.appointment_id) {
        const { data: appointment, error: appointmentError } = await admin.from("appointments").select(`id,job_id,assigned_employee_id,installer_crew_id,title,appointment_type,starts_at,location,status,customer_notifications_enabled,confirmation_notification_enabled,reminder_notification_enabled,preferred_communication_channel,reminder_hours_before,
          job:jobs!appointments_job_id_fkey(id,customer_id,customer_name,phone,email,project_contact_phone,customer_communication_mode,preferred_communication_channel,
            customer:customers!jobs_customer_id_fkey(id,full_name,phone,email,automated_communications_enabled,preferred_communication_channel),
            company_contact:customer_contacts!jobs_company_contact_id_fkey(id,first_name,last_name,mobile_phone,email),
            project_contact:customer_contacts!jobs_project_contact_id_fkey(id,first_name,last_name,mobile_phone,email),
            job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey(id,first_name,last_name,mobile_phone,email))`).eq("id", event.appointment_id).maybeSingle();
        if (appointmentError) throw new Error(appointmentError.message);
        if (appointment && appointment.status !== "cancelled" && new Date(appointment.starts_at).getTime() > Date.now()) {
          if (settings.calendar_customer_notifications_enabled && customerAutomationEligible(appointment, "confirmation")) {
            for (const channel of resolvedCustomerChannels(appointment, settings.calendar_customer_reminder_channel)) {
              const channelEnabled = channel === "email" ? settings.email_notifications_enabled : settings.sms_enabled;
              if (!channelEnabled) continue;
              const result = await sendAutomatedAppointmentNotification(admin, appointment, company, "customer", channel, settings.trial_mode, "confirmation", undefined, event.id);
              sent += result.sent;
              failed += result.failed;
            }
          }
          for (const rule of rules) {
            const audience = rule.notification_audience as AppointmentNotificationAudience;
            const channel = rule.notification_channel as AppointmentNotificationChannel;
            if (audience === "customer") continue;
            const audienceEnabled = settings[controlColumn(audience)];
            const channelEnabled = channel === "email" ? settings.email_notifications_enabled : settings.sms_enabled;
            if (!audienceEnabled || !channelEnabled) continue;
            const result = await sendAutomatedAppointmentNotification(admin, appointment, company, audience, channel, settings.trial_mode, "confirmation", rule.id, event.id);
            sent += result.sent;
            failed += result.failed;
          }
        }
      }
    } catch {
      failed += 1;
    } finally {
      await admin.from("communication_automation_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    }
  }
  return { events: events?.length ?? 0, sent, failed };
}

type Recipient = { id: string | null; name: string; address: string; trialVerified?: boolean };

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
    const { data, error } = await admin.from("installer_contacts").select("id,name,email,mobile_phone,preferred_channel,appointment_confirmations,appointment_reminders,trial_recipient_verified").eq("installer_crew_id", appointment.installer_crew_id).eq("active", true);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((item) => {
      const topicEnabled = kind === "confirmation" ? item.appointment_confirmations : item.appointment_reminders;
      const channelEnabled = channel === "email" ? ["email", "both"].includes(item.preferred_channel) : ["sms", "both"].includes(item.preferred_channel);
      const address = channel === "email" ? item.email : normalizeUsPhone(item.mobile_phone);
      return topicEnabled && channelEnabled && address ? [{ id: item.id, name: item.name, address, trialVerified: item.trial_recipient_verified }] : [];
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

function customerAutomationEligible(appointment: Record<string, unknown>, kind: AppointmentNotificationKind) {
  if (appointment.customer_notifications_enabled !== true) return false;
  if (kind === "confirmation" && appointment.confirmation_notification_enabled !== true) return false;
  if (kind === "reminder" && appointment.reminder_notification_enabled !== true) return false;
  const job = relation(appointment.job);
  if (!job) return false;
  if (job.customer_communication_mode === "on") return true;
  if (job.customer_communication_mode === "off") return false;
  return relation(job.customer)?.automated_communications_enabled === true;
}

function resolvedCustomerChannels(appointment: Record<string, unknown>, fallback: AppointmentNotificationChannel): AppointmentNotificationChannel[] {
  const job = relation(appointment.job);
  const customer = relation(job?.customer);
  const selected = appointment.preferred_communication_channel === "inherit"
    ? job?.preferred_communication_channel === "inherit"
      ? customer?.preferred_communication_channel
      : job?.preferred_communication_channel
    : appointment.preferred_communication_channel;
  if (selected === "both") return ["email", "sms"];
  if (selected === "email" || selected === "sms") return [selected];
  return [fallback];
}

async function getAutomationCompanySettings(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.from("company_settings").select("company_name,email,timezone").eq("singleton_key", true).single();
  if (error) throw new Error(error.message);
  return data;
}
