import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Clock3,
  Columns3,
  ListTodo,
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
        title: "Notifications",
        description: "Prepare email, in-app, and workflow notification preferences.",
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
  return (
    <div className="mt-10 space-y-10">
      {settingsGroups.map((group) => {
        const visibleItems = group.items.filter(
          (item) => !item.restricted || showRestrictedSettings,
        );

        if (visibleItems.length === 0) return null;

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

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <SettingsCard key={item.href} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SettingsCard({ item }: { item: SettingsItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group flex min-h-44 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition group-hover:bg-black group-hover:text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            item.available
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {item.available ? "Available" : "Planned"}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold text-gray-900">{item.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-gray-500">
        {item.description}
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 group-hover:text-black">
        Open settings
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
