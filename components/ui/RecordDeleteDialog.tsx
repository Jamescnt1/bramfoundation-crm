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

type RecordDeleteDialogProps = {
  open: boolean;
  title: string;
  recordName: string;
  description: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export default function RecordDeleteDialog({
  open,
  title,
  recordName,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: RecordDeleteDialogProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function confirm() {
    setIsWorking(true);
    setErrorMessage("");
    try {
      await onConfirm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete this action.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isWorking && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            You are changing <span className="font-semibold text-gray-900">{recordName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          {description}
        </div>
        {errorMessage ? (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" disabled={isWorking} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isWorking} onClick={confirm} className="bg-red-600 text-white hover:bg-red-700">
            {isWorking ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
