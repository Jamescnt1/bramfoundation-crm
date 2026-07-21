"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PipelineColumn from "@/components/pipeline/PipelineColumn";
import QfNumberDialog from "@/components/pipeline/QfNumberDialog";
import {
  isConfiguredQfNumberRequired,
  resolveConfiguredStage,
  type PipelineStage,
  type PipelineStageView,
} from "@/components/pipeline/constants";
import type { PipelineJob } from "@/components/pipeline/types";
import { changeJobPipelineStatus } from "@/app/actions/job-status";
import { formatJobDisplayName } from "@/lib/job-display";

type PipelineBoardProps = {
  initialJobs: PipelineJob[];
  canChangeStatus: boolean;
  stages: PipelineStageView[];
};

export default function PipelineBoard({ initialJobs, canChangeStatus, stages }: PipelineBoardProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [movingJobId, setMovingJobId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<PipelineStage | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    jobId: string;
    status: PipelineStage;
  } | null>(null);

  const jobsByStage = useMemo(() => {
    const groups = Object.fromEntries(
      stages.map((stage) => [stage.slug, [] as PipelineJob[]]),
    ) as Record<string, PipelineJob[]>;

    for (const job of jobs) {
      const stage = resolveConfiguredStage(job.status, stages);
      if (stage) groups[stage.slug].push(job);
    }

    return groups;
  }, [jobs, stages]);

  async function moveJob(jobId: string, newStatus: PipelineStage) {
    if (!canChangeStatus) {
      setErrorMessage("You do not have permission to change pipeline status.");
      clearDragState();
      return;
    }

    const currentJob = jobs.find((job) => job.id === jobId);

    if (!currentJob || resolveConfiguredStage(currentJob.status, stages)?.slug === newStatus) {
      clearDragState();
      return;
    }

    if (
      isConfiguredQfNumberRequired(newStatus, stages) &&
      !currentJob.qfloors_job_number?.trim()
    ) {
      clearDragState();
      setPendingMove({ jobId, status: newStatus });
      return;
    }

    await completeMove(jobId, newStatus);
  }

  async function completeMove(
    jobId: string,
    newStatus: PipelineStage,
    qfNumber?: string,
  ) {
    const currentJob = jobs.find((job) => job.id === jobId);

    if (!currentJob) return;

    const previousStatus = currentJob.status;
    const previousQfNumber = currentJob.qfloors_job_number;

    setErrorMessage("");
    setMovingJobId(jobId);
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: newStatus,
              qfloors_job_number: qfNumber ?? job.qfloors_job_number,
            }
          : job,
      ),
    );
    clearDragState();

    try {
      await changeJobPipelineStatus(jobId, newStatus, qfNumber);
      setPendingMove(null);
      router.refresh();
    } catch (error) {
      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: previousStatus,
                qfloors_job_number: previousQfNumber,
              }
            : job,
        ),
      );
      setErrorMessage(
        `Unable to move ${formatJobDisplayName({ customerName: currentJob.customer?.full_name, jobName: currentJob.customer_name, qfNumber: currentJob.qfloors_job_number })}: ${
          error instanceof Error ? error.message : "An unexpected error occurred."
        }`,
      );
    } finally {
      setMovingJobId(null);
    }
  }

  function clearDragState() {
    setDraggedJobId(null);
    setDragTarget(null);
  }

  return (
    <>
      {errorMessage ? (
        <div className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="font-semibold"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-gray-500">
        Drag a job card to another column to update its pipeline stage.
      </p>

      <div className="mt-4 overflow-x-auto pb-6">
        <div className="flex min-w-max items-stretch gap-5">
          {stages.map((stage) => (
            <PipelineColumn
              key={stage.slug}
              stage={stage}
              jobs={jobsByStage[stage.slug] ?? []}
              movingJobId={movingJobId}
              draggedJobId={draggedJobId}
              isDragTarget={dragTarget === stage.slug}
              onDragStart={(jobId) => setDraggedJobId(jobId)}
              onDragEnd={clearDragState}
              onDragEnter={setDragTarget}
              onDrop={moveJob}
              canChangeStatus={canChangeStatus}
            />
          ))}
        </div>
      </div>

      {pendingMove ? (
      <QfNumberDialog
        open
        jobName={
          (() => {
            const job = jobs.find((item) => item.id === pendingMove?.jobId);
            return job
              ? formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })
              : "this job";
          })()
        }
        targetStatus={pendingMove.status}
        isSaving={Boolean(movingJobId)}
        errorMessage={errorMessage}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null);
            setErrorMessage("");
          }
        }}
        onConfirm={(qfNumber) => {
          if (pendingMove) {
            void completeMove(pendingMove.jobId, pendingMove.status, qfNumber);
          }
        }}
      />
      ) : null}
    </>
  );
}
