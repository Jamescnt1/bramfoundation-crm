import PipelineBoard from "@/components/pipeline/PipelineBoard";
import { getJobs } from "@/lib/services/jobs";
import { getActiveEmployees, hasPermission, requireEmployee } from "@/lib/services/employees";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import { getInstallationJobIds, getWorkOrderReadyJobIds } from "@/lib/services/appointments";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [{ jobs, errorMessage }, canChangeStatus, stages, installationJobIds, workOrderReadyJobIds, employees, currentEmployee] = await Promise.all([
    loadPipelineJobs(),
    hasPermission("pipeline.manage"),
    getPipelineStages(),
    getInstallationJobIds(),
    getWorkOrderReadyJobIds(),
    getActiveEmployees(),
    requireEmployee(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-full">
        <header>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Sales Pipeline
            </h1>

            <p className="mt-2 text-gray-600">
              Move flooring opportunities from first contact through approval and completion.
            </p>
          </div>

        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load pipeline data: {errorMessage}
          </div>
        ) : (
          <PipelineBoard
            initialJobs={jobs}
            canChangeStatus={canChangeStatus}
            stages={stages}
            installationJobIds={installationJobIds}
            workOrderReadyJobIds={workOrderReadyJobIds}
            employees={employees.map(({ id, name, color }) => ({ id, name, color }))}
            initialCardSize={currentEmployee.pipeline_card_size}
          />
        )}
      </div>
    </main>
  );
}

async function loadPipelineJobs() {
  try {
    return {
      jobs: await getJobs(),
      errorMessage: "",
    };
  } catch (error) {
    return {
      jobs: [],
      errorMessage:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
    };
  }
}
