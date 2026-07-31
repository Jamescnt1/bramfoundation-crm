import {
  Building2,
  CalendarClock,
  CircleEllipsis,
  Hammer,
  Handshake,
  MapPinned,
  MessageCircleMore,
  Ruler,
  ShoppingBag,
} from "lucide-react";
import type { AppointmentType } from "@/components/calendar/constants";

export const FALLBACK_EMPLOYEE_COLOR = "#475569";
export const FALLBACK_INSTALLER_COLOR = "#475569";

const APPOINTMENT_ICONS: Record<string, typeof CalendarClock> = {
  appointment: CalendarClock,
  measure: Ruler,
  installation: Hammer,
  job_walk: MapPinned,
  material_selection: ShoppingBag,
  builder_meeting: Building2,
  customer_meeting: Handshake,
  follow_up: MessageCircleMore,
  other: CircleEllipsis,
};

export function AppointmentTypeIcon({
  type,
  className = "h-3.5 w-3.5",
}: {
  type: AppointmentType | null;
  className?: string;
}) {
  const Icon = type ? APPOINTMENT_ICONS[type] ?? CircleEllipsis : CalendarClock;
  return <Icon aria-hidden="true" className={className} />;
}

export function normalizeCalendarColor(
  value: string | null | undefined,
  fallback = FALLBACK_EMPLOYEE_COLOR,
) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function getReadableTextColor(background: string) {
  const color = normalizeCalendarColor(background).slice(1);
  const red = Number.parseInt(color.slice(0, 2), 16) / 255;
  const green = Number.parseInt(color.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(color.slice(4, 6), 16) / 255;
  const linearize = (channel: number) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue);

  // WCAG contrast crossover: black reaches 4.5:1 above ~0.175,
  // while white reaches 4.5:1 below ~0.183.
  return luminance > 0.179 ? "#111827" : "#ffffff";
}
