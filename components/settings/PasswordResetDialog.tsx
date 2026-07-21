"use client";

import { type FormEvent, useState } from "react";
import type { Employee } from "@/lib/services/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PasswordResetDialog({
  employee,
  open,
  onOpenChange,
  onReset,
}: {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    try {
      await onReset(password);
      setPassword("");
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reset password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Issue temporary password</DialogTitle>
            <DialogDescription>
              Set a temporary password for {employee?.name ?? "this employee"}. They will be required to replace it after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <label htmlFor="temporary-password" className="mb-2 block text-sm font-medium text-gray-700">Temporary password</label>
            <Input id="temporary-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <p className="mt-2 text-xs text-gray-500">At least 10 characters with uppercase, lowercase, a number, and a symbol.</p>
            {errorMessage ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Updating…" : "Set temporary password"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
