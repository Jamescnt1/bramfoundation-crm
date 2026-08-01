"use server";

import { revalidatePath } from "next/cache";
import type { MaterialStatus } from "@/components/production/types";
import { requireEmployee, requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addMaterialScopeAction(values: {
  jobId: string;
  categoryId: string;
  description: string;
}) {
  await requirePermission("pipeline.manage");
  const employee = await requireEmployee();
  const admin = createAdminClient();
  const { data: category, error: categoryError } = await admin
    .from("material_categories")
    .select("ordering_required, installation_required, work_order_required")
    .eq("id", values.categoryId)
    .eq("active", true)
    .single();
  if (categoryError) throw new Error(categoryError.message);
  const { error } = await admin.from("job_material_scopes").insert({
    job_id: values.jobId,
    material_category_id: values.categoryId,
    description: values.description.trim() || null,
    ordering_required: category.ordering_required,
    installation_required: category.installation_required,
    work_order_required: category.work_order_required,
    created_by: employee.id,
    updated_by: employee.id,
  });
  if (error) throw new Error(error.message);
  refresh(values.jobId);
}

export async function updateMaterialScopeStatusAction(values: {
  jobId: string;
  scopeId: string;
  status: MaterialStatus;
  etaDate?: string | null;
  note?: string | null;
}) {
  await requirePermission("pipeline.manage");
  const employee = await requireEmployee();
  if (values.status === "ordered" && !values.etaDate) {
    throw new Error("Enter the material ETA or choose Ready if it has already arrived.");
  }
  const updates: Record<string, unknown> = {
    material_status: values.status,
    eta_date: values.etaDate || null,
    updated_by: employee.id,
    ordered_at: ["ordered", "partially_received", "ready"].includes(values.status) ? new Date().toISOString() : null,
    ready_at: values.status === "ready" ? new Date().toISOString() : null,
    issue_note: values.status === "issue" ? values.note?.trim() || "Needs attention" : null,
    excluded_reason: values.status === "excluded" ? values.note?.trim() || "Not required" : null,
  };
  const { data, error } = await createAdminClient()
    .from("job_material_scopes")
    .update(updates)
    .eq("id", values.scopeId)
    .eq("job_id", values.jobId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Material scope not found.");
  refresh(values.jobId);
}

function refresh(jobId: string) {
  revalidatePath(`/leads/${jobId}`);
  revalidatePath("/pipeline");
  revalidatePath("/my-dashboard");
}
