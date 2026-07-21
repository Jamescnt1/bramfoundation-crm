export const EMPLOYEE_ROLES = [
  "administrator",
  "sales_manager",
  "salesperson",
  "operations_manager",
  "installer",
  "office_staff",
] as const;

export type CoreEmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type EmployeeRole = string;

export const PERMISSIONS = [
  "company_dashboard.view",
  "customers.manage",
  "jobs.manage",
  "pipeline.manage",
  "pipeline.settings.manage",
  "calendar.manage",
  "tasks.manage",
  "reports.view",
  "automations.manage",
  "employees.manage",
  "roles.manage",
  "delete_employees",
  "delete_customers",
  "delete_leads",
  "attachments.view",
  "attachments.manage",
  "attachments.archive",
  "customer_email.view",
  "customer_email.send",
  "email_templates.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const COMPANY_DASHBOARD_ROLES: readonly string[] = [
  "administrator",
  "sales_manager",
  "operations_manager",
];

export function canViewCompanyDashboard(role: EmployeeRole) {
  return COMPANY_DASHBOARD_ROLES.includes(role);
}

export function canManageEmployees(role: EmployeeRole) {
  return role === "administrator";
}

export function canManageRoles(role: EmployeeRole) {
  return role === "administrator";
}

export function getRoleLabel(role: EmployeeRole) {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
