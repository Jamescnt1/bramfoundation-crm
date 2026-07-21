import "server-only";

import type { PipelineStage } from "@/components/pipeline/constants";
import { QfNumberRequiredError } from "@/lib/services/jobs";
import { requirePermission } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";
import { getPipelineStages } from "@/lib/services/pipeline-stages";

export type JobStatusUpdate = {
  id: string;
  status: PipelineStage;
  qfloors_job_number: string | null;
  customer_id: string | null;
};

export async function updateJobPipelineStatus(
  jobId: string,
  status: PipelineStage,
  qfNumber?: string,
): Promise<JobStatusUpdate> {
  await requirePermission("pipeline.manage");

  const stages = await getPipelineStages();
  const targetStage = stages.find((stage) => stage.slug === status || stage.label === status);
  if (!targetStage) {
    throw new Error("Invalid pipeline status.");
  }

  const supabase = await createClient();
  const { data: currentJob, error: loadError } = await supabase
    .from("jobs")
    .select("id, customer_id, status, qfloors_job_number")
    .eq("id", jobId)
    .is("archived_at", null)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!currentJob) throw new Error("Job not found.");

  const resultingQfNumber =
    qfNumber !== undefined
      ? qfNumber.trim() || null
      : currentJob.qfloors_job_number?.trim() || null;

  if (targetStage.qf_number_required && !resultingQfNumber) {
    throw new QfNumberRequiredError();
  }

  const updates: {
    status: PipelineStage;
    qfloors_job_number?: string | null;
  } = { status: targetStage.slug };

  if (qfNumber !== undefined) {
    updates.qfloors_job_number = resultingQfNumber;
  }

  // Database triggers record old/new status activity and execute enabled
  // automation rules for this transition.
  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", jobId)
    .select("id, customer_id, status, qfloors_job_number")
    .single();

  if (error) throw new Error(error.message);
  return data as JobStatusUpdate;
}
