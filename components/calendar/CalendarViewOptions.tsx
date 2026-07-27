"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentStatus,
  type AppointmentType,
} from "@/components/calendar/constants";
import {
  AppointmentTypeIcon,
  normalizeCalendarColor,
} from "@/components/calendar/appointment-appearance";
import type { CalendarView } from "@/components/calendar/types";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import { formatAppointmentType } from "@/lib/appointment-display";
import { formatJobDisplayName } from "@/lib/job-display";

export type CalendarFilterValues = {
  employeeIds: string[];
  appointmentTypes: AppointmentType[];
  status: "" | AppointmentStatus;
  customerId: string;
  jobId: string;
};

export type CalendarViewOptionsValue = {
  filters: CalendarFilterValues;
  view: CalendarView;
  defaultView: Exclude<CalendarView, "list">;
  rememberLastView: boolean;
};

type Props = {
  open: boolean;
  value: CalendarViewOptionsValue;
  employees: Employee[];
  jobs: Job[];
  onOpenChange: (open: boolean) => void;
  onApply: (value: CalendarViewOptionsValue) => Promise<void>;
};

const appointmentViews: Array<{ value: CalendarView; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "three_day", label: "3 Day" },
  { value: "day", label: "Day" },
  { value: "list", label: "List" },
];

const defaultViews = appointmentViews.filter(
  (item): item is { value: Exclude<CalendarView, "list">; label: string } =>
    item.value !== "list",
);

const availableAppointmentTypes = APPOINTMENT_TYPES.filter(
  (type) => type !== "installation",
);

const formatStatus = (value: string) =>
  value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

export function createEmptyCalendarFilters(): CalendarFilterValues {
  return {
    employeeIds: [],
    appointmentTypes: [],
    status: "",
    customerId: "",
    jobId: "",
  };
}

export default function CalendarViewOptions({
  open,
  value,
  employees,
  jobs,
  onOpenChange,
  onApply,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const customers = Array.from(
    new Map(
      jobs
        .filter((job) => job.customer_id)
        .map((job) => [
          job.customer_id,
          job.customer?.full_name ?? "Customer unavailable",
        ]),
    ).entries(),
  );
  const availableJobs = draft.filters.customerId
    ? jobs.filter((job) => job.customer_id === draft.filters.customerId)
    : jobs;

  function setFilters(patch: Partial<CalendarFilterValues>) {
    setDraft((current) => ({
      ...current,
      filters: { ...current.filters, ...patch },
    }));
  }

  function toggleEmployee(employeeId: string) {
    setFilters({
      employeeIds: draft.filters.employeeIds.includes(employeeId)
        ? draft.filters.employeeIds.filter((id) => id !== employeeId)
        : [...draft.filters.employeeIds, employeeId],
    });
  }

  function toggleAppointmentType(type: AppointmentType) {
    setFilters({
      appointmentTypes: draft.filters.appointmentTypes.includes(type)
        ? draft.filters.appointmentTypes.filter((item) => item !== type)
        : [...draft.filters.appointmentTypes, type],
    });
  }

  async function apply() {
    setSaving(true);
    setError("");
    try {
      await onApply(draft);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save view options.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const resetValue = {
      ...draft,
      filters: createEmptyCalendarFilters(),
    };
    setDraft(resetValue);
    setSaving(true);
    setError("");
    try {
      await onApply(resetValue);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset view options.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-x-0 top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-2xl p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(86dvh,48rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-gray-200 px-5 py-4 pr-12">
          <DialogTitle>View Options</DialogTitle>
          <DialogDescription>
            Choose what appears on your appointment calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-6">
            <fieldset>
              <legend className="text-sm font-semibold text-gray-900">Calendar view</legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {appointmentViews.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, view: item.value }))}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      draft.view === item.value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <div className="flex items-center justify-between gap-3">
                <legend className="text-sm font-semibold text-gray-900">Employees</legend>
                <button
                  type="button"
                  onClick={() => setFilters({ employeeIds: [] })}
                  className="text-xs font-semibold text-gray-600 hover:text-black"
                >
                  All Employees
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {employees.map((employee) => {
                  const checked = draft.filters.employeeIds.includes(employee.id);
                  return (
                    <label
                      key={employee.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmployee(employee.id)}
                      />
                      <span
                        className="h-3 w-3 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: normalizeCalendarColor(employee.color) }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                        {employee.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              {draft.filters.employeeIds.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">All permitted employees are shown.</p>
              ) : null}
            </fieldset>

            <fieldset>
              <div className="flex items-center justify-between gap-3">
                <legend className="text-sm font-semibold text-gray-900">
                  Appointment Types
                </legend>
                <button
                  type="button"
                  onClick={() => setFilters({ appointmentTypes: [] })}
                  className="text-xs font-semibold text-gray-600 hover:text-black"
                >
                  All Appointment Types
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {availableAppointmentTypes.map((type) => {
                  const checked = draft.filters.appointmentTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAppointmentType(type)}
                      />
                      <AppointmentTypeIcon type={type} className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-800">
                        {formatAppointmentType(type)}
                      </span>
                    </label>
                  );
                })}
              </div>
              {draft.filters.appointmentTypes.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">
                  All appointment types are shown.
                </p>
              ) : null}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
                <select
                  value={draft.filters.status}
                  onChange={(event) =>
                    setFilters({ status: event.target.value as CalendarFilterValues["status"] })
                  }
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-gray-800"
                >
                  <option value="">All statuses</option>
                  {APPOINTMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Customer
                <select
                  value={draft.filters.customerId}
                  onChange={(event) =>
                    setFilters({ customerId: event.target.value, jobId: "" })
                  }
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-gray-800"
                >
                  <option value="">All customers</option>
                  {customers.map(([id, name]) => (
                    <option key={id} value={id ?? ""}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Job
                <select
                  value={draft.filters.jobId}
                  onChange={(event) => setFilters({ jobId: event.target.value })}
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-gray-800"
                >
                  <option value="">All jobs</option>
                  {availableJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatJobDisplayName({
                        customerName: job.customer?.full_name,
                        jobName: job.customer_name,
                        qfNumber: job.qfloors_job_number,
                      })}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Opening preference</h3>
              <label className="mt-3 grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Default Calendar View
                <select
                  value={draft.defaultView}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      defaultView: event.target.value as CalendarViewOptionsValue["defaultView"],
                    }))
                  }
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-gray-800"
                >
                  {defaultViews.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.rememberLastView}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      rememberLastView: event.target.checked,
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    Remember Last View
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Reopen the last Month, Week, 3 Day, or Day view you used.
                  </span>
                </span>
              </label>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900">Color & icon legend</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {employees.map((employee) => (
                  <span
                    key={employee.id}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: normalizeCalendarColor(employee.color) }}
                    />
                    {employee.name}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableAppointmentTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700"
                  >
                    <AppointmentTypeIcon type={type} className="h-3.5 w-3.5" />
                    {formatAppointmentType(type)}
                  </span>
                ))}
              </div>
            </section>

            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button type="button" onClick={apply} disabled={saving}>
            {saving ? "Applying…" : "Apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
