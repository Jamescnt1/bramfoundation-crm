import { Download, Printer, RotateCcw } from "lucide-react";
import { DATE_PRESETS, type DatePreset } from "@/lib/reports/date-range";
import type {
  ReportDefinition,
  ReportFilterKey,
  ReportFilterOptions,
  ReportFilters,
} from "@/lib/reports/types";

type Props = {
  definition: ReportDefinition;
  filters: ReportFilters;
  preset: DatePreset;
  options: ReportFilterOptions;
  loading: boolean;
  hasResult: boolean;
  onPresetChange: (preset: DatePreset) => void;
  onFilterChange: (key: keyof ReportFilters, value: string) => void;
  onRun: () => void;
  onReset: () => void;
  onExport: () => void;
  onPrint: () => void;
};

export default function ReportToolbar({
  definition,
  filters,
  preset,
  options,
  loading,
  hasResult,
  onPresetChange,
  onFilterChange,
  onRun,
  onReset,
  onExport,
  onPrint,
}: Props) {
  return (
    <section className="print:hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Field label="Date range">
            <select
              value={preset}
              onChange={(event) => onPresetChange(event.target.value as DatePreset)}
              className={inputClass}
            >
              {DATE_PRESETS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="From">
            <input
              type="date"
              value={filters.from}
              onChange={(event) => onFilterChange("from", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="To">
            <input
              type="date"
              value={filters.to}
              onChange={(event) => onFilterChange("to", event.target.value)}
              className={inputClass}
            />
          </Field>

          {definition.filters.map((filter) => (
            <FilterSelect
              key={filter}
              filter={filter}
              value={filters[filter] ?? ""}
              options={options}
              onChange={(value) => onFilterChange(filter, value)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onReset} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!hasResult} onClick={onExport} className={secondaryButton}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" disabled={!hasResult} onClick={onPrint} className={secondaryButton}>
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button type="button" disabled={loading} onClick={onRun} className="foundation-primary-action px-5 py-2.5 text-sm">
              {loading ? "Running…" : "Run Report"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  filter,
  value,
  options,
  onChange,
}: {
  filter: ReportFilterKey;
  value: string;
  options: ReportFilterOptions;
  onChange: (value: string) => void;
}) {
  const config = {
    employeeId: ["Employee", options.employees],
    salesperson: ["Salesperson", options.salespeople],
    pipelineStage: ["Pipeline stage", options.pipelineStages],
    leadSource: ["Lead source", options.leadSources],
    customerId: ["Customer", options.customers],
    status: ["Status", options.statuses],
  }[filter] as [string, Array<{ value: string; label: string }>];
  return (
    <Field label={config[0]}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">All</option>
        {config[1].map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-black";
const secondaryButton = "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40";
