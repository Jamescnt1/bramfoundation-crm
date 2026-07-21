export const PHOTO_CATEGORIES = [
  "Before",
  "Measure",
  "Installation",
  "Damage",
  "Completion",
  "Miscellaneous",
] as const;

export const FILE_CATEGORIES = [
  "Customer Document",
  "Measurement",
  "Diagram",
  "Signed Document",
  "Product Information",
  "Change Order",
  "Insurance",
  "Miscellaneous",
] as const;

export type AttachmentKind = "photo" | "file";

export type JobAttachment = {
  id: string;
  job_id: string;
  uploaded_by_employee_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  attachment_kind: AttachmentKind;
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  uploaded_by: { id: string; name: string } | null;
  signed_url: string;
};
