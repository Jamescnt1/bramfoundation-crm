"use client";

import { type ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import type { Employee } from "@/lib/services/employees";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

type Props = {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ProfilePhotoDialog({ employee, open, onOpenChange }: Props) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState(employee.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setPhoto(selected);
    setError("");
    if (!selected) {
      setPreview(employee.avatar_url ?? "");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(selected);
  }

  async function savePhoto() {
    if (!photo) return;
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", photo);
      await updatePhoto("POST", body);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your profile photo.");
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto() {
    setSaving(true);
    setError("");
    try {
      await updatePhoto("DELETE");
      setPhoto(null);
      setPreview("");
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove your profile photo.");
    } finally {
      setSaving(false);
    }
  }

  async function updatePhoto(method: "POST" | "DELETE", body?: FormData) {
    const response = await fetch(`/api/employees/${employee.id}/avatar`, { method, body });
    const result = (await response.json()) as { employee?: Employee; error?: string };
    if (!response.ok || !result.employee) {
      throw new Error(result.error ?? "Unable to update your profile photo.");
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Photo</DialogTitle>
          <DialogDescription>Choose the photo shown throughout your Foundation account.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          <Avatar className="size-28">
            <AvatarImage src={preview || undefined} alt="" />
            <AvatarFallback style={{ backgroundColor: employee.color }} className="text-2xl font-semibold text-white">
              {getInitials(employee.name)}
            </AvatarFallback>
          </Avatar>

          <div className="w-full">
            <label htmlFor="profile-photo" className="text-sm font-medium text-gray-800">Choose a photo</label>
            <Input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choosePhoto}
              disabled={saving}
              className="mt-2"
            />
            <p className="mt-2 text-xs text-gray-500">JPG, PNG, or WebP. Maximum 5 MB.</p>
          </div>

          {error ? <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </div>

        <DialogFooter>
          {employee.avatar_url ? (
            <Button type="button" variant="outline" onClick={() => void removePhoto()} disabled={saving} className="text-red-700">
              Remove Photo
            </Button>
          ) : null}
          <Button type="button" onClick={() => void savePhoto()} disabled={!photo || saving}>
            <Camera /> {saving ? "Saving…" : "Save Photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
