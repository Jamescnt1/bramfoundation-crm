"use client";

import { CalendarDays, PanelsTopLeft } from "lucide-react";

export type CalendarMode = "installs" | "appointments";

type Props = {
  value: CalendarMode;
  onChange: (value: CalendarMode) => void;
};

const tabs = [
  { value: "installs", label: "Install Schedule", icon: PanelsTopLeft },
  { value: "appointments", label: "Appointments", icon: CalendarDays },
] as const;

export default function CalendarModeTabs({ value, onChange }: Props) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-gray-100 px-2 pt-2"
      role="tablist"
      aria-label="Calendar sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-t-lg border px-4 py-2 text-sm font-semibold transition ${
              active
                ? "relative -mb-px border-gray-200 border-b-white bg-white text-gray-950"
                : "border-transparent text-gray-600 hover:bg-white/70 hover:text-gray-950"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
