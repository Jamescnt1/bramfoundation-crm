import PipelineStagesManager from "@/components/settings/PipelineStagesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { requirePermission } from "@/lib/services/employees";
import { getPipelineStages } from "@/lib/services/pipeline-stages";

export const dynamic = "force-dynamic";

export default async function PipelineSettingsPage() {
  await requirePermission("pipeline.settings.manage");
  const stages = await getPipelineStages({ includeArchived: true });

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader
          title="Pipeline"
          description="Configure the stages that move flooring opportunities from first contact through completion."
        />
        <PipelineStagesManager initialStages={stages} />
      </div>
    </main>
  );
}
