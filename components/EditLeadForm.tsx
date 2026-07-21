"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SalespersonSelect from "@/components/SalespersonSelect";
import { isConfiguredQfNumberRequired, resolveConfiguredStage, type PipelineStageView } from "@/components/pipeline/constants";
import {
  updateJob,
  type Job,
} from "@/lib/services/jobs";
import { archiveLeadAction } from "@/app/leads/[id]/edit/actions";
import RecordDeleteDialog from "@/components/ui/RecordDeleteDialog";
import { formatJobDisplayName } from "@/lib/job-display";

type EditLeadFormProps = {
  job: Job;
  canArchive?: boolean;
  stages: PipelineStageView[];
};

export default function EditLeadForm({
  job,
  canArchive = false,
  stages,
}: EditLeadFormProps) {
  const router = useRouter();

  const [status, setStatus] = useState(
    job.status ?? "New Lead",
  );

  const [salesperson, setSalesperson] = useState(
    job.salesperson ?? "",
  );

  const [nextAction, setNextAction] = useState(
    job.next_action ?? "",
  );

  const [nextActionDue, setNextActionDue] = useState(
    job.next_action_due ?? "",
  );

  const [notes, setNotes] = useState(
    job.notes ?? "",
  );

  const [qfNumber, setQfNumber] = useState(
    job.qfloors_job_number ?? "",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage("");

    if (isConfiguredQfNumberRequired(status, stages) && !qfNumber.trim()) {
      setErrorMessage("QF# is required for Estimate Sent and later stages.");
      setIsSaving(false);
      return;
    }

    try {
      await updateJob(job.id, {
        status,
        salesperson: salesperson || null,
        next_action: nextAction.trim() || null,
        next_action_due: nextActionDue || null,
        notes: notes.trim() || null,
        qfloors_job_number: qfNumber.trim() || null,
      });

      router.push(`/leads/${job.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );

      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Unable to save changes: {errorMessage}
        </div>
      )}

      {isConfiguredQfNumberRequired(status, stages) || qfNumber ? (
      <div>
        <label
          htmlFor="qfNumber"
          className="block text-sm font-medium text-gray-700"
        >
          QF# {isConfiguredQfNumberRequired(status, stages) ? <span className="text-red-600">*</span> : null}
        </label>

        <input
          id="qfNumber"
          name="qfNumber"
          type="text"
          disabled={isSaving}
          value={qfNumber}
          onChange={(event) => setQfNumber(event.target.value)}
          placeholder="Enter QFloors reference"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
        <p className="mt-2 text-sm text-gray-500">
          Required when this job reaches Estimate Sent.
        </p>
      </div>
      ) : null}

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-gray-700"
        >
          Status
        </label>

        <select
          id="status"
          name="status"
          disabled={isSaving}
          value={resolveConfiguredStage(status, stages)?.slug ?? status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          {stages.map((statusOption) => (
            <option key={statusOption.slug} value={statusOption.slug}>
              {statusOption.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Salesperson
        </label>

        <SalespersonSelect
          value={salesperson}
          onChange={setSalesperson}
        />
      </div>

      <div>
        <label
          htmlFor="nextAction"
          className="block text-sm font-medium text-gray-700"
        >
          Next Action
        </label>

        <input
          id="nextAction"
          name="nextAction"
          type="text"
          disabled={isSaving}
          value={nextAction}
          onChange={(event) =>
            setNextAction(event.target.value)
          }
          placeholder="Example: Call customer with flooring options"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="nextActionDue"
          className="block text-sm font-medium text-gray-700"
        >
          Next Action Due
        </label>

        <input
          id="nextActionDue"
          name="nextActionDue"
          type="date"
          disabled={isSaving}
          value={nextActionDue}
          onChange={(event) =>
            setNextActionDue(event.target.value)
          }
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700"
        >
          Notes
        </label>

        <textarea
          id="notes"
          name="notes"
          rows={7}
          disabled={isSaving}
          value={notes}
          onChange={(event) =>
            setNotes(event.target.value)
          }
          placeholder="Add customer, project, or follow-up notes"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={isSaving} className="rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" disabled={isSaving} onClick={() => router.push(`/leads/${job.id}`)} className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            Cancel
          </button>
        </div>
        {canArchive ? (
          <button type="button" disabled={isSaving} onClick={() => setArchiveDialogOpen(true)} className="rounded-lg border border-red-200 px-5 py-2.5 font-medium text-red-700 transition hover:bg-red-50">
            Archive Lead
          </button>
        ) : null}
      </div>

      <RecordDeleteDialog
        open={archiveDialogOpen}
        title="Archive lead?"
        recordName={formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}
        description="This lead will leave active lead and pipeline views. The linked customer, tasks, appointments, and activity history will be preserved."
        confirmLabel="Archive lead"
        onOpenChange={setArchiveDialogOpen}
        onConfirm={async () => {
          await archiveLeadAction(job.id);
          router.push("/leads");
          router.refresh();
        }}
      />
    </form>
  );
}
