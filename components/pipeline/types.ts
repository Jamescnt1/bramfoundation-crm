import type { Job } from "@/lib/services/jobs";
import type { ProductionSummary } from "@/components/production/types";

export type PipelineJob = Pick<
  Job,
  | "id"
  | "assigned_employee_id"
  | "customer_name"
  | "lead_source"
  | "status"
  | "salesperson"
  | "next_action"
  | "next_action_due"
  | "qfloors_job_number"
  | "contract_amount"
  | "installation_required"
  | "created_at"
  | "on_hold"
  | "hold_reason"
  | "hold_until"
> & Pick<Job, "customer">;

export type PipelineJobWithProduction = PipelineJob & {
  production_summary?: ProductionSummary;
};
