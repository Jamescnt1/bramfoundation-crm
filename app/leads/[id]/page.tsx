import Link from "next/link";
import { notFound } from "next/navigation";
import JobWorkspace, { type JobWorkspaceTab } from "@/components/jobs/JobWorkspace";
import type { JobAttachment } from "@/components/attachments/types";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { CustomerEmail, EmailTemplate } from "@/components/email/types";
import type { InternalConversation } from "@/components/messaging/types";
import type { Customer } from "@/components/customers/types";
import type { TaskType, UniversalTask } from "@/components/tasks/types";
import { getAppointmentsByJobId } from "@/lib/services/appointments";
import { getCustomerById } from "@/lib/services/customers";
import { getActiveEmployees, hasPermission, requireEmployee, type Employee } from "@/lib/services/employees";
import { getJobActivities, getJobById, type JobActivity } from "@/lib/services/jobs";
import { getTasks, getTaskTypes } from "@/lib/services/tasks";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import { getJobAttachments } from "@/lib/services/job-attachments";
import { getJobConversation } from "@/lib/services/internal-messaging";
import { getActiveEmailTemplates, getJobCustomerEmails } from "@/lib/services/customer-email";
import { getActiveInstallerCrews } from "@/lib/services/installer-crews";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const tabs: JobWorkspaceTab[] = [
  "overview",
  "timeline",
  "tasks",
  "calendar",
  "files",
  "photos",
  "communications",
];

export const dynamic = "force-dynamic";

export default async function JobWorkspacePage({ params, searchParams }: Props) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const activeTab = tabs.includes(tab as JobWorkspaceTab)
    ? (tab as JobWorkspaceTab)
    : "overview";

  let job;
  try {
    job = await getJobById(id);
  } catch (error) {
    return <PageError message={message(error)} />;
  }
  if (!job) notFound();

  const [
    employeesResult,
    installerCrewsResult,
    customerResult,
    statusPermissionResult,
    stagesResult,
  ] = await Promise.all([
    safe(getActiveEmployees(), []),
    safe(getActiveInstallerCrews(), []),
    safe<Customer | null>(job.customer_id ? getCustomerById(job.customer_id) : Promise.resolve(null), null),
    safe(hasPermission("pipeline.manage"), false),
    safe(getPipelineStages(), []),
  ]);

  let activitiesResult = emptyResult<JobActivity[]>([]);
  let tasksResult = emptyResult<UniversalTask[]>([]);
  let taskTypesResult = emptyResult<TaskType[]>([]);
  let appointmentsResult = emptyResult<CalendarAppointment[]>([]);
  let attachmentsResult = emptyResult<JobAttachment[]>([]);
  let manageAttachmentsResult = emptyResult(false);
  let archiveAttachmentsResult = emptyResult(false);
  let conversationResult = emptyResult<InternalConversation | null>(null);
  let currentEmployeeResult = emptyResult<Employee | null>(null);
  let emailsResult = emptyResult<CustomerEmail[]>([]);
  let templatesResult = emptyResult<EmailTemplate[]>([]);
  let emailSendPermissionResult = emptyResult(false);

  if (activeTab === "overview") {
    [activitiesResult, tasksResult, appointmentsResult] = await Promise.all([
      safe(getJobActivities(job.id), []),
      safe(getTasks({ jobId: job.id }), []),
      safe(getAppointmentsByJobId(job.id), []),
    ]);
  } else if (activeTab === "timeline") {
    activitiesResult = await safe(getJobActivities(job.id), []);
  } else if (activeTab === "tasks") {
    [tasksResult, taskTypesResult] = await Promise.all([
      safe(getTasks({ jobId: job.id }), []),
      safe(getTaskTypes(), []),
    ]);
  } else if (activeTab === "calendar") {
    appointmentsResult = await safe(getAppointmentsByJobId(job.id), []);
  } else if (activeTab === "files" || activeTab === "photos") {
    [attachmentsResult, manageAttachmentsResult, archiveAttachmentsResult] = await Promise.all([
      safe(getJobAttachments(job.id), []),
      safe(hasPermission("attachments.manage"), false),
      safe(hasPermission("attachments.archive"), false),
    ]);
  } else if (activeTab === "communications") {
    [
      attachmentsResult,
      manageAttachmentsResult,
      archiveAttachmentsResult,
      conversationResult,
      currentEmployeeResult,
      emailsResult,
      templatesResult,
      emailSendPermissionResult,
    ] = await Promise.all([
      safe(getJobAttachments(job.id), []),
      safe(hasPermission("attachments.manage"), false),
      safe(hasPermission("attachments.archive"), false),
      safe(getJobConversation(job.id), null),
      safe(requireEmployee(), null),
      safe(getJobCustomerEmails(job.id), []),
      safe(getActiveEmailTemplates(), []),
      safe(hasPermission("customer_email.send"), false),
    ]);
  }

  const employees = employeesResult.value;

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/leads" className="text-sm font-medium text-gray-600 hover:text-black">
          ← Back to leads
        </Link>
        <div className="mt-4">
          <JobWorkspace
            activeTab={activeTab}
            job={job}
            customer={customerResult.value}
            assignedEmployee={employees.find((employee) => employee.id === job.assigned_employee_id) ?? null}
            employees={employees}
            installerCrews={installerCrewsResult.value}
            activities={activitiesResult.value}
            tasks={tasksResult.value}
            taskTypes={taskTypesResult.value}
            appointments={appointmentsResult.value}
            activityError={activitiesResult.error}
            taskError={tasksResult.error}
            canChangeStatus={statusPermissionResult.value}
            stages={stagesResult.value}
            attachments={attachmentsResult.value}
            attachmentError={attachmentsResult.error}
            canManageAttachments={manageAttachmentsResult.value}
            canArchiveAttachments={archiveAttachmentsResult.value}
            conversation={conversationResult.value}
            currentEmployee={currentEmployeeResult.value}
            customerEmails={emailsResult.value}
            emailTemplates={templatesResult.value}
            customerEmailError={emailsResult.error}
            canSendCustomerEmail={emailSendPermissionResult.value}
          />
        </div>
      </div>
    </main>
  );
}

type SafeResult<T> = {
  value: T;
  error: string;
};

async function safe<T>(promise: Promise<T>, fallback: T): Promise<SafeResult<T>> {
  try {
    return { value: await promise, error: "" };
  } catch (error) {
    return { value: fallback, error: message(error) };
  }
}

function emptyResult<T>(value: T): SafeResult<T> {
  return { value, error: "" };
}

function PageError({ message: text }: { message: string }) {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/leads" className="text-sm font-medium text-gray-600 hover:text-black">← Back to leads</Link>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load this job: {text}
        </div>
      </div>
    </main>
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
