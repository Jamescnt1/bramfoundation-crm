import "server-only";

import type {
  ReportFilterOptions,
  ReportFilters,
  ReportResult,
} from "@/lib/reports/types";
import { runReport } from "@/lib/reports/engine";
import { requirePermission } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";

export type PipelineDollarRow = {
  slug: string;
  label: string;
  colorKey: string;
  sortOrder: number;
  jobCount: number;
  totalContractAmount: number;
  averageContractAmount: number;
};

export type SalesReportData = {
  sold: { count: number; total: number };
  completed: { count: number; total: number };
  billed: { count: number; total: number };
  missingContractAmountCount: number;
  stages: PipelineDollarRow[];
};

export async function getReportResult(
  reportId: string,
  filters: ReportFilters,
): Promise<ReportResult> {
  return runReport(reportId, filters);
}
export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  await requirePermission("reports.view");
  const supabase = await createClient();
  const [employeesResult, stagesResult, sourcesResult, customersResult] = await Promise.all([
    supabase.from("employees").select("id, name").eq("active", true).order("name"),
    supabase.from("pipeline_stages").select("slug, label").eq("active", true).order("sort_order"),
    supabase.from("lead_sources").select("name").eq("active", true).order("sort_order").order("name"),
    supabase.from("customers").select("id, full_name").is("archived_at", null).order("full_name").limit(500),
  ]);
  const error = employeesResult.error ?? stagesResult.error ?? sourcesResult.error ?? customersResult.error;
  if (error) throw new Error(error.message);
  const employees = (employeesResult.data ?? []).map((employee) => ({ value: employee.id, label: employee.name }));
  return {
    employees,
    salespeople: (employeesResult.data ?? []).map((employee) => ({ value: employee.name, label: employee.name })),
    pipelineStages: (stagesResult.data ?? []).map((stage) => ({ value: stage.slug, label: stage.label })),
    leadSources: (sourcesResult.data ?? []).map((source) => ({ value: source.name, label: source.name })),
    customers: (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.full_name })),
    statuses: [
      { value: "scheduled", label: "Scheduled" },
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In Progress" },
      { value: "waiting", label: "Waiting" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  };
}

export async function getFavoriteReportIds() {
  const employee = await requirePermission("reports.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_favorites")
    .select("report_id")
    .eq("employee_id", employee.id)
    .order("created_at");
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((favorite) => favorite.report_id);
}

export async function setReportFavorite(reportId: string, favorite: boolean) {
  const employee = await requirePermission("reports.view");
  const supabase = await createClient();
  if (favorite) {
    const { error } = await supabase
      .from("report_favorites")
      .upsert({ employee_id: employee.id, report_id: reportId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("report_favorites")
      .delete()
      .eq("employee_id", employee.id)
      .eq("report_id", reportId);
    if (error) throw new Error(error.message);
  }
}

/**
 * Compatibility wrapper for older imports. It preserves the original all-time
 * calculations by requesting the Operational Dollars report across a broad range.
 */
export async function getSalesPipelineReport(): Promise<SalesReportData> {
  const result = await runReport("operational-dollars", {
    from: "2000-01-01",
    to: "2099-12-31",
  });
  const sold = result.metrics[0];
  const completed = result.metrics[1];
  const billed = result.metrics[2];
  const missing = result.metrics[3];
  return {
    sold: { count: parseCount(sold.detail), total: parseMoney(sold.value) },
    completed: { count: parseCount(completed.detail), total: parseMoney(completed.value) },
    billed: { count: parseCount(billed.detail), total: parseMoney(billed.value) },
    missingContractAmountCount: Number(missing.value.replaceAll(",", "")) || 0,
    stages: result.rows.map((row, index) => ({
      slug: String(row.stage ?? "").toLowerCase().replaceAll(" ", "_"),
      label: String(row.stage ?? ""),
      colorKey: "slate",
      sortOrder: index,
      jobCount: Number(row.jobCount ?? 0),
      totalContractAmount: parseMoney(String(row.total ?? "$0")),
      averageContractAmount: parseMoney(String(row.average ?? "$0")),
    })),
  };
}

function parseMoney(value: string) {
  return Number(value.replace(/[^0-9.-]+/g, "")) || 0;
}

function parseCount(value?: string) {
  return Number(value?.match(/\d[\d,]*/)?.[0].replaceAll(",", "") ?? 0);
}
