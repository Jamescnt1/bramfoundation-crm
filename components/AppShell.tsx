"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AppSidebar, { NavigationLinks } from "@/components/AppSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import type { Employee } from "@/lib/services/employees";
import { getRoleLabel } from "@/lib/auth/roles";

export default function AppShell({ children, employee }: { children: React.ReactNode; employee: Employee | null }) {
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
                <p className="text-xs text-gray-500">Bram Flooring</p>
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
              <Link
                href="/leads/new"
                onClick={() => setMobileNavigationOpen(false)}
                className="flex w-full items-center justify-center rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                + New Lead
              </Link>
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
            <p className="font-semibold text-gray-900">Foundation Flooring</p>
            <p className="hidden text-sm text-gray-500 sm:block">Sales Operations</p>
            </div>
          </div>
          <div className="min-w-0 text-right">
            <p className="max-w-28 truncate text-sm font-medium text-gray-900 sm:max-w-none">{employee?.name ?? "Foundation CRM"}</p>
            <p className="hidden text-xs text-gray-500 sm:block">{employee ? getRoleLabel(employee.role) : "Employee"}</p>
            {employee ? <SignOutButton /> : null}
          </div>
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}
