export const PIPELINE_STAGES = [
  "New Lead",
  "Floor Measure",
  "Estimate Sent",
  "Waiting Approval",
  "Approved",
  "Materials Ordered",
  "Install Scheduled",
  "Complete",
  "Lost",
] as const;

export type PipelineStage = string;
export type LegacyPipelineStage = (typeof PIPELINE_STAGES)[number];

export type PipelineStageView = {
  slug: string;
  label: string;
  color_key: string;
  sort_order: number;
  active: boolean;
  terminal: boolean;
  lead_queue: boolean;
  qf_number_required: boolean;
  system_required: boolean;
};

export const QF_REQUIRED_FROM_STAGE = "Estimate Sent" as const;

export function isQfNumberRequired(
  status: string | null,
): boolean {
  const stage = getPipelineStage(status);

  return (
    PIPELINE_STAGES.indexOf(stage as (typeof PIPELINE_STAGES)[number]) >=
    PIPELINE_STAGES.indexOf(QF_REQUIRED_FROM_STAGE)
  );
}

export const ACTIVE_SALES_QUEUE_STAGES = [
  "New Lead",
  "Floor Measure",
] as const satisfies readonly PipelineStage[];

export type ActiveSalesQueueStage =
  (typeof ACTIVE_SALES_QUEUE_STAGES)[number];

export const PIPELINE_STAGE_STYLES: Record<
  (typeof PIPELINE_STAGES)[number],
  { accent: string; badge: string; border: string }
> = {
  "New Lead": {
    accent: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700",
    border: "border-blue-200",
  },
  "Floor Measure": {
    accent: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
    border: "border-amber-200",
  },
  "Estimate Sent": {
    accent: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700",
    border: "border-violet-200",
  },
  "Waiting Approval": {
    accent: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700",
    border: "border-orange-200",
  },
  Approved: {
    accent: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
  },
  "Materials Ordered": {
    accent: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-700",
    border: "border-cyan-200",
  },
  "Install Scheduled": {
    accent: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
  },
  Complete: {
    accent: "bg-teal-600",
    badge: "bg-teal-50 text-teal-700",
    border: "border-teal-200",
  },
  Lost: {
    accent: "bg-gray-500",
    badge: "bg-gray-100 text-gray-700",
    border: "border-gray-300",
  },
};

export const PIPELINE_COLOR_STYLES: Record<
  string,
  { accent: string; badge: string; border: string }
> = {
  blue: { accent: "bg-blue-500", badge: "bg-blue-50 text-blue-700", border: "border-blue-200" },
  amber: { accent: "bg-amber-500", badge: "bg-amber-50 text-amber-700", border: "border-amber-200" },
  violet: { accent: "bg-violet-500", badge: "bg-violet-50 text-violet-700", border: "border-violet-200" },
  orange: { accent: "bg-orange-500", badge: "bg-orange-50 text-orange-700", border: "border-orange-200" },
  emerald: { accent: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  cyan: { accent: "bg-cyan-500", badge: "bg-cyan-50 text-cyan-700", border: "border-cyan-200" },
  indigo: { accent: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700", border: "border-indigo-200" },
  teal: { accent: "bg-teal-600", badge: "bg-teal-50 text-teal-700", border: "border-teal-200" },
  red: { accent: "bg-red-500", badge: "bg-red-50 text-red-700", border: "border-red-200" },
  gray: { accent: "bg-gray-500", badge: "bg-gray-100 text-gray-700", border: "border-gray-300" },
};

export function getStageStyles(stage: PipelineStageView | string) {
  if (typeof stage !== "string") return PIPELINE_COLOR_STYLES[stage.color_key] ?? PIPELINE_COLOR_STYLES.gray;
  const legacy = PIPELINE_STAGE_STYLES[stage as keyof typeof PIPELINE_STAGE_STYLES];
  return legacy ?? PIPELINE_COLOR_STYLES.gray;
}

export function resolveConfiguredStage(status: string | null, stages: PipelineStageView[]) {
  const normalized = status?.trim().toLowerCase();
  return stages.find((stage) =>
    stage.slug.toLowerCase() === normalized || stage.label.toLowerCase() === normalized,
  ) ?? stages.find((stage) => stage.slug === LEGACY_SLUG_MAP[status ?? ""])
    ?? stages.find((stage) => stage.slug === "new_lead")
    ?? stages[0];
}

export function isConfiguredQfNumberRequired(status: string | null, stages: PipelineStageView[]) {
  return resolveConfiguredStage(status, stages)?.qf_number_required ?? isQfNumberRequired(status);
}

const LEGACY_STAGE_MAP: Record<string, LegacyPipelineStage> = {
  "New Lead": "New Lead",
  Contacted: "New Lead",
  Appointment: "Floor Measure",
  "Measure Complete": "Floor Measure",
  "Floor Measure": "Floor Measure",
  "Estimate Sent": "Estimate Sent",
  "Follow-Up": "Waiting Approval",
  Negotiating: "Waiting Approval",
  "Waiting Approval": "Waiting Approval",
  Won: "Approved",
  Sold: "Approved",
  Approved: "Approved",
  "Ready for Production": "Materials Ordered",
  "Materials Ordered": "Materials Ordered",
  "Installation Scheduled": "Install Scheduled",
  "Install Scheduled": "Install Scheduled",
  "Installation Complete": "Complete",
  Closed: "Complete",
  Complete: "Complete",
  Lost: "Lost",
};

const LEGACY_SLUG_MAP: Record<string, string> = {
  "New Lead": "new_lead", Contacted: "new_lead",
  Appointment: "floor_measure", "Measure Complete": "floor_measure", "Floor Measure": "floor_measure",
  "Estimate Sent": "estimate_sent",
  "Follow-Up": "waiting_approval", Negotiating: "waiting_approval", "Waiting Approval": "waiting_approval",
  Won: "approved", Sold: "approved", Approved: "approved",
  "Ready for Production": "materials_ordered", "Materials Ordered": "materials_ordered",
  "Installation Scheduled": "install_scheduled", "Install Scheduled": "install_scheduled",
  "Installation Complete": "complete", Closed: "complete", Complete: "complete", Lost: "lost",
};

export function getPipelineStage(status: string | null): LegacyPipelineStage {
  if (!status) {
    return "New Lead";
  }

  return LEGACY_STAGE_MAP[status] ?? "New Lead";
}

export function isActiveSalesQueueStage(
  status: string | null,
): status is ActiveSalesQueueStage {
  const stage = getPipelineStage(status);

  return ACTIVE_SALES_QUEUE_STAGES.some(
    (queueStage) => queueStage === stage,
  );
}
