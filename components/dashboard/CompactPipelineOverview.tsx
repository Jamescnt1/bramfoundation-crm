"use client";

import Link from "next/link";
import { useState } from "react";
import {
  getStageStyles,
  type PipelineStageView,
} from "@/components/pipeline/constants";
import { formatJobDisplayName } from "@/lib/job-display";
import type { WorkspaceJob } from "@/lib/services/workspace";

type PipelineStageGroup = {
  stage: PipelineStageView;
  jobs: WorkspaceJob[];
};

export default function CompactPipelineOverview({
  groups,
}: {
  groups: PipelineStageGroup[];
}) {
  const [activeStageSlug, setActiveStageSlug] = useState<string | null>(null);
  const activeGroup =
    groups.find(({ stage }) => stage.slug === activeStageSlug) ?? null;

  return (
    <div
      className="relative"
      onMouseLeave={() => setActiveStageSlug(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setActiveStageSlug(null);
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch px-0.5 pt-0.5">
        {groups.map(({ stage, jobs }, index) => {
          const styles = getStageStyles(stage);
          const first = index === 0;
          const last = index === groups.length - 1;

          return (
            <div
              key={stage.slug}
              className={`group relative w-36 shrink-0 ${first ? "" : "-ml-2"}`}
            >
              <button
                type="button"
                aria-expanded={activeStageSlug === stage.slug}
                aria-label={`${stage.label}: ${jobs.length} assigned ${jobs.length === 1 ? "job" : "jobs"}`}
                onMouseEnter={() => setActiveStageSlug(stage.slug)}
                onFocus={() => setActiveStageSlug(stage.slug)}
                onClick={() =>
                  setActiveStageSlug((current) =>
                    current === stage.slug ? null : stage.slug,
                  )
                }
                className={`relative flex h-10 w-full items-center justify-between gap-2 px-4 text-left text-white shadow-sm transition brightness-95 hover:z-20 hover:brightness-105 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 ${styles.accent} ${
                  first ? "pl-3" : "pl-5"
                } ${last ? "pr-3" : "pr-5"}`}
                style={{
                  clipPath: first
                    ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                    : last
                      ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)"
                      : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                }}
              >
                <span className="truncate text-[11px] font-bold uppercase tracking-wide">
                  {stage.label}
                </span>
                <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {jobs.length}
                </span>
              </button>
            </div>
          );
        })}
        </div>
      </div>

      {activeGroup ? (
        <div className="absolute left-1/2 top-full z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 pt-1">
          <StageJobPanel group={activeGroup} />
        </div>
      ) : null}
    </div>
  );
}

function StageJobPanel({ group }: { group: PipelineStageGroup }) {
  const { stage, jobs } = group;
  const styles = getStageStyles(stage);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
          <h3 className="text-sm font-semibold text-gray-900">{stage.label}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
          {jobs.length}
        </span>
      </div>

      <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
        {jobs.length ? (
          jobs.map((job) => (
            <Link
              key={job.id}
              href={`/leads/${job.id}`}
              className="block px-3 py-2.5 transition hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
            >
              <p className="text-xs font-semibold text-gray-900">
                {formatJobDisplayName({
                  customerName: job.customer?.full_name,
                  jobName: job.customer_name,
                  qfNumber: job.qfloors_job_number,
                })}
              </p>
              {job.next_action ? (
                <p className="mt-0.5 truncate text-[11px] text-gray-500">
                  Next: {job.next_action}
                </p>
              ) : null}
            </Link>
          ))
        ) : (
          <p className="px-3 py-5 text-center text-xs text-gray-500">
            No assigned jobs in this stage.
          </p>
        )}
      </div>

      <Link
        href="/pipeline"
        className="block border-t border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        Open full pipeline
      </Link>
    </div>
  );
}
