"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APPOINTMENT_TYPES,
  type AppointmentType,
} from "@/components/calendar/constants";
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
  createAppointment,
  updateAppointment,
} from "@/lib/services/appointments";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import { formatJobDisplayName } from "@/lib/job-display";

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
};

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

function formatOptionLabel(value: string) {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
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
  defaultAppointmentType = "measure",
}: AppointmentDialogProps) {
  const router = useRouter();
  const isEditing = Boolean(appointment);

  const [appointmentType, setAppointmentType] =
    useState<AppointmentType>("measure");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [installerCrewId, setInstallerCrewId] = useState("");
  const [jobId, setJobId] = useState("");

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
      setNotes(appointment.notes ?? "");
      setAssignedEmployeeId(appointment.assigned_employee_id ?? "");
      setInstallerCrewId(appointment.installer_crew_id ?? "");
      setJobId(appointment.job_id ?? "");
    } else {
      setAppointmentType(defaultAppointmentType);
      setDate(formatDateInput(defaultDate ?? new Date()));
      setEndDate(formatDateInput(defaultDate ?? new Date()));
      setStartTime("09:00");
      setEndTime("10:00");
      setLocation("");
      setNotes("");
      setAssignedEmployeeId("");
      setInstallerCrewId("");
      setJobId(defaultJobId ?? "");
    }

    setErrorMessage(null);
  }, [open, appointment, defaultDate, defaultJobId, defaultAppointmentType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) {
      return;
    }

    onOpenChange(nextOpen);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage(null);

    if (!date || !startTime || !endTime || (appointmentType === "installation" && !endDate)) {
      setErrorMessage(
        "Please select the appointment date and times.",
      );
      return;
    }

    const startsAt = createAppointmentDate(date, startTime);
    const endsAt = createAppointmentDate(
      appointmentType === "installation" ? endDate : date,
      endTime,
    );

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
      appointment_type: appointmentType,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: appointment?.status ?? "scheduled",
      location: location.trim() || null,
      notes: notes.trim() || null,
      assigned_employee_id: appointmentType === "installation" ? null : assignedEmployeeId || null,
      installer_crew_id: appointmentType === "installation" ? installerCrewId || null : null,
      job_id: jobId || null,
    };

    setIsSaving(true);

    try {
      if (appointment) {
        await updateAppointment(
          appointment.id,
          appointmentValues,
        );
      } else {
        await createAppointment({
          ...appointmentValues,
        });
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the appointment.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
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

          <div className="grid gap-5 py-6">
            {jobs.length ? (
              <div className="grid gap-2">
                <label htmlFor="appointment-job" className="text-sm font-medium text-gray-900">
                  Customer / job
                </label>
                <select
                  id="appointment-job"
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                >
                  <option value="">General appointment</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
                  setAppointmentType(
                    event.target.value as AppointmentType,
                  )
                }
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
              >
                {APPOINTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatOptionLabel(type)}
                  </option>
                ))}
              </select>
            </div>

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
                  onChange={(event) =>
                    setDate(event.target.value)
                  }
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
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="">Unassigned crew</option>
                    {installerCrews.map((crew) => (
                      <option key={crew.id} value={crew.id}>{crew.name}</option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>

            {appointmentType === "installation" ? (
              <div className="grid gap-2">
                <label htmlFor="appointment-end-date" className="text-sm font-medium text-gray-900">
                  End date
                </label>
                <Input
                  id="appointment-end-date"
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
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
                  onChange={(event) =>
                    setStartTime(event.target.value)
                  }
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
                  onChange={(event) =>
                    setEndTime(event.target.value)
                  }
                  required
                />
              </div>
            </div>

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
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
              >
                <option value="">Unassigned</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </div> : null}

            <div className="grid gap-2">
              <label
                htmlFor="appointment-location"
                className="text-sm font-medium text-gray-900"
              >
                Location
              </label>

              <Input
                id="appointment-location"
                value={location}
                onChange={(event) =>
                  setLocation(event.target.value)
                }
                placeholder="123 Main Street"
              />
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
                className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
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

          <DialogFooter>
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
