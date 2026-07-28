"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronRight, Star } from "lucide-react";
import ReportResultView from "@/components/reports/ReportResultView";
import ReportToolbar from "@/components/reports/ReportToolbar";
import { setReportFavoriteAction } from "@/app/reports/actions";
import { resolveDatePreset, type DatePreset } from "@/lib/reports/date-range";
import type {
  ReportCategory,
  ReportDefinition,
  ReportFilterOptions,
  ReportFilters,
  ReportResult,
} from "@/lib/reports/types";

type Props = {
  categories: Array<{ id: ReportCategory; label: string; description: string }>;
  definitions: ReportDefinition[];
  filterOptions: ReportFilterOptions;
  initialFavoriteReportIds: string[];
};

const defaultRange = resolveDatePreset("this_month");

export default function ReportsCenter({
  categories,
  definitions,
  filterOptions,
  initialFavoriteReportIds,
}: Props) {
  const [category, setCategory] = useState<ReportCategory>("executive");
  const [activeReportId, setActiveReportId] = useState("");
  const [favorites, setFavorites] = useState(new Set(initialFavoriteReportIds));
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [filters, setFilters] = useState<ReportFilters>(defaultRange);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeDefinition = definitions.find((item) => item.id === activeReportId) ?? null;
  const categoryReports = definitions.filter((item) => item.category === category);
  const favoriteDefinitions = useMemo(
    () => definitions.filter((item) => favorites.has(item.id)),
    [definitions, favorites],
  );

  function chooseReport(report: ReportDefinition) {
    setCategory(report.category);
    setActiveReportId(report.id);
    setResult(null);
    setError("");
    requestAnimationFrame(() => document.getElementById("active-report")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function runActiveReport() {
    if (!activeDefinition) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ reportId: activeDefinition.id, from: filters.from, to: filters.to });
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "from" && key !== "to" && value) params.set(key, value);
    }
    try {
      const response = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json() as ReportResult | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Unable to run report.");
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run report.");
    } finally {
      setLoading(false);
    }
  }

  function changePreset(nextPreset: DatePreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") setFilters((current) => ({ ...current, ...resolveDatePreset(nextPreset) }));
  }

  function changeFilter(key: keyof ReportFilters, value: string) {
    if (key === "from" || key === "to") setPreset("custom");
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function resetFilters() {
    setPreset("this_month");
    setFilters(defaultRange);
    setResult(null);
  }

  async function toggleFavorite(reportId: string) {
    const next = !favorites.has(reportId);
    setFavorites((current) => {
      const updated = new Set(current);
      if (next) updated.add(reportId); else updated.delete(reportId);
      return updated;
    });
    try {
      await setReportFavoriteAction(reportId, next);
    } catch {
      setFavorites((current) => {
        const updated = new Set(current);
        if (next) updated.delete(reportId); else updated.add(reportId);
        return updated;
      });
    }
  }

  function exportCsv() {
    if (!result) return;
    const values = [
      result.columns.map((column) => column.label),
      ...result.rows.map((row) => result.columns.map((column) => row[column.key] ?? "")),
    ];
    const csv = values.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.id}-${filters.from}-to-${filters.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-7 space-y-6">
      {favoriteDefinitions.length ? (
        <section className="print:hidden">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Favorite reports</h2>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {favoriteDefinitions.map((report) => (
              <button key={report.id} type="button" onClick={() => chooseReport(report)} className="min-w-64 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-gray-400">
                <p className="font-semibold text-gray-950">{report.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{report.question}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="print:hidden grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="h-fit overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm lg:sticky lg:top-4">
          <div className="flex min-w-max gap-1 lg:block lg:min-w-0">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                  category === item.id ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={`mt-0.5 hidden text-xs lg:block ${category === item.id ? "text-gray-300" : "text-gray-500"}`}>{item.description}</span>
              </button>
            ))}
          </div>
        </nav>

        <section>
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-gray-950">{categories.find((item) => item.id === category)?.label}</h2>
            <p className="mt-1 text-sm text-gray-500">{categories.find((item) => item.id === category)?.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {categoryReports.map((report) => (
              <article key={report.id} className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-400">
                <button
                  type="button"
                  onClick={() => void toggleFavorite(report.id)}
                  className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-amber-500"
                  aria-label={favorites.has(report.id) ? `Remove ${report.name} from favorites` : `Favorite ${report.name}`}
                >
                  <Star className={`h-4 w-4 ${favorites.has(report.id) ? "fill-amber-400 text-amber-500" : ""}`} />
                </button>
                <button type="button" onClick={() => chooseReport(report)} className="w-full pr-8 text-left">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-gray-100 p-2 text-gray-700"><BarChart3 className="h-4 w-4" /></span>
                    {report.availability === "limited" ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Current data</span> : null}
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-950">{report.name}</h3>
                  <p className="mt-1 text-sm leading-5 text-gray-600">{report.description}</p>
                  <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gray-900">Open report <ChevronRight className="h-4 w-4" /></p>
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      {activeDefinition ? (
        <section id="active-report" className="scroll-mt-4 space-y-5">
          <ReportToolbar
            definition={activeDefinition}
            filters={filters}
            preset={preset}
            options={filterOptions}
            loading={loading}
            hasResult={Boolean(result)}
            onPresetChange={changePreset}
            onFilterChange={changeFilter}
            onRun={() => void runActiveReport()}
            onReset={resetFilters}
            onExport={exportCsv}
            onPrint={() => window.print()}
          />
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {loading ? <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">Building {activeDefinition.name}…</div> : null}
          {!loading && result ? <ReportResultView result={result} /> : null}
          {!loading && !result && !error ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="font-medium text-gray-800">{activeDefinition.question}</p>
              <p className="mt-1 text-sm text-gray-500">Choose the date range and filters, then run the report.</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

