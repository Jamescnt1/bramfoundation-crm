import Link from "next/link";
import { CircleDollarSign, FileCheck2, ReceiptText } from "lucide-react";
import { getStageStyles } from "@/components/pipeline/constants";
import { getSalesPipelineReport } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const report = await getSalesPipelineReport();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-sm font-medium text-gray-500">Sales & Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">Reports</h1>
          <p className="mt-2 max-w-3xl text-gray-600">
            Lightweight pipeline-dollar reporting from Contract Amount. QFloors remains the source for estimates, invoices, payments, and accounting.
          </p>
        </header>

        {report.missingContractAmountCount ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>{report.missingContractAmountCount} legacy sold job{report.missingContractAmountCount === 1 ? "" : "s"}</strong> {report.missingContractAmountCount === 1 ? "is" : "are"} missing a Contract Amount. Open the affected job from the Pipeline to remediate it.
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryCard icon={<CircleDollarSign />} label="Sold Jobs" description="Approved or later" count={report.sold.count} total={report.sold.total} />
          <SummaryCard icon={<FileCheck2 />} label="Completed Installs" description="Jobs in Complete" count={report.completed.count} total={report.completed.total} />
          <SummaryCard icon={<ReceiptText />} label="Billed Jobs" description="Explicitly marked billed" count={report.billed.count} total={report.billed.total} />
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">Pipeline Dollar Summary</h2>
              <p className="mt-1 text-sm text-gray-500">Active stages from Approved forward, excluding Lost.</p>
            </div>
            <Link href="/pipeline" className="text-sm font-medium text-gray-600 hover:text-black">Open Pipeline →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-5 py-3 font-semibold">Stage</th><th className="px-5 py-3 text-right font-semibold">Job count</th><th className="px-5 py-3 text-right font-semibold">Total Contract Amount</th><th className="px-5 py-3 text-right font-semibold">Average Contract Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.stages.map((row) => {
                  const styles = getStageStyles({ ...row, color_key: row.colorKey, sort_order: row.sortOrder, active: true, terminal: false, lead_queue: false, qf_number_required: true, contract_amount_required: true, system_required: false });
                  return (
                    <tr key={row.slug} className="hover:bg-gray-50">
                      <td className="px-5 py-4"><Link href={`/pipeline?stage=${encodeURIComponent(row.slug)}`} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge}`}>{row.label}</Link></td>
                      <td className="px-5 py-4 text-right font-medium text-gray-900">{row.jobCount}</td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-950">{currency(row.totalContractAmount)}</td>
                      <td className="px-5 py-4 text-right text-gray-700">{currency(row.averageContractAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, description, count, total }: { icon: React.ReactNode; label: string; description: string; count: number; total: number }) {
  return <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-gray-950">{label}</p><p className="mt-1 text-xs text-gray-500">{description}</p></div><span className="rounded-lg bg-gray-100 p-2 text-gray-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</span></div><p className="mt-5 text-3xl font-bold tracking-tight text-gray-950">{currency(total)}</p><p className="mt-1 text-sm text-gray-500">{count} job{count === 1 ? "" : "s"}</p></article>;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
