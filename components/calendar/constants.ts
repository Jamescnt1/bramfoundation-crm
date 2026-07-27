export const APPOINTMENT_TYPES = [
  "measure",
  "installation",
  "job_walk",
  "material_selection",
  "builder_meeting",
  "appointment",
  "follow_up",
  "other",
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
