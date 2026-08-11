import Link from "next/link";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  compact?: boolean;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel = "Back",
  actions,
  compact = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex text-sm font-medium text-gray-600 transition hover:text-gray-950"
          >
            ← {backLabel}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="text-sm font-medium text-gray-500">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            "font-bold tracking-tight text-gray-950",
            compact ? "text-2xl" : "text-3xl",
            eyebrow && "mt-1",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-gray-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
