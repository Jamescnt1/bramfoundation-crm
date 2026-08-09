"use client";

import ConfigurableListManager from "@/components/settings/ConfigurableListManager";
import InstallerContactsManager from "@/components/settings/InstallerContactsManager";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import type { InstallerContact } from "@/lib/services/installer-contacts";
import {
  createConfigurationItemAction,
  removeConfigurationItemAction,
  reorderConfigurationItemsAction,
  updateConfigurationItemAction,
} from "@/app/settings/configuration-actions";

export default function InstallerCrewsManager({ initialCrews, initialContacts }: { initialCrews: InstallerCrew[]; initialContacts: InstallerContact[] }) {
  return (
    <>
      <ConfigurableListManager
        initialItems={initialCrews}
        itemLabel="Install Crew"
        usageDescription="Available when scheduling installation appointments."
        showColor
        onCreate={(name) => createConfigurationItemAction("installer_crews", name)}
        onUpdate={(item) => updateConfigurationItemAction("installer_crews", item)}
        onReorder={(items) => reorderConfigurationItemsAction("installer_crews", items)}
        onRemove={(id) => removeConfigurationItemAction("installer_crews", id)}
      />
      <InstallerContactsManager crews={initialCrews} initialContacts={initialContacts} />
    </>
  );
}
