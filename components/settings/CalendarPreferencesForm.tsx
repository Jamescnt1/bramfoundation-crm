"use client";

import { useState } from "react";
import { updateCalendarPreferencesAction } from "@/app/settings/calendar/actions";
import type { CalendarView } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";

type PreferredView = Exclude<CalendarView, "list">;

const views: Array<{ value: PreferredView; label: string; description: string }> = [
  { value: "month", label: "Month", description: "A broad scheduling overview." },
  { value: "week", label: "Week", description: "Seven days aligned to a time ruler." },
  { value: "three_day", label: "3 Day", description: "More detail with short-range planning." },
  { value: "day", label: "Day", description: "A focused daily schedule." },
];

export default function CalendarPreferencesForm({
  initialDefaultView,
  initialRememberLastView,
}: {
  initialDefaultView: PreferredView;
  initialRememberLastView: boolean;
}) {
  const [defaultView, setDefaultView] = useState(initialDefaultView);
  const [rememberLastView, setRememberLastView] = useState(initialRememberLastView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateCalendarPreferencesAction({ defaultView, rememberLastView });
      setMessage("Calendar preferences saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save calendar preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">My calendar view</h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose how the Appointments tab opens for your employee account.
      </p>

      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Default calendar view</legend>
        {views.map((view) => (
          <label
            key={view.value}
            className={`cursor-pointer rounded-lg border p-4 ${
              defaultView === view.value
                ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                : "border-gray-200"
            }`}
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="default-calendar-view"
                value={view.value}
                checked={defaultView === view.value}
                onChange={() => setDefaultView(view.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{view.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{view.description}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-5 flex items-start gap-3 rounded-lg border border-gray-200 p-4">
        <input
          type="checkbox"
          checked={rememberLastView}
          onChange={(event) => setRememberLastView(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-sm font-semibold text-gray-900">
            Remember last calendar view
          </span>
          <span className="mt-1 block text-xs text-gray-500">
            When enabled, the last Month, Week, 3 Day, or Day view you used opens instead of the default.
          </span>
        </span>
      </label>

      {message ? <p role="status" className="mt-4 text-sm text-green-700">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
