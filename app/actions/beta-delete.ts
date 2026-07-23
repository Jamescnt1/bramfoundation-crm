"use server";

import { revalidatePath } from "next/cache";
import { BETA_PERMANENT_DELETE_ENABLED } from "@/lib/features/beta-permanent-delete";
import { requireAdministrator } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

// TODO(BETA): Remove these actions and restore archive/deactivate behavior after cleanup.
export async function deleteTaskPermanentlyAction(taskId: string) {
  await requireBetaAdministrator();
  const admin = createAdminClient();
  const { error } = await admin.from("job_tasks").delete().eq("id", taskId);
  if (error) throw new Error(friendlyError(error.message));
  revalidatePath("/tasks");
  revalidatePath("/my-dashboard");
}

export async function deleteAppointmentPermanentlyAction(appointmentId: string) {
  await requireBetaAdministrator();
  const admin = createAdminClient();
  const { error } = await admin.from("appointments").delete().eq("id", appointmentId);
  if (error) throw new Error(friendlyError(error.message));
  revalidatePath("/calendar");
  revalidatePath("/my-dashboard");
}

async function requireBetaAdministrator() {
  if (!BETA_PERMANENT_DELETE_ENABLED) {
    throw new Error("Permanent deletion is disabled. Use the archive workflow instead.");
  }
  return requireAdministrator();
}

function friendlyError(message: string) {
  return message.includes("foreign key") || message.includes("violates")
    ? "This record cannot be deleted because another record still depends on it. Remove the related test record first."
    : message;
}

