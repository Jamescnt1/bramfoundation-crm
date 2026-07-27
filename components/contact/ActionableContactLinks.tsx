"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

type SharedLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "children"> & {
  value: string | null | undefined;
  label?: string;
  showIcon?: boolean;
};

const linkClass =
  "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-sm text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export function normalizePhoneHref(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const extensionMatch = trimmed.match(/(?:ext\.?|extension|x)\s*(\d+)\s*$/i);
  const base = extensionMatch ? trimmed.slice(0, extensionMatch.index).trim() : trimmed;
  const digits = base.replace(/\D/g, "");
  if (!digits) return null;

  const number = base.startsWith("+") ? `+${digits}` : digits;
  return extensionMatch ? `tel:${number};ext=${extensionMatch[1]}` : `tel:${number}`;
}

export function normalizeEmailHref(value: string | null | undefined) {
  const email = value?.trim();
  if (!email || /[\r\n]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return `mailto:${email}`;
}

export function normalizeMapsHref(value: string | null | undefined) {
  const address = value?.trim();
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function appleMapsHref(address: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

function androidMapsHref(address: string) {
  return `geo:0,0?q=${encodeURIComponent(address)}`;
}

export function PhoneLink({
  value,
  label,
  showIcon = false,
  className,
  ...props
}: SharedLinkProps) {
  const href = normalizePhoneHref(value);
  const display = value?.trim();
  if (!href || !display) return null;

  return (
    <a
      href={href}
      aria-label={label ? `Call ${label}` : `Call ${display}`}
      className={cn(className, linkClass)}
      {...props}
    >
      {showIcon ? <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" /> : null}
      <span className="break-words">{display}</span>
    </a>
  );
}

export function EmailLink({
  value,
  label,
  showIcon = false,
  className,
  ...props
}: SharedLinkProps) {
  const href = normalizeEmailHref(value);
  const display = value?.trim();
  if (!href || !display) return null;

  return (
    <a
      href={href}
      aria-label={label ? `Email ${label}` : `Email ${display}`}
      className={cn(className, linkClass)}
      {...props}
    >
      {showIcon ? <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" /> : null}
      <span className="break-all">{display}</span>
    </a>
  );
}

export function AddressLink({
  value,
  label,
  showIcon = false,
  className,
  onClick,
  ...props
}: SharedLinkProps) {
  const href = normalizeMapsHref(value);
  const address = value?.trim();
  if (!href || !address) return null;
  const appleHref = appleMapsHref(address);
  const androidHref = androidMapsHref(address);

  function openDeviceMaps(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isAndroid) {
      event.preventDefault();
      window.location.assign(androidHref);
      return;
    }

    if (isAppleMobile) {
      event.preventDefault();
      window.open(appleHref, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={openDeviceMaps}
      aria-label={label ? `Open directions to ${label}` : `Open directions to ${address}`}
      className={cn(className, linkClass)}
      {...props}
    >
      {showIcon ? <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" /> : null}
      <span className="whitespace-pre-line break-words">{address}</span>
    </a>
  );
}
