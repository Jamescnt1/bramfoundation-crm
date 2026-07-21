import Link from "next/link";

export type OperationalMetric = {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "amber" | "red";
};

export default function OperationalMetrics({ metrics }: { metrics: OperationalMetric[] }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="group border-b border-gray-100 px-5 py-4 transition hover:bg-gray-50 sm:border-r lg:border-b-0"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{metric.label}</p>
            <p className={`mt-1 text-2xl font-bold ${metric.tone === "red" ? "text-red-700" : metric.tone === "amber" ? "text-amber-700" : "text-gray-950"}`}>{metric.value}</p>
            <p className="mt-1 text-xs text-gray-400 group-hover:text-gray-700">Open view →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
