import type { AppointmentType } from "@/components/calendar/constants";

export type AppointmentDisplayValues = {
  appointmentType?: AppointmentType | null;
  appointmentTypeLabel?: string | null;
  customerName?: string | null;
  jobName?: string | null;
};

export function formatAppointmentType(
  type: AppointmentType | null | undefined,
  configuredLabel?: string | null,
): string {
  if (configuredLabel?.trim()) return configuredLabel.trim();
  if (!type) return "Appointment";

  const labels: Record<string, string> = {
    appointment: "Customer Meeting",
    measure: "Floor Measure",
    installation: "Install",
    follow_up: "Follow-up",
    job_walk: "Job Walk",
    material_selection: "Material Selection",
    builder_meeting: "Builder Meeting",
    customer_meeting: "Customer Meeting",
    other: "Other",
  };

  return labels[type] ?? type
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The single appointment display convention used throughout the CRM.
 * Linked appointments use Customer - Job - Appointment Type. General
 * appointments fall back to General appointment - Appointment Type.
 */
export function formatAppointmentDisplayName({
  appointmentType,
  appointmentTypeLabel,
  customerName,
  jobName,
}: AppointmentDisplayValues): string {
  const type = formatAppointmentType(appointmentType, appointmentTypeLabel);
  const customer = customerName?.trim();
  const job = jobName?.trim();

  if (customer && job) return `${customer} - ${job} - ${type}`;
  if (job) return `${job} - ${type}`;
  if (customer) return `${customer} - ${type}`;
  return `General appointment - ${type}`;
}
