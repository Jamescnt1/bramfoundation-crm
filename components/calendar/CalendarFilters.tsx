import type { AppointmentStatus, AppointmentType } from "@/components/calendar/constants";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@/components/calendar/constants";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import { formatJobDisplayName } from "@/lib/job-display";

export type CalendarFilterValues = {
  employeeId: string;
  eventType: "" | AppointmentType;
  status: "" | AppointmentStatus;
  customerId: string;
  jobId: string;
};

type Props = {
  value: CalendarFilterValues;
  employees: Employee[];
  jobs: Job[];
  onChange: (value: CalendarFilterValues) => void;
};

const label = (value: string) => value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export default function CalendarFilters({ value, employees, jobs, onChange }: Props) {
  const customers = Array.from(
    new Map(jobs.filter((job) => job.customer_id).map((job) => [job.customer_id, job.customer?.full_name ?? "Customer unavailable"])).entries(),
  );
  const availableJobs = value.customerId
    ? jobs.filter((job) => job.customer_id === value.customerId)
    : jobs;
  const set = (patch: Partial<CalendarFilterValues>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3 border-b border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <Filter label="Employee" value={value.employeeId} onChange={(next) => set({ employeeId: next })}>
        <option value="">All employees</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </Filter>
      <Filter label="Event type" value={value.eventType} onChange={(next) => set({ eventType: next as CalendarFilterValues["eventType"] })}>
        <option value="">All event types</option>
        {APPOINTMENT_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
      </Filter>
      <Filter label="Status" value={value.status} onChange={(next) => set({ status: next as CalendarFilterValues["status"] })}>
        <option value="">All statuses</option>
        {APPOINTMENT_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
      </Filter>
      <Filter label="Customer" value={value.customerId} onChange={(next) => set({ customerId: next, jobId: "" })}>
        <option value="">All customers</option>
        {customers.map(([id, name]) => <option key={id} value={id ?? ""}>{name}</option>)}
      </Filter>
      <Filter label="Job" value={value.jobId} onChange={(next) => set({ jobId: next })}>
        <option value="">All jobs</option>
        {availableJobs.map((job) => <option key={job.id} value={job.id}>{formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}</option>)}
      </Filter>
    </div>
  );
}

function Filter({ label: title, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {title}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-gray-800">
        {children}
      </select>
    </label>
  );
}
