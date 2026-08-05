"use client";

import Link from "next/link";
import AppointmentTooltip from "@/components/calendar/AppointmentTooltip";
import {
  AppointmentTypeIcon,
  FALLBACK_INSTALLER_COLOR,
  getReadableTextColor,
  normalizeCalendarColor,
} from "@/components/calendar/appointment-appearance";
import type { CalendarAppointment } from "@/components/calendar/types";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";
import { dateKeyInTimeZone, formatAppointmentDateTime } from "@/lib/date-time";

export default function DashboardScheduleList({
  appointments,
  timeZone,
  installations = false,
}: {
  appointments: CalendarAppointment[];
  timeZone: string;
  installations?: boolean;
}) {
  if (!appointments.length) {
    return (
      <p className="py-6 text-sm text-gray-500">
        {installations
          ? "No current or upcoming installations in the next 14 days."
          : "No appointments assigned in the next 14 days."}
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {appointments.slice(0, 8).map((appointment) => {
        const displayName = formatAppointmentDisplayName({
          title: appointment.title,
          appointmentType: appointment.appointment_type,
          appointmentTypeLabel: appointment.appointment_type_record?.name,
          customerName: appointment.job?.customer?.full_name,
          jobName: appointment.job?.customer_name,
        });
        const crewColor = normalizeCalendarColor(
          appointment.installer_crew?.color,
          FALLBACK_INSTALLER_COLOR,
        );
        const crewTextColor = getReadableTextColor(crewColor);

        return (
          <AppointmentTooltip
            key={appointment.id}
            appointment={appointment}
            displayName={displayName}
          >
            <Link
              href={`/calendar?appointment=${appointment.id}&date=${dateKeyInTimeZone(appointment.starts_at, timeZone)}${installations ? "&tab=installs" : ""}`}
              className="group block py-2.5 transition hover:bg-gray-50"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/10"
                  style={installations
                    ? { backgroundColor: crewColor, color: crewTextColor }
                    : undefined}
                >
                  <AppointmentTypeIcon
                    type={appointment.appointment_type}
                    className={`h-4 w-4 ${installations ? "" : "text-slate-600"}`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {displayName}
                    </span>
                    <time className="max-w-28 shrink-0 text-right text-[11px] leading-4 font-medium text-gray-600">
                      {formatAppointmentDateTime(appointment.starts_at, timeZone)}
                    </time>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {installations
                      ? `${appointment.installer_crew?.name ?? "Unassigned crew"}${appointment.installation_scope ? ` · ${appointment.installation_scope}` : ""}`
                      : appointment.location ?? "No location"}
                  </span>
                </span>
              </div>
            </Link>
          </AppointmentTooltip>
        );
      })}
    </div>
  );
}
