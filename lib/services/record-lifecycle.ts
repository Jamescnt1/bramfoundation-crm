import "server-only";

import { requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export async function archiveCustomer(customerId: string) {
  const actor = await requirePermission("delete_customers");
  const admin = createAdminClient();

  const [{ data: customer, error: customerError }, { count, error: jobsError }] =
    await Promise.all([
      admin.from("customers").select("id, full_name, archived_at").eq("id", customerId).single(),
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    ]);

  if (customerError) throw new Error(customerError.message);
  if (jobsError) throw new Error(jobsError.message);
  if (customer.archived_at) throw new Error("This customer is already archived.");

  const { error } = await admin
    .from("customers")
    .update({ archived_at: new Date().toISOString(), archived_by: actor.id })
    .eq("id", customerId)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  await writeAudit(admin, actor.id, "customer.archived", "customer", customer.id, customer.full_name, {
    linked_job_count: count ?? 0,
  });

  return { linkedJobCount: count ?? 0 };
}

export async function archiveLead(jobId: string) {
  const actor = await requirePermission("delete_leads");
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, customer_id, customer_name, qfloors_job_number, archived_at")
    .eq("id", jobId)
    .single();

  if (jobError) throw new Error(jobError.message);
  if (job.archived_at) throw new Error("This lead is already archived.");

  const { error } = await admin
    .from("jobs")
    .update({ archived_at: new Date().toISOString(), archived_by: actor.id })
    .eq("id", jobId)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  const { error: activityError } = await admin.from("job_activities").insert({
    job_id: jobId,
    activity_type: "lead_archived",
    description: `Lead archived by ${actor.name}`,
    old_value: "active",
    new_value: "archived",
  });
  if (activityError) throw new Error(activityError.message);

  await writeAudit(admin, actor.id, "lead.archived", "job", job.id, job.customer_name, {
    customer_id: job.customer_id,
    qfloors_job_number: job.qfloors_job_number,
  });
}

export async function deactivateEmployee(employeeId: string) {
  const actor = await requirePermission("delete_employees");
  if (actor.id === employeeId) throw new Error("You cannot deactivate your own account.");

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, auth_user_id, name, email, active")
    .eq("id", employeeId)
    .single();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee.active) throw new Error("This employee is already inactive.");

  if (employee.auth_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(employee.auth_user_id, {
      ban_duration: "876000h",
    });
    if (authError) throw new Error(authError.message);
  }

  const { error } = await admin
    .from("employees")
    .update({
      active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: actor.id,
    })
    .eq("id", employeeId);
  if (error) throw new Error(error.message);

  await writeAudit(admin, actor.id, "employee.deactivated", "employee", employee.id, employee.name, {
    email: employee.email,
    login_disabled: Boolean(employee.auth_user_id),
  });
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  actorEmployeeId: string,
  action: string,
  entityType: string,
  entityId: string,
  entityLabel: string | null,
  details: Record<string, unknown>,
) {
  const { error } = await admin.from("admin_audit_log").insert({
    actor_employee_id: actorEmployeeId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_label: entityLabel,
    details,
  });
  if (error) throw new Error(error.message);
}
