"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/services/employees";
import {
  archivePipelineStage,
  createPipelineStage,
  synchronizePipelineBusinessRules,
  updatePipelineStage,
  type PipelineStageValues,
} from "@/lib/services/pipeline-stages";

export async function createPipelineStageAction(values: PipelineStageValues) {
  await requirePermission("pipeline.settings.manage");
  await createPipelineStage(values);
  revalidateAll();
}

export async function updatePipelineStageAction(id: string, values: PipelineStageValues) {
  await requirePermission("pipeline.settings.manage");
  await updatePipelineStage(id, values);
  revalidateAll();
}

export async function reorderPipelineStagesAction(items: { id: string; values: PipelineStageValues }[]) {
  await requirePermission("pipeline.settings.manage");
  await Promise.all(items.map((item, sortOrder) => updatePipelineStage(item.id, { ...item.values, sort_order: sortOrder })));
  await synchronizePipelineBusinessRules();
  revalidateAll();
}

export async function archivePipelineStageAction(id: string, replacementSlug?: string) {
  await requirePermission("pipeline.settings.manage");
  await archivePipelineStage(id, replacementSlug);
  revalidateAll();
}

function revalidateAll() {
  ["/settings/pipeline", "/pipeline", "/leads", "/company", "/my-dashboard", "/settings/automation-rules"].forEach((path) => revalidatePath(path));
}
