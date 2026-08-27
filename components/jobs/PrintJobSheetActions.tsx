"use client";

import { ArrowLeft, Printer } from "lucide-react";

export default function PrintJobSheetActions({ jobId }: { jobId: string }) {
  return (
    <div className="print:hidden mx-auto mb-4 flex max-w-[8.5in] items-center justify-between gap-3">
      <a
        href={`/leads/${jobId}`}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back to job
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="foundation-primary-action h-9 gap-2 rounded-md px-4 text-sm"
      >
        <Printer className="h-4 w-4" /> Print / Save PDF
      </button>
    </div>
  );
}
