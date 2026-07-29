"use server";

import { revalidatePath } from "next/cache";
import type { CalendarView } from "@/components/calendar/types";
import { requireEmployee } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export type PreferredCalendarView = Exclude<CalendarView, "list">;

const preferenceViews: PreferredCalendarView[] = [
  "month",
  "week",
  "three_day",
  "day",
];

function validateView(value: string): PreferredCalendarView {
  if (!preferenceViews.includes(value as PreferredCalendarView)) {
    throw new Error("Select a valid calendar view.");
  }
  return value as PreferredCalendarView;
}

export async function updateCalendarPreferencesAction(input: {
  defaultView: string;
  rememberLastView: boolean;
}) {
  const employee = await requireEmployee();
  const admin = createAdminClient();
  const { error } = await admin
    .from("employees")
    .update({
      default_calendar_view: validateView(input.defaultView),
      remember_last_calendar_view: Boolean(input.rememberLastView),
    })
    .eq("id", employee.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
  revalidatePath("/settings/calendar");
}

export async function rememberCalendarViewAction(view: string) {
  const employee = await requireEmployee();
  if (!employee.remember_last_calendar_view) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("employees")
    .update({ last_calendar_view: validateView(view) })
    .eq("id", employee.id);

  if (error) throw new Error(error.message);
}
