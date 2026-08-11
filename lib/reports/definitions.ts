import type { ReportCategory, ReportDefinition } from "@/lib/reports/types";

export const REPORT_CATEGORIES: Array<{
  id: ReportCategory;
  label: string;
  description: string;
}> = [
  { id: "executive", label: "Executive", description: "Company performance at a glance." },
  { id: "sales", label: "Sales", description: "Lead activity, conversion, and sold work." },
  { id: "operations", label: "Operations", description: "Installation readiness and stalled work." },
  { id: "employees", label: "Employee Performance", description: "Workload and outcomes by employee." },
  { id: "customers", label: "Customers", description: "Customer value, repeat work, and sources." },
  { id: "pipeline", label: "Pipeline", description: "Funnel health, aging, value, and velocity." },
  { id: "tasks", label: "Tasks", description: "Completion, overdue work, categories, and ownership." },
  { id: "calendar", label: "Calendar", description: "Appointment volume, type, status, and ownership." },
  { id: "financial", label: "Financial (Operational)", description: "Contract dollars tracked inside Foundation." },
  { id: "files", label: "Files", description: "Layouts, photos, documents, and job coverage." },
  { id: "communications", label: "Communications", description: "Internal messaging and response signals." },
];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "executive-overview",
    category: "executive",
    name: "Executive Overview",
    description: "Sales, pipeline value, completed revenue, average job size, win rate, and lead sources.",
    question: "How is the company performing in this period?",
    filters: ["salesperson", "pipelineStage", "leadSource", "customerId"],
  },
  {
    id: "sales-performance",
    category: "sales",
    name: "Sales Performance",
    description: "Leads created, measures, estimates, close rate, days to close, and sales by employee.",
    question: "What sales activity produced results?",
    filters: ["salesperson", "leadSource"],
  },
  {
    id: "operations-health",
    category: "operations",
    name: "Operations Health",
    description: "Scheduled and completed installs, material queues, stalled jobs, and missing requirements.",
    question: "Which jobs need operational attention?",
    filters: ["employeeId", "pipelineStage", "customerId"],
  },
  {
    id: "employee-scorecards",
    category: "employees",
    name: "Employee Scorecards",
    description: "Leads, measures, estimates, sold dollars, tasks, close rate, and appointments whose scheduled time has elapsed.",
    question: "How is each employee's workload and performance trending?",
    filters: ["employeeId"],
  },
  {
    id: "customer-value",
    category: "customers",
    name: "Customer Value",
    description: "Top and repeat customers, revenue by customer, and revenue by lead source.",
    question: "Which customers and sources create the most value?",
    filters: ["leadSource", "customerId"],
  },
  {
    id: "pipeline-funnel",
    category: "pipeline",
    name: "Pipeline Funnel",
    description: "Stage counts, dollars, conversion percentages, and average age.",
    question: "Where is work moving through the pipeline?",
    filters: ["salesperson", "pipelineStage", "leadSource"],
  },
  {
    id: "pipeline-velocity",
    category: "pipeline",
    name: "Pipeline Velocity",
    description: "Stage aging and bottlenecks using the current stage and last job update.",
    question: "Where is work slowing down?",
    filters: ["salesperson", "pipelineStage"],
  },
  {
    id: "task-performance",
    category: "tasks",
    name: "Task Performance",
    description: "Created, completed, overdue, average completion time, category, status, and employee.",
    question: "Is assigned work being completed on time?",
    filters: ["employeeId", "customerId", "status"],
  },
  {
    id: "calendar-performance",
    category: "calendar",
    name: "Calendar Activity",
    description: "Appointments by employee, type, and status, including measures and installs.",
    question: "How is scheduled field and office activity distributed?",
    filters: ["employeeId", "customerId", "status"],
  },
  {
    id: "operational-dollars",
    category: "financial",
    name: "Operational Dollars",
    description: "The existing Sold, Completed, Billed, and pipeline-stage Contract Amount report.",
    question: "How many contract dollars are sold, completed, billed, and in each approved stage?",
    filters: ["pipelineStage", "salesperson", "leadSource", "customerId"],
  },
  {
    id: "file-coverage",
    category: "files",
    name: "File & Layout Coverage",
    description: "Layouts, photos, documents, and jobs currently missing field documentation.",
    question: "Are job records supported by the files the team needs?",
    filters: ["employeeId", "customerId"],
  },
  {
    id: "communications-overview",
    category: "communications",
    name: "Internal Communications",
    description: "Messages, mentions, unread notifications, and participating employees.",
    question: "How much internal communication is occurring and what remains unread?",
    filters: ["employeeId"],
    availability: "limited",
  },
];

export function getReportDefinition(reportId: string) {
  return REPORT_DEFINITIONS.find((definition) => definition.id === reportId);
}
