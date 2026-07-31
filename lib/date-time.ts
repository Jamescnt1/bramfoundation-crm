export const DEFAULT_COMPANY_TIME_ZONE = "America/Phoenix";

type DateValue = string | number | Date;

function asDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {},
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  }).format(asDate(value));
}

export function formatAppointmentDateTime(
  value: DateValue,
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  return formatDateTime(
    value,
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
    timeZone,
  );
}

export function formatAppointmentTime(
  value: DateValue,
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  return formatDateTime(value, { hour: "numeric", minute: "2-digit" }, timeZone);
}

export function dateKeyInTimeZone(
  value: DateValue,
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asDate(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatTaskDue(
  dueAt: string | null,
  dueDate: string | null,
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  if (dueAt) return formatAppointmentDateTime(dueAt, timeZone);
  if (dueDate) {
    const [year, month, day] = dueDate.split("-").map(Number);
    return formatDateTime(
      new Date(Date.UTC(year, month - 1, day, 12)),
      { month: "short", day: "numeric" },
      "UTC",
    );
  }
  return "No due date";
}
