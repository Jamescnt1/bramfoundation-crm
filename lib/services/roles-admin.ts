import "server-only";

import { requireAdministrator } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export type PermissionDefinition = {
  key: string;
  name: string;
  description: string | null;
  category: string;
};

export type RoleDefinition = {
  key: string;
  name: string;
  description: string | null;
  system: boolean;
  active: boolean;
  permissions: string[];
};

export async function getRolesAndPermissions() {
  await requireAdministrator();
  const admin = createAdminClient();
  const [rolesResult, permissionsResult, grantsResult] = await Promise.all([
    admin.from("role_definitions").select("key, name, description, system, active").order("name"),
    admin.from("permission_definitions").select("key, name, description, category").order("category").order("name"),
    admin.from("role_permissions").select("role_key, permission_key"),
  ]);

  const error = rolesResult.error ?? permissionsResult.error ?? grantsResult.error;
  if (error) throw new Error(error.message);

  const grants = grantsResult.data ?? [];
  const roles = (rolesResult.data ?? []).map((role) => ({
    ...role,
    permissions: grants
      .filter((grant) => grant.role_key === role.key)
      .map((grant) => grant.permission_key),
  })) as RoleDefinition[];

  return {
    roles,
    permissions: (permissionsResult.data ?? []) as PermissionDefinition[],
  };
}

export async function createRoleDefinition(values: {
  key: string;
  name: string;
  description: string | null;
}) {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_definitions")
    .insert({ ...values, system: false, active: true })
    .select("key, name, description, system, active")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, permissions: [] } as RoleDefinition;
}

export async function setRolePermissions(roleKey: string, permissionKeys: string[]) {
  await requireAdministrator();
  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("role_permissions")
    .delete()
    .eq("role_key", roleKey);
  if (deleteError) throw new Error(deleteError.message);

  if (permissionKeys.length) {
    const { error } = await admin.from("role_permissions").insert(
      permissionKeys.map((permissionKey) => ({
        role_key: roleKey,
        permission_key: permissionKey,
      })),
    );
    if (error) throw new Error(error.message);
  }
}
