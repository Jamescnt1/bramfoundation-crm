"use client";

import { useState } from "react";
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

type QfNumberDialogProps = {
  open: boolean;
  jobName: string;
  targetStatus: string;
  isSaving: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (qfNumber: string) => void;
};

export default function QfNumberDialog({
  open,
  jobName,
  targetStatus,
  isSaving,
  errorMessage,
  onOpenChange,
  onConfirm,
}: QfNumberDialogProps) {
  const [qfNumber, setQfNumber] = useState("");
  const [validationError, setValidationError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = qfNumber.trim();

    if (!trimmed) {
      setValidationError("Enter the QF# before continuing.");
      return;
    }

    setValidationError("");
    onConfirm(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>QF# required</DialogTitle>
            <DialogDescription>
              Add the QFloors reference for {jobName} before moving it to {targetStatus}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <label htmlFor="pipeline-qf-number" className="text-sm font-medium text-gray-900">
              QF#
            </label>
            <Input
              id="pipeline-qf-number"
              value={qfNumber}
              onChange={(event) => setQfNumber(event.target.value)}
              placeholder="Enter QFloors reference"
              autoFocus
              disabled={isSaving}
              className="mt-2"
            />
            {validationError || errorMessage ? (
              <p className="mt-2 text-sm text-red-700">{validationError || errorMessage}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : `Save QF# and move to ${targetStatus}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
