"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

const reasons = new Set(["Customer reviewing", "Budgeting", "Builder timeline", "Project delayed", "Seasonal", "Other"]);

export async function placeJobOnHoldAction(values: { jobId: string; reason: string; holdUntil: string; note: string }) {
  const employee = await requirePermission("pipeline.manage");
  if (!values.jobId || !reasons.has(values.reason)) throw new Error("Choose a valid hold reason.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.holdUntil)) throw new Error("Choose a follow-up date.");
  const admin = createAdminClient();
  const { data: job, error: loadError } = await admin.from("jobs").select("id, customer_id, customer_name, assigned_employee_id, salesperson, on_hold").eq("id", values.jobId).is("archived_at", null).maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!job) throw new Error("Job not found.");

  const note = values.note.trim() || null;
  const { error } = await admin.from("jobs").update({ on_hold: true, hold_reason: values.reason, hold_until: values.holdUntil, hold_note: note, held_by: employee.id, held_at: new Date().toISOString() }).eq("id", values.jobId);
  if (error) throw new Error(error.message);

  const { error: activityError } = await admin.from("job_activities").insert({ job_id: values.jobId, activity_type: "job_on_hold", description: `Job placed on hold until ${values.holdUntil}: ${values.reason}${note ? ` — ${note}` : ""}`, old_value: job.on_hold ? "on_hold" : "active", new_value: "on_hold" });
  const { error: taskError } = await admin.from("job_tasks").insert({ job_id: values.jobId, customer_id: job.customer_id, title: `Follow up: ${job.customer_name}`, assigned_employee_id: job.assigned_employee_id, assigned_to: job.salesperson, due_at: `${values.holdUntil}T23:59:00Z`, priority: "normal", status: "open", completed: false });
  if (activityError || taskError) {
    await admin.from("jobs").update({ on_hold: false, hold_reason: null, hold_until: null, hold_note: null, held_by: null, held_at: null }).eq("id", values.jobId);
    throw new Error(activityError?.message ?? taskError?.message ?? "Unable to create the hold follow-up.");
  }
  refresh(values.jobId);
}

export async function releaseJobHoldAction(jobId: string) {
  const employee = await requirePermission("pipeline.manage");
  const admin = createAdminClient();
  const { data, error } = await admin.from("jobs").update({ on_hold: false, hold_reason: null, hold_until: null, hold_note: null, held_by: null, held_at: null }).eq("id", jobId).is("archived_at", null).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found.");
  await admin.from("job_activities").insert({ job_id: jobId, activity_type: "job_hold_released", description: `Job returned to the active pipeline by ${employee.name}`, old_value: "on_hold", new_value: "active" });
  refresh(jobId);
}

function refresh(jobId: string) {
  revalidatePath(`/leads/${jobId}`);
  revalidatePath("/pipeline");
  revalidatePath("/company");
  revalidatePath("/my-dashboard");
  revalidatePath("/tasks");
}
