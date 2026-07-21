import "server-only";

import type { EmployeeRole } from "@/lib/auth/roles";
import type { Employee } from "@/lib/services/employees";
import { requireAdministrator } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: values.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: values.name,
      must_change_password: true,
    },
  });

  if (userError) throw new Error(userError.message);

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
    .single();

  if (error) {
    await admin.auth.admin.deleteUser(userData.user.id);
    throw new Error(error.message);
  }

  if (!values.active) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      userData.user.id,
      { ban_duration: "876000h" },
    );
    if (banError) throw new Error(banError.message);
  }

  return data as Employee;
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
