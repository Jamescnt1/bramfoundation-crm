import Link from "next/link";
import { notFound } from "next/navigation";
import JobWorkspace from "@/components/jobs/JobWorkspace";
import { getAppointmentsByJobId } from "@/lib/services/appointments";
import { getCustomerById } from "@/lib/services/customers";
import { getActiveEmployees, hasPermission, requireEmployee } from "@/lib/services/employees";
import { getJobActivities, getJobById } from "@/lib/services/jobs";
import { getTasks, getTaskTypes } from "@/lib/services/tasks";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import { getJobAttachments } from "@/lib/services/job-attachments";
import { getJobConversation } from "@/lib/services/internal-messaging";
import { getActiveEmailTemplates, getJobCustomerEmails } from "@/lib/services/customer-email";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export default async function JobWorkspacePage({ params }: Props) {
  const { id } = await params;
  let job;
  try { job = await getJobById(id); } catch (error) { return <PageError message={message(error)} />; }
  if (!job) notFound();

  const [activitiesResult, tasksResult, taskTypesResult, appointmentsResult, employeesResult, customerResult, statusPermissionResult, stagesResult, attachmentsResult, manageAttachmentsResult, archiveAttachmentsResult, conversationResult, currentEmployeeResult, emailsResult, templatesResult, emailSendPermissionResult] = await Promise.allSettled([
    getJobActivities(job.id), getTasks({ jobId: job.id }), getTaskTypes(), getAppointmentsByJobId(job.id), getActiveEmployees(),
    job.customer_id ? getCustomerById(job.customer_id) : Promise.resolve(null),
    hasPermission("pipeline.manage"),
    getPipelineStages(),
    getJobAttachments(job.id),
    hasPermission("attachments.manage"),
    hasPermission("attachments.archive"),
    getJobConversation(job.id),
    requireEmployee(),
    getJobCustomerEmails(job.id),
    getActiveEmailTemplates(),
    hasPermission("customer_email.send"),
  ]);
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : [];

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/leads" className="text-sm font-medium text-gray-600 hover:text-black">← Back to leads</Link>
        <div className="mt-6">
          <JobWorkspace
            job={job}
            customer={customerResult.status === "fulfilled" ? customerResult.value : null}
            assignedEmployee={employees.find((employee) => employee.id === job.assigned_employee_id) ?? null}
            employees={employees}
            activities={activitiesResult.status === "fulfilled" ? activitiesResult.value : []}
            tasks={tasksResult.status === "fulfilled" ? tasksResult.value : []}
            taskTypes={taskTypesResult.status === "fulfilled" ? taskTypesResult.value : []}
            appointments={appointmentsResult.status === "fulfilled" ? appointmentsResult.value : []}
            activityError={activitiesResult.status === "rejected" ? message(activitiesResult.reason) : ""}
            taskError={tasksResult.status === "rejected" ? message(tasksResult.reason) : ""}
            canChangeStatus={statusPermissionResult.status === "fulfilled" && statusPermissionResult.value}
            stages={stagesResult.status === "fulfilled" ? stagesResult.value : []}
            attachments={attachmentsResult.status === "fulfilled" ? attachmentsResult.value : []}
            attachmentError={attachmentsResult.status === "rejected" ? message(attachmentsResult.reason) : ""}
            canManageAttachments={manageAttachmentsResult.status === "fulfilled" && manageAttachmentsResult.value}
            canArchiveAttachments={archiveAttachmentsResult.status === "fulfilled" && archiveAttachmentsResult.value}
            conversation={conversationResult.status === "fulfilled" ? conversationResult.value : null}
            currentEmployee={currentEmployeeResult.status === "fulfilled" ? currentEmployeeResult.value : null}
            customerEmails={emailsResult.status === "fulfilled" ? emailsResult.value : []}
            emailTemplates={templatesResult.status === "fulfilled" ? templatesResult.value : []}
            customerEmailError={emailsResult.status === "rejected" ? message(emailsResult.reason) : ""}
            canSendCustomerEmail={emailSendPermissionResult.status === "fulfilled" && emailSendPermissionResult.value}
          />
        </div>
      </div>
    </main>
  );
}

function PageError({ message: text }: { message: string }) { return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-5xl"><Link href="/leads" className="text-sm font-medium text-gray-600 hover:text-black">← Back to leads</Link><div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">Unable to load this job: {text}</div></div></main>; }
function message(error: unknown) { return error instanceof Error ? error.message : "An unexpected error occurred."; }
