import "server-only";

import type {
  MaterialCategory,
  MaterialScope,
  ProductionSummary,
} from "@/components/production/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getMaterialCategories(): Promise<MaterialCategory[]> {
  const { data, error } = await createAdminClient()
    .from("material_categories")
    .select("id, name, abbreviation, color_key, ordering_required, installation_required, work_order_required, active, sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as MaterialCategory[];
}

export async function getJobMaterialScopes(jobId: string): Promise<MaterialScope[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_material_scopes")
    .select(`id, job_id, material_category_id, description, ordering_required,
      installation_required, work_order_required, scope_kind, job_walk_required, material_status, eta_date,
      ordered_at, ready_at, issue_note, excluded_reason, sort_order,
      category:material_categories!job_material_scopes_material_category_id_fkey (
        id, name, abbreviation, color_key, ordering_required,
        installation_required, work_order_required, active, sort_order
      )`)
    .eq("job_id", jobId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);

  const scopes = (data ?? []).map((scope) => ({
    ...scope,
    category: Array.isArray(scope.category) ? scope.category[0] : scope.category,
    appointments: [],
  })) as MaterialScope[];
  if (!scopes.length) return scopes;

  const { data: links, error: linkError } = await admin
    .from("job_material_scope_appointments")
    .select(`material_scope_id, appointment:appointments!job_material_scope_appointments_appointment_id_fkey (
      id, appointment_type, starts_at, ends_at, status, installation_scope, work_order_status,
      installer:installer_crews!appointments_installer_crew_id_fkey (name)
    )`)
    .in("material_scope_id", scopes.map((scope) => scope.id));
  if (linkError) throw new Error(linkError.message);

  const byScope = new Map<string, MaterialScope["appointments"]>();
  for (const link of links ?? []) {
    const raw = Array.isArray(link.appointment) ? link.appointment[0] : link.appointment;
    if (!raw) continue;
    const installer = Array.isArray(raw.installer) ? raw.installer[0] : raw.installer;
    const appointment = {
      id: raw.id,
      appointment_type: raw.appointment_type,
      starts_at: raw.starts_at,
      ends_at: raw.ends_at,
      status: raw.status,
      installation_scope: raw.installation_scope,
      work_order_status: raw.work_order_status,
      installer_name: installer?.name ?? null,
    } as MaterialScope["appointments"][number];
    byScope.set(link.material_scope_id, [...(byScope.get(link.material_scope_id) ?? []), appointment]);
  }
  return scopes.map((scope) => ({ ...scope, appointments: byScope.get(scope.id) ?? [] }));
}

export function summarizeProduction(jobId: string, scopes: MaterialScope[]): ProductionSummary {
  let totalSteps = 0;
  let completedSteps = 0;
  let materialsOrdered = 0;
  let materialsReady = 0;
  let materialsTotal = 0;
  let installationsRequired = 0;
  let installationsScheduled = 0;
  let workOrdersRequired = 0;
  let workOrdersSent = 0;
  let jobWalksRequired = 0;
  let jobWalksScheduled = 0;
  let jobWalksCompleted = 0;
  let needsAttention = false;

  for (const scope of scopes) {
    const excluded = scope.material_status === "excluded";
    const ordered = excluded || !scope.ordering_required || ["ordered", "partially_received", "ready"].includes(scope.material_status);
    const ready = excluded || scope.material_status === "ready";
    const installAppointments = scope.appointments.filter((item) => item.appointment_type === "installation" && item.status !== "cancelled");
    const jobWalkAppointments = scope.appointments.filter((item) => item.appointment_type === "job_walk" && item.status !== "cancelled");
    const scheduled = excluded || !scope.installation_required || installAppointments.length > 0;
    const sent = excluded || !scope.work_order_required || (
      installAppointments.length > 0 && installAppointments.every((item) => ["sent", "acknowledged"].includes(item.work_order_status))
    );
    const jobWalkScheduled = excluded || !scope.job_walk_required || jobWalkAppointments.length > 0;
    const jobWalkComplete = excluded || !scope.job_walk_required || jobWalkAppointments.some((item) => item.status === "completed");
    if (scope.ordering_required) {
      materialsTotal += 1;
      totalSteps += 2;
      completedSteps += Number(ordered) + Number(ready);
      if (ordered) materialsOrdered += 1;
      if (ready) materialsReady += 1;
    }
    if (scope.installation_required) { installationsRequired += 1; totalSteps += 1; completedSteps += Number(scheduled); }
    if (scheduled) installationsScheduled += Number(scope.installation_required);
    if (scope.work_order_required) { workOrdersRequired += 1; totalSteps += 1; completedSteps += Number(sent); }
    if (sent) workOrdersSent += Number(scope.work_order_required);
    if (scope.job_walk_required) { jobWalksRequired += 1; totalSteps += 1; completedSteps += Number(jobWalkComplete); }
    if (jobWalkScheduled) jobWalksScheduled += Number(scope.job_walk_required);
    if (jobWalkComplete) jobWalksCompleted += Number(scope.job_walk_required);
    needsAttention ||= scope.material_status === "issue" || Boolean(
      scope.eta_date && scope.appointments.some((item) => item.starts_at.slice(0, 10) < scope.eta_date!),
    );
  }
  return {
    job_id: jobId,
    total_steps: totalSteps,
    completed_steps: completedSteps,
    materials_total: materialsTotal,
    materials_ordered: materialsOrdered,
    materials_ready: materialsReady,
    installations_required: installationsRequired,
    installations_scheduled: installationsScheduled,
    work_orders_required: workOrdersRequired,
    work_orders_sent: workOrdersSent,
    job_walks_required: jobWalksRequired,
    job_walks_scheduled: jobWalksScheduled,
    job_walks_completed: jobWalksCompleted,
    needs_attention: needsAttention,
  };
}

export async function getProductionSummaries(jobIds: string[]): Promise<Record<string, ProductionSummary>> {
  const entries = await Promise.all(jobIds.map(async (jobId) => {
    const scopes = await getJobMaterialScopes(jobId);
    return [jobId, summarizeProduction(jobId, scopes)] as const;
  }));
  return Object.fromEntries(entries);
}
