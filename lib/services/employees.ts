import { cache } from "react";
import { redirect } from "next/navigation";
import type { EmployeeRole, PermissionKey } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type Employee = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  role: EmployeeRole;
  active: boolean;
  avatar_url: string | null;
  color: string;
  job_title: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export const getCurrentEmployee = cache(async (): Promise<Employee | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id, auth_user_id, name, email, username, phone, role, active, avatar_url, color, job_title, bio, created_at, updated_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Employee | null;
});

export async function requireEmployee() {
  const employee = await getCurrentEmployee();
  if (!employee || !employee.active) redirect("/login");
  return employee;
}

export async function requireAdministrator() {
  const employee = await requireEmployee();
  if (employee.role !== "administrator") redirect("/my-dashboard");
  return employee;
}

export async function hasPermission(permission: PermissionKey) {
  const employee = await getCurrentEmployee();
  if (!employee || !employee.active) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_key", employee.role)
    .eq("permission_key", permission)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function requirePermission(permission: PermissionKey) {
  const employee = await requireEmployee();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_key", employee.role)
    .eq("permission_key", permission)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("You do not have permission to perform this action.");
  return employee;
}

export async function getActiveEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, auth_user_id, name, email, username, phone, role, active, avatar_url, color, job_title, bio, created_at, updated_at")
    .eq("active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}
