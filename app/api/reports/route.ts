import { NextRequest } from "next/server";
import { getReportResult } from "@/lib/services/reports";
import type { ReportFilters } from "@/lib/reports/types";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const reportId = params.get("reportId") ?? "";
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const filters: ReportFilters = {
      from,
      to,
      employeeId: clean(params.get("employeeId")),
      salesperson: clean(params.get("salesperson")),
      pipelineStage: clean(params.get("pipelineStage")),
      leadSource: clean(params.get("leadSource")),
      customerId: clean(params.get("customerId")),
      status: clean(params.get("status")),
    };
    const result = await getReportResult(reportId, filters);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to run this report." },
      { status: 400 },
    );
  }
}

function clean(value: string | null) {
  return value?.trim() || undefined;
}

