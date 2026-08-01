"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, GripVertical } from "lucide-react";
import type { PipelineJob } from "@/components/pipeline/types";
import { formatJobDisplayName } from "@/lib/job-display";
import type { PipelineCardSize } from "@/app/pipeline/actions";

type PipelineCardProps = {
  job: PipelineJob;
  isMoving: boolean;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  canChangeStatus: boolean;
  cardSize: PipelineCardSize;
};

export default function PipelineCard({
  job,
  isMoving,
  onDragStart,
  onDragEnd,
  canChangeStatus,
  cardSize,
}: PipelineCardProps) {
  const overdue = isOverdue(job.next_action_due);
  const missingRequiredQf =
    ["estimate_sent", "waiting_approval", "approved", "materials_ordered", "install_scheduled", "complete", "lost", "Estimate Sent", "Waiting Approval", "Approved", "Materials Ordered", "Install Scheduled", "Complete", "Lost"].includes(job.status)
    && !job.qfloors_job_number?.trim();
  const missingRequiredContract =
    ["approved", "materials_ordered", "install_scheduled", "complete", "lost", "Approved", "Materials Ordered", "Install Scheduled", "Complete", "Lost"].includes(job.status)
    && !job.contract_amount;

  return (
    <article
      data-pipeline-card
      draggable={canChangeStatus && !isMoving}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", job.id);
        onDragStart(job.id);
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-md border border-gray-200 bg-white shadow-sm transition ${cardSize === "small" ? "px-2 py-1.5" : cardSize === "medium" ? "px-2.5 py-1.5" : "px-2.5 py-2"} ${
        isMoving
          ? "cursor-wait opacity-60"
          : canChangeStatus
            ? "cursor-grab hover:border-gray-300 hover:shadow active:cursor-grabbing"
            : "cursor-default"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical
          className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-gray-400"
          aria-hidden="true"
        />

        <Link
          href={`/leads/${job.id}`}
          className={`min-w-0 flex-1 truncate font-semibold text-gray-900 hover:underline ${cardSize === "small" ? "text-xs leading-4" : "text-sm leading-5"}`}
          title={formatJobDisplayName({
            customerName: job.customer?.full_name,
            jobName: job.customer_name,
            qfNumber: job.qfloors_job_number,
          })}
        >
          {formatJobDisplayName({
            customerName: job.customer?.full_name,
            jobName: job.customer_name,
            qfNumber: job.qfloors_job_number,
          })}
        </Link>

        {missingRequiredQf ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
            title="QF# is required at this pipeline stage"
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            QF#
          </span>
        ) : null}
        {missingRequiredContract ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title="Contract Amount is required at this pipeline stage">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            $
          </span>
        ) : null}
      </div>

      {cardSize !== "small" ? <div className={`flex min-w-0 items-center gap-1.5 pl-5 text-gray-500 ${cardSize === "medium" ? "mt-0.5 text-[10px] leading-4" : "mt-1 text-[11px] leading-4"}`}>
        <span className="max-w-[42%] shrink-0 truncate">
          {job.salesperson ?? "Unassigned"}
        </span>
        <span aria-hidden="true">·</span>
        <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className={`min-w-0 truncate ${overdue ? "font-semibold text-red-700" : ""}`}>
          {job.next_action ?? "No next action"}
          {job.next_action_due ? ` · ${formatDate(job.next_action_due)}` : ""}
        </span>
      </div> : null}
    </article>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function isOverdue(value: string | null) {
  if (!value) {
    return false;
  }

  return new Date(`${value}T23:59:59`) < new Date();
}
