import Link from "next/link";
import {
  getActiveSalesQueue,
  type ActiveSalesQueueJob,
} from "@/lib/services/jobs";
import {
  PIPELINE_COLOR_STYLES,
} from "@/components/pipeline/constants";
import { formatJobDisplayName } from "@/lib/job-display";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  let jobs: ActiveSalesQueueJob[] = [];
  let errorMessage = "";

  try {
    jobs = await getActiveSalesQueue();
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
  }

  const queueCounts = jobs.reduce<Record<string, number>>((counts, job) => ({ ...counts, [job.pipeline_stage]: (counts[job.pipeline_stage] ?? 0) + 1 }), {});

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-black"
            >
              ← Dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Active Sales Queue
            </h1>

            <p className="mt-2 text-gray-600">
              New leads and floor measures requiring immediate attention.
            </p>
          </div>

          <Link
            href="/leads/new"
            className="inline-flex w-fit rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800"
          >
            + New Lead
          </Link>
        </header>

        {!errorMessage && (
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <QueueMetric
              label="Active queue stages"
              value={Object.keys(queueCounts).length}
              description="Configured for immediate attention"
            />
            <QueueMetric
              label="Total Requiring Action"
              value={jobs.length}
              description="Active sales workload"
            />
          </section>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load the sales queue: {errorMessage}
          </div>
        )}

        {!errorMessage && (
          <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {jobs.length === 0 ? (
              <div className="p-8">
                <p className="font-medium text-gray-900">
                  The active sales queue is clear.
                </p>
                <p className="mt-2 text-gray-500">
                  New leads and floor measures will appear here until they
                  reach Estimate Sent.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="border-b border-gray-200 bg-gray-50 text-sm text-gray-600">
                    <tr>
                      <th className="px-5 py-4 font-medium">Priority</th>
                      <th className="px-5 py-4 font-medium">Customer / Job</th>
                      <th className="px-5 py-4 font-medium">Stage</th>
                      <th className="px-5 py-4 font-medium">Salesperson</th>
                      <th className="px-5 py-4 font-medium">Next Action</th>
                      <th className="px-5 py-4 font-medium">Due</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <UrgencyBadge urgency={job.urgency} />
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/leads/${job.id}`}
                            className="font-medium text-gray-900 hover:underline"
                          >
                            {formatJobDisplayName({
                              customerName: job.customer?.full_name,
                              jobName: job.customer_name,
                              qfNumber: job.qfloors_job_number,
                            })}
                          </Link>
                          <p className="mt-1 text-sm text-gray-500">
                            {job.address ??
                              job.phone ??
                              job.email ??
                              "No project details"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <StageBadge stage={job.pipeline_stage} colorKey={job.pipeline_color_key} />
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          {job.salesperson ?? "Unassigned"}
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          {job.next_action ?? "No next action"}
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          {formatDate(job.next_action_due)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function QueueMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}

function StageBadge({ stage, colorKey }: { stage: string; colorKey: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${(PIPELINE_COLOR_STYLES[colorKey] ?? PIPELINE_COLOR_STYLES.gray).badge}`}
    >
      {stage}
    </span>
  );
}

function UrgencyBadge({
  urgency,
}: {
  urgency: ActiveSalesQueueJob["urgency"];
}) {
  const styles = {
    overdue: "bg-red-50 text-red-700",
    today: "bg-orange-50 text-orange-700",
    new_lead: "bg-blue-50 text-blue-700",
    future_measure: "bg-gray-100 text-gray-700",
  };
  const labels = {
    overdue: "Overdue",
    today: "Today",
    new_lead: "New Lead",
    future_measure: "Upcoming",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[urgency]}`}
    >
      {labels[urgency]}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString();
}
