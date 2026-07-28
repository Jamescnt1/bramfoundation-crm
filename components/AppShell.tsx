"use client";

import Link from "next/link";
import { Menu, Plus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AppSidebar, { NavigationLinks } from "@/components/AppSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import GlobalSearch from "@/components/search/GlobalSearch";
import type { Employee } from "@/lib/services/employees";
import { getRoleLabel } from "@/lib/auth/roles";

type AppShellProps = {
  children: React.ReactNode;
  employee: Employee | null;
  companyName: string | null;
};

export default function AppShell({
  children,
  employee,
  companyName,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <AppSidebar employee={employee} />

      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavigationOpen(false)}
          />
          <aside className="relative h-full w-[min(20rem,88vw)] overflow-y-auto bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
              <div>
                <p className="font-bold text-gray-900">Foundation CRM</p>
                <p className="text-xs text-gray-500">Flooring Sales Management</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavigationOpen(false)}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 pb-0">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/leads/new"
                  onClick={() => setMobileNavigationOpen(false)}
                  className="flex items-center justify-center rounded-lg bg-black px-3 py-3 text-sm font-semibold text-white"
                >
                  + New Lead
                </Link>
                <Link
                  href="/tasks?new=1"
                  onClick={() => setMobileNavigationOpen(false)}
                  className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-800"
                >
                  + New Task
                </Link>
              </div>
            </div>
            <NavigationLinks
              employee={employee}
              pathname={pathname}
              onNavigate={() => setMobileNavigationOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:h-20 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavigationOpen(true)}
              className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">
                {companyName ?? "Company"}
              </p>
              <p className="hidden text-sm text-gray-500 sm:block">
                Sales Operations
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/leads/new"
                className="inline-flex h-9 items-center rounded-full bg-black px-3 text-sm font-semibold text-white hover:bg-gray-800 sm:px-4"
              >
                <span className="sm:hidden">+ Lead</span>
                <span className="hidden sm:inline">+ New Lead</span>
              </Link>
              <Link
                href="/tasks?new=1"
                aria-label="Create a new task"
                className="inline-flex h-9 items-center rounded-full border border-gray-300 bg-white px-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 sm:px-4"
              >
                <Plus className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">+ New Task</span>
              </Link>
            </div>
            <GlobalSearch key={pathname} />
            <div className="hidden min-w-0 text-right lg:block">
              <p className="max-w-36 truncate text-sm font-medium text-gray-900">{employee?.name ?? "Foundation CRM"}</p>
              <p className="text-xs text-gray-500">{employee ? getRoleLabel(employee.role) : "Employee"}</p>
              {employee ? <SignOutButton /> : null}
            </div>
          </div>
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}
