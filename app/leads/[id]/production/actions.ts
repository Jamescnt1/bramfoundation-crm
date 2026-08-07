"use server";

import { revalidatePath } from "next/cache";
import type { CompletionCheckMethod, MaterialStatus } from "@/components/production/types";
import { requireEmployee, requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addMaterialScopeAction(values: {
  jobId: string;
  categoryId: string;
  description: string;
  completionCheckMethod?: CompletionCheckMethod;
  completionCheckNotes?: string;
}) {
  await requirePermission("pipeline.manage");
  const employee = await requireEmployee();
  if (values.completionCheckMethod === "not_required" && !values.completionCheckNotes?.trim()) {
    throw new Error("Enter why a completion check is not required.");
  }
  const admin = createAdminClient();
  const { data: category, error: categoryError } = await admin
    .from("material_categories")
    .select("name, ordering_required, installation_required, work_order_required")
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
    scope_kind: category.name === "Demo / Labor" ? "demo" : "material",
    job_walk_required: values.completionCheckMethod === "job_walk",
    completion_check_method: values.completionCheckMethod ?? "not_required",
    completion_check_status: values.completionCheckMethod === "not_required" ? "not_required" : "pending",
    completion_check_notes: values.completionCheckMethod === "not_required" ? values.completionCheckNotes?.trim() : null,
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

export async function linkMaterialScopeAppointmentAction(values: {
  jobId: string;
  scopeId: string;
  appointmentId: string;
}) {
  await requirePermission("pipeline.manage");
  const admin = createAdminClient();
  const [{ data: scope, error: scopeError }, { data: appointment, error: appointmentError }] = await Promise.all([
    admin.from("job_material_scopes").select("id").eq("id", values.scopeId).eq("job_id", values.jobId).single(),
    admin.from("appointments").select("id").eq("id", values.appointmentId).eq("job_id", values.jobId).eq("appointment_type", "installation").single(),
  ]);
  if (scopeError || !scope) throw new Error(scopeError?.message ?? "Material scope not found.");
  if (appointmentError || !appointment) throw new Error(appointmentError?.message ?? "Installation appointment not found.");
  const { error } = await admin.from("job_material_scope_appointments").upsert({
    material_scope_id: values.scopeId,
    appointment_id: values.appointmentId,
  });
  if (error) throw new Error(error.message);
  refresh(values.jobId);
}

export async function unlinkMaterialScopeAppointmentAction(values: {
  jobId: string;
  scopeId: string;
  appointmentId: string;
}) {
  await requirePermission("pipeline.manage");
  const admin = createAdminClient();
  const { data: scope, error: scopeError } = await admin
    .from("job_material_scopes")
    .select("id")
    .eq("id", values.scopeId)
    .eq("job_id", values.jobId)
    .single();
  if (scopeError || !scope) throw new Error(scopeError?.message ?? "Production scope not found.");
  const { error } = await admin
    .from("job_material_scope_appointments")
    .delete()
    .eq("material_scope_id", values.scopeId)
    .eq("appointment_id", values.appointmentId);
  if (error) throw new Error(error.message);
  refresh(values.jobId);
}

export async function updateProductionScopeAction(values: {
  jobId: string;
  scopeId: string;
  categoryId: string;
  description: string;
  completionCheckMethod: CompletionCheckMethod;
  completionCheckNotes?: string;
}) {
  await requirePermission("pipeline.manage");
  const employee = await requireEmployee();
  if (values.completionCheckMethod === "not_required" && !values.completionCheckNotes?.trim()) {
    throw new Error("Enter why a completion check is not required.");
  }
  const admin = createAdminClient();
  const { data: category, error: categoryError } = await admin
    .from("material_categories")
    .select("name, ordering_required, installation_required, work_order_required")
    .eq("id", values.categoryId).eq("active", true).single();
  if (categoryError) throw new Error(categoryError.message);
  const { data: currentScope, error: currentScopeError } = await admin.from("job_material_scopes")
    .select("completion_check_method").eq("id", values.scopeId).eq("job_id", values.jobId).single();
  if (currentScopeError || !currentScope) throw new Error(currentScopeError?.message ?? "Production scope not found.");
  const methodChanged = currentScope.completion_check_method !== values.completionCheckMethod;
  const completionUpdates = methodChanged ? {
    completion_check_status: values.completionCheckMethod === "not_required" ? "not_required" : "pending",
    completion_contact_name: null,
    completion_contact_method: null,
    completion_check_notes: values.completionCheckMethod === "not_required" ? values.completionCheckNotes?.trim() : null,
    completion_checked_at: null,
    completion_checked_by: null,
  } : values.completionCheckMethod === "not_required" ? {
    completion_check_notes: values.completionCheckNotes?.trim(),
  } : {};
  const { error } = await admin.from("job_material_scopes").update({
    material_category_id: values.categoryId,
    description: values.description.trim() || null,
    ordering_required: category.ordering_required,
    installation_required: category.installation_required,
    work_order_required: category.work_order_required,
    scope_kind: category.name === "Demo / Labor" ? "demo" : "material",
    job_walk_required: values.completionCheckMethod === "job_walk",
    completion_check_method: values.completionCheckMethod,
    ...completionUpdates,
    updated_by: employee.id,
  }).eq("id", values.scopeId).eq("job_id", values.jobId);
  if (error) throw new Error(error.message);

  const { data: links, error: linkError } = await admin
    .from("job_material_scope_appointments")
    .select("appointment_id")
    .eq("material_scope_id", values.scopeId);
  if (linkError) throw new Error(linkError.message);
  for (const link of links ?? []) {
    const { data: siblingLinks } = await admin
      .from("job_material_scope_appointments")
      .select(`scope:job_material_scopes!job_material_scope_appointments_material_scope_id_fkey (
        description, category:material_categories!job_material_scopes_material_category_id_fkey (name)
      )`).eq("appointment_id", link.appointment_id);
    const label = (siblingLinks ?? []).map((item) => {
      const scope = Array.isArray(item.scope) ? item.scope[0] : item.scope;
      const relatedCategory = scope && (Array.isArray(scope.category) ? scope.category[0] : scope.category);
      return scope?.description || relatedCategory?.name;
    }).filter(Boolean).join(", ");
    await admin.from("appointments").update({ installation_scope: label || null }).eq("id", link.appointment_id).eq("appointment_type", "installation");
  }
  refresh(values.jobId);
}

export async function deleteProductionScopeAction(jobId: string, scopeId: string) {
  await requirePermission("pipeline.manage");
  const { data, error } = await createAdminClient()
    .from("job_material_scopes")
    .delete().eq("id", scopeId).eq("job_id", jobId).select("id").single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Production scope not found.");
  refresh(jobId);
}

export async function recordCompletionCheckAction(values: {
  jobId: string;
  scopeId: string;
  contactName: string;
  contactMethod: "phone" | "email" | "text" | "in_person" | "other";
  outcome: "satisfied" | "issue";
  notes: string;
}) {
  await requirePermission("pipeline.manage");
  const employee = await requireEmployee();
  if (!values.contactName.trim()) throw new Error("Enter the person contacted.");
  const notes = values.notes.trim();
  if (values.outcome === "issue" && !notes) throw new Error("Describe the reported issue.");
  const admin = createAdminClient();
  const { data, error } = await admin.from("job_material_scopes").update({
    completion_check_method: "customer_checkin",
    completion_check_status: values.outcome === "issue" ? "issue" : "completed",
    completion_contact_name: values.contactName.trim(),
    completion_contact_method: values.contactMethod,
    completion_check_notes: notes || "Customer confirmed the completed work looks good.",
    completion_checked_at: new Date().toISOString(),
    completion_checked_by: employee.id,
    job_walk_required: false,
    updated_by: employee.id,
  }).eq("id", values.scopeId).eq("job_id", values.jobId).select("description").single();
  if (error || !data) throw new Error(error?.message ?? "Production scope not found.");
  const description = values.outcome === "issue"
    ? `Completion check recorded an issue${data.description ? ` for ${data.description}` : ""}: ${notes}`
    : `Customer check-in completed${data.description ? ` for ${data.description}` : ""} with ${values.contactName.trim()} by ${values.contactMethod.replace("_", " ")}.`;
  const { error: activityError } = await admin.from("job_activities").insert({
    job_id: values.jobId,
    activity_type: values.outcome === "issue" ? "production_issue" : "completion_check",
    description,
    new_value: values.outcome,
  });
  if (activityError) throw new Error(activityError.message);
  refresh(values.jobId);
}

export async function resetCompletionCheckAction(jobId: string, scopeId: string) {
  await requirePermission("pipeline.manage");
  const employee = await requireEmployee();
  const admin = createAdminClient();
  const { data: scope, error: scopeError } = await admin.from("job_material_scopes")
    .select("completion_check_method").eq("id", scopeId).eq("job_id", jobId).single();
  if (scopeError || !scope) throw new Error(scopeError?.message ?? "Production scope not found.");
  const { error } = await admin.from("job_material_scopes").update({
    completion_check_status: scope.completion_check_method === "not_required" ? "not_required" : "pending",
    completion_contact_name: null,
    completion_contact_method: null,
    completion_check_notes: null,
    completion_checked_at: null,
    completion_checked_by: null,
    updated_by: employee.id,
  }).eq("id", scopeId).eq("job_id", jobId);
  if (error) throw new Error(error.message);
  refresh(jobId);
}

function refresh(jobId: string) {
  revalidatePath(`/leads/${jobId}`);
  revalidatePath("/pipeline");
  revalidatePath("/my-dashboard");
}
