"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, ClipboardList, Send } from "lucide-react";
import type { CalendarAppointment } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { setInstallationWorkOrderSentAction } from "@/app/leads/[id]/installations/actions";

type Props = {
  jobId: string;
  appointments: CalendarAppointment[];
  installationRequired: boolean;
  compact?: boolean;
  onSchedule: () => void;
  onOpenInstallations?: () => void;
};

export default function JobInstallationsPanel({
  jobId,
  appointments,
  installationRequired,
  compact = false,
  onSchedule,
  onOpenInstallations,
}: Props) {
  const router = useRouter();
  const installations = appointments
    .filter((appointment) =>
      appointment.appointment_type === "installation" &&
      appointment.status !== "cancelled",
    )
    .sort((first, second) =>
      new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime(),
    );
  const sentCount = installations.filter(
    (appointment) => appointment.work_order_status === "sent" ||
      appointment.work_order_status === "acknowledged",
  ).length;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setSent(appointment: CalendarAppointment, sent: boolean) {
    setBusyId(appointment.id);
    setError("");
    try {
      await setInstallationWorkOrderSentAction(appointment.id, jobId, sent);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the work order.");
    } finally {
      setBusyId(null);
    }
  }

  if (!installationRequired) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-900">No installation crews required</p>
        <p className="mt-1 text-xs text-gray-500">This job is marked as materials-only or customer-installed.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-gray-950">{sentCount}/{installations.length}</p>
            <p className="text-xs text-gray-500">crew work orders sent</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            installations.length > 0 && sentCount === installations.length
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}>
            {installations.length === 0
              ? "Crews needed"
              : sentCount === installations.length
                ? "All sent"
                : "Action needed"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
          <Button type="button" variant="outline" onClick={onOpenInstallations}>View installations</Button>
          <Button type="button" variant="outline" onClick={onSchedule}>Add crew</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-950">Crew assignments and work orders</h3>
          <p className="mt-1 text-sm text-gray-500">
            {sentCount} of {installations.length} work orders sent.
          </p>
        </div>
        <Button type="button" onClick={onSchedule}>Add installation crew</Button>
      </div>

      {error ? <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {installations.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {installations.map((appointment) => {
            const sent = appointment.work_order_status === "sent" ||
              appointment.work_order_status === "acknowledged";
            return (
              <article key={appointment.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-950">
                      {appointment.installer_crew?.name ?? "Unassigned crew"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {appointment.installation_scope ?? "Scope not entered"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    sent ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                  }`}>
                    {sent ? "Work order sent" : "Work order pending"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {formatRange(appointment.starts_at, appointment.ends_at)}
                  </p>
                  {appointment.work_order_sent_at ? (
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Sent {formatDateTime(appointment.work_order_sent_at)}
                      {appointment.work_order_sender?.name
                        ? ` by ${appointment.work_order_sender.name}`
                        : ""}
                    </p>
                  ) : (
                    <p className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Waiting to be sent
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant={sent ? "outline" : "default"}
                  className="mt-4"
                  disabled={busyId !== null}
                  onClick={() => void setSent(appointment, !sent)}
                >
                  <Send />
                  {busyId === appointment.id
                    ? "Saving..."
                    : sent
                      ? "Mark not sent"
                      : "Mark work order sent"}
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="font-medium text-gray-900">No installation crews scheduled</p>
          <p className="mt-1 text-sm text-gray-500">Add one appointment for each crew and flooring scope.</p>
        </div>
      )}
    </div>
  );
}

function formatRange(start: string, end: string | null) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startText = formatter.format(new Date(start));
  if (!end) return startText;
  const endText = formatter.format(new Date(end));
  return startText === endText ? startText : `${startText} – ${endText}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
