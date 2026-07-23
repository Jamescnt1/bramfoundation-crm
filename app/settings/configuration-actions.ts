"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/services/employees";
import {
  createConfigurationItem,
  removeInstallerCrew,
  removeLeadSource,
  removeTaskType,
  updateConfigurationItem,
} from "@/lib/services/configuration-admin";

type ConfigurationKind = "lead_sources" | "task_types" | "installer_crews";
type Item = { id: string; name: string; active: boolean; sort_order: number };

export async function createConfigurationItemAction(kind: ConfigurationKind, name: string) {
  await requireAdministrator();
  await createConfigurationItem(kind, name);
  revalidate(kind);
}

export async function updateConfigurationItemAction(kind: ConfigurationKind, item: Item) {
  await requireAdministrator();
  await updateConfigurationItem(kind, item.id, item);
  revalidate(kind);
}

export async function reorderConfigurationItemsAction(kind: ConfigurationKind, items: Item[]) {
  await requireAdministrator();
  await Promise.all(
    items.map((item, sort_order) =>
      updateConfigurationItem(kind, item.id, { ...item, sort_order }),
    ),
  );
  revalidate(kind);
}

export async function removeConfigurationItemAction(kind: ConfigurationKind, id: string) {
  await requireAdministrator();
  const result = kind === "lead_sources"
    ? await removeLeadSource(id)
    : kind === "task_types"
      ? await removeTaskType(id)
      : await removeInstallerCrew(id);
  revalidate(kind);
  return result;
}

function revalidate(kind: ConfigurationKind) {
  const path = kind === "lead_sources"
    ? "/settings/lead-sources"
    : kind === "task_types"
      ? "/settings/task-types"
      : "/settings/install-crews";
  revalidatePath(path);
  revalidatePath("/leads/new");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}
