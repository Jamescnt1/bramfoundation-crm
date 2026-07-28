import type { ReportResult } from "@/lib/reports/types";

export default function ReportResultView({ result }: { result: ReportResult }) {
  const maximum = Math.max(...(result.chart?.items.map((item) => item.value) ?? [0]), 1);
  return (
    <div className="space-y-5">
      <header className="print-report-header flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">{result.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{result.description}</p>
        </div>
        <p className="shrink-0 text-sm font-medium text-gray-500">{result.rangeLabel}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {result.metrics.map((item) => (
          <article key={item.label} className={`rounded-xl border p-4 shadow-sm ${
            item.tone === "warning" ? "border-amber-200 bg-amber-50" :
              item.tone === "positive" ? "border-emerald-200 bg-emerald-50" :
                "border-gray-200 bg-white"
          }`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-950">{item.value}</p>
            {item.detail ? <p className="mt-1 text-xs text-gray-500">{item.detail}</p> : null}
          </article>
        ))}
      </section>

      {result.chart?.items.length ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-950">{result.chart.title}</h3>
          <div className="mt-4 space-y-3">
            {result.chart.items.map((item) => (
              <div key={item.label} className="grid grid-cols-[minmax(90px,180px)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-gray-700" title={item.label}>{item.label}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gray-800" style={{ width: `${Math.max(2, item.value / maximum * 100)}%` }} />
                </div>
                <span className="min-w-12 text-right font-medium text-gray-800">{item.formattedValue ?? item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="font-semibold text-gray-950">Report detail</h3>
          <p className="mt-1 text-xs text-gray-500">{result.rows.length.toLocaleString()} rows</p>
        </div>
        {result.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {result.columns.map((column) => (
                    <th key={column.key} className={`px-5 py-3 font-semibold ${column.align === "right" ? "text-right" : ""}`}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {result.columns.map((column) => (
                      <td key={column.key} className={`px-5 py-3.5 text-gray-700 ${column.align === "right" ? "text-right tabular-nums" : ""}`}>
                        {row[column.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-gray-500">{result.emptyMessage ?? "No matching activity was found."}</div>
        )}
      </section>

      {result.notes?.length ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">About this report</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-900">
            {result.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

