import Link from "next/link";
import type { AttentionItem } from "@/lib/services/company-dashboard";

export default function AttentionList({ items, emptyText = "Nothing currently requires attention." }: { items: AttentionItem[]; emptyText?: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">{emptyText}</p>;
  return (
    <div className="divide-y divide-gray-100">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="flex items-start gap-3 py-3 transition hover:bg-gray-50 sm:px-2">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity === "red" ? "bg-red-500" : "bg-amber-500"}`} />
          <span className="min-w-0"><span className="block font-medium text-gray-950">{item.title}</span><span className="mt-0.5 block truncate text-sm text-gray-500">{item.detail}</span></span>
          <span className="ml-auto text-gray-400">→</span>
        </Link>
      ))}
    </div>
  );
}
