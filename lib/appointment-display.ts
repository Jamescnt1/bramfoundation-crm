import type { AppointmentType } from "@/components/calendar/constants";

export type AppointmentDisplayValues = {
  appointmentType?: AppointmentType | null;
  customerName?: string | null;
  jobName?: string | null;
};

export function formatAppointmentType(
  type: AppointmentType | null | undefined,
): string {
  if (!type) return "Appointment";

  const labels: Record<AppointmentType, string> = {
    appointment: "Appointment",
    measure: "Measure",
    installation: "Installation",
    follow_up: "Follow-up",
    job_walk: "Job Walk",
    other: "Other",
  };

  return labels[type];
}

/**
 * The single appointment display convention used throughout the CRM.
 * Linked appointments use Customer - Job - Appointment Type. General
 * appointments fall back to General appointment - Appointment Type.
 */
export function formatAppointmentDisplayName({
  appointmentType,
  customerName,
  jobName,
}: AppointmentDisplayValues): string {
  const type = formatAppointmentType(appointmentType);
  const customer = customerName?.trim();
  const job = jobName?.trim();

  if (customer && job) return `${customer} - ${job} - ${type}`;
  if (job) return `${job} - ${type}`;
  if (customer) return `${customer} - ${type}`;
  return `General appointment - ${type}`;
}

