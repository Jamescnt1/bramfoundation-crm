import "server-only";

import type { PipelineStage } from "@/components/pipeline/constants";
import {
  ContractAmountRequiredError,
  InstallAppointmentRequiredError,
  normalizeContractAmount,
  QfNumberRequiredError,
} from "@/lib/services/jobs";
import { requirePermission } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";
import { getPipelineStages } from "@/lib/services/pipeline-stages";

export type JobStatusUpdate = {
  id: string;
  status: PipelineStage;
  qfloors_job_number: string | null;
  contract_amount: string | null;
  customer_id: string | null;
  installation_required: boolean;
};

export async function updateJobPipelineStatus(
  jobId: string,
  status: PipelineStage,
  qfNumber?: string,
  contractAmount?: string,
  installationRequired?: boolean,
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
    .select("id, customer_id, status, qfloors_job_number, contract_amount, installation_required")
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
  const resultingContractAmount =
    contractAmount !== undefined
      ? normalizeContractAmount(contractAmount)
      : currentJob.contract_amount;
  if (targetStage.contract_amount_required && !resultingContractAmount) {
    throw new ContractAmountRequiredError();
  }
  const resultingInstallationRequired =
    installationRequired ?? currentJob.installation_required;
  if (targetStage.slug === "install_scheduled" && resultingInstallationRequired) {
    const { count, error: appointmentError } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("appointment_type", "installation")
      .neq("status", "cancelled");

    if (appointmentError) throw new Error(appointmentError.message);
    if (!count) throw new InstallAppointmentRequiredError();
  }
  if (isWorkOrderSentStage(targetStage.slug, targetStage.label) && resultingInstallationRequired) {
    const { data: workOrders, error: workOrderError } = await supabase
      .from("appointments")
      .select("work_order_status")
      .eq("job_id", jobId)
      .eq("appointment_type", "installation")
      .neq("status", "cancelled");

    if (workOrderError) throw new Error(workOrderError.message);
    if (
      !workOrders?.length ||
      workOrders.some(
        (workOrder) =>
          workOrder.work_order_status !== "sent" &&
          workOrder.work_order_status !== "acknowledged",
      )
    ) {
      throw new Error(
        "All installation crew work orders must be marked sent before moving this job to Work Order Sent.",
      );
    }
  }

  const updates: {
    status: PipelineStage;
    qfloors_job_number?: string | null;
    contract_amount?: string | null;
    installation_required?: boolean;
  } = { status: targetStage.slug };

  if (qfNumber !== undefined) {
    updates.qfloors_job_number = resultingQfNumber;
  }
  if (contractAmount !== undefined) updates.contract_amount = resultingContractAmount;
  if (installationRequired !== undefined) {
    updates.installation_required = installationRequired;
  }

  // Database triggers record old/new status activity and execute enabled
  // automation rules for this transition.
  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", jobId)
    .select("id, customer_id, status, qfloors_job_number, contract_amount, installation_required")
    .single();

  if (error) throw new Error(error.message);
  return data as JobStatusUpdate;
}

function isWorkOrderSentStage(slug: string, label: string) {
  const normalized = `${slug} ${label}`
    .toLowerCase()
    .replaceAll("-", " ")
    .replaceAll("_", " ");
  return normalized.includes("work order") && normalized.includes("sent");
}
