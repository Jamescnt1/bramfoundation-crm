"use client";

import ConfigurableListManager from "@/components/settings/ConfigurableListManager";
import {
  createConfigurationItemAction,
  removeConfigurationItemAction,
  reorderConfigurationItemsAction,
  updateConfigurationItemAction,
} from "@/app/settings/configuration-actions";
import type { LeadSource } from "@/lib/services/lead-sources";

export default function LeadSourcesManager({
  initialSources,
}: {
  initialSources: LeadSource[];
}) {
  return (
    <ConfigurableListManager
      initialItems={initialSources}
      itemLabel="Lead Source"
      usageDescription="Available when new leads and jobs are created."
      onCreate={(name) => createConfigurationItemAction("lead_sources", name)}
      onUpdate={(item) => updateConfigurationItemAction("lead_sources", item)}
      onReorder={(items) => reorderConfigurationItemsAction("lead_sources", items)}
      onRemove={(id) => removeConfigurationItemAction("lead_sources", id)}
    />
  );
}
