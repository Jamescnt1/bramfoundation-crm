import type { ReactNode } from "react";

export function WorkspaceCard({ title, count, action, children, className = "" }: { title: string; count?: number; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-gray-950" title={title}>{title}</h2>
          {count !== undefined ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{count}</span> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function WorkspaceSectionHeader({ title, description, count, action }: { title: string; description?: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-950">{title}</h2>
          {count !== undefined ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{count}</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function WorkspaceEmpty({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"><span>{text}</span>{action}</div>;
}

export function WorkspaceError({ text }: { text: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{text}</div>;
}
