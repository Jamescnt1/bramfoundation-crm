import Link from "next/link";

export default function DashboardSection({
  title,
  description,
  href,
  linkLabel = "View all →",
  className = "",
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
        </div>
        {href ? <Link href={href} className="shrink-0 text-sm font-medium text-gray-500 hover:text-black">{linkLabel}</Link> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
