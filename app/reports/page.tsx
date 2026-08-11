import ReportsCenter from "@/components/reports/ReportsCenter";
import { REPORT_CATEGORIES, REPORT_DEFINITIONS } from "@/lib/reports/definitions";
import { getFavoriteReportIds, getReportFilterOptions } from "@/lib/services/reports";
import PageHeader from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [filterOptions, favoriteReportIds] = await Promise.all([
    getReportFilterOptions(),
    getFavoriteReportIds(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader eyebrow="Business intelligence" title="Reports Center" description="Choose the business question you want to answer, then refine the result. Only the active report is queried." />

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
