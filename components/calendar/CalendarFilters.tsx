import type { AppointmentStatus, AppointmentType } from "@/components/calendar/constants";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@/components/calendar/constants";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import { formatJobDisplayName } from "@/lib/job-display";
import { formatAppointmentType } from "@/lib/appointment-display";

export type CalendarFilterValues = {
  employeeIds: string[];
  eventType: "" | AppointmentType;
  status: "" | AppointmentStatus;
  customerId: string;
  jobId: string;
};

type Props = {
  value: CalendarFilterValues;
  employees: Employee[];
  jobs: Job[];
  includeInstallations?: boolean;
  onChange: (value: CalendarFilterValues) => void;
};

const label = (value: string) => value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export default function CalendarFilters({
  value,
  employees,
  jobs,
  includeInstallations = true,
  onChange,
}: Props) {
  const customers = Array.from(
    new Map(jobs.filter((job) => job.customer_id).map((job) => [job.customer_id, job.customer?.full_name ?? "Customer unavailable"])).entries(),
  );
  const availableJobs = value.customerId
    ? jobs.filter((job) => job.customer_id === value.customerId)
    : jobs;
  const set = (patch: Partial<CalendarFilterValues>) => onChange({ ...value, ...patch });
  const toggleEmployee = (employeeId: string) => {
    const selected = value.employeeIds.includes(employeeId)
      ? value.employeeIds.filter((id) => id !== employeeId)
      : [...value.employeeIds, employeeId];
    set({ employeeIds: selected });
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4">
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Employees
        </legend>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => set({ employeeIds: [] })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              value.employeeIds.length === 0
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-600"
            }`}
          >
            All employees
          </button>
          {employees.map((employee) => {
            const selected = value.employeeIds.includes(employee.id);
            return (
              <button
                key={employee.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleEmployee(employee.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  selected
                    ? "border-gray-900 bg-white text-gray-900 ring-1 ring-gray-900"
                    : "border-gray-300 bg-white text-gray-600"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: employee.color || "#475569" }}
                  aria-hidden="true"
                />
                {employee.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Filter label="Event type" value={value.eventType} onChange={(next) => set({ eventType: next as CalendarFilterValues["eventType"] })}>
        <option value="">All event types</option>
        {APPOINTMENT_TYPES.filter(
          (type) => includeInstallations || type !== "installation",
        ).map((type) => <option key={type} value={type}>{formatAppointmentType(type)}</option>)}
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
