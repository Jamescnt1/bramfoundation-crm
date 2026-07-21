"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import PipelineStatusBadge from "@/components/pipeline/PipelineStatusBadge";
import { getPipelineStage, isQfNumberRequired } from "@/components/pipeline/constants";
import type { Job } from "@/lib/services/jobs";
import type { Customer } from "./types";

type CustomerHierarchyRowProps = {
  customer: Customer;
  jobs: Job[];
  expanded: boolean;
  onToggle: () => void;
};

export default function CustomerHierarchyRow({
  customer,
  jobs,
  expanded,
  onToggle,
}: CustomerHierarchyRowProps) {
  const activeJobs = jobs.filter((job) => {
    const stage = getPipelineStage(job.status);
    return stage !== "Complete" && stage !== "Lost";
  }).length;

  return (
    <article className="border-b border-gray-200 last:border-b-0">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <button
            type="button"
            onClick={onToggle}
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-black sm:mt-0"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${customer.full_name}`}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <div className="min-w-0">
            <Link
              href={`/customers/${customer.id}`}
              className="truncate font-semibold text-black hover:underline"
            >
              {customer.full_name}
            </Link>

            <p className="mt-1 truncate text-sm text-gray-500">
              {customer.phone ?? customer.email ?? "No contact information"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 pl-11 text-sm sm:pl-0">
          <div>
            <span className="font-semibold text-gray-900">{jobs.length}</span>{" "}
            <span className="text-gray-500">total</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900">{activeJobs}</span>{" "}
            <span className="text-gray-500">open</span>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
          {jobs.length === 0 ? (
            <p className="ml-11 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
              No jobs linked to this customer.
            </p>
          ) : (
            <div className="ml-4 border-l-2 border-gray-200 pl-6 sm:ml-7">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="relative border-b border-gray-200 py-3 last:border-b-0"
                >
                  <span
                    className="absolute -left-6 top-6 h-px w-4 bg-gray-200"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${job.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {job.customer_name}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">
                        <span className={isQfNumberRequired(job.status) && !job.qfloors_job_number?.trim() ? "font-semibold text-red-700" : ""}>
                          {job.qfloors_job_number ? `QF# ${job.qfloors_job_number}` : isQfNumberRequired(job.status) ? "QF# required" : "QF# not assigned"}
                        </span>
                        {job.address ? ` · ${job.address}` : ""}
                      </p>
                    </div>

                    <PipelineStatusBadge status={job.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
