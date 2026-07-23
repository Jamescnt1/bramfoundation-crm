"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { CalendarAppointment } from "@/components/calendar/types";
import {
  formatAppointmentDisplayName,
  formatAppointmentType,
} from "@/lib/appointment-display";

type AppointmentTooltipProps = {
  appointment: CalendarAppointment;
  children: ReactNode;
};

type TooltipPosition = {
  left: number;
  top: number;
  width: number;
};

const VIEWPORT_GAP = 12;
const TOOLTIP_WIDTH = 320;
const OPEN_DELAY_MS = 120;

function formatLabel(value: string | null, fallback: string) {
  if (!value) return fallback;

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateRange(appointment: CalendarAppointment) {
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at ?? appointment.starts_at);
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const sameDate =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  return sameDate
    ? formatter.format(start)
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

export default function AppointmentTooltip({
  appointment,
  children,
}: AppointmentTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  function clearOpenTimer() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }

  function showWithDelay() {
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }

  function hide() {
    clearOpenTimer();
    setOpen(false);
    setPosition(null);
  }

  function handlePointerEnter(event: ReactPointerEvent<HTMLSpanElement>) {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      showWithDelay();
    }
  }

  useEffect(() => clearOpenTimer, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
      let left = rect.right + 8;

      if (left + width > window.innerWidth - VIEWPORT_GAP) {
        left = rect.left - width - 8;
      }

      left = Math.max(
        VIEWPORT_GAP,
        Math.min(left, window.innerWidth - width - VIEWPORT_GAP),
      );

      const estimatedHeight = 260;
      let top = rect.top;
      if (top + estimatedHeight > window.innerHeight - VIEWPORT_GAP) {
        top = Math.max(VIEWPORT_GAP, window.innerHeight - estimatedHeight - VIEWPORT_GAP);
      }

      setPosition({ left, top, width });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearOpenTimer();
        setOpen(false);
        setPosition(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const displayName = formatAppointmentDisplayName({
    appointmentType: appointment.appointment_type,
    customerName: appointment.job?.customer?.full_name,
    jobName: appointment.job?.customer_name,
  });

  return (
    <span
      ref={triggerRef}
      className="block w-full"
      aria-describedby={open ? tooltipId : undefined}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={hide}
      onFocus={showWithDelay}
      onBlur={hide}
    >
      {children}

      {open && position
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              style={position}
              className="pointer-events-none fixed z-[100] rounded-xl border border-gray-200 bg-white p-4 text-left text-sm text-gray-700 shadow-xl"
            >
              <p className="font-semibold text-gray-950">
                {displayName}
              </p>

              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                <dt className="font-medium text-gray-500">Customer</dt>
                <dd className="break-words text-gray-900">
                  {appointment.job?.customer?.full_name || "Not linked"}
                </dd>

                <dt className="font-medium text-gray-500">Job</dt>
                <dd className="break-words text-gray-900">
                  {appointment.job?.customer_name || "Not linked"}
                </dd>

                <dt className="font-medium text-gray-500">QF#</dt>
                <dd className="text-gray-900">
                  {appointment.job?.qfloors_job_number || "Not assigned"}
                </dd>

                <dt className="font-medium text-gray-500">Dates</dt>
                <dd className="text-gray-900">
                  {formatDateRange(appointment)}
                </dd>

                <dt className="font-medium text-gray-500">Time</dt>
                <dd className="text-gray-900">
                  {formatTime(appointment.starts_at)}
                  {appointment.ends_at
                    ? ` – ${formatTime(appointment.ends_at)}`
                    : ""}
                </dd>

                <dt className="font-medium text-gray-500">Assigned</dt>
                <dd className="text-gray-900">
                  {appointment.appointment_type === "installation"
                    ? appointment.installer_crew?.name || "Unassigned crew"
                    : appointment.assigned_employee?.name || "Unassigned"}
                </dd>

                {appointment.location ? (
                  <>
                    <dt className="font-medium text-gray-500">Location</dt>
                    <dd className="break-words text-gray-900">
                      {appointment.location}
                    </dd>
                  </>
                ) : null}

                <dt className="font-medium text-gray-500">Type</dt>
                <dd className="text-gray-900">
                  {formatAppointmentType(appointment.appointment_type)}
                </dd>

                <dt className="font-medium text-gray-500">Status</dt>
                <dd className="text-gray-900">
                  {formatLabel(appointment.status, "Scheduled")}
                </dd>
              </dl>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
