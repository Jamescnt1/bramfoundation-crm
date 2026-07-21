import Link from "next/link";
import { isQfNumberRequired } from "@/components/pipeline/constants";
import type { Job } from "@/lib/services/jobs";

type CustomerJobCardProps = {
  job: Job;
};

export default function CustomerJobCard({
  job,
}: CustomerJobCardProps) {
  return (
    <Link
      href={`/leads/${job.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {job.customer_name}
            </h3>

            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {job.status}
            </span>
          </div>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-medium text-gray-500">
                QF#
              </dt>

              <dd className={`mt-1 ${isQfNumberRequired(job.status) && !job.qfloors_job_number?.trim() ? "font-semibold text-red-700" : "text-gray-900"}`}>
                {job.qfloors_job_number ?? (isQfNumberRequired(job.status) ? "Required" : "Not assigned")}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-gray-500">
                Lead Source
              </dt>

              <dd className="mt-1 text-gray-900">
                {job.lead_source ?? "Not provided"}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-gray-500">
                Project Address
              </dt>

              <dd className="mt-1 text-gray-900">
                {job.address ?? "Not provided"}
              </dd>
            </div>
          </dl>
        </div>

        <span className="shrink-0 text-sm font-medium text-gray-600">
          View job →
        </span>
      </div>
    </Link>
  );
}
