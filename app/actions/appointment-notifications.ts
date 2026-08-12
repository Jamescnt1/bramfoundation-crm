"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentNotificationAudience, AppointmentNotificationChannel, AppointmentNotificationKind } from "@/components/calendar/communication-types";
import { sendAppointmentNotification } from "@/lib/services/appointment-notifications";

export async function sendAppointmentNotificationAction(input: { appointmentId: string; audience: AppointmentNotificationAudience; channel: AppointmentNotificationChannel; kind: AppointmentNotificationKind }) {
  try {
    const result = await sendAppointmentNotification(input);
    revalidatePath("/calendar");
    return { ok: true as const, result };
  } catch (caught) {
    return { ok: false as const, error: caught instanceof Error ? caught.message : "Unable to send the appointment notification." };
  }
}
