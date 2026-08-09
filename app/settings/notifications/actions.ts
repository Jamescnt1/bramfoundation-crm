"use server";

import { revalidatePath } from "next/cache";
import {
  updateCommunicationSettings,
  updateEmployeeCommunicationPreference,
  type CommunicationSettings,
  type EmployeeCommunicationPreference,
} from "@/lib/services/communication-settings";
import { sendInstallerTrialSms } from "@/lib/services/sms-delivery";

export async function updateCommunicationSettingsAction(values: Omit<CommunicationSettings, "id">) {
  const settings = await updateCommunicationSettings(values);
  revalidatePath("/settings/notifications");
  return settings;
}

export async function sendInstallerTrialSmsAction(installerContactId: string, consentConfirmed: boolean) {
  const result = await sendInstallerTrialSms(installerContactId, consentConfirmed);
  revalidatePath("/settings/notifications");
  return result;
}

export async function updateEmployeeCommunicationPreferenceAction(
  employeeId: string,
  values: Omit<EmployeeCommunicationPreference, "employee_id" | "employee_name" | "employee_email" | "employee_phone">,
) {
  const preference = await updateEmployeeCommunicationPreference(employeeId, values);
  revalidatePath("/settings/notifications");
  return preference;
}
