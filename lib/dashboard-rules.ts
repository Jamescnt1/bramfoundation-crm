export const DASHBOARD_RULE_GROUPS = [
  "needs_attention",
  "needs_my_attention",
] as const;

export const DASHBOARD_RULE_SEVERITIES = [
  "critical",
  "important",
  "informational",
] as const;

export type DashboardRuleGroup = (typeof DASHBOARD_RULE_GROUPS)[number];
export type DashboardRuleSeverity = (typeof DASHBOARD_RULE_SEVERITIES)[number];

export type DashboardRuleDefinition = {
  key: string;
  group: DashboardRuleGroup;
  label: string;
  description: string;
  defaultEnabled: boolean;
  defaultSeverity: DashboardRuleSeverity;
  threshold?: {
    key: "days";
    label: string;
    minimum: number;
    maximum: number;
    defaultValue: number;
  };
};

export const DASHBOARD_RULES = [
  {
    key: "missing_qf_number",
    group: "needs_attention",
    label: "Missing QF#",
    description: "Jobs in a stage that requires a QFloors number but do not have one.",
    defaultEnabled: true,
    defaultSeverity: "critical",
  },
  {
    key: "missing_contract_amount",
    group: "needs_attention",
    label: "Missing Contract Amount",
    description: "Jobs in an approved-or-later stage without a saved contract value.",
    defaultEnabled: true,
    defaultSeverity: "critical",
  },
  {
    key: "missing_company_contact",
    group: "needs_attention",
    label: "Missing Company Contact",
    description: "Company jobs that do not identify the organization contact responsible for the work.",
    defaultEnabled: false,
    defaultSeverity: "informational",
  },
  {
    key: "missing_job_address",
    group: "needs_attention",
    label: "Missing Job Address",
    description: "Jobs without a physical work-site address.",
    defaultEnabled: false,
    defaultSeverity: "informational",
  },
  {
    key: "missing_layout",
    group: "needs_attention",
    label: "Missing Layout",
    description: "Active jobs that do not have a current layout document.",
    defaultEnabled: false,
    defaultSeverity: "informational",
  },
  {
    key: "missing_photos",
    group: "needs_attention",
    label: "Missing Photos",
    description: "Active jobs without an uploaded photo.",
    defaultEnabled: false,
    defaultSeverity: "informational",
  },
  {
    key: "missing_files",
    group: "needs_attention",
    label: "Missing Files",
    description: "Active jobs without an uploaded job file.",
    defaultEnabled: false,
    defaultSeverity: "informational",
  },
  {
    key: "missing_install_date",
    group: "needs_attention",
    label: "Jobs without Install Date",
    description: "Installation-required jobs in Install Scheduled without an installation appointment.",
    defaultEnabled: true,
    defaultSeverity: "critical",
  },
  {
    key: "overdue_tasks",
    group: "needs_attention",
    label: "Overdue Tasks",
    description: "Incomplete tasks whose due date or due time has passed.",
    defaultEnabled: true,
    defaultSeverity: "critical",
  },
  {
    key: "no_recent_activity",
    group: "needs_attention",
    label: "Jobs with No Activity",
    description: "Active jobs that have not been updated within the selected number of days.",
    defaultEnabled: true,
    defaultSeverity: "important",
    threshold: {
      key: "days",
      label: "Days without activity",
      minimum: 1,
      maximum: 365,
      defaultValue: 14,
    },
  },
  {
    key: "unassigned_appointments",
    group: "needs_attention",
    label: "Unassigned Appointments",
    description: "Upcoming calendar appointments without an assigned employee, or installations without an assigned installer crew. Customer contacts do not affect this warning.",
    defaultEnabled: true,
    defaultSeverity: "critical",
  },
  {
    key: "jobs_assigned_to_me",
    group: "needs_my_attention",
    label: "Jobs Assigned to Me",
    description: "Active jobs assigned to the employee viewing the dashboard.",
    defaultEnabled: false,
    defaultSeverity: "informational",
  },
  {
    key: "tasks_assigned_to_me",
    group: "needs_my_attention",
    label: "Tasks Assigned to Me",
    description: "Open tasks assigned to the employee viewing the dashboard.",
    defaultEnabled: false,
    defaultSeverity: "important",
  },
  {
    key: "mentions_for_me",
    group: "needs_my_attention",
    label: "Mentions and Messages for Me",
    description: "Unread internal-message mentions directed to the employee viewing the dashboard.",
    defaultEnabled: true,
    defaultSeverity: "important",
  },
  {
    key: "jobs_awaiting_my_approval",
    group: "needs_my_attention",
    label: "Jobs Awaiting My Approval",
    description: "Jobs in Waiting Approval that are assigned to the employee viewing the dashboard.",
    defaultEnabled: true,
    defaultSeverity: "important",
  },
  {
    key: "overdue_items_assigned_to_me",
    group: "needs_my_attention",
    label: "Overdue Items Assigned to Me",
    description: "Overdue tasks assigned to the employee viewing the dashboard.",
    defaultEnabled: true,
    defaultSeverity: "critical",
  },
] as const satisfies readonly DashboardRuleDefinition[];

export type DashboardRuleKey = (typeof DASHBOARD_RULES)[number]["key"];

export function getDashboardRuleDefinition(key: string) {
  return DASHBOARD_RULES.find((rule) => rule.key === key);
}

export function getDashboardRuleThreshold(
  rule: (typeof DASHBOARD_RULES)[number],
) {
  return "threshold" in rule ? rule.threshold : undefined;
}

export function severityRank(severity: DashboardRuleSeverity) {
  return DASHBOARD_RULE_SEVERITIES.indexOf(severity);
}
