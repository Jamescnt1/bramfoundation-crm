import Link from "next/link";
import type { RecentActivityItem } from "@/lib/services/company-dashboard";

export default function RecentActivityFeed({ items }: { items: RecentActivityItem[] }) {
  if (!items.length) return <p className="py-6 text-sm text-gray-500">No recent activity.</p>;
  return <div className="divide-y divide-gray-100">{items.slice(0, 12).map((item) => <Link key={item.id} href={item.href} className="flex gap-3 py-3 hover:bg-gray-50 sm:px-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" /><span className="min-w-0"><span className="block text-sm text-gray-900"><strong>{item.employeeName}</strong> · {item.description}</span><span className="mt-1 block text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span></span></Link>)}</div>;
}
