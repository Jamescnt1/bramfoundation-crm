"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AppSidebar, { NavigationLinks } from "@/components/AppSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import FoundationBrand from "@/components/branding/FoundationBrand";
import GlobalSearch from "@/components/search/GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Employee } from "@/lib/services/employees";
import { getRoleLabel } from "@/lib/auth/roles";
import ProfilePhotoDialog from "@/components/account/ProfilePhotoDialog";

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
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);

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
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/sms-terms"
  ) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-full overflow-x-hidden overscroll-x-none [@supports(overflow:clip)]:overflow-x-clip">
      <AppSidebar employee={employee} />

      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavigationOpen(false)}
          />
          <aside className="relative h-full w-[min(20rem,88vw)] overflow-y-auto bg-gray-900 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-800 px-5">
              <FoundationBrand compact onNavigate={() => setMobileNavigationOpen(false)} />
              <button
                type="button"
                onClick={() => setMobileNavigationOpen(false)}
                className="rounded-lg p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
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
                  className="flex items-center justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  + New Lead
                </Link>
                <Link
                  href="/tasks?new=1"
                  onClick={() => setMobileNavigationOpen(false)}
                  className="flex items-center justify-center rounded-md border border-gray-600 bg-gray-800 px-3 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  + New Task
                </Link>
              </div>
              {employee ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavigationOpen(false);
                    setProfilePhotoOpen(true);
                  }}
                  className="mt-3 flex w-full items-center gap-3 rounded-md border border-gray-700 bg-gray-800 px-3 py-2.5 text-left text-white hover:bg-gray-700 sm:hidden"
                >
                  <Avatar className="ring-1 ring-white/25">
                    <AvatarImage src={employee.avatar_url ?? undefined} alt="" />
                    <AvatarFallback style={{ backgroundColor: employee.color }} className="font-semibold text-white">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{employee.name}</span>
                    <span className="block text-xs text-gray-400">Change profile photo</span>
                  </span>
                </button>
              ) : null}
            </div>
            <NavigationLinks
              employee={employee}
              pathname={pathname}
              onNavigate={() => setMobileNavigationOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden [@supports(overflow:clip)]:overflow-x-clip">
        <header className="flex h-16 w-full min-w-0 max-w-full items-center justify-between gap-3 border-b border-gray-700 bg-gray-900 px-4 text-white shadow-sm md:h-20 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavigationOpen(true)}
              className="shrink-0 rounded-md border border-gray-700 p-2 text-gray-200 hover:bg-gray-800 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">
                {companyName ?? "Company"}
              </p>
              <p className="hidden text-sm text-gray-400 sm:block">
                Sales Operations
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/leads/new"
                className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 sm:px-4"
              >
                <span className="sm:hidden">+ Lead</span>
                <span className="hidden sm:inline">+ New Lead</span>
              </Link>
              <Link
                href="/tasks?new=1"
                aria-label="Create a new task"
                className="inline-flex h-9 items-center rounded-md border border-gray-600 bg-gray-800 px-2.5 text-sm font-semibold text-white hover:bg-gray-700 sm:px-4"
              >
                <span className="sm:hidden">+ Task</span>
                <span className="hidden sm:inline">+ New Task</span>
              </Link>
            </div>
            <GlobalSearch key={pathname} />
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              {employee ? (
                <button
                  type="button"
                  onClick={() => setProfilePhotoOpen(true)}
                  className="rounded-full outline-none transition hover:ring-2 hover:ring-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Change profile photo"
                  title="Change profile photo"
                >
                  <Avatar size="lg" className="ring-1 ring-white/25">
                    <AvatarImage src={employee.avatar_url ?? undefined} alt="" />
                    <AvatarFallback style={{ backgroundColor: employee.color }} className="font-semibold text-white">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <Avatar size="lg" className="ring-1 ring-white/25">
                  <AvatarFallback style={{ backgroundColor: "#3f6e8c" }} className="font-semibold text-white">FC</AvatarFallback>
                </Avatar>
              )}
              <div className="hidden min-w-0 text-right lg:block">
                <p className="max-w-36 truncate text-sm font-medium text-white">{employee?.name ?? "Foundation CRM"}</p>
                <p className="text-xs text-gray-400">{employee ? getRoleLabel(employee.role) : "Employee"}</p>
                {employee ? <SignOutButton /> : null}
              </div>
            </div>
          </div>
        </header>
        <div className="w-full min-w-0 max-w-full overflow-x-hidden [@supports(overflow:clip)]:overflow-x-clip">{children}</div>
      </div>
      {employee && profilePhotoOpen ? (
        <ProfilePhotoDialog employee={employee} open onOpenChange={setProfilePhotoOpen} />
      ) : null}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
