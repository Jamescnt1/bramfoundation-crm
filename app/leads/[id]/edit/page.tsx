import Link from "next/link";
import { notFound } from "next/navigation";
import EditLeadForm from "@/components/EditLeadForm";
import {
  getJobById,
  type Job,
} from "@/lib/services/jobs";
import { formatJobDisplayName } from "@/lib/job-display";
import { hasPermission } from "@/lib/services/employees";
import { getPipelineStages, type PipelineStageConfig } from "@/lib/services/pipeline-stages";

type EditLeadPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: EditLeadPageProps) {
  const { id } = await params;

  let job: Job | null = null;
  let errorMessage = "";
  let canArchiveLead = false;
  let stages: PipelineStageConfig[] = [];

  try {
    [job, canArchiveLead, stages] = await Promise.all([
      getJobById(id),
      hasPermission("delete_leads"),
      getPipelineStages(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/leads/${id}`}
            className="text-sm font-medium text-gray-600 hover:text-black"
          >
            ← Back to lead
          </Link>

          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            Unable to load this lead: {errorMessage}
          </div>
        </div>
      </main>
    );
  }

  if (!job) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/leads/${job.id}`}
          className="text-sm font-medium text-gray-600 hover:text-black"
        >
          ← Back to lead
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold">
            Edit {formatJobDisplayName({
              customerName: job.customer?.full_name,
              jobName: job.customer_name,
              qfNumber: job.qfloors_job_number,
            })}
          </h1>

          <p className="mt-2 text-gray-600">
            Update the sales status and next action.
          </p>
        </header>

        <section className="mt-8 rounded-xl bg-white p-6 shadow-sm md:p-8">
          <EditLeadForm job={job} canArchive={canArchiveLead} stages={stages} />
        </section>
      </div>
    </main>
  );
}
