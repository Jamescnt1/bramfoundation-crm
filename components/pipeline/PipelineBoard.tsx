"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PipelineColumn from "@/components/pipeline/PipelineColumn";
import JobRequirementsDialog from "@/components/pipeline/JobRequirementsDialog";
import {
  isConfiguredQfNumberRequired,
  isConfiguredContractAmountRequired,
  isInstallScheduledStage,
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
  installationJobIds: string[];
  workOrderReadyJobIds: string[];
};

export default function PipelineBoard({ initialJobs, canChangeStatus, stages, installationJobIds, workOrderReadyJobIds }: PipelineBoardProps) {
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

  if (stages.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Pipeline stages could not be loaded. Ask an administrator to verify the
        pipeline configuration and employee access policies.
      </div>
    );
  }

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
      shouldReviewInstallation(currentJob.status, newStatus, stages) ||
      (
        isWorkOrderSentStage(newStatus, stages) &&
        currentJob.installation_required &&
        !workOrderReadyJobIds.includes(currentJob.id)
      ) ||
      (isConfiguredQfNumberRequired(newStatus, stages) && !currentJob.qfloors_job_number?.trim()) ||
      (isConfiguredContractAmountRequired(newStatus, stages) && !currentJob.contract_amount)
      || (
        isInstallScheduledStage(newStatus, stages) &&
        currentJob.installation_required &&
        !installationJobIds.includes(currentJob.id)
      )
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
    contractAmount?: string,
    installationRequired?: boolean,
  ) {
    const currentJob = jobs.find((job) => job.id === jobId);

    if (!currentJob) return;

    const previousStatus = currentJob.status;
    const previousQfNumber = currentJob.qfloors_job_number;
    const previousContractAmount = currentJob.contract_amount;
    const previousInstallationRequired = currentJob.installation_required;

    setErrorMessage("");
    setMovingJobId(jobId);
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: newStatus,
              qfloors_job_number: qfNumber ?? job.qfloors_job_number,
              contract_amount: contractAmount ?? job.contract_amount,
              installation_required: installationRequired ?? job.installation_required,
            }
          : job,
      ),
    );
    clearDragState();

    try {
      await changeJobPipelineStatus(jobId, newStatus, qfNumber, contractAmount, installationRequired);
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
                contract_amount: previousContractAmount,
                installation_required: previousInstallationRequired,
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
      <JobRequirementsDialog
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
        requireQfNumber={isConfiguredQfNumberRequired(pendingMove.status, stages) && !jobs.find((job) => job.id === pendingMove.jobId)?.qfloors_job_number?.trim()}
        requireContractAmount={isConfiguredContractAmountRequired(pendingMove.status, stages) && !jobs.find((job) => job.id === pendingMove.jobId)?.contract_amount}
        requireInstallAppointment={
          isInstallScheduledStage(pendingMove.status, stages) &&
          Boolean(jobs.find((job) => job.id === pendingMove.jobId)?.installation_required) &&
          !installationJobIds.includes(pendingMove.jobId)
        }
        requireWorkOrdersSent={
          isWorkOrderSentStage(pendingMove.status, stages) &&
          Boolean(jobs.find((job) => job.id === pendingMove.jobId)?.installation_required) &&
          !workOrderReadyJobIds.includes(pendingMove.jobId)
        }
        installationsHref={`/leads/${pendingMove.jobId}?tab=installations`}
        scheduleInstallHref={`/leads/${pendingMove.jobId}?tab=calendar&schedule=installation`}
        initialQfNumber={jobs.find((job) => job.id === pendingMove.jobId)?.qfloors_job_number}
        initialContractAmount={jobs.find((job) => job.id === pendingMove.jobId)?.contract_amount}
        showInstallationQuestion={
          shouldReviewInstallation(
            jobs.find((job) => job.id === pendingMove.jobId)?.status ?? "",
            pendingMove.status,
            stages,
          ) ||
          (
            isWorkOrderSentStage(pendingMove.status, stages) &&
            !installationJobIds.includes(pendingMove.jobId)
          )
        }
        initialInstallationRequired={jobs.find((job) => job.id === pendingMove.jobId)?.installation_required}
        isSaving={Boolean(movingJobId)}
        errorMessage={errorMessage}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null);
            setErrorMessage("");
          }
        }}
        onConfirm={({ qfNumber, contractAmount, installationRequired }) => {
          if (pendingMove) {
            void completeMove(
              pendingMove.jobId,
              pendingMove.status,
              qfNumber,
              contractAmount,
              installationRequired,
            );
          }
        }}
      />
      ) : null}
    </>
  );
}

function shouldReviewInstallation(
  currentStatus: string,
  nextStatus: string,
  stages: PipelineStageView[],
) {
  const approvedStage = stages.find((stage) => stage.slug === "approved");
  const currentStage = resolveConfiguredStage(currentStatus, stages);
  const nextStage = resolveConfiguredStage(nextStatus, stages);
  return Boolean(
    approvedStage &&
    currentStage &&
    nextStage &&
    currentStage.sort_order < approvedStage.sort_order &&
    nextStage.sort_order >= approvedStage.sort_order,
  );
}

function isWorkOrderSentStage(status: string, stages: PipelineStageView[]) {
  const stage = resolveConfiguredStage(status, stages);
  const normalized = `${stage?.slug ?? ""} ${stage?.label ?? ""}`
    .toLowerCase()
    .replaceAll("-", " ")
    .replaceAll("_", " ");
  return normalized.includes("work order") && normalized.includes("sent");
}
