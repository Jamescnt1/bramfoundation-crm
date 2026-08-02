import Link from "next/link";
import type { AttentionItem } from "@/lib/services/company-dashboard";

export default function AttentionList({ items, emptyText = "Nothing currently requires attention." }: { items: AttentionItem[]; emptyText?: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">{emptyText}</p>;
  return (
    <div className="divide-y divide-gray-100">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="flex items-start gap-3 py-3.5 transition hover:bg-gray-50 sm:px-2">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            item.severity === "critical"
              ? "bg-red-500"
              : item.severity === "important"
                ? "bg-amber-500"
                : "bg-blue-500"
          }`} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-950">{item.title}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{item.assignedEmployee}</span>
            </span>
            {item.subject ? <span className="mt-1 block text-sm font-medium text-gray-800">{item.subject}</span> : null}
            <span className="mt-0.5 block text-sm leading-5 text-gray-500">{item.detail}</span>
          </span>
          <span className="ml-auto shrink-0 pt-1 text-gray-400">→</span>
        </Link>
      ))}
    </div>
  );
}
