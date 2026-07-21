export const APPOINTMENT_TYPES = [
  "appointment",
  "measure",
  "installation",
  "follow_up",
] as const;

export type AppointmentType =
  (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type AppointmentStatus =
  (typeof APPOINTMENT_STATUSES)[number];