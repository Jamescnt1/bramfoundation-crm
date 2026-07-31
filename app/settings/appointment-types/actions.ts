"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/services/employees";
import {
  createAppointmentType,
  removeAppointmentType,
  updateAppointmentType,
  type AppointmentTypeDefinition,
} from "@/lib/services/appointment-types";

type Item = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export async function createAppointmentTypeAction(name: string) {
  await requireAdministrator();
  await createAppointmentType(name);
  revalidateAppointmentTypes();
}

export async function updateAppointmentTypeAction(item: Item) {
  await requireAdministrator();
  await updateAppointmentType(item.id, item);
  revalidateAppointmentTypes();
}

export async function reorderAppointmentTypesAction(items: Item[]) {
  await requireAdministrator();
  await Promise.all(
    items.map((item, sort_order) =>
      updateAppointmentType(item.id, {
        name: item.name,
        active: item.active,
        sort_order,
      } satisfies Pick<
        AppointmentTypeDefinition,
        "name" | "active" | "sort_order"
      >),
    ),
  );
  revalidateAppointmentTypes();
}

export async function removeAppointmentTypeAction(id: string) {
  await requireAdministrator();
  const result = await removeAppointmentType(id);
  revalidateAppointmentTypes();
  return result;
}

function revalidateAppointmentTypes() {
  revalidatePath("/settings/appointment-types");
  revalidatePath("/settings/calendar");
  revalidatePath("/calendar");
  revalidatePath("/leads");
}
