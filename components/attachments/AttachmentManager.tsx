"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileIcon, ImageIcon, Pencil, Trash2, Upload } from "lucide-react";
import { deleteAttachment, editJobAttachment } from "@/app/actions/job-attachments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FILE_CATEGORIES,
  PHOTO_CATEGORIES,
  type AttachmentKind,
  type JobAttachment,
} from "@/components/attachments/types";

type Props = {
  jobId: string;
  kind: AttachmentKind;
  initialAttachments: JobAttachment[];
  canManage: boolean;
  canArchive: boolean;
  compact?: boolean;
};

type UploadState = { name: string; progress: number; status: "uploading" | "done" | "error"; error?: string };

export default function AttachmentManager({ jobId, kind, initialAttachments, canManage, canArchive, compact = false }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState<string>(kind === "photo" ? PHOTO_CATEGORIES[0] : FILE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<JobAttachment | null>(null);
  const [editing, setEditing] = useState<JobAttachment | null>(null);
  const [deleting, setDeleting] = useState<JobAttachment | null>(null);
  const categories = kind === "photo" ? PHOTO_CATEGORIES : FILE_CATEGORIES;
  const attachments = useMemo(
    () => initialAttachments.filter((attachment) => attachment.attachment_kind === kind),
    [initialAttachments, kind],
  );

  async function addFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length || !canManage) return;
    setMessage("");
    setUploads(selected.map((file) => ({ name: file.name, progress: 0, status: "uploading" })));

    let successful = 0;
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      try {
        await uploadFile(file, index);
        successful += 1;
      } catch (error) {
        setUploads((current) => current.map((item, itemIndex) => itemIndex === index
          ? { ...item, status: "error", error: error instanceof Error ? error.message : "Upload failed." }
          : item));
      }
    }

    if (successful) {
      setMessage(`${successful} ${successful === 1 ? "item" : "items"} uploaded successfully.`);
      setDescription("");
      router.refresh();
    }
  }

  function uploadFile(file: File, index: number) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      formData.set("category", category);
      formData.set("description", description);
      const request = new XMLHttpRequest();
      request.open("POST", `/api/jobs/${jobId}/attachments`);
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploads((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, progress } : item));
      };
      request.onload = () => {
        const response = parseResponse(request.responseText);
        if (request.status >= 200 && request.status < 300) {
          setUploads((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, progress: 100, status: "done" } : item));
          resolve();
        } else reject(new Error(response.error ?? "Upload failed."));
      };
      request.onerror = () => reject(new Error("Network error while uploading."));
      request.send(formData);
    });
  }

  return (
    <div>
      {canManage ? (
        <div
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}
          className={`rounded-lg border border-dashed transition ${compact ? "p-3" : "p-5"} ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}`}
        >
          <div className={`flex flex-col lg:flex-row lg:items-end ${compact ? "gap-2" : "gap-4"}`}>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ${compact ? "h-8 w-8" : "h-10 w-10"}`}><Upload className={compact ? "h-4 w-4" : "h-5 w-5"} /></span>
                <div><p className="text-sm font-semibold text-gray-950">Add {kind === "photo" ? "photos" : "files"}</p><p className="text-xs text-gray-500">Drag and drop or browse. Multiple selections supported.</p></div>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={kind === "photo" ? "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" : ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx"}
                capture={kind === "photo" ? "environment" : undefined}
                className="sr-only"
                onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }}
              />
            </div>
            <label className="grid gap-1 text-sm font-medium text-gray-700">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3">{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="grid min-w-64 flex-1 gap-1 text-sm font-medium text-gray-700">Description<Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional notes" /></label>
            <Button type="button" onClick={() => inputRef.current?.click()}>Browse</Button>
          </div>
          {uploads.length ? <div className="mt-4 space-y-2">{uploads.map((upload, index) => <div key={`${upload.name}-${index}`} className="rounded-lg bg-white p-3 text-sm"><div className="flex justify-between gap-3"><span className="truncate font-medium">{upload.name}</span><span className={upload.status === "error" ? "text-red-600" : "text-gray-500"}>{upload.status === "error" ? upload.error : `${upload.progress}%`}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div className={`h-full rounded-full ${upload.status === "error" ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${upload.progress}%` }} /></div></div>)}</div> : null}
          {message ? <p className="mt-3 text-sm font-medium text-green-700">{message}</p> : null}
        </div>
      ) : null}

      {!attachments.length ? (
        <div className={`${compact ? "mt-3 px-3 py-2 text-left" : "mt-5 p-8 text-center"} rounded-lg border border-dashed border-gray-300`}><p className="text-sm font-medium text-gray-900">No {kind === "photo" ? "photos" : "files"} yet. <span className="font-normal text-gray-500">{canManage ? `Use the upload controls above to add the first ${kind}.` : "You do not have permission to upload attachments."}</span></p></div>
      ) : kind === "photo" ? (
        <div className={`${compact ? "mt-3 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" : "mt-5 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"} grid`}>{attachments.map((attachment) => <PhotoTile key={attachment.id} attachment={attachment} compact={compact} onPreview={setPreview} onEdit={canManage ? setEditing : undefined} onArchive={canArchive ? setDeleting : undefined} />)}</div>
      ) : (
        <div className={`${compact ? "mt-3" : "mt-5"} overflow-x-auto rounded-lg border border-gray-200`}><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-gray-50 text-gray-600"><tr><th className="px-3 py-2">File</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Uploaded by</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Size</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{attachments.map((attachment) => <FileRow key={attachment.id} attachment={attachment} onPreview={setPreview} onEdit={canManage ? setEditing : undefined} onArchive={canArchive ? setDeleting : undefined} />)}</tbody></table></div>
      )}

      <PreviewDialog attachment={preview} onClose={() => setPreview(null)} />
      <EditDialog attachment={editing} categories={categories} onClose={() => setEditing(null)} onSave={async (values) => { await editJobAttachment({ jobId, attachmentId: editing!.id, ...values }); setEditing(null); router.refresh(); }} />
      <DeleteDialog attachment={deleting} onClose={() => setDeleting(null)} onConfirm={async () => { await deleteAttachment({ jobId, attachmentId: deleting!.id }); setDeleting(null); router.refresh(); }} />
    </div>
  );
}

function PhotoTile({ attachment, onPreview, onEdit, onArchive, compact = false }: { attachment: JobAttachment; onPreview: (value: JobAttachment) => void; onEdit?: (value: JobAttachment) => void; onArchive?: (value: JobAttachment) => void; compact?: boolean }) {
  const previewable = isBrowserImage(attachment.mime_type);
  return <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"><button type="button" onClick={() => onPreview(attachment)} className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-gray-100">{previewable ? <img src={attachment.signed_url} alt={attachment.description || attachment.file_name} className="h-full w-full object-cover" /> : <div className="text-center text-gray-500"><ImageIcon className="mx-auto h-7 w-7" /><p className="mt-1 text-[11px]">Preview unavailable</p></div>}</button><div className={compact ? "p-2" : "p-3"}><p className="truncate text-sm font-semibold text-gray-950" title={attachment.file_name}>{attachment.file_name}</p><p className="mt-0.5 truncate text-[11px] text-gray-500">{attachment.category} · {formatDate(attachment.created_at)}</p>{!compact ? <p className="mt-1 truncate text-xs text-gray-500">{attachment.uploaded_by?.name ?? "Unknown uploader"}</p> : null}{attachment.description ? <p className={`${compact ? "mt-1 line-clamp-1 text-xs" : "mt-2 line-clamp-2 text-sm"} text-gray-600`}>{attachment.description}</p> : null}<Actions attachment={attachment} onPreview={onPreview} onEdit={onEdit} onArchive={onArchive} /></div></article>;
}

function FileRow({ attachment, onPreview, onEdit, onArchive }: { attachment: JobAttachment; onPreview: (value: JobAttachment) => void; onEdit?: (value: JobAttachment) => void; onArchive?: (value: JobAttachment) => void }) {
  return <tr><td className="px-4 py-3"><button type="button" onClick={() => onPreview(attachment)} className="flex max-w-xs items-center gap-2 font-medium text-gray-950 hover:underline"><FileIcon className="h-4 w-4 shrink-0 text-gray-400" /><span className="truncate">{attachment.file_name}</span></button></td><td className="px-4 py-3 text-gray-600">{attachment.category}</td><td className="px-4 py-3 text-gray-600">{attachment.uploaded_by?.name ?? "Unknown"}</td><td className="px-4 py-3 text-gray-600">{formatDate(attachment.created_at)}</td><td className="px-4 py-3 text-gray-600">{formatSize(attachment.file_size)}</td><td className="px-4 py-3"><Actions attachment={attachment} onPreview={onPreview} onEdit={onEdit} onArchive={onArchive} compact /></td></tr>;
}

function Actions({ attachment, onPreview, onEdit, onArchive, compact = false }: { attachment: JobAttachment; onPreview: (value: JobAttachment) => void; onEdit?: (value: JobAttachment) => void; onArchive?: (value: JobAttachment) => void; compact?: boolean }) {
  return <div className={`flex flex-wrap gap-1 ${compact ? "justify-end" : "mt-3"}`}><IconButton label="Preview" onClick={() => onPreview(attachment)}><Eye /></IconButton><a href={attachment.signed_url} download={attachment.file_name} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100" aria-label="Download"><Download className="h-4 w-4" /></a>{onEdit ? <IconButton label="Edit details" onClick={() => onEdit(attachment)}><Pencil /></IconButton> : null}{onArchive ? <IconButton label="Delete permanently" onClick={() => onArchive(attachment)} danger><Trash2 /></IconButton> : null}</div>;
}

function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) { return <button type="button" onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 [&_svg]:h-4 [&_svg]:w-4 ${danger ? "text-red-600" : "text-gray-500"}`} aria-label={label} title={label}>{children}</button>; }

function PreviewDialog({ attachment, onClose }: { attachment: JobAttachment | null; onClose: () => void }) {
  return <Dialog open={Boolean(attachment)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[92vh] sm:max-w-5xl"><DialogHeader><DialogTitle>{attachment?.file_name}</DialogTitle><DialogDescription>{attachment?.category} · {attachment ? formatSize(attachment.file_size) : ""}</DialogDescription></DialogHeader>{attachment ? <div className="max-h-[70vh] overflow-auto rounded-lg bg-gray-100 p-2">{isBrowserImage(attachment.mime_type) ? <img src={attachment.signed_url} alt={attachment.description || attachment.file_name} className="mx-auto max-h-[68vh] object-contain" /> : attachment.mime_type === "application/pdf" ? <iframe src={attachment.signed_url} title={attachment.file_name} className="h-[68vh] w-full rounded bg-white" /> : <div className="p-12 text-center"><FileIcon className="mx-auto h-12 w-12 text-gray-400" /><p className="mt-3 text-gray-600">This format cannot be previewed in the browser.</p><a href={attachment.signed_url} download={attachment.file_name} className="mt-4 inline-flex rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Download file</a></div>}</div> : null}</DialogContent></Dialog>;
}

function EditDialog({ attachment, categories, onClose, onSave }: { attachment: JobAttachment | null; categories: readonly string[]; onClose: () => void; onSave: (values: { fileName: string; category: string; description: string | null }) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  return <Dialog open={Boolean(attachment)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Edit attachment details</DialogTitle><DialogDescription>The stored object remains private; this changes its displayed name and metadata.</DialogDescription></DialogHeader>{attachment ? <form key={attachment.id} className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(""); const data = new FormData(event.currentTarget); try { await onSave({ fileName: String(data.get("fileName") || ""), category: String(data.get("category") || ""), description: String(data.get("description") || "").trim() || null }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save changes."); setSaving(false); } }}><label className="grid gap-1 text-sm font-medium">File name<Input name="fileName" defaultValue={attachment.file_name} required maxLength={255} /></label><label className="grid gap-1 text-sm font-medium">Category<select name="category" defaultValue={attachment.category} className="h-10 rounded-lg border border-gray-300 bg-white px-3">{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Description<textarea name="description" defaultValue={attachment.description ?? ""} rows={4} className="rounded-lg border border-gray-300 p-3" /></label>{error ? <p className="text-sm text-red-600">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></DialogFooter></form> : null}</DialogContent></Dialog>;
}

function DeleteDialog({ attachment, onClose, onConfirm }: { attachment: JobAttachment | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  return <Dialog open={Boolean(attachment)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Permanently delete attachment?</DialogTitle><DialogDescription>{attachment?.file_name} and its private stored object will be permanently deleted. This cannot be undone.</DialogDescription></DialogHeader>{error ? <p className="text-sm text-red-600">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="button" className="bg-red-600 hover:bg-red-700" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await onConfirm(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete attachment."); setSaving(false); } }}>{saving ? "Deleting..." : "Permanently delete"}</Button></DialogFooter></DialogContent></Dialog>;
}

function isBrowserImage(mime: string) { return ["image/jpeg", "image/png", "image/webp"].includes(mime); }
function formatSize(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
function parseResponse(value: string): { error?: string } { try { return JSON.parse(value) as { error?: string }; } catch { return {}; } }
