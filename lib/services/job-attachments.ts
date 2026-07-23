import "server-only";

import {
  FILE_CATEGORIES,
  PHOTO_CATEGORIES,
  type AttachmentKind,
  type JobAttachment,
} from "@/components/attachments/types";
import { BETA_PERMANENT_DELETE_ENABLED } from "@/lib/features/beta-permanent-delete";
import { requireAdministrator, requireEmployee, requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "job-attachments";
const SIGNED_URL_SECONDS = 60 * 60;

export async function getJobAttachments(jobId: string): Promise<JobAttachment[]> {
  await requirePermission("attachments.view");
  const admin = createAdminClient();
  await requireActiveJob(admin, jobId);

  const { data, error } = await admin
    .from("job_attachments")
    .select(`
      id, job_id, uploaded_by_employee_id, file_name, storage_path,
      mime_type, file_size, attachment_kind, category, description,
      created_at, updated_at, archived_at,
      uploaded_by:employees!job_attachments_uploaded_by_employee_id_fkey (id, name)
    `)
    .eq("job_id", jobId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => ({
    ...row,
    uploaded_by: Array.isArray(row.uploaded_by) ? row.uploaded_by[0] ?? null : row.uploaded_by,
  }));

  if (!rows.length) return [];

  const { data: signed, error: signedError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((row) => row.storage_path), SIGNED_URL_SECONDS);

  if (signedError) throw new Error(signedError.message);
  const urls = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));

  return rows.map((row) => ({
    ...row,
    signed_url: urls.get(row.storage_path) ?? "",
  })) as JobAttachment[];
}

export async function uploadJobAttachment(input: {
  jobId: string;
  file: File;
  kind: AttachmentKind;
  category: string;
  description: string | null;
}) {
  const actor = await requirePermission("attachments.manage");
  const admin = createAdminClient();
  await requireActiveJob(admin, input.jobId);
  validateFile(input.file, input.kind);
  validateCategory(input.kind, input.category);

  const safeName = sanitizeFileName(input.file.name);
  const folder = input.kind === "photo" ? "photos" : "files";
  const storagePath = `${input.jobId}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await admin
    .from("job_attachments")
    .insert({
      job_id: input.jobId,
      uploaded_by_employee_id: actor.id,
      file_name: input.file.name.slice(0, 255),
      storage_path: storagePath,
      mime_type: input.file.type || mimeFromExtension(input.file.name),
      file_size: input.file.size,
      attachment_kind: input.kind,
      category: input.category,
      description: input.description,
    })
    .select("id")
    .single();

  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  await writeActivity(admin, input.jobId, "attachment_uploaded", `${actor.name} uploaded ${input.file.name}`, null, data.id);
  return data;
}

export async function updateJobAttachmentMetadata(input: {
  attachmentId: string;
  fileName: string;
  category: string;
  description: string | null;
}) {
  const actor = await requirePermission("attachments.manage");
  const admin = createAdminClient();
  const attachment = await getAttachment(admin, input.attachmentId);
  await requireActiveJob(admin, attachment.job_id);

  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > 255) throw new Error("File name must be between 1 and 255 characters.");
  validateCategory(attachment.attachment_kind as AttachmentKind, input.category);

  const { error } = await admin
    .from("job_attachments")
    .update({ file_name: fileName, category: input.category, description: input.description })
    .eq("id", input.attachmentId)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  await writeActivity(
    admin,
    attachment.job_id,
    "attachment_metadata_updated",
    `${actor.name} updated attachment details for ${fileName}`,
    attachment.file_name,
    fileName,
  );
}

export async function archiveJobAttachment(attachmentId: string) {
  const actor = await requirePermission("attachments.archive");
  const admin = createAdminClient();
  const attachment = await getAttachment(admin, attachmentId);
  await requireActiveJob(admin, attachment.job_id);

  const { error } = await admin
    .from("job_attachments")
    .update({ archived_at: new Date().toISOString(), archived_by_employee_id: actor.id })
    .eq("id", attachmentId)
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  await writeActivity(
    admin,
    attachment.job_id,
    "attachment_archived",
    `${actor.name} archived ${attachment.file_name}`,
    attachmentId,
    "archived",
  );
}

export async function deleteJobAttachmentPermanently(attachmentId: string) {
  if (!BETA_PERMANENT_DELETE_ENABLED) throw new Error("Permanent deletion is disabled. Archive this attachment instead.");
  const actor = await requireAdministrator();
  const admin = createAdminClient();
  const attachment = await getAttachment(admin, attachmentId);
  await requireActiveJob(admin, attachment.job_id);

  const { error: linkError } = await admin
    .from("customer_email_attachments")
    .delete()
    .eq("attachment_id", attachmentId);
  if (linkError) throw new Error(linkError.message);

  const { error: storageError } = await admin.storage.from(BUCKET).remove([attachment.storage_path]);
  if (storageError) throw new Error(`The stored file could not be deleted: ${storageError.message}`);

  const { error } = await admin.from("job_attachments").delete().eq("id", attachmentId);
  if (error) throw new Error(error.message);

  await writeActivity(
    admin,
    attachment.job_id,
    "attachment_permanently_deleted_beta",
    `${actor.name} permanently deleted ${attachment.file_name} during beta cleanup`,
    attachmentId,
    "permanently deleted",
  );
}

async function requireActiveJob(admin: ReturnType<typeof createAdminClient>, jobId: string) {
  await requireEmployee();
  const { data, error } = await admin.from("jobs").select("id").eq("id", jobId).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found or access is unavailable.");
}

async function getAttachment(admin: ReturnType<typeof createAdminClient>, attachmentId: string) {
  const { data, error } = await admin
    .from("job_attachments")
    .select("id, job_id, file_name, storage_path, attachment_kind, archived_at")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.archived_at) throw new Error("Attachment not found.");
  return data;
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

const PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const FILE_MIMES = new Set([
  ...PHOTO_MIMES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function validateFile(file: File, kind: AttachmentKind) {
  if (!file.size) throw new Error(`${file.name} is empty.`);
  const maximum = kind === "photo" ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
  if (file.size > maximum) throw new Error(`${file.name} exceeds the ${kind === "photo" ? "20 MB" : "50 MB"} limit.`);
  const mime = file.type || mimeFromExtension(file.name);
  const allowed = kind === "photo" ? PHOTO_MIMES : FILE_MIMES;
  if (!allowed.has(mime)) throw new Error(`${file.name} is not a supported ${kind}.`);
}

function validateCategory(kind: AttachmentKind, category: string) {
  const categories: readonly string[] = kind === "photo" ? PHOTO_CATEGORIES : FILE_CATEGORIES;
  if (!categories.includes(category)) throw new Error("Choose a valid attachment category.");
}

function sanitizeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-180) || "attachment";
}

function mimeFromExtension(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  const values: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    heic: "image/heic", heif: "image/heif", pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return values[extension ?? ""] ?? "application/octet-stream";
}
