import "server-only";

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

type JobRow = {
  status: string;
  contract_amount: string | number | null;
  billed_at: string | null;
};

export async function getSalesPipelineReport(): Promise<SalesReportData> {
  await requirePermission("reports.view");
  const supabase = await createClient();
  const [stagesResult, aliasesResult, jobsResult] = await Promise.all([
    supabase.from("pipeline_stages")
      .select("slug, label, color_key, sort_order, active, contract_amount_required")
      .eq("active", true)
      .order("sort_order"),
    supabase.from("pipeline_stage_aliases").select("alias, stage_slug"),
    supabase.from("jobs")
      .select("status, contract_amount, billed_at")
      .is("archived_at", null),
  ]);
  if (stagesResult.error) throw new Error(stagesResult.error.message);
  if (aliasesResult.error) throw new Error(aliasesResult.error.message);
  if (jobsResult.error) throw new Error(jobsResult.error.message);

  const stages = stagesResult.data ?? [];
  const stageBySlug = new Map(stages.map((stage) => [stage.slug, stage]));
  const aliasMap = new Map((aliasesResult.data ?? []).map((item) => [item.alias.toLowerCase(), item.stage_slug]));
  const approvedOrder = stageBySlug.get("approved")?.sort_order ?? 4;
  const reportingStages = stages.filter(
    (stage) => stage.sort_order >= approvedOrder && stage.slug !== "lost",
  );
  const grouped = new Map<string, { count: number; total: number }>(
    reportingStages.map((stage) => [stage.slug, { count: 0, total: 0 }]),
  );

  let soldCount = 0;
  let soldTotal = 0;
  let completedCount = 0;
  let completedTotal = 0;
  let billedCount = 0;
  let billedTotal = 0;
  let missingContractAmountCount = 0;

  for (const job of (jobsResult.data ?? []) as JobRow[]) {
    const slug = stageBySlug.has(job.status)
      ? job.status
      : aliasMap.get(job.status.toLowerCase())
        ?? stages.find((stage) => stage.label.toLowerCase() === job.status.toLowerCase())?.slug;
    const stage = slug ? stageBySlug.get(slug) : undefined;
    const amount = Number(job.contract_amount ?? 0);
    const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const isSold = Boolean(stage && stage.sort_order >= approvedOrder && stage.slug !== "lost");

    if (isSold) {
      soldCount += 1;
      soldTotal += validAmount;
      if (!validAmount) missingContractAmountCount += 1;
      const group = grouped.get(stage!.slug);
      if (group) {
        group.count += 1;
        group.total += validAmount;
      }
    }
    if (slug === "complete") {
      completedCount += 1;
      completedTotal += validAmount;
    }
    if (job.billed_at) {
      billedCount += 1;
      billedTotal += validAmount;
    }
  }

  return {
    sold: { count: soldCount, total: soldTotal },
    completed: { count: completedCount, total: completedTotal },
    billed: { count: billedCount, total: billedTotal },
    missingContractAmountCount,
    stages: reportingStages.map((stage) => {
      const values = grouped.get(stage.slug) ?? { count: 0, total: 0 };
      return {
        slug: stage.slug,
        label: stage.label,
        colorKey: stage.color_key,
        sortOrder: stage.sort_order,
        jobCount: values.count,
        totalContractAmount: values.total,
        averageContractAmount: values.count ? values.total / values.count : 0,
      };
    }),
  };
}
