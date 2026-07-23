import "server-only";

import { BETA_PERMANENT_DELETE_ENABLED } from "@/lib/features/beta-permanent-delete";
import { requireAdministrator } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

const ATTACHMENT_BUCKET = "job-attachments";

export async function deleteCustomerPermanently(customerId: string) {
  assertBetaDeleteEnabled();
  const actor = await requireAdministrator();
  const admin = createAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, full_name")
    .eq("id", customerId)
    .single();

  if (customerError) throw new Error(customerError.message);

  const { data, error } = await admin.rpc("beta_permanently_delete_customer", {
    target_customer_id: customerId,
  });
  if (error) throw new Error(friendlyDeleteError(error.message));

  const storagePaths = extractStoragePaths(data);
  const storageWarning = await removeStoredObjects(admin, storagePaths);

  await writeAudit(admin, actor.id, "customer.permanently_deleted_beta", "customer", customer.id, customer.full_name, {
    storage_object_count: storagePaths.length,
    storage_warning: storageWarning,
    temporary_beta_behavior: true,
  });

  return { storageWarning };
}

export async function deleteLeadPermanently(jobId: string) {
  assertBetaDeleteEnabled();
  const actor = await requireAdministrator();
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, customer_id, customer_name, qfloors_job_number")
    .eq("id", jobId)
    .single();

  if (jobError) throw new Error(jobError.message);

  const { data, error } = await admin.rpc("beta_permanently_delete_job", {
    target_job_id: jobId,
  });
  if (error) throw new Error(friendlyDeleteError(error.message));

  const storagePaths = extractStoragePaths(data);
  const storageWarning = await removeStoredObjects(admin, storagePaths);

  await writeAudit(admin, actor.id, "job.permanently_deleted_beta", "job", job.id, job.customer_name, {
    customer_id: job.customer_id,
    qfloors_job_number: job.qfloors_job_number,
    storage_object_count: storagePaths.length,
    storage_warning: storageWarning,
    temporary_beta_behavior: true,
  });

  return { storageWarning };
}

export async function deleteEmployeePermanently(employeeId: string) {
  assertBetaDeleteEnabled();
  const actor = await requireAdministrator();
  if (actor.id === employeeId) throw new Error("You cannot permanently delete your own administrator account.");

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, auth_user_id, name, email")
    .eq("id", employeeId)
    .single();
  if (employeeError) throw new Error(employeeError.message);

  const [{ count: sentMessages }, { count: createdConversations }] = await Promise.all([
    admin.from("messages").select("id", { count: "exact", head: true }).eq("sender_employee_id", employeeId),
    admin.from("conversations").select("id", { count: "exact", head: true }).eq("created_by_employee_id", employeeId),
  ]);

  if ((sentMessages ?? 0) > 0 || (createdConversations ?? 0) > 0) {
    throw new Error(
      "This employee has internal message history that must remain attributable. Delete the related test conversations first, or deactivate this employee instead.",
    );
  }

  const { error } = await admin.from("employees").delete().eq("id", employeeId);
  if (error) throw new Error(friendlyDeleteError(error.message));

  if (employee.auth_user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(employee.auth_user_id);
    if (authError) {
      throw new Error(`The employee record was deleted, but the login could not be removed: ${authError.message}`);
    }
  }

  await writeAudit(admin, actor.id, "employee.permanently_deleted_beta", "employee", employee.id, employee.name, {
    email: employee.email,
    login_deleted: Boolean(employee.auth_user_id),
    temporary_beta_behavior: true,
  });
}

function assertBetaDeleteEnabled() {
  if (!BETA_PERMANENT_DELETE_ENABLED) {
    throw new Error("Permanent deletion is disabled. Use the archive workflow instead.");
  }
}

function extractStoragePaths(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => row && typeof row === "object" && "storage_path" in row ? row.storage_path : null)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
}

async function removeStoredObjects(admin: ReturnType<typeof createAdminClient>, paths: string[]) {
  if (!paths.length) return null;
  const { error } = await admin.storage.from(ATTACHMENT_BUCKET).remove(paths);
  return error ? `Database cleanup completed, but ${paths.length} Storage object(s) need manual cleanup: ${error.message}` : null;
}

function friendlyDeleteError(message: string) {
  if (message.includes("foreign key") || message.includes("violates")) {
    return "This record cannot be deleted because related history still requires it. Remove the related test records first, then try again.";
  }
  return message;
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
