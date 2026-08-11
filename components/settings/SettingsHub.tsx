"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  LayoutDashboard,
  Bell,
  Building2,
  CalendarDays,
  Clock3,
  Columns3,
  ListTodo,
  HardHat,
  Mail,
  Palmtree,
  Plug,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

type SettingsHubProps = {
  showRestrictedSettings: boolean;
};

type SettingsItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  restricted?: boolean;
  available?: boolean;
};

type SettingsGroup = {
  title: string;
  description: string;
  items: SettingsItem[];
};

const settingsGroups: SettingsGroup[] = [
  {
    title: "System",
    description: "Manage your company, workforce, and access controls.",
    items: [
      {
        title: "Company",
        description: "Maintain company identity and organization preferences.",
        href: "/settings/company",
        icon: Building2,
        restricted: true,
        available: true,
      },
      {
        title: "Company Dashboard",
        description: "Choose which rules populate management attention sections.",
        href: "/settings/company-dashboard",
        icon: LayoutDashboard,
        restricted: true,
        available: true,
      },
      {
        title: "Employees & Access",
        description: "Create employees, manage login access, and assign roles.",
        href: "/settings/employees",
        icon: Users,
        restricted: true,
        available: true,
      },
      {
        title: "Roles & Permissions",
        description: "Define roles and control the capabilities assigned to them.",
        href: "/settings/roles",
        icon: ShieldCheck,
        restricted: true,
        available: true,
      },
    ],
  },
  {
    title: "Workflow",
    description: "Configure how leads, jobs, and tasks move through the CRM.",
    items: [
      {
        title: "Pipeline",
        description: "Manage job stages and the order of your operational workflow.",
        href: "/settings/pipeline",
        icon: Columns3,
      },
      {
        title: "Automation Rules",
        description: "Create tasks automatically when jobs enter pipeline stages.",
        href: "/settings/automation-rules",
        icon: Workflow,
        available: true,
      },
      {
        title: "Lead Sources",
        description: "Manage the sources available when leads and jobs are created.",
        href: "/settings/lead-sources",
        icon: Tags,
        restricted: true,
        available: true,
      },
      {
        title: "Task Types",
        description: "Define reusable categories for operational and follow-up tasks.",
        href: "/settings/task-types",
        icon: ListTodo,
        restricted: true,
        available: true,
      },
    ],
  },
  {
    title: "Scheduling",
    description: "Set the rules and availability used by company scheduling.",
    items: [
      {
        title: "Install Crews",
        description: "Manage crews, individual installer contacts, and communication preferences.",
        href: "/settings/install-crews",
        icon: HardHat,
        restricted: true,
        available: true,
      },
      {
        title: "Appointment Types",
        description: "Create, reorder, rename, and retire unified scheduling types.",
        href: "/settings/appointment-types",
        icon: CalendarDays,
        restricted: true,
        available: true,
      },
      {
        title: "Calendar",
        description: "Configure calendar defaults, appointment types, and display options.",
        href: "/settings/calendar",
        icon: CalendarDays,
      },
      {
        title: "Business Hours",
        description: "Set the standard working hours used for scheduling.",
        href: "/settings/business-hours",
        icon: Clock3,
      },
      {
        title: "Holidays",
        description: "Manage company closures and scheduling exceptions.",
        href: "/settings/holidays",
        icon: Palmtree,
      },
    ],
  },
  {
    title: "Notifications",
    description: "Control how the team is alerted about important work.",
    items: [
      {
        title: "Email Templates",
        description: "Create customer email templates and test them before automation use.",
        href: "/settings/email-templates",
        icon: Mail,
        restricted: true,
        available: true,
      },
      {
        title: "Communications",
        description: "Manage company safety controls and each employee’s email and text preferences.",
        href: "/settings/notifications",
        icon: Bell,
      },
    ],
  },
  {
    title: "Integrations",
    description: "Connect Foundation CRM with the systems your company uses.",
    items: [
      {
        title: "Integrations",
        description: "Manage QFloors references and future external connections.",
        href: "/settings/integrations",
        icon: Plug,
      },
    ],
  },
];

export default function SettingsHub({
  showRestrictedSettings,
}: SettingsHubProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(() => settingsGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      (!item.restricted || showRestrictedSettings) &&
      (!normalizedQuery || `${item.title} ${item.description} ${group.title}`.toLocaleLowerCase().includes(normalizedQuery)),
    ),
  })).filter((group) => group.items.length), [normalizedQuery, showRestrictedSettings]);

  return (
    <div className="mt-8">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label htmlFor="settings-search" className="sr-only">Search settings</label>
        <input
          id="settings-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search settings..."
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="mt-6 space-y-8">
      {visibleGroups.map((group) => {
        return (
          <section key={group.title} aria-labelledby={`settings-${group.title}`}>
            <div>
              <h2
                id={`settings-${group.title}`}
                className="text-lg font-semibold text-gray-900"
              >
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{group.description}</p>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {group.items.map((item) => (
                <SettingsCard key={item.href} item={item} />
              ))}
            </div>
          </section>
        );
      })}
      {!visibleGroups.length ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium text-gray-900">No settings match “{query.trim()}”.</p>
          <button type="button" onClick={() => setQuery("")} className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-900">Clear search</button>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function SettingsCard({ item }: { item: SettingsItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group flex items-center gap-4 border-b border-gray-100 px-4 py-4 transition last:border-b-0 hover:bg-gray-50 sm:px-5"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900">{item.title}</span>
          {item.available === false ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Planned</span> : null}
        </span>
        <span className="mt-0.5 block text-sm text-gray-500">{item.description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-gray-700" />
    </Link>
  );
}
