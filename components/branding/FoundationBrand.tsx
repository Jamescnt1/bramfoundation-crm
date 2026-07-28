import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type FoundationBrandProps = {
  compact?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export default function FoundationBrand({
  compact = false,
  className,
  onNavigate,
}: FoundationBrandProps) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label="Foundation CRM home"
      className={cn(
        "block overflow-hidden rounded-[3px] bg-[#e7e6e3] shadow-[0_1px_0_rgb(255_255_255/0.08)] ring-1 ring-white/10 transition hover:ring-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        compact ? "w-[152px]" : "w-[205px]",
        className,
      )}
    >
      <Image
        src="/foundation-crm-logo.png"
        alt="Foundation CRM"
        width={335}
        height={99}
        priority
        className="h-auto w-full"
      />
    </Link>
  );
}
