"use client";

import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  ContactRound,
  LayoutDashboard,
  Settings,
  UsersRound,
  Workflow,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { Employee } from "@/lib/services/employees";
import { canViewCompanyDashboard } from "@/lib/auth/roles";

const navigation = [
  {
    name: "My Dashboard",
    href: "/my-dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Leads",
    href: "/leads",
    icon: UsersRound,
  },
  {
    name: "Customers",
    href: "/customers",
    icon: ContactRound,
  },
  {
    name: "Pipeline",
    href: "/pipeline",
    icon: Workflow,
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    name: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function getNavigationItems(employee: Employee | null) {
  return employee && canViewCompanyDashboard(employee.role)
    ? [
        { name: "Company Dashboard", href: "/company", icon: Building2 },
        ...navigation,
        { name: "Reports", href: "/reports", icon: BarChart3 },
      ]
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
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
    <aside className="hidden min-h-screen w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900 lg:block">
      <div className="flex h-20 items-center border-b border-gray-800 px-6">
        <div>
          <p className="text-lg font-bold tracking-[0.08em] text-white">
            Foundation CRM
          </p>

          <p className="text-xs uppercase tracking-[0.12em] text-gray-400">
            Flooring Sales Management
          </p>
        </div>
      </div>

      <NavigationLinks employee={employee} pathname={pathname} />
    </aside>
  );
}
