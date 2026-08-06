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

export function dayBoundsInTimeZone(
  value: DateValue,
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  const dateKey = dateKeyInTimeZone(value, timeZone);
  const nextDateKey = addCalendarDays(dateKey, 1);
  return {
    dateKey,
    start: zonedMidnight(dateKey, timeZone),
    end: zonedMidnight(nextDateKey, timeZone),
  };
}

export function dateRangeBoundsInTimeZone(
  from: string,
  to: string,
  timeZone = DEFAULT_COMPANY_TIME_ZONE,
) {
  return {
    start: zonedMidnight(from, timeZone),
    endExclusive: zonedMidnight(addCalendarDays(to, 1), timeZone),
  };
}

function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function zonedMidnight(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let result = new Date(targetAsUtc);
  for (let index = 0; index < 2; index += 1) {
    result = new Date(targetAsUtc - timeZoneOffset(result, timeZone));
  }
  return result;
}

function timeZoneOffset(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  const represented = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return represented - Math.floor(value.getTime() / 1000) * 1000;
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
