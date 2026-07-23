import "server-only";

import type { EmployeeRole } from "@/lib/auth/roles";
import type { Employee } from "@/lib/services/employees";
import { requireAdministrator } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmployeeAdminValues = {
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  role: EmployeeRole;
  active: boolean;
  job_title: string | null;
  bio: string | null;
  color: string;
};

const employeeColumns =
  "id, auth_user_id, name, email, username, phone, role, active, avatar_url, color, job_title, bio, created_at, updated_at";

export type EmployeeAdminErrorCode =
  | "duplicate_email"
  | "duplicate_username"
  | "invalid_password"
  | "configuration_error"
  | "profile_write_failed"
  | "rollback_failed"
  | "auth_create_failed";

export class EmployeeAdminError extends Error {
  constructor(
    public readonly code: EmployeeAdminErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmployeeAdminError";
  }
}

export async function getManagedEmployees(): Promise<Employee[]> {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employees")
    .select(employeeColumns)
    .order("active", { ascending: false })
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}

export async function createManagedEmployee(
  values: EmployeeAdminValues,
  temporaryPassword: string,
) {
  await requireAdministrator();
  const admin = createAdminClient();
  await assertEmployeeIdentityAvailable(admin, values.email, values.username);

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: values.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: values.name,
      must_change_password: true,
    },
  });

  if (userError) throw mapAuthCreateError(userError);

  const { data, error } = await admin
    .from("employees")
    .update({
      auth_user_id: userData.user.id,
      name: values.name,
      email: values.email,
      username: values.username,
      phone: values.phone,
      role: values.role,
      active: values.active,
      job_title: values.job_title,
      bio: values.bio,
      color: values.color,
    })
    .eq("auth_user_id", userData.user.id)
    .select(employeeColumns)
    .maybeSingle();

  if (error || !data) {
    await rollbackNewEmployee(admin, userData.user.id);
    throw mapProfileWriteError(error);
  }

  if (!values.active) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      userData.user.id,
      { ban_duration: "876000h" },
    );
    if (banError) {
      await rollbackNewEmployee(admin, userData.user.id, data.id);
      throw new EmployeeAdminError(
        "auth_create_failed",
        "The employee login could not be disabled during setup.",
        { cause: banError },
      );
    }
  }

  return data as Employee;
}

async function assertEmployeeIdentityAvailable(
  admin: SupabaseClient,
  email: string,
  username: string | null,
) {
  const emailQuery = admin
    .from("employees")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  const usernameQuery = username
    ? admin
        .from("employees")
        .select("id")
        .ilike("username", username)
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [emailResult, usernameResult] = await Promise.all([
    emailQuery,
    usernameQuery,
  ]);

  if (emailResult.error) throw mapProfileWriteError(emailResult.error);
  if (usernameResult.error) throw mapProfileWriteError(usernameResult.error);
  if (emailResult.data) {
    throw new EmployeeAdminError(
      "duplicate_email",
      "An employee already uses this login email.",
    );
  }
  if (usernameResult.data) {
    throw new EmployeeAdminError(
      "duplicate_username",
      "An employee already uses this username.",
    );
  }
}

async function rollbackNewEmployee(
  admin: SupabaseClient,
  authUserId: string,
  employeeId?: string,
) {
  const profileResult = employeeId
    ? await admin.from("employees").delete().eq("id", employeeId)
    : await admin.from("employees").delete().eq("auth_user_id", authUserId);
  const authResult = await admin.auth.admin.deleteUser(authUserId);

  if (profileResult.error || authResult.error) {
    throw new EmployeeAdminError(
      "rollback_failed",
      "Employee setup was incomplete and automatic cleanup needs administrator attention.",
      { cause: profileResult.error ?? authResult.error },
    );
  }
}

function mapAuthCreateError(error: {
  code?: string;
  message: string;
  status?: number;
}) {
  const normalized = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (
    normalized.includes("already") ||
    normalized.includes("exists") ||
    normalized.includes("registered")
  ) {
    return new EmployeeAdminError(
      "duplicate_email",
      "A login account already uses this email. No duplicate employee was created.",
      { cause: error },
    );
  }
  if (
    normalized.includes("password") &&
    (normalized.includes("weak") || error.status === 422)
  ) {
    return new EmployeeAdminError(
      "invalid_password",
      "The temporary password does not meet the login security requirements.",
      { cause: error },
    );
  }
  if (
    normalized.includes("invalid jwt") ||
    normalized.includes("api key") ||
    error.status === 401
  ) {
    return new EmployeeAdminError(
      "configuration_error",
      "Employee login creation is not configured correctly on this server.",
      { cause: error },
    );
  }
  return new EmployeeAdminError(
    "auth_create_failed",
    "The employee login could not be created.",
    { cause: error },
  );
}

function mapProfileWriteError(
  error:
    | {
        code?: string;
        details?: string;
        message: string;
      }
    | null,
) {
  const normalized =
    `${error?.code ?? ""} ${error?.details ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (normalized.includes("username")) {
    return new EmployeeAdminError(
      "duplicate_username",
      "An employee already uses this username.",
      { cause: error },
    );
  }
  if (normalized.includes("email") || error?.code === "23505") {
    return new EmployeeAdminError(
      "duplicate_email",
      "An employee already uses this login email.",
      { cause: error },
    );
  }
  return new EmployeeAdminError(
    "profile_write_failed",
    "The login was created, but the employee profile could not be saved. The login was removed automatically.",
    { cause: error },
  );
}

export async function updateManagedEmployee(
  employeeId: string,
  values: EmployeeAdminValues,
) {
  const administrator = await requireAdministrator();
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("employees")
    .select("auth_user_id, role, active")
    .eq("id", employeeId)
    .single();

  if (existingError) throw new Error(existingError.message);
  if (administrator.id === employeeId && (!values.active || values.role !== "administrator")) {
    throw new Error("You cannot deactivate or remove your own Administrator role.");
  }

  if (existing.auth_user_id) {
    const { data: authUserData, error: getAuthUserError } =
      await admin.auth.admin.getUserById(existing.auth_user_id);
    if (getAuthUserError) throw new Error(getAuthUserError.message);

    const { error: authError } = await admin.auth.admin.updateUserById(
      existing.auth_user_id,
      {
        email: values.email,
        ban_duration: values.active ? "none" : "876000h",
        user_metadata: {
          ...authUserData.user.user_metadata,
          full_name: values.name,
        },
      },
    );
    if (authError) throw new Error(authError.message);
  }

  const { data, error } = await admin
    .from("employees")
    .update(values)
    .eq("id", employeeId)
    .select(employeeColumns)
    .single();

  if (error) throw new Error(error.message);
  return data as Employee;
}

export async function resetManagedEmployeePassword(
  employeeId: string,
  temporaryPassword: string,
) {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data: employee, error } = await admin
    .from("employees")
    .select("auth_user_id")
    .eq("id", employeeId)
    .single();

  if (error) throw new Error(error.message);
  if (!employee.auth_user_id) throw new Error("This employee does not have a login account.");

  const { data: userData, error: getUserError } =
    await admin.auth.admin.getUserById(employee.auth_user_id);
  if (getUserError) throw new Error(getUserError.message);

  const { error: updateError } = await admin.auth.admin.updateUserById(
    employee.auth_user_id,
    {
      password: temporaryPassword,
      user_metadata: {
        ...userData.user.user_metadata,
        must_change_password: true,
      },
    },
  );

  if (updateError) throw new Error(updateError.message);
}
