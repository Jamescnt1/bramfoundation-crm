export type ReportCategory =
  | "executive"
  | "sales"
  | "operations"
  | "employees"
  | "customers"
  | "pipeline"
  | "tasks"
  | "calendar"
  | "financial"
  | "files"
  | "communications";

export type ReportFilterKey =
  | "employeeId"
  | "salesperson"
  | "pipelineStage"
  | "leadSource"
  | "customerId"
  | "status";

export type ReportDefinition = {
  id: string;
  category: ReportCategory;
  name: string;
  description: string;
  question: string;
  filters: ReportFilterKey[];
  availability?: "ready" | "limited";
};

export type ReportFilters = {
  from: string;
  to: string;
  employeeId?: string;
  salesperson?: string;
  pipelineStage?: string;
  leadSource?: string;
  customerId?: string;
  status?: string;
};

export type ReportMetric = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "positive" | "warning";
};

export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ReportChartItem = {
  label: string;
  value: number;
  formattedValue?: string;
};

export type ReportResult = {
  id: string;
  title: string;
  description: string;
  rangeLabel: string;
  metrics: ReportMetric[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  chart?: {
    title: string;
    items: ReportChartItem[];
  };
  notes?: string[];
  emptyMessage?: string;
};

export type ReportFilterOption = {
  value: string;
  label: string;
};

export type ReportFilterOptions = {
  employees: ReportFilterOption[];
  salespeople: ReportFilterOption[];
  pipelineStages: ReportFilterOption[];
  leadSources: ReportFilterOption[];
  customers: ReportFilterOption[];
  statuses: ReportFilterOption[];
};

