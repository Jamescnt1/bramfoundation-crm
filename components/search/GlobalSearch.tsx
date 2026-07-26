"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  FileText,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalSearchResponse, GlobalSearchResult, GlobalSearchResultType } from "@/lib/search/types";

const groupOrder: GlobalSearchResultType[] = [
  "customer", "contact", "lead", "job", "task", "appointment", "employee", "file",
];
const groupLabels: Record<GlobalSearchResultType, string> = {
  customer: "Customers",
  contact: "Contacts",
  job: "Jobs",
  lead: "Leads",
  task: "Tasks",
  appointment: "Appointments",
  employee: "Employees",
  file: "Files & Photos",
};
const icons = {
  customer: UserRound,
  contact: UserRound,
  job: BriefcaseBusiness,
  lead: BriefcaseBusiness,
  task: CheckSquare,
  appointment: CalendarDays,
  employee: UsersRound,
  file: FileText,
} satisfies Record<GlobalSearchResultType, typeof Search>;

export default function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const grouped = useMemo(
    () => groupOrder.map((type) => ({ type, items: results.filter((item) => item.type === type) })).filter((group) => group.items.length),
    [results],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const body = (await response.json()) as GlobalSearchResponse & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Search is unavailable.");
        setResults(body.results);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Search is unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function openResult(result: GlobalSearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      openResult(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className="flex h-9 w-36 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 shadow-sm transition focus-within:w-52 focus-within:border-gray-500 sm:w-44 sm:focus-within:w-64">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setOpen(true);
            setActiveIndex(-1);
            setError("");
            if (value.trim().length < 2) {
              setResults([]);
              setLoading(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          aria-label="Search Foundation CRM"
          aria-controls="global-search-results"
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
        <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500 md:block">⌘K</kbd>
      </div>

      {open && query.trim().length >= 2 ? (
        <div
          id="global-search-results"
          className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[min(70vh,36rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[28rem]"
        >
          {loading ? <State text="Searching..." /> : null}
          {!loading && error ? <State text={error} danger /> : null}
          {!loading && !error && results.length === 0 ? <State text="No results" /> : null}
          {!loading && !error
            ? grouped.map((group) => (
                <section key={group.type} className="not-first:mt-2">
                  <h2 className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {groupLabels[group.type]}
                  </h2>
                  {group.items.map((result) => {
                    const Icon = icons[result.type];
                    const index = results.indexOf(result);
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => openResult(result)}
                        className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left ${activeIndex === index ? "bg-gray-100" : "hover:bg-gray-50"}`}
                      >
                        <span className="mt-0.5 rounded-md bg-gray-100 p-1.5 text-gray-600"><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{result.title}</span>
                          {result.subtitle ? <span className="mt-0.5 block truncate text-xs text-gray-500">{result.subtitle}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function State({ text, danger = false }: { text: string; danger?: boolean }) {
  return <p className={`px-4 py-8 text-center text-sm ${danger ? "text-red-600" : "text-gray-500"}`}>{text}</p>;
}
