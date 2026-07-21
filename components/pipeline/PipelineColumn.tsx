"use client";

import PipelineCard from "@/components/pipeline/PipelineCard";
import {
  getStageStyles,
  type PipelineStageView,
  type PipelineStage,
} from "@/components/pipeline/constants";
import type { PipelineJob } from "@/components/pipeline/types";

type PipelineColumnProps = {
  stage: PipelineStageView;
  jobs: PipelineJob[];
  movingJobId: string | null;
  draggedJobId: string | null;
  isDragTarget: boolean;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  onDragEnter: (stage: PipelineStage) => void;
  onDrop: (jobId: string, stage: PipelineStage) => void;
  canChangeStatus: boolean;
};

export default function PipelineColumn({
  stage,
  jobs,
  movingJobId,
  draggedJobId,
  isDragTarget,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
  canChangeStatus,
}: PipelineColumnProps) {
  const styles = getStageStyles(stage);

  return (
    <section
      onDragEnter={() => onDragEnter(stage.slug)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const jobId = event.dataTransfer.getData("text/plain") || draggedJobId;

        if (jobId) {
          onDrop(jobId, stage.slug);
        }
      }}
      className={`flex w-72 flex-none flex-col overflow-hidden rounded-xl border bg-gray-100 transition ${
        isDragTarget ? `${styles.border} ring-2 ring-black/10` : "border-gray-200"
      }`}
      aria-label={`${stage.label} pipeline column`}
    >
      <header className="border-b border-gray-200 bg-white px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.accent}`} />
            <h2 className="truncate font-semibold text-gray-900">{stage.label}</h2>
          </div>

          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge}`}>
            {jobs.length}
          </span>
        </div>
      </header>

      <div className={`min-h-52 flex-1 space-y-1.5 p-2 ${isDragTarget ? "bg-white/60" : ""}`}>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 p-5 text-center text-sm text-gray-500">
            {isDragTarget ? "Drop lead here" : "No leads in this stage"}
          </div>
        ) : (
          jobs.map((job) => (
            <PipelineCard
              key={job.id}
              job={job}
              isMoving={movingJobId === job.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              canChangeStatus={canChangeStatus}
            />
          ))
        )}
      </div>
    </section>
  );
}
