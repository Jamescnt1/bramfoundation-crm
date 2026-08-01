"use client";

import { AlertTriangle, Check, Circle, Slash } from "lucide-react";
import type { MaterialScope, ProductionSummary } from "@/components/production/types";

const categoryColors: Record<string, string> = {
  blue: "bg-[#3f6e8c]", amber: "bg-[#c89c45]", violet: "bg-violet-600",
  orange: "bg-orange-600", emerald: "bg-[#5d8a52]", cyan: "bg-cyan-600",
  indigo: "bg-indigo-600", teal: "bg-teal-600", red: "bg-[#b14e4e]", gray: "bg-[#8f969c]",
};

export default function ProductionProgress({
  scopes,
  summary,
  compact = false,
  onOpen,
}: {
  scopes: MaterialScope[];
  summary: ProductionSummary;
  compact?: boolean;
  onOpen: () => void;
}) {
  if (!scopes.length) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-medium text-gray-900">Production setup needed</p><p className="mt-1 text-xs text-gray-500">Add material scopes to begin production tracking.</p></div>
        <button type="button" onClick={onOpen} className="rounded-md bg-[#3f6e8c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#315b76]">Set up production</button>
      </div>
    );
  }

  const visible = compact ? scopes.slice(0, 4) : scopes;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-gray-950">Production Progress</p><p className="text-xs text-gray-500">{summary.completed_steps}/{summary.total_steps} milestones complete</p></div>
        {summary.needs_attention ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" /> Attention</span> : null}
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[430px]">
          <div className="grid grid-cols-[minmax(100px,1fr)_repeat(4,54px)] gap-1 px-1 text-center text-[9px] font-semibold uppercase tracking-wide text-gray-500">
            <span /><span>Ordered</span><span>Ready</span><span>Schedule</span><span>W.O.</span>
          </div>
          <div className="mt-1 divide-y divide-gray-100">
            {visible.map((scope) => <MaterialProgressRow key={scope.id} scope={scope} />)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-[11px] text-gray-500">{scopes.length > visible.length ? `+${scopes.length - visible.length} more material scopes` : "Updates automatically from production activity."}</span>
        <button type="button" onClick={onOpen} className="text-xs font-semibold text-[#3f6e8c] hover:underline">Open Production</button>
      </div>
    </div>
  );
}

function MaterialProgressRow({ scope }: { scope: MaterialScope }) {
  const excluded = scope.material_status === "excluded";
  const ordered = excluded || !scope.ordering_required || ["ordered", "partially_received", "ready"].includes(scope.material_status);
  const ready = excluded || scope.material_status === "ready";
  const scheduled = excluded || !scope.installation_required || scope.appointments.some((item) => item.status !== "cancelled");
  const workOrder = excluded || !scope.work_order_required || (scope.appointments.length > 0 && scope.appointments.every((item) => ["sent", "acknowledged"].includes(item.work_order_status)));
  return (
    <div className="grid grid-cols-[minmax(100px,1fr)_repeat(4,54px)] items-center gap-1 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${categoryColors[scope.category.color_key] ?? categoryColors.gray}`}>{scope.category.abbreviation}</span>
        <span className="truncate text-xs font-medium text-gray-800" title={scope.description ?? scope.category.name}>{scope.description || scope.category.name}</span>
      </div>
      <Step complete={ordered} excluded={excluded || !scope.ordering_required} attention={scope.material_status === "issue"} />
      <Step complete={ready} excluded={excluded} attention={scope.material_status === "issue" || scope.material_status === "partially_received"} />
      <Step complete={scheduled} excluded={excluded || !scope.installation_required} />
      <Step complete={workOrder} excluded={excluded || !scope.work_order_required} />
    </div>
  );
}

function Step({ complete, excluded = false, attention = false }: { complete: boolean; excluded?: boolean; attention?: boolean }) {
  return <span className="relative flex items-center justify-center before:absolute before:left-[-55%] before:right-[50%] before:h-px before:bg-gray-200 first:before:hidden">
    <span className={`relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border ${excluded ? "border-gray-300 bg-gray-50 text-gray-400" : attention ? "border-amber-500 bg-amber-50 text-amber-700" : complete ? "border-[#5d8a52] bg-[#5d8a52] text-white" : "border-gray-300 bg-white text-gray-300"}`}>
      {excluded ? <Slash className="h-3 w-3" /> : attention ? <AlertTriangle className="h-3 w-3" /> : complete ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
    </span>
  </span>;
}
