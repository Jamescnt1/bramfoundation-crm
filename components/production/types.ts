export type MaterialStatus =
  | "needs_ordering"
  | "ordered"
  | "partially_received"
  | "ready"
  | "issue"
  | "excluded";

export type MaterialCategory = {
  id: string;
  name: string;
  abbreviation: string;
  color_key: string;
  ordering_required: boolean;
  installation_required: boolean;
  work_order_required: boolean;
  active: boolean;
  sort_order: number;
};

export type MaterialScope = {
  id: string;
  job_id: string;
  material_category_id: string;
  description: string | null;
  ordering_required: boolean;
  installation_required: boolean;
  work_order_required: boolean;
  material_status: MaterialStatus;
  eta_date: string | null;
  ordered_at: string | null;
  ready_at: string | null;
  issue_note: string | null;
  excluded_reason: string | null;
  sort_order: number;
  category: MaterialCategory;
  appointments: {
    id: string;
    starts_at: string;
    ends_at: string | null;
    status: string;
    installation_scope: string | null;
    work_order_status: "not_sent" | "sent" | "acknowledged";
    installer_name: string | null;
  }[];
};

export type ProductionSummary = {
  job_id: string;
  total_steps: number;
  completed_steps: number;
  materials_total: number;
  materials_ordered: number;
  materials_ready: number;
  installations_required: number;
  installations_scheduled: number;
  work_orders_required: number;
  work_orders_sent: number;
  needs_attention: boolean;
};
