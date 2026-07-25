"use client";

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
  initialQfNumber?: string | null;
  initialContractAmount?: string | null;
  isSaving: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (values: { qfNumber?: string; contractAmount?: string }) => void;
};

export default function JobRequirementsDialog(props: Props) {
  const [qfNumber, setQfNumber] = useState(props.initialQfNumber ?? "");
  const [contractAmount, setContractAmount] = useState(props.initialContractAmount ?? "");
  const [validationError, setValidationError] = useState("");

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
    setValidationError("");
    props.onConfirm({
      ...(props.requireQfNumber ? { qfNumber: qfNumber.trim() } : {}),
      ...(props.requireContractAmount ? { contractAmount: amount.toFixed(2) } : {}),
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
            {validationError || props.errorMessage ? <p className="text-sm text-red-700">{validationError || props.errorMessage}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.isSaving}>Cancel</Button>
            <Button type="submit" disabled={props.isSaving}>{props.isSaving ? "Saving..." : `Save and move to ${props.targetStatus}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
