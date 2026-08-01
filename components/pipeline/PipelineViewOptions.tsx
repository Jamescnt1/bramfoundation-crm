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
import type { PipelineCardSize } from "@/app/pipeline/actions";

export type PipelineEmployeeOption = {
  id: string;
  name: string;
  color: string;
};

export type PipelineViewOptionsValue = {
  cardSize: PipelineCardSize;
  employeeIds: string[];
};

type Props = {
  open: boolean;
  value: PipelineViewOptionsValue;
  employees: PipelineEmployeeOption[];
  onOpenChange: (open: boolean) => void;
  onApply: (value: PipelineViewOptionsValue) => Promise<void>;
};

const sizes: Array<{ value: PipelineCardSize; label: string; description: string }> = [
  { value: "small", label: "Small", description: "Names and critical warnings" },
  { value: "medium", label: "Medium", description: "Names, owner, and next action" },
  { value: "large", label: "Large", description: "Current comfortable view" },
];

export default function PipelineViewOptions({ open, value, employees, onOpenChange, onApply }: Props) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleEmployee(employeeId: string) {
    setDraft((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employeeId)
        ? current.employeeIds.filter((id) => id !== employeeId)
        : [...current.employeeIds, employeeId],
    }));
  }

  async function apply() {
    setSaving(true);
    setError("");
    try {
      await onApply(draft);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save pipeline options.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-x-0 top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-2xl p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(86dvh,42rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-gray-200 px-5 py-4 pr-12">
          <DialogTitle>Pipeline Filters &amp; View</DialogTitle>
          <DialogDescription>
            Adjust the company pipeline without changing which jobs belong in it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900">Job size</legend>
            <p className="mt-1 text-xs text-gray-500">Your selection follows your Foundation account.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {sizes.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, cardSize: size.value }))}
                  className={`rounded-lg border px-3 py-3 text-left transition ${
                    draft.cardSize === size.value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="block text-sm font-semibold">{size.label}</span>
                  <span className={`mt-1 hidden text-[11px] leading-4 sm:block ${draft.cardSize === size.value ? "text-gray-300" : "text-gray-500"}`}>
                    {size.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-semibold text-gray-900">Employees</legend>
              <button
                type="button"
                onClick={() => setDraft((current) => ({ ...current, employeeIds: [] }))}
                className="text-xs font-semibold text-gray-600 hover:text-black"
              >
                All Employees
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">The Pipeline remains company-wide unless you temporarily narrow this view.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {employees.map((employee) => (
                <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={draft.employeeIds.includes(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                  />
                  <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: employee.color }} aria-hidden="true" />
                  <span className="min-w-0 truncate text-sm font-medium text-gray-800">{employee.name}</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={draft.employeeIds.includes("unassigned")}
                  onChange={() => toggleEmployee("unassigned")}
                />
                <span className="h-3 w-3 rounded-full bg-gray-300 ring-1 ring-black/10" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-800">Unassigned</span>
              </label>
            </div>
          </fieldset>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </div>

        <DialogFooter className="m-0 shrink-0 px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void apply()} disabled={saving}>{saving ? "Saving…" : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
