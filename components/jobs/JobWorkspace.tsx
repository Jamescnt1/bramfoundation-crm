"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, CheckSquare, MoreHorizontal, NotebookPen, UserRound } from "lucide-react";
import AttachmentManager from "@/components/attachments/AttachmentManager";
import type { JobAttachment } from "@/components/attachments/types";
import AppointmentCard from "@/components/calendar/AppointmentCard";
import AppointmentDialog from "@/components/calendar/AppointmentDialog";
import TaskManager from "@/components/tasks/TaskManager";
import PipelineStatusControl from "@/components/pipeline/PipelineStatusControl";
import JobRequirementsDialog from "@/components/pipeline/JobRequirementsDialog";
import { isConfiguredContractAmountRequired, isConfiguredQfNumberRequired, resolveConfiguredStage, type PipelineStage, type PipelineStageView } from "@/components/pipeline/constants";
import { changeJobPipelineStatus } from "@/app/actions/job-status";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { Customer } from "@/components/customers/types";
import type { Employee } from "@/lib/services/employees";
import type { Job, JobActivity } from "@/lib/services/jobs";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import type { TaskType, UniversalTask } from "@/components/tasks/types";
import { formatJobDisplayName } from "@/lib/job-display";
import InternalMessagePanel from "@/components/messaging/InternalMessagePanel";
import type { InternalConversation, MessagingEmployee } from "@/components/messaging/types";
import CustomerEmailPanel from "@/components/email/CustomerEmailPanel";
import type { CustomerEmail, EmailTemplate } from "@/components/email/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkspaceCard, WorkspaceEmpty, WorkspaceError, WorkspaceSectionHeader } from "@/components/jobs/WorkspacePrimitives";

type Props = {
  activeTab: JobWorkspaceTab;
  job: Job;
  customer: Customer | null;
  assignedEmployee: Employee | null;
  employees: Employee[];
  installerCrews: InstallerCrew[];
  activities: JobActivity[];
  tasks: UniversalTask[];
  taskTypes: TaskType[];
  appointments: CalendarAppointment[];
  activityError?: string;
  taskError?: string;
  canChangeStatus: boolean;
  stages: PipelineStageView[];
  attachments: JobAttachment[];
  attachmentError?: string;
  canManageAttachments: boolean;
  canArchiveAttachments: boolean;
  conversation: InternalConversation | null;
  currentEmployee: Employee | null;
  customerEmails: CustomerEmail[];
  emailTemplates: EmailTemplate[];
  customerEmailError?: string;
  canSendCustomerEmail: boolean;
};

export type JobWorkspaceTab =
  | "overview"
  | "timeline"
  | "tasks"
  | "calendar"
  | "files"
  | "photos"
  | "communications";

const nav = [
  ["overview", "Overview"], ["timeline", "Timeline"], ["tasks", "Tasks"],
  ["calendar", "Calendar"], ["files", "Files"], ["photos", "Photos"],
  ["communications", "Communications"],
] as const;

export default function JobWorkspace({ activeTab, job, customer, assignedEmployee, employees, installerCrews, activities, tasks, taskTypes, appointments, activityError, taskError, canChangeStatus, stages, attachments, attachmentError, canManageAttachments, canArchiveAttachments, conversation, currentEmployee, customerEmails, emailTemplates, customerEmailError, canSendCustomerEmail }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState<"measure" | "installation">("measure");
  const [currentStatus, setCurrentStatus] = useState(job.status);
  const [currentQfNumber, setCurrentQfNumber] = useState(job.qfloors_job_number);
  const [currentContractAmount, setCurrentContractAmount] = useState(job.contract_amount);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<PipelineStage | null>(null);
  const openTasks = tasks.filter((task) => !task.completed);
  const overdueTasks = openTasks.filter((task) => task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
  const upcoming = appointments.filter((appointment) => new Date(appointment.starts_at) >= new Date()).slice(0, 4);
  const employeeName = assignedEmployee?.name ?? job.salesperson ?? "Unassigned";
  const missingRequiredQfNumber = isConfiguredQfNumberRequired(currentStatus, stages) && !currentQfNumber?.trim();
  const missingRequiredContractAmount = isConfiguredContractAmountRequired(currentStatus, stages) && !currentContractAmount;
  const jobDisplayName = formatJobDisplayName({
    customerName: customer?.full_name ?? job.customer?.full_name,
    jobName: job.customer_name,
    qfNumber: currentQfNumber,
  });

  async function requestStatusChange(nextStatus: PipelineStage) {
    if (resolveConfiguredStage(currentStatus, stages)?.slug === nextStatus) return;
    if (
      (isConfiguredQfNumberRequired(nextStatus, stages) && !currentQfNumber?.trim()) ||
      (isConfiguredContractAmountRequired(nextStatus, stages) && !currentContractAmount)
    ) {
      setPendingStatus(nextStatus);
      return;
    }
    await saveStatus(nextStatus);
  }

  async function saveStatus(nextStatus: PipelineStage, qfNumber?: string, contractAmount?: string) {
    const previousStatus = currentStatus;
    const previousQfNumber = currentQfNumber;
    const previousContractAmount = currentContractAmount;
    setStatusError("");
    setStatusSaving(true);
    setCurrentStatus(nextStatus);
    if (qfNumber !== undefined) setCurrentQfNumber(qfNumber);
    if (contractAmount !== undefined) setCurrentContractAmount(contractAmount);

    try {
      const updated = await changeJobPipelineStatus(job.id, nextStatus, qfNumber, contractAmount);
      setCurrentStatus(updated.status);
      setCurrentQfNumber(updated.qfloors_job_number);
      setCurrentContractAmount(updated.contract_amount);
      setPendingStatus(null);
      router.refresh();
    } catch (error) {
      setCurrentStatus(previousStatus);
      setCurrentQfNumber(previousQfNumber);
      setCurrentContractAmount(previousContractAmount);
      setStatusError(error instanceof Error ? error.message : "Unable to change status.");
    } finally {
      setStatusSaving(false);
    }
  }

  function schedule(type: "measure" | "installation") {
    setAppointmentType(type);
    setAppointmentOpen(true);
  }

  function selectTab(tab: JobWorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <header className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Job Workspace</p>
              <h1 className="min-w-0 text-xl font-bold text-gray-950 sm:text-2xl" title={jobDisplayName}>{jobDisplayName}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PipelineStatusControl status={currentStatus} disabled={statusSaving} canChange={canChangeStatus} stages={stages} onChange={(status) => void requestStatusChange(status)} />
              {currentQfNumber || missingRequiredQfNumber ? (
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${missingRequiredQfNumber ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-gray-100 text-gray-900"}`}>
                  {currentQfNumber ? `QF# ${currentQfNumber}` : "QF# required"}
                </span>
              ) : null}
              {currentContractAmount || missingRequiredContractAmount ? (
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${missingRequiredContractAmount ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-800"}`}>
                  {currentContractAmount ? formatCurrency(currentContractAmount) : "Contract Amount required"}
                </span>
              ) : null}
              <span className="text-xs text-gray-600">Assigned to <strong className="text-gray-900">{employeeName}</strong></span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <QuickButton onClick={() => selectTab("tasks")}><CheckSquare /> Add Task</QuickButton>
            <QuickButton onClick={() => schedule("measure")}><CalendarPlus /> Schedule Measure</QuickButton>
            <Link href={`/leads/${job.id}/edit`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"><NotebookPen className="h-3.5 w-3.5" /> Add Note / Change Status</Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50" aria-label="More job actions"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => schedule("installation")}><CalendarPlus /> Schedule Install</DropdownMenuItem>
                {customer ? <DropdownMenuItem onClick={() => window.location.assign(`/customers/${customer.id}`)}><UserRound /> Open Customer</DropdownMenuItem> : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {statusError ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</div> : null}
        <dl className="mt-3 grid gap-x-5 gap-y-2 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Customer" value={customer?.full_name ?? job.customer_name} />
          <Fact label="Project address" value={job.address ?? "Not provided"} />
          <Fact label="Created" value={formatDate(job.created_at)} />
          <Fact label="Next action due" value={job.next_action_due ? formatDate(job.next_action_due) : "No due date"} />
        </dl>
      </header>

      <nav className="sticky top-0 z-20 mt-3 flex gap-1 overflow-x-auto rounded-t-lg border border-gray-200 border-b-0 bg-gray-100 px-2 pt-2 shadow-sm" role="tablist" aria-label="Job workspace sections">
        {nav.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => selectTab(id)}
            className={`min-h-10 whitespace-nowrap rounded-t-md border px-3 py-2 text-xs font-semibold transition ${
              activeTab === id
                ? "relative -mb-px border-gray-200 border-b-white bg-white text-gray-950"
                : "border-transparent text-gray-600 hover:bg-white/70 hover:text-gray-950"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="rounded-b-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        {activeTab === "overview" ? (
          <section>
            <WorkspaceSectionHeader title="Overview" description="Operational summary and the next work requiring attention." />
            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-3">
                <WorkspaceCard title="Job summary">
                  <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Fact label="Customer" value={customer?.full_name ?? job.customer_name} />
                    <Fact label="Job" value={job.customer_name} />
                    <Fact label="QF#" value={currentQfNumber || "Not required yet"} />
                    <Fact label="Status" value={resolveConfiguredStage(currentStatus, stages)?.label ?? currentStatus} />
                    <Fact label="Contract Amount" value={currentContractAmount ? formatCurrency(currentContractAmount) : "Not entered"} />
                    <Fact label="Assigned employee" value={employeeName} />
                    <Fact label="Created" value={formatDate(job.created_at)} />
                    <Fact label="Next action due" value={job.next_action_due ? formatDate(job.next_action_due) : "No due date"} />
                    <Fact label="Project address" value={job.address ?? "Not provided"} />
                  </div>
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Notes</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-gray-800">
                      {job.notes ?? "No notes have been added."}
                    </p>
                  </div>
                </WorkspaceCard>

                <WorkspaceCard title="Recent activity" count={activities.length}>
                  {activityError ? (
                    <WorkspaceError text={activityError} />
                  ) : activities.length ? (
                    <div className="divide-y divide-gray-100">
                      {activities.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 text-gray-900">{activity.description}</p>
                            <p className="text-[11px] text-gray-500">{formatDateTime(activity.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <WorkspaceEmpty text="No activity has been recorded yet." />
                  )}
                </WorkspaceCard>
              </div>

              <div className="space-y-3">
                <WorkspaceCard title="Work at a glance">
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Open tasks" value={openTasks.length} />
                    <Metric label="Overdue" value={overdueTasks.length} danger={Boolean(overdueTasks.length)} />
                    <Metric label="Upcoming" value={upcoming.length} />
                    <Metric label="Activity" value={activities.length} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                    <QuickButton onClick={() => selectTab("tasks")}>Open Tasks</QuickButton>
                    <QuickButton onClick={() => schedule("measure")}>Schedule Measure</QuickButton>
                    <QuickButton onClick={() => selectTab("communications")}>Messages</QuickButton>
                  </div>
                </WorkspaceCard>

                <WorkspaceCard title="Next appointment" count={upcoming.length}>
                  {upcoming.length ? (
                    <AppointmentCard appointment={upcoming[0]} compact />
                  ) : (
                    <WorkspaceEmpty
                      text="No upcoming appointments."
                      action={<button type="button" onClick={() => schedule("measure")} className="text-xs font-semibold text-gray-900 hover:underline">Schedule</button>}
                    />
                  )}
                </WorkspaceCard>

                <WorkspaceCard title="Related customer">
                  {customer ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">{customer.full_name}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{customer.phone ?? "No phone"} · {customer.email ?? "No email"}</p>
                      </div>
                      <Link href={`/customers/${customer.id}`} className="shrink-0 rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-gray-800">Open</Link>
                    </div>
                  ) : (
                    <WorkspaceEmpty text="This job is not linked to a customer record yet." />
                  )}
                </WorkspaceCard>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "timeline" ? (
          <section>
            <WorkspaceCard title="Timeline / Activity" count={activities.length}>
              {activityError ? <WorkspaceError text={activityError} /> : activities.length ? (
                <div className="divide-y divide-gray-100">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-5 text-gray-900">{activity.description}</p>
                        <p className="text-[11px] text-gray-500">{formatDateTime(activity.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <WorkspaceEmpty text="No activity has been recorded yet." />}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "tasks" ? (
          <section>
            <WorkspaceCard title="Tasks" count={openTasks.length}>
              {taskError ? <WorkspaceError text={taskError} /> : (
                <TaskManager compact initialTasks={tasks} customers={customer ? [customer] : []} jobs={[job]} employees={employees} taskTypes={taskTypes} fixedCustomerId={customer?.id ?? null} fixedJobId={job.id} />
              )}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "calendar" ? (
          <section>
            <WorkspaceCard title="Calendar" count={appointments.length} action={<Link href="/calendar" className="text-xs font-semibold text-gray-700 hover:underline">Open full calendar</Link>}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <QuickButton onClick={() => schedule("measure")}>Schedule Measure</QuickButton>
                <QuickButton onClick={() => schedule("installation")}>Schedule Install</QuickButton>
              </div>
              {appointments.length ? (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} compact />)}
                </div>
              ) : <WorkspaceEmpty text="No calendar events are linked to this job." />}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "files" ? (
          <section>
            <WorkspaceCard title="Files" count={attachments.filter((item) => item.attachment_kind === "file").length}>
              {attachmentError ? <WorkspaceError text={attachmentError} /> : <AttachmentManager compact jobId={job.id} kind="file" initialAttachments={attachments} canManage={canManageAttachments} canArchive={canArchiveAttachments} />}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "photos" ? (
          <section>
            <WorkspaceCard title="Photos" count={attachments.filter((item) => item.attachment_kind === "photo").length}>
              {attachmentError ? <WorkspaceError text={attachmentError} /> : <AttachmentManager compact jobId={job.id} kind="photo" initialAttachments={attachments} canManage={canManageAttachments} canArchive={canArchiveAttachments} />}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "communications" ? (
          <section>
            <WorkspaceSectionHeader title="Communications" description="Customer email and secure internal discussion remain clearly separated." />
            <div className="mt-2 space-y-3">
              {customerEmailError ? <WorkspaceError text={customerEmailError} /> : <CustomerEmailPanel compact jobId={job.id} recipient={customer?.email ?? job.email ?? ""} emails={customerEmails} templates={emailTemplates} attachments={attachments} canSend={canSendCustomerEmail} />}
              {currentEmployee ? <InternalMessagePanel compact initialConversation={conversation} currentEmployee={{ id: currentEmployee.id, name: currentEmployee.name, avatar_url: currentEmployee.avatar_url, color: currentEmployee.color }} employees={employees.map((employee) => ({ id: employee.id, name: employee.name, avatar_url: employee.avatar_url, color: employee.color })) as MessagingEmployee[]} jobId={job.id} attachments={attachments} /> : <WorkspaceError text="Your employee profile could not be loaded for internal messaging." />}
            </div>
          </section>
        ) : null}
      </div>

      <AppointmentDialog open={appointmentOpen} onOpenChange={setAppointmentOpen} defaultDate={new Date()} defaultJobId={job.id} defaultAppointmentType={appointmentType} employees={employees} installerCrews={installerCrews} jobs={[job]} />
      {pendingStatus ? (
        <JobRequirementsDialog
          open
          jobName={jobDisplayName}
          targetStatus={pendingStatus}
          requireQfNumber={isConfiguredQfNumberRequired(pendingStatus, stages) && !currentQfNumber?.trim()}
          requireContractAmount={isConfiguredContractAmountRequired(pendingStatus, stages) && !currentContractAmount}
          initialQfNumber={currentQfNumber}
          initialContractAmount={currentContractAmount}
          isSaving={statusSaving}
          errorMessage={statusError}
          onOpenChange={(open) => {
            if (!open) {
              setPendingStatus(null);
              setStatusError("");
            }
          }}
          onConfirm={({ qfNumber, contractAmount }) => void saveStatus(pendingStatus, qfNumber, contractAmount)}
        />
      ) : null}
    </>
  );
}

function QuickButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 [&_svg]:h-3.5 [&_svg]:w-3.5">{children}</button>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium leading-5 text-gray-900" title={value}>{value}</dd></div>; }
function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className={`rounded-md px-3 py-2 ${danger ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-900"}`}><p className="text-[11px] font-medium opacity-70">{label}</p><p className="text-lg font-bold leading-6">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatCurrency(value: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value)); }
