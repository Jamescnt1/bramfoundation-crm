import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
} from "lucide-react";

type CalendarToolbarProps = {
  heading: string;
  activeFilterCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewOptions: () => void;
  onNewAppointment: () => void;
};

export default function CalendarToolbar({
  heading,
  activeFilterCount,
  onPrevious,
  onNext,
  onToday,
  onViewOptions,
  onNewAppointment,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-gray-200 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 sm:h-10 sm:w-10"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToday}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 sm:px-4 sm:text-sm"
        >
          Today
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 sm:h-10 sm:w-10"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <h2 className="ml-1 text-base font-semibold text-gray-900 sm:text-xl">
          {heading}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onViewOptions}
          className="relative inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">View Options</span>
          <span className="sm:hidden">View</span>
          {activeFilterCount > 0 ? (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[10px] font-bold text-white"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onNewAppointment}
          className="foundation-primary-action h-9 w-fit gap-2 px-4 text-sm"
        >
          <Plus className="h-4 w-4" />
          Appointment
        </button>
      </div>
    </div>
  );
}
