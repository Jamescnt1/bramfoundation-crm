"use client";

import ConfigurableListManager from "@/components/settings/ConfigurableListManager";
import type { TaskType } from "@/components/tasks/types";
import {
  createConfigurationItemAction,
  removeConfigurationItemAction,
  reorderConfigurationItemsAction,
  updateConfigurationItemAction,
} from "@/app/settings/configuration-actions";

export default function TaskTypesManager({
  initialTypes,
}: {
  initialTypes: TaskType[];
}) {
  return (
    <ConfigurableListManager
      initialItems={initialTypes}
      itemLabel="Task Type"
      usageDescription="Available in task create and edit forms."
      onCreate={(name) => createConfigurationItemAction("task_types", name)}
      onUpdate={(item) => updateConfigurationItemAction("task_types", item)}
      onReorder={(items) => reorderConfigurationItemsAction("task_types", items)}
      onRemove={(id) => removeConfigurationItemAction("task_types", id)}
    />
  );
}
