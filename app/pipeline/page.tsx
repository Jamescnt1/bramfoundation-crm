import Link from "next/link";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import { getJobs } from "@/lib/services/jobs";
import { hasPermission } from "@/lib/services/employees";
import { getPipelineStages } from "@/lib/services/pipeline-stages";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [{ jobs, errorMessage }, canChangeStatus, stages] = await Promise.all([
    loadPipelineJobs(),
    hasPermission("pipeline.manage"),
    getPipelineStages(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-full">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Sales Pipeline
            </h1>

            <p className="mt-2 text-gray-600">
              Move flooring opportunities from first contact through approval and completion.
            </p>
          </div>

          <Link
            href="/leads/new"
            className="inline-flex w-fit rounded-lg bg-black px-5 py-2.5 font-medium text-white transition hover:bg-gray-800"
          >
            + New Lead
          </Link>
        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load pipeline data: {errorMessage}
          </div>
        ) : (
          <PipelineBoard initialJobs={jobs} canChangeStatus={canChangeStatus} stages={stages} />
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
