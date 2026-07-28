import ReportsCenter from "@/components/reports/ReportsCenter";
import { REPORT_CATEGORIES, REPORT_DEFINITIONS } from "@/lib/reports/definitions";
import { getFavoriteReportIds, getReportFilterOptions } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [filterOptions, favoriteReportIds] = await Promise.all([
    getReportFilterOptions(),
    getFavoriteReportIds(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-gray-500">Business intelligence</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">Reports Center</h1>
          <p className="mt-2 text-gray-600">
            Choose the business question you want to answer, then refine the result. Only the active report is queried.
          </p>
        </header>

        <ReportsCenter
          categories={REPORT_CATEGORIES}
          definitions={REPORT_DEFINITIONS}
          filterOptions={filterOptions}
          initialFavoriteReportIds={favoriteReportIds}
        />
      </div>
    </main>
  );
}
