import type { Job } from "@/lib/services/jobs";

export type PipelineJob = Pick<
  Job,
  | "id"
  | "customer_name"
  | "lead_source"
  | "status"
  | "salesperson"
  | "next_action"
  | "next_action_due"
  | "qfloors_job_number"
  | "created_at"
> & Pick<Job, "customer">;
