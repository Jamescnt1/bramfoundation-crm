"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/services/employees";
import {
  createInstallerContact,
  retireInstallerContact,
  updateInstallerContact,
  type InstallerContactValues,
} from "@/lib/services/installer-contacts";

export async function createInstallerContactAction(values: InstallerContactValues) {
  await requireAdministrator();
  const contact = await createInstallerContact(values);
  revalidate();
  return contact;
}

export async function updateInstallerContactAction(id: string, values: InstallerContactValues) {
  await requireAdministrator();
  const contact = await updateInstallerContact(id, values);
  revalidate();
  return contact;
}

export async function retireInstallerContactAction(id: string) {
  await requireAdministrator();
  const contact = await retireInstallerContact(id);
  revalidate();
  return contact;
}

function revalidate() {
  revalidatePath("/settings/install-crews");
  revalidatePath("/settings/notifications");
  revalidatePath("/calendar");
}
