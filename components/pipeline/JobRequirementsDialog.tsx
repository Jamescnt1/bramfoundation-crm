"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  jobName: string;
  targetStatus: string;
  requireQfNumber: boolean;
  requireContractAmount: boolean;
  requireInstallAppointment?: boolean;
  requireWorkOrdersSent?: boolean;
  installationsHref?: string;
  scheduleInstallHref?: string;
  onScheduleInstall?: () => void;
  initialQfNumber?: string | null;
  initialContractAmount?: string | null;
  showInstallationQuestion?: boolean;
  showProductionSetup?: boolean;
  materialCategories?: { id: string; name: string; abbreviation: string }[];
  initialInstallationRequired?: boolean;
  isSaving: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (values: { qfNumber?: string; contractAmount?: string; installationRequired?: boolean; materialCategoryIds?: string[] }) => void;
};

export default function JobRequirementsDialog(props: Props) {
  const [qfNumber, setQfNumber] = useState(props.initialQfNumber ?? "");
  const [contractAmount, setContractAmount] = useState(props.initialContractAmount ?? "");
  const [installationRequired, setInstallationRequired] = useState(
    props.initialInstallationRequired ?? true,
  );
  const [validationError, setValidationError] = useState("");
  const [materialCategoryIds, setMaterialCategoryIds] = useState<string[]>([]);
  const [noMaterialsRequired, setNoMaterialsRequired] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.requireQfNumber && !qfNumber.trim()) {
      setValidationError("Enter the QF# before continuing.");
      return;
    }
    const amount = Number(contractAmount.replace(/[$,\s]/g, ""));
    if (props.requireContractAmount && (!Number.isFinite(amount) || amount <= 0)) {
      setValidationError("Enter a positive Contract Amount before continuing.");
      return;
    }
    if (props.showProductionSetup && !noMaterialsRequired && !materialCategoryIds.length) {
      setValidationError("Choose at least one material category or select No materials required.");
      return;
    }
    setValidationError("");
    props.onConfirm({
      ...(props.requireQfNumber ? { qfNumber: qfNumber.trim() } : {}),
      ...(props.requireContractAmount ? { contractAmount: amount.toFixed(2) } : {}),
      ...(props.showInstallationQuestion ? { installationRequired } : {}),
      ...(props.showProductionSetup ? { materialCategoryIds: noMaterialsRequired ? [] : materialCategoryIds } : {}),
    });
  }

  return (
    <Dialog open={props.open} onOpenChange={(next) => !props.isSaving && props.onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Job information required</DialogTitle>
            <DialogDescription>
              Complete the required sales details for {props.jobName} before moving it to {props.targetStatus}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-6">
            {props.requireQfNumber ? (
              <label className="block text-sm font-medium text-gray-900">
                QF#
                <Input value={qfNumber} onChange={(event) => setQfNumber(event.target.value)} placeholder="Enter QFloors reference" disabled={props.isSaving} className="mt-2" />
              </label>
            ) : null}
            {props.requireContractAmount ? (
              <label className="block text-sm font-medium text-gray-900">
                Contract Amount
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">$</span>
                  <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={contractAmount} onChange={(event) => setContractAmount(event.target.value)} placeholder="0.00" disabled={props.isSaving} className="pl-7" />
                </div>
                <span className="mt-1 block text-xs font-normal text-gray-500">Used for CRM pipeline reporting only. QFloors remains the accounting system.</span>
              </label>
            ) : null}
            {props.showInstallationQuestion ? (
              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-sm font-semibold text-gray-950">Installation planning</legend>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Will this job require one or more Foundation-managed installation crews?
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInstallationRequired(true)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      installationRequired
                        ? "border-gray-950 bg-gray-950 text-white"
                        : "border-gray-300 bg-white text-gray-700"
                    }`}
                  >
                    Yes, crews needed
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallationRequired(false)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      !installationRequired
                        ? "border-gray-950 bg-gray-950 text-white"
                        : "border-gray-300 bg-white text-gray-700"
                    }`}
                  >
                    No crews needed
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Crew assignments and work orders can be managed from the job’s Installations tab.
                </p>
              </fieldset>
            ) : null}
            {props.showProductionSetup ? (
              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-sm font-semibold text-gray-950">Production setup</legend>
                <p className="mt-1 text-xs leading-5 text-gray-600">Select the material groups included in this job. More scopes can be added from Production.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(props.materialCategories ?? []).map((category) => <label key={category.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${materialCategoryIds.includes(category.id) ? "border-[#3f6e8c] bg-blue-50 text-blue-950" : "border-gray-200"}`}><input type="checkbox" checked={materialCategoryIds.includes(category.id)} disabled={noMaterialsRequired || props.isSaving} onChange={(event) => setMaterialCategoryIds(event.target.checked ? [...materialCategoryIds, category.id] : materialCategoryIds.filter((id) => id !== category.id))} /><span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white">{category.abbreviation}</span>{category.name}</label>)}
                </div>
                <label className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-sm"><input type="checkbox" checked={noMaterialsRequired} disabled={props.isSaving} onChange={(event) => { setNoMaterialsRequired(event.target.checked); if (event.target.checked) setMaterialCategoryIds([]); }} />No materials required</label>
              </fieldset>
            ) : null}
            {props.requireInstallAppointment && installationRequired ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-sm font-semibold text-indigo-950">Install date required</p>
                <p className="mt-1 text-xs leading-5 text-indigo-800">
                  Schedule a non-cancelled installation appointment before moving this job to Install Scheduled.
                </p>
                {props.onScheduleInstall ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 bg-white"
                    onClick={props.onScheduleInstall}
                    disabled={props.isSaving}
                  >
                    Schedule
                  </Button>
                ) : props.scheduleInstallHref ? (
                  <Link
                    href={props.scheduleInstallHref}
                    className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
                  >
                    Open job to schedule install
                  </Link>
                ) : null}
              </div>
            ) : null}
            {props.requireWorkOrdersSent && installationRequired ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">Crew work orders still pending</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Every active installation crew must have its work order marked sent before this pipeline stage can be used.
                </p>
                {props.installationsHref ? (
                  <Link
                    href={props.installationsHref}
                    className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-amber-300 bg-white px-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100"
                  >
                    Open installations
                  </Link>
                ) : null}
              </div>
            ) : null}
            {validationError || props.errorMessage ? <p className="text-sm text-red-700">{validationError || props.errorMessage}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.isSaving}>Cancel</Button>
            <Button
              type="submit"
              disabled={
                props.isSaving ||
                (props.requireInstallAppointment && installationRequired) ||
                (props.requireWorkOrdersSent && installationRequired)
              }
            >
              {props.isSaving ? "Saving..." : `Save and move to ${props.targetStatus}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
