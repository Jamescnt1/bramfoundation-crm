"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  getStageStyles,
  resolveConfiguredStage,
  type PipelineStage,
  type PipelineStageView,
} from "@/components/pipeline/constants";

type Props = {
  status: string | null;
  disabled?: boolean;
  canChange?: boolean;
  onChange: (status: PipelineStage) => void;
  className?: string;
  stages: PipelineStageView[];
};

export default function PipelineStatusControl({
  status,
  disabled = false,
  canChange = true,
  onChange,
  className = "",
  stages,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stage = resolveConfiguredStage(status, stages);
  const styles = getStageStyles(stage ?? "");

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  if (!stage) return null;

  if (!canChange) {
    return (
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge} ${className}`}
        title="You do not have permission to change pipeline status."
      >
        <span className={`h-2 w-2 rounded-full ${styles.accent}`} />
        {stage.label}
      </span>
    );
  }

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${styles.badge}`}
      >
        <span className={`h-2 w-2 rounded-full ${styles.accent}`} />
        {stage.label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Pipeline status"
          className="absolute left-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
        >
          {stages.map((option) => {
            const optionStyles = getStageStyles(option);
            return (
              <button
                key={option.slug}
                type="button"
                role="option"
                aria-selected={option.slug === stage.slug}
                onClick={() => {
                  setOpen(false);
                  if (option.slug !== stage.slug) onChange(option.slug);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 ${
                  option.slug === stage.slug ? "bg-gray-50 text-gray-950" : "text-gray-700"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${optionStyles.accent}`} />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
