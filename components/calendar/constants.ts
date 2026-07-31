export type AppointmentType = string;

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type AppointmentStatus =
  (typeof APPOINTMENT_STATUSES)[number];
