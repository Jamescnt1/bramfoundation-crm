"use client";

import ConfigurableListManager from "@/components/settings/ConfigurableListManager";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import {
  createConfigurationItemAction,
  removeConfigurationItemAction,
  reorderConfigurationItemsAction,
  updateConfigurationItemAction,
} from "@/app/settings/configuration-actions";

export default function InstallerCrewsManager({ initialCrews }: { initialCrews: InstallerCrew[] }) {
  return (
    <ConfigurableListManager
      initialItems={initialCrews}
      itemLabel="Install Crew"
      usageDescription="Available when scheduling installation appointments."
      onCreate={(name) => createConfigurationItemAction("installer_crews", name)}
      onUpdate={(item) => updateConfigurationItemAction("installer_crews", item)}
      onReorder={(items) => reorderConfigurationItemsAction("installer_crews", items)}
      onRemove={(id) => removeConfigurationItemAction("installer_crews", id)}
    />
  );
}
