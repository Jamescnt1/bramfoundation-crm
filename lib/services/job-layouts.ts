import "server-only";

import type { JobLayout, LayoutDocument, LayoutTemplate } from "@/components/layouts/types";
import { createLayoutDocument } from "@/components/layouts/types";
import { requireLayoutsBeta } from "@/lib/features/layouts-beta";
import { requireEmployee, requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "job-attachments";
const SIGNED_URL_SECONDS = 60 * 60;
const MAXIMUM_DOCUMENT_BYTES = 3 * 1024 * 1024;

export async function getJobLayouts(jobId: string): Promise<JobLayout[]> {
  requireLayoutsBeta();
  await requirePermission("layouts.view");
  const admin = createAdminClient();
  await requireActiveJob(admin, jobId);

  const { data, error } = await admin
    .from("job_layouts")
    .select(`
      id, job_id, name, document_data, page_count, preview_storage_path,
      created_by_employee_id, updated_by_employee_id, created_at, updated_at,
      archived_at,
      created_by:employees!job_layouts_created_by_employee_id_fkey (id, name),
      updated_by:employees!job_layouts_updated_by_employee_id_fkey (id, name)
    `)
    .eq("job_id", jobId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const previewPaths = rows.flatMap((row) => row.preview_storage_path ? [row.preview_storage_path] : []);
  const previewUrls = new Map<string, string>();

  if (previewPaths.length) {
    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrls(previewPaths, SIGNED_URL_SECONDS);
    if (signedError) throw new Error(signedError.message);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) previewUrls.set(entry.path, entry.signedUrl);
    }
  }

  return rows.map((row) => ({
    ...row,
    document_data: row.document_data as LayoutDocument,
    created_by: firstRelation(row.created_by),
    updated_by: firstRelation(row.updated_by),
    preview_url: row.preview_storage_path ? previewUrls.get(row.preview_storage_path) ?? null : null,
  })) as JobLayout[];
}

export async function createJobLayout(input: {
  jobId: string;
  name: string;
  template: LayoutTemplate;
}) {
  requireLayoutsBeta();
  const actor = await requirePermission("layouts.manage");
  const admin = createAdminClient();
  await requireActiveJob(admin, input.jobId);
  const name = validateName(input.name);
  const document = createLayoutDocument(input.template);

  const { data, error } = await admin
    .from("job_layouts")
    .insert({
      job_id: input.jobId,
      name,
      document_data: document,
      page_count: document.pages.length,
      created_by_employee_id: actor.id,
      updated_by_employee_id: actor.id,
    })
    .select("id, updated_at")
    .single();
  if (error) throw new Error(error.message);

  await writeActivity(admin, input.jobId, "layout_created", `${actor.name} created layout ${name}`, null, data.id);
  return data as { id: string; updated_at: string };
}

export async function saveJobLayout(input: {
  layoutId: string;
  jobId: string;
  name: string;
  document: LayoutDocument;
  expectedUpdatedAt: string;
}) {
  requireLayoutsBeta();
  const actor = await requirePermission("layouts.manage");
  const admin = createAdminClient();
  await requireActiveJob(admin, input.jobId);
  const name = validateName(input.name);
  validateDocument(input.document);

  const { data, error } = await admin
    .from("job_layouts")
    .update({
      name,
      document_data: input.document,
      page_count: input.document.pages.length,
      updated_by_employee_id: actor.id,
    })
    .eq("id", input.layoutId)
    .eq("job_id", input.jobId)
    .eq("updated_at", input.expectedUpdatedAt)
    .is("archived_at", null)
    .select("updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("LAYOUT_CONFLICT: This layout changed elsewhere. Your offline draft has been preserved.");
  return data as { updated_at: string };
}

export async function archiveJobLayout(input: { layoutId: string; jobId: string }) {
  requireLayoutsBeta();
  const actor = await requirePermission("layouts.archive");
  const admin = createAdminClient();
  await requireActiveJob(admin, input.jobId);

  const { data: layout, error: lookupError } = await admin
    .from("job_layouts")
    .select("name, preview_storage_path")
    .eq("id", input.layoutId)
    .eq("job_id", input.jobId)
    .is("archived_at", null)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!layout) throw new Error("Layout not found.");

  const { error } = await admin
    .from("job_layouts")
    .update({ archived_at: new Date().toISOString(), archived_by_employee_id: actor.id })
    .eq("id", input.layoutId)
    .eq("job_id", input.jobId);
  if (error) throw new Error(error.message);

  await writeActivity(admin, input.jobId, "layout_archived", `${actor.name} archived layout ${layout.name}`, input.layoutId, "archived");
}

export async function uploadLayoutPreview(input: {
  layoutId: string;
  jobId: string;
  file: File;
}) {
  requireLayoutsBeta();
  await requirePermission("layouts.manage");
  const admin = createAdminClient();
  await requireActiveJob(admin, input.jobId);
  if (input.file.type !== "image/png") throw new Error("Layout preview must be a PNG.");
  if (!input.file.size || input.file.size > 5 * 1024 * 1024) throw new Error("Layout preview exceeds the 5 MB limit.");

  const { data: layout, error: lookupError } = await admin
    .from("job_layouts")
    .select("id, preview_storage_path")
    .eq("id", input.layoutId)
    .eq("job_id", input.jobId)
    .is("archived_at", null)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!layout) throw new Error("Layout not found.");

  const storagePath = `${input.jobId}/layouts/${input.layoutId}/preview.png`;
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: updated, error } = await admin
    .from("job_layouts")
    .update({ preview_storage_path: storagePath })
    .eq("id", input.layoutId)
    .eq("job_id", input.jobId)
    .select("updated_at")
    .single();
  if (error) throw new Error(error.message);
  return { storagePath, updatedAt: updated.updated_at as string };
}

function validateName(value: string) {
  const name = value.trim();
  if (!name || name.length > 120) throw new Error("Layout name must be between 1 and 120 characters.");
  return name;
}

function validateDocument(document: LayoutDocument) {
  if (document.version !== 1 || !Array.isArray(document.pages) || document.pages.length < 1 || document.pages.length > 50) {
    throw new Error("The layout document is invalid.");
  }
  if (!document.pages.some((page) => page.id === document.activePageId)) throw new Error("The active layout page is invalid.");
  let objectCount = 0;
  for (const page of document.pages) {
    if (!page.id || !page.name || page.width < 300 || page.width > 5000 || page.height < 300 || page.height > 5000) {
      throw new Error("A layout page is invalid.");
    }
    if (!Array.isArray(page.objects)) throw new Error("Layout objects are invalid.");
    objectCount += page.objects.length;
  }
  if (objectCount > 10_000) throw new Error("This layout contains too many drawing objects.");
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > MAXIMUM_DOCUMENT_BYTES) {
    throw new Error("This layout exceeds the 3 MB editable-data limit.");
  }
}

async function requireActiveJob(admin: ReturnType<typeof createAdminClient>, jobId: string) {
  await requireEmployee();
  const { data, error } = await admin.from("jobs").select("id").eq("id", jobId).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found or access is unavailable.");
}

async function writeActivity(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  activityType: string,
  description: string,
  oldValue: string | null,
  newValue: string | null,
) {
  const { error } = await admin.from("job_activities").insert({
    job_id: jobId,
    activity_type: activityType,
    description,
    old_value: oldValue,
    new_value: newValue,
  });
  if (error) throw new Error(error.message);
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
