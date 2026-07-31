"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setInstallationWorkOrderSentAction(
  appointmentId: string,
  jobId: string,
  sent: boolean,
) {
  const employee = await requirePermission("calendar.manage");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .update({
      work_order_status: sent ? "sent" : "not_sent",
      work_order_sent_at: sent ? new Date().toISOString() : null,
      work_order_sent_by: sent ? employee.id : null,
    })
    .eq("id", appointmentId)
    .eq("job_id", jobId)
    .eq("appointment_type", "installation")
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("The installation work order could not be updated.");

  revalidatePath(`/leads/${jobId}`);
  revalidatePath("/calendar");
  revalidatePath("/company");
  revalidatePath("/my-dashboard");
}
