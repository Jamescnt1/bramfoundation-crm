export type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDatePreset(preset: DatePreset, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);

  if (preset === "this_week" || preset === "last_week") {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset - (preset === "last_week" ? 7 : 0));
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 6);
  } else if (preset === "this_month") {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
  } else if (preset === "last_month") {
    from.setMonth(from.getMonth() - 1, 1);
    to.setDate(0);
  } else if (preset === "this_quarter") {
    const firstMonth = Math.floor(from.getMonth() / 3) * 3;
    from.setMonth(firstMonth, 1);
    to.setMonth(firstMonth + 3, 0);
  } else {
    from.setMonth(0, 1);
    to.setMonth(11, 31);
  }

  return { from: localDateKey(from), to: localDateKey(to) };
}

export function parseReportDateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Choose a valid report date range.");
  }
  const maximumDays = 366 * 5;
  if ((end.getTime() - start.getTime()) / 86_400_000 > maximumDays) {
    throw new Error("Report date ranges cannot exceed five years.");
  }
  return {
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
    label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  };
}

