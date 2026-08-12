import "server-only";

import { requireAdministrator, requireEmployee } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioConfigurationStatus } from "@/lib/twilio/config";

export type CommunicationSettings = {
  id: string;
  email_notifications_enabled: boolean;
  sms_enabled: boolean;
  scheduled_communications_enabled: boolean;
  automated_communications_enabled: boolean;
  trial_mode: boolean;
  calendar_customer_notifications_enabled: boolean;
  calendar_employee_notifications_enabled: boolean;
  calendar_installer_notifications_enabled: boolean;
};

export type EmployeeCommunicationPreference = {
  employee_id: string;
  employee_name: string;
  employee_email: string | null;
  employee_phone: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  appointment_notifications: boolean;
  task_notifications: boolean;
  internal_message_notifications: boolean;
  job_notifications: boolean;
};

export type CommunicationSettingsPageData = {
  settings: CommunicationSettings;
  preferences: EmployeeCommunicationPreference[];
  canManageCompanySettings: boolean;
  twilio: ReturnType<typeof getTwilioConfigurationStatus>;
  smsTestRecipients: SmsTestRecipient[];
  recentSmsTests: SmsTestDelivery[];
};

export type SmsTestRecipient = {
  id: string;
  name: string;
  crew_name: string;
  mobile_phone: string;
  preferred_channel: string;
  trial_recipient_verified: boolean;
};

export type SmsTestDelivery = {
  id: string;
  recipient_name: string;
  recipient_address: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
};

const settingsColumns = "id, email_notifications_enabled, sms_enabled, scheduled_communications_enabled, automated_communications_enabled, trial_mode, calendar_customer_notifications_enabled, calendar_employee_notifications_enabled, calendar_installer_notifications_enabled";
const preferenceColumns = "employee_id, email_enabled, sms_enabled, appointment_notifications, task_notifications, internal_message_notifications, job_notifications";

export async function getCommunicationSettingsPageData(): Promise<CommunicationSettingsPageData> {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const canManageCompanySettings = actor.role === "administrator";
  const [settingsResult, employeeResult] = await Promise.all([
    admin.from("communication_settings").select(settingsColumns).eq("singleton_key", true).single(),
    admin.from("employees").select("id, name, email, phone").eq("active", true).order("name"),
  ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (employeeResult.error) throw new Error(employeeResult.error.message);

  const visibleEmployees = canManageCompanySettings
    ? employeeResult.data ?? []
    : (employeeResult.data ?? []).filter((employee) => employee.id === actor.id);
  const employeeIds = visibleEmployees.map((employee) => employee.id);
  const preferenceResult = employeeIds.length
    ? await admin.from("employee_communication_preferences").select(preferenceColumns).in("employee_id", employeeIds)
    : { data: [], error: null };
  if (preferenceResult.error) throw new Error(preferenceResult.error.message);
  const preferenceByEmployee = new Map((preferenceResult.data ?? []).map((item) => [item.employee_id, item]));
  let smsTestRecipients: SmsTestRecipient[] = [];
  let recentSmsTests: SmsTestDelivery[] = [];
  if (canManageCompanySettings) {
    const [contactResult, deliveryResult] = await Promise.all([
      admin.from("installer_contacts").select("id, name, mobile_phone, preferred_channel, trial_recipient_verified, installer_crew:installer_crews(name)").eq("active", true).not("mobile_phone", "is", null).order("name"),
      admin.from("communication_deliveries").select("id, recipient_id, recipient_address, status, failure_reason, created_at").eq("channel", "sms").eq("direction", "outbound").eq("recipient_type", "installer").order("created_at", { ascending: false }).limit(10),
    ]);
    if (contactResult.error) throw new Error(contactResult.error.message);
    if (deliveryResult.error) throw new Error(deliveryResult.error.message);
    const contacts = (contactResult.data ?? []).map((contact) => {
      const crew = contact.installer_crew as unknown as { name: string } | { name: string }[] | null;
      return {
        id: contact.id,
        name: contact.name,
        crew_name: (Array.isArray(crew) ? crew[0]?.name : crew?.name) ?? "Install crew",
        mobile_phone: contact.mobile_phone as string,
        preferred_channel: contact.preferred_channel,
        trial_recipient_verified: contact.trial_recipient_verified,
      };
    });
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
    smsTestRecipients = contacts;
    recentSmsTests = (deliveryResult.data ?? []).map((delivery) => ({
      id: delivery.id,
      recipient_name: contactById.get(delivery.recipient_id ?? "")?.name ?? "Installer contact",
      recipient_address: delivery.recipient_address,
      status: delivery.status,
      failure_reason: delivery.failure_reason,
      created_at: delivery.created_at,
    }));
  }

  return {
    settings: settingsResult.data as CommunicationSettings,
    preferences: visibleEmployees.map((employee) => {
      const preference = preferenceByEmployee.get(employee.id);
      return {
        employee_id: employee.id,
        employee_name: employee.name,
        employee_email: employee.email,
        employee_phone: employee.phone,
        email_enabled: preference?.email_enabled ?? true,
        sms_enabled: preference?.sms_enabled ?? false,
        appointment_notifications: preference?.appointment_notifications ?? true,
        task_notifications: preference?.task_notifications ?? true,
        internal_message_notifications: preference?.internal_message_notifications ?? true,
        job_notifications: preference?.job_notifications ?? true,
      };
    }),
    canManageCompanySettings,
    twilio: getTwilioConfigurationStatus(),
    smsTestRecipients,
    recentSmsTests,
  };
}

export async function updateCommunicationSettings(values: Omit<CommunicationSettings, "id">) {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data, error } = await admin.from("communication_settings").update({
    email_notifications_enabled: Boolean(values.email_notifications_enabled),
    sms_enabled: Boolean(values.sms_enabled),
    scheduled_communications_enabled: Boolean(values.scheduled_communications_enabled),
    automated_communications_enabled: Boolean(values.automated_communications_enabled),
    trial_mode: Boolean(values.trial_mode),
    calendar_customer_notifications_enabled: Boolean(values.calendar_customer_notifications_enabled),
    calendar_employee_notifications_enabled: Boolean(values.calendar_employee_notifications_enabled),
    calendar_installer_notifications_enabled: Boolean(values.calendar_installer_notifications_enabled),
  }).eq("singleton_key", true).select(settingsColumns).single();
  if (error) throw new Error(error.message);
  return data as CommunicationSettings;
}

export async function updateEmployeeCommunicationPreference(
  employeeId: string,
  values: Omit<EmployeeCommunicationPreference, "employee_id" | "employee_name" | "employee_email" | "employee_phone">,
) {
  const actor = await requireEmployee();
  if (actor.id !== employeeId && actor.role !== "administrator") {
    throw new Error("You can only change your own notification preferences.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("employee_communication_preferences").upsert({
    employee_id: employeeId,
    email_enabled: Boolean(values.email_enabled),
    sms_enabled: Boolean(values.sms_enabled),
    appointment_notifications: Boolean(values.appointment_notifications),
    task_notifications: Boolean(values.task_notifications),
    internal_message_notifications: Boolean(values.internal_message_notifications),
    job_notifications: Boolean(values.job_notifications),
  }, { onConflict: "employee_id" }).select(preferenceColumns).single();
  if (error) throw new Error(error.message);
  return data;
}
