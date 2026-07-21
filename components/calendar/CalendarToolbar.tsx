import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { CalendarView } from "@/components/calendar/types";

type CalendarToolbarProps = {
  heading: string;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewAppointment: () => void;
  onScheduleMeasure: () => void;
  onScheduleInstallation: () => void;
};

export default function CalendarToolbar({
  heading,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onNewAppointment,
  onScheduleMeasure,
  onScheduleInstallation,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-gray-200 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToday}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Today
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <h2 className="ml-1 text-xl font-semibold text-gray-900">
          {heading}
        </h2>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
          {([
            ["month", "Month"],
            ["week", "Week"],
            ["three_day", "3 Day"],
            ["day", "Day"],
            ["list", "List"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewChange(value)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button type="button" onClick={onScheduleMeasure} className="whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100">
          Schedule Measure
        </button>
        <button type="button" onClick={onScheduleInstallation} className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
          Schedule Install
        </button>

        <button
          type="button"
          onClick={onNewAppointment}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          New Appointment
        </button>
      </div>
    </div>
  );
}
