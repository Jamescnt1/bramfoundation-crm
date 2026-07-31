"use client";

import {
  createAppointmentTypeAction,
  removeAppointmentTypeAction,
  reorderAppointmentTypesAction,
  updateAppointmentTypeAction,
} from "@/app/settings/appointment-types/actions";
import ConfigurableListManager, {
  type ConfigurableItem,
} from "@/components/settings/ConfigurableListManager";
import type { AppointmentTypeDefinition } from "@/lib/services/appointment-types";

export default function AppointmentTypesManager({
  initialTypes,
}: {
  initialTypes: AppointmentTypeDefinition[];
}) {
  const items: ConfigurableItem[] = initialTypes.map((type) => ({
    id: type.key,
    name: type.name,
    active: type.active,
    sort_order: type.sort_order,
  }));

  return (
    <ConfigurableListManager
      initialItems={items}
      itemLabel="Appointment Type"
      usageDescription="Available in unified Schedule forms and calendar filters."
      onCreate={createAppointmentTypeAction}
      onUpdate={updateAppointmentTypeAction}
      onReorder={reorderAppointmentTypesAction}
      onRemove={removeAppointmentTypeAction}
      protectedIds={["appointment", "installation"]}
    />
  );
}
