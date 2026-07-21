"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Employee } from "@/lib/services/employees";
import { canViewCompanyDashboard } from "@/lib/auth/roles";

const navigation = [
  {
    name: "My Dashboard",
    href: "/my-dashboard",
  },
  {
    name: "Leads",
    href: "/leads",
  },
  {
    name: "Customers",
    href: "/customers",
  },
  {
    name: "Pipeline",
    href: "/pipeline",
  },
  {
    name: "Calendar",
    href: "/calendar",
  },
  {
    name: "Tasks",
    href: "/tasks",
  },
  {
    name: "Settings",
    href: "/settings",
  },
];

export function getNavigationItems(employee: Employee | null) {
  return employee && canViewCompanyDashboard(employee.role)
    ? [{ name: "Company Dashboard", href: "/company" }, ...navigation]
    : navigation;
}

export function NavigationLinks({
  employee,
  pathname,
  onNavigate,
}: {
  employee: Employee | null;
  pathname: string;
  onNavigate?: () => void;
}) {
  const items = getNavigationItems(employee);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <nav className="space-y-1 p-4">
      {items.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${
              active
                ? "bg-black text-white"
                : "text-gray-700 hover:bg-gray-100 hover:text-black"
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppSidebar({ employee }: { employee: Employee | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
      <div className="flex h-20 items-center border-b border-gray-200 px-6">
        <div>
          <p className="text-lg font-bold text-gray-900">
            Foundation CRM
          </p>

          <p className="text-xs text-gray-500">
            Flooring Sales Management
          </p>
        </div>
      </div>

      <NavigationLinks employee={employee} pathname={pathname} />
    </aside>
  );
}
