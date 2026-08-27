"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PrintOption =
  | "contacts"
  | "schedule"
  | "production"
  | "jobNotes"
  | "employeeNotes"
  | "accessCode";

const optionLabels: Array<{
  id: PrintOption;
  label: string;
  description: string;
}> = [
  { id: "contacts", label: "Contacts", description: "Company, project, and job-site contacts" },
  { id: "schedule", label: "Schedule", description: "Upcoming appointments and installation dates" },
  { id: "production", label: "Production", description: "Material status, ETA, and installer assignment" },
  { id: "jobNotes", label: "Job information notes", description: "The notes saved on the job record" },
  { id: "employeeNotes", label: "Recent employee notes", description: "Internal notes — include only when appropriate" },
  { id: "accessCode", label: "Lock-box / access code", description: "Sensitive site-access information" },
];

const initialSelection: Record<PrintOption, boolean> = {
  contacts: true,
  schedule: true,
  production: true,
  jobNotes: true,
  employeeNotes: false,
  accessCode: false,
};

export default function PrintJobDetailsDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState(initialSelection);

  function openPrintSheet() {
    const query = new URLSearchParams(
      Object.entries(selected).map(([key, value]) => [key, value ? "1" : "0"]),
    );
    window.open(`/leads/${jobId}/print?${query.toString()}`, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Print job details</DialogTitle>
          <DialogDescription>
            Choose what belongs on the compact handoff sheet. Contract amount is never included.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {optionLabels.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected[option.id]}
                onChange={(event) =>
                  setSelected((current) => ({ ...current, [option.id]: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                <span className="block text-xs text-gray-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={openPrintSheet}>
            <Printer /> Open print sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
