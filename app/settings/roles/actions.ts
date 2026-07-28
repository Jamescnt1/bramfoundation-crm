"use server";

import { revalidatePath } from "next/cache";
import {
  createRoleDefinition,
  setRolePermissions,
  updateRoleDefinition,
} from "@/lib/services/roles-admin";

export async function createRoleAction(input: {
  key: string;
  name: string;
  description: string;
}) {
  const key = input.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const name = input.name.trim();
  if (!/^[a-z][a-z0-9_]{2,49}$/.test(key)) {
    throw new Error("Role key must use lowercase letters, numbers, and underscores.");
  }
  if (name.length < 2) throw new Error("Role name is required.");
  const role = await createRoleDefinition({
    key,
    name,
    description: input.description.trim() || null,
  });
  revalidatePath("/settings/roles");
  return role;
}

export async function updateRoleAction(input: {
  key: string;
  name: string;
  description: string;
  active: boolean;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Role name is required.");
  const updated = await updateRoleDefinition(input.key, {
    name,
    description: input.description.trim() || null,
    active: input.active,
  });
  revalidatePath("/settings/roles");
  revalidatePath("/settings/employees");
  return updated;
}

export async function updateRolePermissionsAction(
  roleKey: string,
  permissionKeys: string[],
) {
  if (!roleKey) throw new Error("Role is required.");
  await setRolePermissions(roleKey, [...new Set(permissionKeys)]);
  revalidatePath("/settings/roles");
}
