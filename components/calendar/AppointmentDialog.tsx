"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, CalendarPlus, Check, Search } from "lucide-react";
import type { AppointmentType } from "@/components/calendar/constants";
import type { CalendarAppointment } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  copyAppointmentToEmployee,
  createAppointment,
  linkAppointmentsToMaterialScopes,
  updateLinkedProductionScopeDescription,
  updateAppointment,
  type AppointmentUpdateScope,
} from "@/lib/services/appointments";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import { formatJobDisplayName } from "@/lib/job-display";
import { formatAppointmentType } from "@/lib/appointment-display";
import type { AppointmentTypeDefinition } from "@/lib/services/appointment-types";
import { productionPipelineErrorMessage } from "@/lib/production-pipeline-error";

type AppointmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date | null;
  appointment?: CalendarAppointment | null;
  employees: Employee[];
  installerCrews: InstallerCrew[];
  jobs?: Job[];
  defaultJobId?: string | null;
  defaultAppointmentType?: AppointmentType;
  appointmentTypes: AppointmentTypeDefinition[];
  productionScopes?: { id: string; job_id: string; label: string; abbreviation: string }[];
  defaultMaterialScopeIds?: string[];
  appointmentScopeIds?: string[];
};

type LocationMode = "job" | "custom";

const EMPTY_SCOPE_IDS: string[] = [];

function formatDateInput(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function createAppointmentDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function oneHourAfter(date: string, time: string) {
  const start = createAppointmentDate(date, time);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    date: formatDateInput(end),
    time: formatTimeInput(end),
  };
}

function oneYearAfter(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  value.setFullYear(value.getFullYear() + 1);
  return formatDateInput(value);
}

function formatContactName(contact: Job["company_contact"]) {
  if (!contact) return "Not selected";
  return `${contact.first_name} ${contact.last_name}`.trim();
}

function formatProjectContact(job: Job) {
  return job.project_contact_name || (job.project_contact ? formatContactName(job.project_contact) : job.project_customer_name || job.customer_name || "Not provided");
}

export default function AppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  appointment,
  employees,
  installerCrews,
  jobs = [],
  defaultJobId = null,
  defaultAppointmentType = "appointment",
  appointmentTypes,
  productionScopes = [],
  defaultMaterialScopeIds = EMPTY_SCOPE_IDS,
  appointmentScopeIds = EMPTY_SCOPE_IDS,
}: AppointmentDialogProps) {
  const router = useRouter();
  const isEditing = Boolean(appointment);

  const [appointmentType, setAppointmentType] =
    useState<AppointmentType>("appointment");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [locationMode, setLocationMode] = useState<LocationMode>("custom");
  const [notes, setNotes] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [installerCrewId, setInstallerCrewId] = useState("");
  const [installationScope, setInstallationScope] = useState("");
  const [materialScopeIds, setMaterialScopeIds] = useState<string[]>([]);
  const [jobId, setJobId] = useState("");
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [jobQuery, setJobQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [endTimeManuallyEdited, setEndTimeManuallyEdited] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "biweekly" | "monthly">("none");
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState("");
  const [updateScope, setUpdateScope] = useState<AppointmentUpdateScope>("occurrence");
  const [copyEmployeeId, setCopyEmployeeId] = useState("");
  const [copyScope, setCopyScope] = useState<"occurrence" | "series">("occurrence");
  const [copyMessage, setCopyMessage] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  /* Form state is intentionally reset whenever a create/edit dialog opens. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      return;
    }

    if (appointment) {
      const startsAt = new Date(appointment.starts_at);
      const endsAt = appointment.ends_at
        ? new Date(appointment.ends_at)
        : new Date(startsAt.getTime() + 60 * 60 * 1000);

      setAppointmentType(
        appointment.appointment_type ?? "measure",
      );
      setDate(formatDateInput(startsAt));
      setEndDate(formatDateInput(endsAt));
      setStartTime(formatTimeInput(startsAt));
      setEndTime(formatTimeInput(endsAt));
      setLocation(appointment.location ?? "");
      const appointmentJob = jobs.find((job) => job.id === appointment.job_id);
      setLocationMode(
        appointmentJob?.address &&
          appointment.location?.trim() === appointmentJob.address.trim()
          ? "job"
          : "custom",
      );
      setNotes(appointment.notes ?? "");
      setAssignedEmployeeId(appointment.assigned_employee_id ?? "");
      setInstallerCrewId(appointment.installer_crew_id ?? "");
      setInstallationScope(appointment.installation_scope ?? "");
      setMaterialScopeIds(appointmentScopeIds);
      setJobId(appointment.job_id ?? "");
      setJobPickerOpen(false);
      setJobQuery("");
      setCustomTitle(appointment.job_id ? "" : appointment.title ?? "");
      setEndTimeManuallyEdited(true);
      setAllDay(Boolean(appointment.all_day));
      setRecurrence("none");
      setRecurrenceEndsOn(appointment.recurrence_ends_on ?? "");
      setUpdateScope("occurrence");
      setCopyEmployeeId("");
      setCopyScope("occurrence");
      setCopyMessage("");
    } else {
      const initialJob = jobs.find((job) => job.id === defaultJobId);
      setAppointmentType(defaultAppointmentType);
      setDate(formatDateInput(defaultDate ?? new Date()));
      const initialStart = defaultDate ?? new Date();
      const initialEnd = new Date(initialStart.getTime() + 60 * 60 * 1000);
      setEndDate(formatDateInput(initialEnd));
      setStartTime(formatTimeInput(initialStart));
      setEndTime(formatTimeInput(initialEnd));
      setLocation(initialJob?.address ?? "");
      setLocationMode(initialJob?.address ? "job" : "custom");
      setNotes("");
      setAssignedEmployeeId("");
      setInstallerCrewId("");
      setInstallationScope("");
      setMaterialScopeIds(defaultMaterialScopeIds);
      setJobId(defaultJobId ?? "");
      setJobPickerOpen(false);
      setJobQuery("");
      setCustomTitle("");
      setEndTimeManuallyEdited(false);
      setAllDay(false);
      setRecurrence("none");
      setRecurrenceEndsOn("");
      setUpdateScope("occurrence");
      setCopyEmployeeId("");
      setCopyScope("occurrence");
      setCopyMessage("");
    }

    setErrorMessage(null);
  // Initialize once for the appointment being opened. Depending on array props
  // here caused every form interaction to restore the original appointment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) {
      return;
    }

    onOpenChange(nextOpen);
  }

  function handleAppointmentTypeChange(nextType: AppointmentType) {
    setAppointmentType(nextType);

    if (isEditing) return;

    const selectedJob = jobs.find((job) => job.id === jobId);

    if (nextType === "material_selection") {
      setLocationMode("custom");
      setLocation("");
      return;
    }

    if (
      (nextType === "installation" || nextType === "measure") &&
      selectedJob?.address
    ) {
      setLocationMode("job");
      setLocation(selectedJob.address);
    }
  }

  function selectJob(nextJobId: string) {
    const nextJob = jobs.find((job) => job.id === nextJobId);
    setJobId(nextJobId);
    setJobPickerOpen(false);
    setJobQuery("");
    setMaterialScopeIds([]);
    setInstallationScope("");
    if (nextJob?.address && appointmentType !== "material_selection") {
      setLocationMode("job");
      setLocation(nextJob.address);
    } else {
      setLocationMode("custom");
      setLocation("");
    }
  }

  const selectedJob = jobs.find((job) => job.id === jobId);
  const filteredJobs = useMemo(() => {
    const normalized = jobQuery.trim().toLowerCase();
    return jobs.filter((job) => !normalized || [
      job.customer?.full_name,
      job.customer_name,
      job.project_customer_name,
      job.qfloors_job_number,
      job.address,
      job.company_contact ? formatContactName(job.company_contact) : null,
      formatProjectContact(job),
    ].some((value) => value?.toLowerCase().includes(normalized))).slice(0, 40);
  }, [jobQuery, jobs]);

  function handleStartTimeChange(nextStartTime: string) {
    setStartTime(nextStartTime);
    if (endTimeManuallyEdited) return;
    const nextEnd = oneHourAfter(date, nextStartTime);
    if (!nextEnd) return;
    setEndDate(nextEnd.date);
    setEndTime(nextEnd.time);
  }

  function handleStartDateChange(nextDate: string) {
    const previousStart = date ? new Date(`${date}T12:00:00`) : null;
    const previousEnd = endDate ? new Date(`${endDate}T12:00:00`) : null;
    setDate(nextDate);

    if (appointmentType === "installation") {
      const daySpan = previousStart && previousEnd
        ? Math.max(0, Math.round((previousEnd.getTime() - previousStart.getTime()) / 86_400_000))
        : 0;
      const nextEnd = new Date(`${nextDate}T12:00:00`);
      if (!Number.isNaN(nextEnd.getTime())) {
        nextEnd.setDate(nextEnd.getDate() + daySpan);
        setEndDate(formatDateInput(nextEnd));
      }
      return;
    }

    setEndDate(nextDate);
    if (!endTimeManuallyEdited) {
      const nextEnd = oneHourAfter(nextDate, startTime);
      if (nextEnd) setEndTime(nextEnd.time);
    }
  }

  const selectableAppointmentTypes = appointment?.appointment_type &&
    !appointmentTypes.some((type) => type.key === appointment.appointment_type)
    ? [
        ...appointmentTypes,
        {
          key: appointment.appointment_type,
          name: formatAppointmentType(
            appointment.appointment_type,
            appointment.appointment_type_record?.name,
          ),
          active: false,
          sort_order: Number.MAX_SAFE_INTEGER,
        },
      ]
    : appointmentTypes;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage(null);

    if (!date || !endDate || (!allDay && (!startTime || !endTime))) {
      setErrorMessage(
        "Please select the appointment date and times.",
      );
      return;
    }

    const startsAt = createAppointmentDate(date, allDay ? "07:00" : startTime);
    const endsAt = createAppointmentDate(endDate, allDay ? "15:00" : endTime);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      setErrorMessage("The appointment date or time is invalid.");
      return;
    }

    if (endsAt <= startsAt) {
      setErrorMessage(
        "The ending time must be later than the starting time.",
      );
      return;
    }

    const appointmentValues = {
      title: jobId ? null : customTitle.trim() || null,
      appointment_type: appointmentType,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: appointment?.status ?? "scheduled",
      location: location.trim() || null,
      notes: notes.trim() || null,
      assigned_employee_id: appointmentType === "installation" ? null : assignedEmployeeId || null,
      installer_crew_id: appointmentType === "installation" ? installerCrewId || null : null,
      installation_scope: appointmentType === "installation" ? installationScope.trim() || null : null,
      job_id: jobId || null,
      all_day: allDay,
    };

    setIsSaving(true);

    try {
      if (appointment) {
        await updateAppointment(
          appointment.id,
          appointmentValues,
          updateScope,
        );
        if (["installation", "job_walk"].includes(appointmentType)) {
          await linkAppointmentsToMaterialScopes([appointment.id], materialScopeIds);
          if (appointmentType === "installation") {
            await updateLinkedProductionScopeDescription(materialScopeIds, installationScope);
          }
        }
      } else {
        const recurrenceValue = recurrence === "none" ? null : {
          frequency: recurrence === "biweekly" ? "weekly" as const : recurrence,
          interval: recurrence === "biweekly" ? 2 : 1,
          endsOn: recurrenceEndsOn,
        };
        if (recurrenceValue && !recurrenceEndsOn) throw new Error("Choose when the recurring appointment ends.");
        const created = await createAppointment({ ...appointmentValues, recurrence: recurrenceValue });
        if (["installation", "job_walk"].includes(appointmentType)) {
          await linkAppointmentsToMaterialScopes(created.map((item) => item.id), materialScopeIds);
          if (appointmentType === "installation") {
            await updateLinkedProductionScopeDescription(materialScopeIds, installationScope);
          }
        }
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(productionPipelineErrorMessage(error, "Unable to save the appointment."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="inset-x-0 top-0 left-0 h-screen h-[100dvh] max-h-screen max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 [&>[data-slot=dialog-close]]:top-[max(0.5rem,env(safe-area-inset-top))] sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[min(90dvh,52rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:[&>[data-slot=dialog-close]]:top-2">
        <form
          onSubmit={handleSubmit}
          className="flex h-full min-h-0 flex-col sm:max-h-[min(90dvh,52rem)]"
        >
          <DialogHeader className="shrink-0 border-b border-gray-200 px-4 pt-[max(1rem,env(safe-area-inset-top))] pr-12 pb-4 sm:px-4 sm:pt-4">
            <DialogTitle>
              {isEditing
                ? "Edit appointment"
                : "New appointment"}
            </DialogTitle>

            <DialogDescription>
              {isEditing
                ? "Update the appointment details."
                : "Add an appointment to the Foundation CRM calendar."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-5 [-webkit-overflow-scrolling:touch]"
            data-appointment-dialog-scroll
          >
            <div className="grid gap-5">
            <div className="grid gap-2">
              <label
                htmlFor="appointment-type"
                className="text-sm font-medium text-gray-900"
              >
                Appointment type
              </label>

              <select
                id="appointment-type"
                value={appointmentType}
                onChange={(event) =>
                  handleAppointmentTypeChange(event.target.value as AppointmentType)
                }
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200 sm:h-9 sm:text-sm"
              >
                {selectableAppointmentTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.name}
                    {!type.active ? " (Retired)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {jobs.length ? (
              <div className="grid gap-2">
                <label htmlFor="appointment-job" className="text-sm font-medium text-gray-900">
                  Customer / job
                </label>
                <div className="relative">
                  <button
                    id="appointment-job"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={jobPickerOpen}
                    onClick={() => setJobPickerOpen((current) => !current)}
                    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {selectedJob ? <BriefcaseBusiness className="h-4 w-4 shrink-0 text-[#3f6e8c]" /> : <CalendarPlus className="h-4 w-4 shrink-0 text-gray-500" />}
                      <span className="truncate">{selectedJob ? formatJobDisplayName({ customerName: selectedJob.customer?.full_name, jobName: selectedJob.customer_name, qfNumber: selectedJob.qfloors_job_number }) : "Not linked to a job"}</span>
                    </span>
                    <Search className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                  {jobPickerOpen ? <div className="absolute z-40 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    <div className="relative"><Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-gray-400" /><input autoFocus value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} placeholder="Search customer, job, QF#, contact, or address" className="w-full rounded-md border border-gray-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-gray-500" /></div>
                    <div className="mt-1 max-h-60 overflow-y-auto" role="listbox">
                      <button type="button" role="option" aria-selected={!jobId} onClick={() => selectJob("")} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-gray-50"><CalendarPlus className="h-4 w-4 text-gray-500" /><span className="flex-1"><span className="block text-sm font-medium text-gray-900">Not linked to a job</span><span className="block text-xs text-gray-500">Use the appointment name below</span></span>{!jobId ? <Check className="h-4 w-4 text-emerald-600" /> : null}</button>
                      <div className="my-1 border-t border-gray-100" />
                      {filteredJobs.map((job) => <button key={job.id} type="button" role="option" aria-selected={job.id === jobId} onClick={() => selectJob(job.id)} className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-gray-50"><BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-[#3f6e8c]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}</span><span className="block truncate text-xs text-gray-500">{[job.address, job.project_contact_name].filter(Boolean).join(" · ") || "No address provided"}</span></span>{job.id === jobId ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : null}</button>)}
                      {!filteredJobs.length ? <p className="px-3 py-5 text-center text-sm text-gray-500">No matching customer jobs.</p> : null}
                    </div>
                  </div> : null}
                </div>
                {!jobId ? (
                  <div className="grid gap-2">
                    <label htmlFor="appointment-name" className="text-sm font-medium text-gray-900">Appointment name</label>
                    <Input id="appointment-name" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Customer, company, meeting, or event name" />
                  </div>
                ) : null}
                {jobId ? (() => {
                  if (!selectedJob) return null;
                  return (
                    <dl className="grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-gray-500">Company Contact</dt>
                        <dd className="mt-0.5 font-semibold text-gray-900">
                          {formatContactName(selectedJob.company_contact)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Project / Job Contact</dt>
                        <dd className="mt-0.5 font-semibold text-gray-900">
                          {formatProjectContact(selectedJob)}
                        </dd>
                        {selectedJob.project_contact_description ? <dd className="mt-0.5 text-gray-500">{selectedJob.project_contact_description}</dd> : null}
                        {selectedJob.project_contact_phone || (!selectedJob.project_contact && (selectedJob.phone || selectedJob.email)) ? <dd className="mt-0.5 text-gray-500">{[selectedJob.project_contact_phone ?? selectedJob.phone, selectedJob.email].filter(Boolean).join(" · ")}</dd> : null}
                      </div>
                      {selectedJob.job_site_contact ? <div><dt className="font-medium text-gray-500">Job Site Contact</dt><dd className="mt-0.5 font-semibold text-gray-900">{formatContactName(selectedJob.job_site_contact)}</dd></div> : null}
                    </dl>
                  );
                })() : null}
              </div>
            ) : null}

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAllDay(checked);
                    if (checked) {
                      setStartTime("07:00");
                      setEndTime("15:00");
                      if (appointmentType !== "installation") setEndDate(date);
                    }
                  }}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">All Day</span>
                <span className="mt-0.5 block text-xs text-gray-500">Blocks the Foundation workday from 7:00 AM–3:00 PM.</span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="appointment-date"
                  className="text-sm font-medium text-gray-900"
                >
                  {appointmentType === "installation" ? "Start date" : "Date"}
                </label>

                <Input
                  id="appointment-date"
                  type="date"
                  value={date}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor={appointmentType === "installation" ? "appointment-installer-crew" : "appointment-date"}
                  className="text-sm font-medium text-gray-900"
                >
                  {appointmentType === "installation" ? "Install crew" : ""}
                </label>
                {appointmentType === "installation" ? (
                  <select
                    id="appointment-installer-crew"
                    value={installerCrewId}
                    onChange={(event) => setInstallerCrewId(event.target.value)}
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200 sm:h-9 sm:text-sm"
                  >
                    <option value="">Unassigned crew</option>
                    {installerCrews.map((crew) => (
                      <option key={crew.id} value={crew.id}>{crew.name}</option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>

            {["installation", "job_walk"].includes(appointmentType) ? (
              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-sm font-semibold text-gray-900">Production scopes</legend>
                <p className="mt-1 text-xs text-gray-500">Choose which production scopes this {appointmentType === "job_walk" ? "job walk" : "crew appointment"} completes.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {productionScopes.filter((scope) => scope.job_id === jobId).map((scope) => <label key={scope.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${materialScopeIds.includes(scope.id) ? "border-[#3f6e8c] bg-blue-50" : "border-gray-200"}`}><input type="checkbox" checked={materialScopeIds.includes(scope.id)} onChange={(event) => { const next = event.target.checked ? [...materialScopeIds, scope.id] : materialScopeIds.filter((id) => id !== scope.id); setMaterialScopeIds(next); if (appointmentType === "installation") { const labels = productionScopes.filter((item) => next.includes(item.id)).map((item) => item.label); setInstallationScope(labels.join(", ")); } }} /><span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3f6e8c] px-1 text-[10px] font-bold text-white">{scope.abbreviation}</span>{scope.label}</label>)}
                  {productionScopes.filter((scope) => scope.job_id === jobId).length === 0 ? <p className="text-xs text-gray-500">No production material scopes are available for this job.</p> : null}
                </div>
              </fieldset>
            ) : null}

            {appointmentType === "installation" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="appointment-end-date" className="text-sm font-medium text-gray-900">
                    End date
                  </label>
                  <Input
                    id="appointment-end-date"
                    type="date"
                    value={endDate}
                    min={date}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setEndTimeManuallyEdited(true);
                    }}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="appointment-installation-scope" className="text-sm font-medium text-gray-900">
                    Crew scope
                  </label>
                  <Input
                    id="appointment-installation-scope"
                    value={installationScope}
                    onChange={(event) => setInstallationScope(event.target.value)}
                    placeholder="Carpet, tile, bedrooms, phase 2..."
                  />
                </div>
              </div>
            ) : null}

            {!allDay ? <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="appointment-start-time"
                  className="text-sm font-medium text-gray-900"
                >
                  Start time
                </label>

                <Input
                  id="appointment-start-time"
                  type="time"
                  value={startTime}
                  onChange={(event) => handleStartTimeChange(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="appointment-end-time"
                  className="text-sm font-medium text-gray-900"
                >
                  End time
                </label>

                <Input
                  id="appointment-end-time"
                  type="time"
                  value={endTime}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    setEndTimeManuallyEdited(true);
                  }}
                  required
                />
              </div>
            </div> : null}

            {appointmentType !== "installation" ? <div className="grid gap-2">
              <label
                htmlFor="appointment-employee"
                className="text-sm font-medium text-gray-900"
              >
                Assigned employee
              </label>

              <select
                id="appointment-employee"
                value={assignedEmployeeId}
                onChange={(event) => setAssignedEmployeeId(event.target.value)}
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200 sm:h-9 sm:text-sm"
              >
                <option value="">Unassigned</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </div> : null}

            {!isEditing && appointmentType !== "installation" ? (
              <div className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-gray-900">
                  Repeat
                  <select
                    value={recurrence}
                    onChange={(event) => setRecurrence(event.target.value as typeof recurrence)}
                    className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                {recurrence !== "none" ? (
                  <label className="grid gap-2 text-sm font-medium text-gray-900">
                    Repeat through
                    <Input type="date" min={date} max={oneYearAfter(date)} value={recurrenceEndsOn} onChange={(event) => setRecurrenceEndsOn(event.target.value)} required />
                  </label>
                ) : null}
              </div>
            ) : null}

            {isEditing && appointment?.recurrence_series_id ? (
              <label className="grid gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-gray-900">
                Apply changes to
                <select value={updateScope} onChange={(event) => setUpdateScope(event.target.value as AppointmentUpdateScope)} className="h-10 rounded-md border border-blue-200 bg-white px-3 text-sm">
                  <option value="occurrence">This appointment</option>
                  <option value="future">This and future appointments</option>
                  <option value="series">Entire series</option>
                </select>
              </label>
            ) : null}

            {appointment && appointmentType !== "installation" ? (
              <section className="rounded-lg border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-900">Copy To</h3>
                <p className="mt-1 text-xs text-gray-500">Create an independent copy for another employee.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <select value={copyEmployeeId} onChange={(event) => setCopyEmployeeId(event.target.value)} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm">
                    <option value="">Select employee</option>
                    {employees.filter((employee) => employee.id !== appointment.assigned_employee_id).map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.name}</option>
                    ))}
                  </select>
                  {appointment.recurrence_series_id ? (
                    <select value={copyScope} onChange={(event) => setCopyScope(event.target.value as typeof copyScope)} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm">
                      <option value="occurrence">This only</option>
                      <option value="series">Entire series</option>
                    </select>
                  ) : null}
                  <Button type="button" variant="outline" disabled={!copyEmployeeId || isSaving} onClick={async () => {
                    if (!copyEmployeeId) return;
                    setIsSaving(true); setErrorMessage(null); setCopyMessage("");
                    try {
                      await copyAppointmentToEmployee(appointment.id, copyEmployeeId, copyScope);
                      const employee = employees.find((item) => item.id === copyEmployeeId);
                      setCopyMessage(`Copied to ${employee?.name ?? "employee"}.`);
                      setCopyEmployeeId("");
                      router.refresh();
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : "Unable to copy the appointment.");
                    } finally { setIsSaving(false); }
                  }}>Copy</Button>
                </div>
                {copyMessage ? <p className="mt-2 text-xs font-semibold text-green-700">{copyMessage}</p> : null}
              </section>
            ) : null}

            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-gray-900"
              >
                Location
              </label>

              {jobId ? (
                <div className="grid grid-cols-2 rounded-md bg-gray-100 p-1" role="group" aria-label="Appointment location source">
                  <button
                    type="button"
                    onClick={() => {
                      const selectedJob = jobs.find((job) => job.id === jobId);
                      setLocationMode("job");
                      setLocation(selectedJob?.address ?? "");
                    }}
                    className={`min-h-9 rounded px-2 text-xs font-semibold ${
                      locationMode === "job"
                        ? "bg-white text-gray-950 shadow-sm"
                        : "text-gray-600"
                    }`}
                  >
                    Use Job Address
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationMode("custom");
                      setLocation("");
                    }}
                    className={`min-h-9 rounded px-2 text-xs font-semibold ${
                      locationMode === "custom"
                        ? "bg-white text-gray-950 shadow-sm"
                        : "text-gray-600"
                    }`}
                  >
                    Custom Address
                  </button>
                </div>
              ) : null}

              <Input
                id="appointment-location"
                value={location}
                onChange={(event) =>
                  setLocation(event.target.value)
                }
                placeholder={
                  locationMode === "job"
                    ? "Job address is not available"
                    : "Vendor, showroom, or meeting address"
                }
              />
              <p className="text-xs text-gray-500">
                {locationMode === "job"
                  ? "Loaded from the job. Editing this changes only this appointment."
                  : "Saved only on this appointment; the job address will not change."}
              </p>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="appointment-notes"
                className="text-sm font-medium text-gray-900"
              >
                Notes
              </label>

              <textarea
                id="appointment-notes"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Add appointment notes..."
                rows={4}
                className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 sm:text-sm"
              />
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            ) : null}
            </div>
          </div>

          <DialogFooter className="m-0 shrink-0 rounded-none px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:m-0 sm:rounded-b-xl sm:p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : isEditing
                  ? "Save changes"
                  : "Save appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
