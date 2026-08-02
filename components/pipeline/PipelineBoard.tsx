"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SlidersHorizontal } from "lucide-react";
import PipelineColumn from "@/components/pipeline/PipelineColumn";
import PipelineViewOptions, { type PipelineEmployeeOption } from "@/components/pipeline/PipelineViewOptions";
import JobRequirementsDialog from "@/components/pipeline/JobRequirementsDialog";
import {
  isConfiguredQfNumberRequired,
  isConfiguredContractAmountRequired,
  isInstallScheduledStage,
  resolveConfiguredStage,
  type PipelineStage,
  type PipelineStageView,
} from "@/components/pipeline/constants";
import type { PipelineJobWithProduction } from "@/components/pipeline/types";
import { changeJobPipelineStatus } from "@/app/actions/job-status";
import { formatJobDisplayName } from "@/lib/job-display";
import { updatePipelineCardSizeAction, updatePipelineSortOrderAction, type PipelineCardSize, type PipelineSortOrder } from "@/app/pipeline/actions";

type PipelineBoardProps = {
  initialJobs: PipelineJobWithProduction[];
  canChangeStatus: boolean;
  stages: PipelineStageView[];
  installationJobIds: string[];
  workOrderReadyJobIds: string[];
  employees: PipelineEmployeeOption[];
  initialCardSize: PipelineCardSize;
  initialSortOrder: PipelineSortOrder;
};

export default function PipelineBoard({ initialJobs, canChangeStatus, stages, installationJobIds, workOrderReadyJobIds, employees, initialCardSize, initialSortOrder }: PipelineBoardProps) {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ pointerId: number; startX: number; scrollLeft: number } | null>(null);
  const [jobs, setJobs] = useState(initialJobs);
  const [cardSize, setCardSize] = useState<PipelineCardSize>(initialCardSize);
  const [sortOrder, setSortOrder] = useState<PipelineSortOrder>(initialSortOrder);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [movingJobId, setMovingJobId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<PipelineStage | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    jobId: string;
    status: PipelineStage;
  } | null>(null);

  const visibleJobs = useMemo(() => {
    if (employeeIds.length === 0) return jobs;
    return jobs.filter((job) =>
      job.assigned_employee_id
        ? employeeIds.includes(job.assigned_employee_id)
        : employeeIds.includes("unassigned"),
    );
  }, [employeeIds, jobs]);

  const jobsByStage = useMemo(() => {
    const groups = Object.fromEntries(
      stages.map((stage) => [stage.slug, [] as PipelineJobWithProduction[]]),
    ) as Record<string, PipelineJobWithProduction[]>;

    for (const job of visibleJobs) {
      const stage = resolveConfiguredStage(job.status, stages);
      if (stage) groups[stage.slug].push(job);
    }

    for (const stageJobs of Object.values(groups)) {
      stageJobs.sort((first, second) => {
        if (sortOrder === "alphabetical") {
          const firstName = formatJobDisplayName({ customerName: first.customer?.full_name, jobName: first.customer_name, qfNumber: first.qfloors_job_number });
          const secondName = formatJobDisplayName({ customerName: second.customer?.full_name, jobName: second.customer_name, qfNumber: second.qfloors_job_number });
          return firstName.localeCompare(secondName, undefined, { sensitivity: "base", numeric: true });
        }
        const difference = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        return sortOrder === "oldest" ? difference : -difference;
      });
    }

    return groups;
  }, [sortOrder, stages, visibleJobs]);

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-pipeline-card], button, a, input, select, textarea")) return;
    const board = boardRef.current;
    if (!board) return;
    panState.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: board.scrollLeft };
    board.setPointerCapture(event.pointerId);
    setIsPanning(true);
    event.preventDefault();
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panState.current;
    const board = boardRef.current;
    if (!pan || !board || pan.pointerId !== event.pointerId) return;
    board.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panState.current?.pointerId !== event.pointerId) return;
    panState.current = null;
    setIsPanning(false);
  }

  function autoScrollDuringCardDrag(event: React.DragEvent<HTMLDivElement>) {
    const board = boardRef.current;
    if (!board) return;
    const bounds = board.getBoundingClientRect();
    const edge = 90;
    if (event.clientX < bounds.left + edge) board.scrollLeft -= 18;
    if (event.clientX > bounds.right - edge) board.scrollLeft += 18;
  }

  async function applyViewOptions(next: { cardSize: PipelineCardSize; sortOrder: PipelineSortOrder; employeeIds: string[] }) {
    setEmployeeIds(next.employeeIds);
    await Promise.all([
      next.cardSize !== cardSize ? updatePipelineCardSizeAction(next.cardSize) : Promise.resolve(),
      next.sortOrder !== sortOrder ? updatePipelineSortOrderAction(next.sortOrder) : Promise.resolve(),
    ]);
    setCardSize(next.cardSize);
    setSortOrder(next.sortOrder);
  }

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Drag cards between stages. Grab empty board space to move across the pipeline.
        </p>
        <button
          type="button"
          onClick={() => setViewOptionsOpen(true)}
          className="relative inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-600">{cardSize}</span>
          {employeeIds.length ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[10px] font-bold text-white" aria-label={`${employeeIds.length} active employee filters`}>
              {employeeIds.length}
            </span>
          ) : null}
        </button>
      </div>

      {employeeIds.length ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <span>Showing {visibleJobs.length} of {jobs.length} company jobs.</span>
          <button type="button" onClick={() => setEmployeeIds([])} className="font-semibold text-gray-900 hover:underline">Clear employee filter</button>
        </div>
      ) : null}

      <div
        ref={boardRef}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDragOver={autoScrollDuringCardDrag}
        className={`mt-4 overflow-x-auto pb-6 select-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      >
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
              cardSize={cardSize}
            />
          ))}
        </div>
      </div>

      {viewOptionsOpen ? (
        <PipelineViewOptions
          open
          value={{ cardSize, sortOrder, employeeIds }}
          employees={employees}
          onOpenChange={setViewOptionsOpen}
          onApply={applyViewOptions}
        />
      ) : null}

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
