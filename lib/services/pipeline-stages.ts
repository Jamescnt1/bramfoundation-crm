import "server-only";

import { createClient } from "@/lib/supabase/server";

export const PIPELINE_COLOR_KEYS = [
  "blue", "amber", "violet", "orange", "emerald",
  "cyan", "indigo", "teal", "red", "gray",
] as const;

export type PipelineColorKey = (typeof PIPELINE_COLOR_KEYS)[number];
export type PipelineStageSlug = string;

export type PipelineStageConfig = {
  id: string;
  slug: PipelineStageSlug;
  label: string;
  color_key: PipelineColorKey;
  sort_order: number;
  active: boolean;
  terminal: boolean;
  lead_queue: boolean;
  qf_number_required: boolean;
  system_required: boolean;
  behavior: Record<string, unknown>;
  job_count: number;
};

export type PipelineStageValues = Omit<
  PipelineStageConfig,
  "id" | "job_count"
>;

const stageColumns = "id, slug, label, color_key, sort_order, active, terminal, lead_queue, qf_number_required, system_required, behavior";

export async function getPipelineStages(options?: { includeArchived?: boolean }): Promise<PipelineStageConfig[]> {
  const supabase = await createClient();
  let query = supabase.from("pipeline_stages").select(stageColumns).order("sort_order").order("label");
  if (!options?.includeArchived) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(async (stage) => ({
    ...stage,
    job_count: await countJobsForStage(stage.slug, stage.label),
  }))) as Promise<PipelineStageConfig[]>;
}

export async function getPipelineStageAliases(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pipeline_stage_aliases").select("alias, stage_slug");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((item) => [item.alias, item.stage_slug]));
}

export async function createPipelineStage(values: PipelineStageValues) {
  const supabase = await createClient();
  const normalized = validate(values);
  const { error } = await supabase.from("pipeline_stages").insert(normalized);
  if (error) throwFriendly(error);
  await upsertAlias(normalized.label, normalized.slug);
  await synchronizePipelineBusinessRules();
}

export async function updatePipelineStage(id: string, values: PipelineStageValues) {
  const supabase = await createClient();
  const normalized = validate(values);
  const { data: current, error: loadError } = await supabase
    .from("pipeline_stages").select("slug, label, system_required").eq("id", id).single();
  if (loadError) throw new Error(loadError.message);
  if (current.system_required && current.slug !== normalized.slug) {
    throw new Error("Required system stage slugs cannot be changed.");
  }
  if (current.system_required && !normalized.active) {
    throw new Error("Required system stages cannot be archived.");
  }
  normalized.system_required = current.system_required;
  if (normalized.slug === "estimate_sent") normalized.qf_number_required = true;
  if (["complete", "lost"].includes(normalized.slug)) normalized.terminal = true;
  const { error } = await supabase.from("pipeline_stages").update(normalized).eq("id", id);
  if (error) throwFriendly(error);
  await upsertAlias(current.label, normalized.slug);
  await upsertAlias(normalized.label, normalized.slug);
  await synchronizePipelineBusinessRules();
}

export async function archivePipelineStage(id: string, replacementSlug?: string) {
  const supabase = await createClient();
  const { data: stage, error } = await supabase
    .from("pipeline_stages").select("slug, label, system_required").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (stage.system_required) throw new Error("Required system stages cannot be archived.");

  await countJobsForStage(stage.slug, stage.label);
  // Archiving never changes historical job values. Reassignment is optional and
  // explicit; hard deletion is intentionally not exposed by this service.
  if (replacementSlug) {
    const { data: replacement, error: replacementError } = await supabase
      .from("pipeline_stages").select("slug, label").eq("slug", replacementSlug).eq("active", true).single();
    if (replacementError) throw new Error(replacementError.message);
    const aliases = await aliasesFor(stage.slug, stage.label);
    const { error: moveError } = await supabase.from("jobs").update({ status: replacement.slug }).in("status", aliases);
    if (moveError) throw new Error(moveError.message);
  }
  const { error: archiveError } = await supabase.from("pipeline_stages").update({ active: false }).eq("id", id);
  if (archiveError) throw new Error(archiveError.message);
}

export async function synchronizePipelineBusinessRules() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pipeline_stages").select("id, slug, sort_order, active").order("sort_order");
  if (error) throw new Error(error.message);
  const estimateOrder = data?.find((stage) => stage.slug === "estimate_sent")?.sort_order ?? 2;
  for (const stage of data ?? []) {
    const updates: Record<string, boolean> = {};
    if (stage.active) updates.qf_number_required = stage.sort_order >= estimateOrder;
    if (["complete", "lost"].includes(stage.slug)) updates.terminal = true;
    if (["new_lead", "floor_measure", "estimate_sent", "complete", "lost"].includes(stage.slug)) updates.active = true;
    if (Object.keys(updates).length) {
      const { error: updateError } = await supabase.from("pipeline_stages").update(updates).eq("id", stage.id);
      if (updateError) throw new Error(updateError.message);
    }
  }
}

async function countJobsForStage(slug: string, label: string) {
  const supabase = await createClient();
  const aliases = await aliasesFor(slug, label);
  const { count, error } = await supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", aliases);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function aliasesFor(slug: string, label: string) {
  const aliases = await getPipelineStageAliases();
  return Array.from(new Set([slug, label, ...Object.entries(aliases).filter(([, value]) => value === slug).map(([key]) => key)]));
}

async function upsertAlias(alias: string, stageSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_stage_aliases").upsert({ alias, stage_slug: stageSlug });
  if (error) throw new Error(error.message);
}

function validate(values: PipelineStageValues): PipelineStageValues {
  const label = values.label.trim().replace(/\s+/g, " ");
  const slug = values.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!label) throw new Error("Stage label cannot be blank.");
  if (!slug) throw new Error("Stage slug cannot be blank.");
  if (!/^[a-z][a-z0-9_]{1,49}$/.test(slug)) throw new Error("Stage slug must start with a letter and use only lowercase letters, numbers, and underscores.");
  if (!PIPELINE_COLOR_KEYS.includes(values.color_key)) throw new Error("Choose a valid stage color.");
  return { ...values, label, slug, sort_order: Math.max(0, Math.trunc(values.sort_order)), behavior: values.behavior ?? {} };
}

function throwFriendly(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new Error("A pipeline stage with that label or slug already exists.");
  throw new Error(error.message);
}
