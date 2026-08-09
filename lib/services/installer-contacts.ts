import "server-only";

import { requireAdministrator } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export type InstallerPreferredChannel = "none" | "email" | "sms" | "both";

export type InstallerContact = {
  id: string;
  installer_crew_id: string;
  name: string;
  mobile_phone: string | null;
  email: string | null;
  preferred_channel: InstallerPreferredChannel;
  appointment_confirmations: boolean;
  appointment_reminders: boolean;
  schedule_changes: boolean;
  trial_recipient_verified: boolean;
  active: boolean;
};

export type InstallerContactValues = Omit<InstallerContact, "id">;

const columns = "id, installer_crew_id, name, mobile_phone, email, preferred_channel, appointment_confirmations, appointment_reminders, schedule_changes, trial_recipient_verified, active";

export async function getInstallerContacts(): Promise<InstallerContact[]> {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data, error } = await admin.from("installer_contacts").select(columns).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as InstallerContact[];
}

export async function createInstallerContact(values: InstallerContactValues) {
  await requireAdministrator();
  const admin = createAdminClient();
  const payload = validateInstallerContact(values);
  const { data, error } = await admin.from("installer_contacts").insert(payload).select(columns).single();
  if (error) throw new Error(friendlyContactError(error.message));
  return data as InstallerContact;
}

export async function updateInstallerContact(id: string, values: InstallerContactValues) {
  await requireAdministrator();
  const admin = createAdminClient();
  const payload = validateInstallerContact(values);
  const { data, error } = await admin.from("installer_contacts").update(payload).eq("id", id).select(columns).single();
  if (error) throw new Error(friendlyContactError(error.message));
  return data as InstallerContact;
}

export async function retireInstallerContact(id: string) {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data, error } = await admin.from("installer_contacts").update({ active: false }).eq("id", id).select(columns).single();
  if (error) throw new Error(error.message);
  return data as InstallerContact;
}

function validateInstallerContact(values: InstallerContactValues) {
  const name = values.name.trim();
  if (!name) throw new Error("Installer name is required.");
  const mobilePhone = normalizePhone(values.mobile_phone);
  const email = values.email?.trim().toLowerCase() || null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid installer email address.");
  if (!mobilePhone && !email) throw new Error("Add a mobile number, an email address, or both.");
  if ((values.preferred_channel === "sms" || values.preferred_channel === "both") && !mobilePhone) {
    throw new Error("Add a mobile number before choosing text messages.");
  }
  if ((values.preferred_channel === "email" || values.preferred_channel === "both") && !email) {
    throw new Error("Add an email address before choosing email notifications.");
  }
  if (values.trial_recipient_verified && !mobilePhone) {
    throw new Error("A Twilio trial recipient must have a mobile number.");
  }
  return {
    installer_crew_id: values.installer_crew_id,
    name,
    mobile_phone: mobilePhone,
    email,
    preferred_channel: values.preferred_channel,
    appointment_confirmations: Boolean(values.appointment_confirmations),
    appointment_reminders: Boolean(values.appointment_reminders),
    schedule_changes: Boolean(values.schedule_changes),
    trial_recipient_verified: Boolean(values.trial_recipient_verified),
    active: Boolean(values.active),
  };
}

function normalizePhone(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  throw new Error("Enter a valid mobile number, including area code.");
}

function friendlyContactError(message: string) {
  return message.includes("installer_contacts_crew_name_idx")
    ? "That installer is already listed for this crew."
    : message;
}
