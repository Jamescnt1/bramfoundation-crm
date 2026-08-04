"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarPlus, CheckSquare, CirclePause, Copy, MoreHorizontal, Pencil, Play, UserRound } from "lucide-react";
import AttachmentManager from "@/components/attachments/AttachmentManager";
import type { JobAttachment } from "@/components/attachments/types";
import AppointmentCard from "@/components/calendar/AppointmentCard";
import AppointmentDialog from "@/components/calendar/AppointmentDialog";
import TaskManager from "@/components/tasks/TaskManager";
import PipelineStatusControl from "@/components/pipeline/PipelineStatusControl";
import JobRequirementsDialog from "@/components/pipeline/JobRequirementsDialog";
import { isConfiguredContractAmountRequired, isConfiguredQfNumberRequired, isInstallScheduledStage, resolveConfiguredStage, type PipelineStage, type PipelineStageView } from "@/components/pipeline/constants";
import { changeJobPipelineStatus } from "@/app/actions/job-status";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { AppointmentType } from "@/components/calendar/constants";
import type { Customer } from "@/components/customers/types";
import type { Employee } from "@/lib/services/employees";
import type { Job, JobActivity, JobContactSummary } from "@/lib/services/jobs";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import type { AppointmentTypeDefinition } from "@/lib/services/appointment-types";
import type { TaskType, UniversalTask } from "@/components/tasks/types";
import { formatJobDisplayName } from "@/lib/job-display";
import InternalMessagePanel from "@/components/messaging/InternalMessagePanel";
import type { InternalConversation, MessagingEmployee } from "@/components/messaging/types";
import CustomerEmailPanel from "@/components/email/CustomerEmailPanel";
import { AddressLink, EmailLink, PhoneLink } from "@/components/contact/ActionableContactLinks";
import type { CustomerEmail, EmailTemplate } from "@/components/email/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkspaceCard, WorkspaceEmpty, WorkspaceError, WorkspaceSectionHeader } from "@/components/jobs/WorkspacePrimitives";
import LayoutWorkspace from "@/components/layouts/LayoutWorkspace";
import type { JobLayout } from "@/components/layouts/types";
import JobNotesPanel from "@/components/jobs/JobNotesPanel";
import type { JobNote } from "@/lib/services/job-notes";
import { formatDateTime as formatCompanyDateTime } from "@/lib/date-time";
import type { MaterialCategory, MaterialScope, ProductionSummary } from "@/components/production/types";
import ProductionProgress from "@/components/production/ProductionProgress";
import ProductionWorkspace from "@/components/production/ProductionWorkspace";
import { addMaterialScopeAction } from "@/app/leads/[id]/production/actions";
import JobHoldDialog from "@/components/jobs/JobHoldDialog";
import { releaseJobHoldAction } from "@/app/leads/[id]/hold/actions";

type Props = {
  activeTab: JobWorkspaceTab;
  job: Job;
  customer: Customer | null;
  assignedEmployee: Employee | null;
  employees: Employee[];
  installerCrews: InstallerCrew[];
  appointmentTypes: AppointmentTypeDefinition[];
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
  layoutsEnabled: boolean;
  layouts: JobLayout[];
  layoutError?: string;
  canManageLayouts: boolean;
  canArchiveLayouts: boolean;
  notes: JobNote[];
  notesError?: string;
  canViewNotes: boolean;
  canCreateNotes: boolean;
  canEditNotes: boolean;
  canDeleteNotes: boolean;
  materialScopes: MaterialScope[];
  materialCategories: MaterialCategory[];
  productionSummary: ProductionSummary;
};

export type JobWorkspaceTab =
  | "overview"
  | "notes"
  | "timeline"
  | "tasks"
  | "calendar"
  | "production"
  | "files"
  | "photos"
  | "layouts"
  | "communications";

const baseNav = [
  ["overview", "Overview"], ["notes", "Notes"], ["timeline", "Timeline"], ["tasks", "Tasks"],
  ["calendar", "Calendar"], ["production", "Production"], ["files", "Files"], ["photos", "Photos"],
  ["communications", "Communications"],
] as const;

export default function JobWorkspace({ activeTab, job, customer, assignedEmployee, employees, installerCrews, appointmentTypes, activities, tasks, taskTypes, appointments, activityError, taskError, canChangeStatus, stages, attachments, attachmentError, canManageAttachments, canArchiveAttachments, conversation, currentEmployee, customerEmails, emailTemplates, customerEmailError, canSendCustomerEmail, layoutsEnabled, layouts, layoutError, canManageLayouts, canArchiveLayouts, notes, notesError, canViewNotes, canCreateNotes, canEditNotes, canDeleteNotes, materialScopes, materialCategories, productionSummary }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("appointment");
  const [scheduledMaterialScopeIds, setScheduledMaterialScopeIds] = useState<string[]>([]);
  const [appointmentBeingEdited, setAppointmentBeingEdited] = useState<CalendarAppointment | null>(null);
  const [currentStatus, setCurrentStatus] = useState(job.status);
  const [currentQfNumber, setCurrentQfNumber] = useState(job.qfloors_job_number);
  const [currentContractAmount, setCurrentContractAmount] = useState(job.contract_amount);
  const [currentInstallationRequired, setCurrentInstallationRequired] = useState(job.installation_required);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<PipelineStage | null>(null);
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [onHold, setOnHold] = useState(job.on_hold);
  const [holdReason, setHoldReason] = useState(job.hold_reason);
  const [holdUntil, setHoldUntil] = useState(job.hold_until);
  const [holdNote, setHoldNote] = useState(job.hold_note);
  const openTasks = tasks.filter((task) => !task.completed);
  const overdueTasks = openTasks.filter((task) => task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date());
  const upcoming = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.starts_at) >= new Date())
    .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime());
  const installationAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_type === "installation" &&
      appointment.status !== "cancelled",
  );
  const workOrdersReady =
    installationAppointments.length > 0 &&
    installationAppointments.every(
      (appointment) =>
        appointment.work_order_status === "sent" ||
        appointment.work_order_status === "acknowledged",
    );
  const employeeName = assignedEmployee?.name ?? job.salesperson ?? "Unassigned";
  const missingRequiredQfNumber = isConfiguredQfNumberRequired(currentStatus, stages) && !currentQfNumber?.trim();
  const missingRequiredContractAmount = isConfiguredContractAmountRequired(currentStatus, stages) && !currentContractAmount;
  const jobDisplayName = formatJobDisplayName({
    customerName: customer?.full_name ?? job.customer?.full_name,
    jobName: job.customer_name,
    qfNumber: currentQfNumber,
  });
  const workspaceTitle = formatJobDisplayName({
    customerName: customer?.full_name ?? job.customer?.full_name,
    jobName: job.customer_name,
  });
  const nav: ReadonlyArray<readonly [JobWorkspaceTab, string]> = layoutsEnabled
    ? [...baseNav.slice(0, 7), ["layouts", "Layouts"], ...baseNav.slice(7)]
    : baseNav;

  async function requestStatusChange(nextStatus: PipelineStage) {
    if (resolveConfiguredStage(currentStatus, stages)?.slug === nextStatus) return;
    const approvedStage = stages.find((stage) => stage.slug === "approved");
    const currentStage = resolveConfiguredStage(currentStatus, stages);
    const nextStage = resolveConfiguredStage(nextStatus, stages);
    const crossesApproval =
      Boolean(approvedStage && currentStage && nextStage) &&
      currentStage.sort_order < approvedStage!.sort_order &&
      nextStage.sort_order >= approvedStage!.sort_order;

    if (
      crossesApproval ||
      (isConfiguredQfNumberRequired(nextStatus, stages) && !currentQfNumber?.trim()) ||
      (isConfiguredContractAmountRequired(nextStatus, stages) && !currentContractAmount)
      || (
        isInstallScheduledStage(nextStatus, stages) &&
        currentInstallationRequired &&
        installationAppointments.length === 0
      )
      || (
        isWorkOrderSentStage(nextStatus, stages) &&
        currentInstallationRequired &&
        !workOrdersReady
      )
    ) {
      setPendingStatus(nextStatus);
      return;
    }
    await saveStatus(nextStatus);
  }

  async function saveStatus(nextStatus: PipelineStage, qfNumber?: string, contractAmount?: string, installationRequired?: boolean, materialCategoryIds?: string[]) {
    const previousStatus = currentStatus;
    const previousQfNumber = currentQfNumber;
    const previousContractAmount = currentContractAmount;
    const previousInstallationRequired = currentInstallationRequired;
    setStatusError("");
    setStatusSaving(true);
    setCurrentStatus(nextStatus);
    if (qfNumber !== undefined) setCurrentQfNumber(qfNumber);
    if (contractAmount !== undefined) setCurrentContractAmount(contractAmount);
    if (installationRequired !== undefined) setCurrentInstallationRequired(installationRequired);

    try {
      if (materialCategoryIds?.length) {
        await Promise.all(materialCategoryIds.map((categoryId) => addMaterialScopeAction({ jobId: job.id, categoryId, description: "" })));
      }
      const updated = await changeJobPipelineStatus(job.id, nextStatus, qfNumber, contractAmount, installationRequired);
      setCurrentStatus(updated.status);
      setCurrentQfNumber(updated.qfloors_job_number);
      setCurrentContractAmount(updated.contract_amount);
      setCurrentInstallationRequired(updated.installation_required);
      setOnHold(false);
      setHoldReason(null);
      setHoldUntil(null);
      setHoldNote(null);
      setPendingStatus(null);
      router.refresh();
    } catch (error) {
      setCurrentStatus(previousStatus);
      setCurrentQfNumber(previousQfNumber);
      setCurrentContractAmount(previousContractAmount);
      setCurrentInstallationRequired(previousInstallationRequired);
      setStatusError(error instanceof Error ? error.message : "Unable to change status.");
    } finally {
      setStatusSaving(false);
    }
  }

  function schedule(type: AppointmentType = "appointment", materialScopeIds: string[] = []) {
    setAppointmentBeingEdited(null);
    setAppointmentType(type);
    setScheduledMaterialScopeIds(materialScopeIds);
    setAppointmentOpen(true);
  }

  function editInstallation(appointment: CalendarAppointment) {
    setAppointmentBeingEdited(appointment);
    setAppointmentType(appointment.appointment_type ?? "installation");
    setScheduledMaterialScopeIds(materialScopes.filter((scope) => scope.appointments.some((item) => item.id === appointment.id)).map((scope) => scope.id));
    setAppointmentOpen(true);
  }

  /* Pipeline deep links open the same shared scheduler with a contextual type. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const requestedType = searchParams.get("schedule");
    if (!requestedType) return;

    const type: AppointmentType =
      requestedType === "installation"
        ? "installation"
        : requestedType === "measure"
          ? "measure"
          : "appointment";

    setAppointmentType(type);
    setAppointmentOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("schedule");
    router.replace(
      params.size ? `${pathname}?${params.toString()}` : pathname,
      { scroll: false },
    );
  }, [pathname, router, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
              <h1 className="min-w-0 text-xl font-bold text-gray-950 sm:text-2xl" title={workspaceTitle}>{workspaceTitle}</h1>
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
              {onHold ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">On Hold until {holdUntil ? formatDate(holdUntil) : "follow-up"}{holdReason ? ` · ${holdReason}` : ""}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <QuickButton onClick={() => selectTab("tasks")}><CheckSquare /> Add Task</QuickButton>
            <QuickButton onClick={() => schedule()}><CalendarPlus /> Schedule</QuickButton>
            <Link href={`/leads/${job.id}/edit`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"><Pencil className="h-3.5 w-3.5" /> Edit Job Info</Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50" aria-label="More job actions"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {customer ? <DropdownMenuItem onClick={() => window.location.assign(`/customers/${customer.id}`)}><UserRound /> Open Customer</DropdownMenuItem> : null}
                <DropdownMenuItem onClick={() => window.location.assign(`/leads/${job.id}/copy`)}><Copy /> Copy Job</DropdownMenuItem>
                {canChangeStatus ? onHold ? <DropdownMenuItem onClick={async () => { try { await releaseJobHoldAction(job.id); setOnHold(false); setHoldReason(null); setHoldUntil(null); setHoldNote(null); router.refresh(); } catch (error) { setStatusError(error instanceof Error ? error.message : "Unable to return job to the pipeline."); } }}><Play /> Return to Active Pipeline</DropdownMenuItem> : <DropdownMenuItem onClick={() => setHoldDialogOpen(true)}><CirclePause /> Place On Hold</DropdownMenuItem> : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {statusError ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</div> : null}
        <dl className="mt-3 grid gap-x-5 gap-y-2 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Customer" value={customer?.full_name ?? job.customer_name} />
          <Fact label="Project address" value={job.address ? <AddressLink value={job.address} className="min-h-0" /> : "Not provided"} />
          <Fact label="Next action due" value={job.next_action_due ? formatDate(job.next_action_due) : "No due date"} />
          <Fact label="Created" value={formatDate(job.created_at)} />
        </dl>
      </header>
      <JobHoldDialog open={holdDialogOpen} jobId={job.id} currentReason={holdReason} currentUntil={holdUntil} currentNote={holdNote} onOpenChange={setHoldDialogOpen} onSaved={(values) => { setOnHold(true); setHoldReason(values.reason); setHoldUntil(values.until); setHoldNote(values.note); router.refresh(); }} />

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
                <WorkspaceCard title="Project Contacts">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <ContactCard title="Company Contact" context={customer?.full_name ?? "Customer / account"} contact={job.company_contact} fallbackPhone={customer?.phone} fallbackEmail={customer?.email} editHref={`/leads/${job.id}/edit`} />
                    <ContactCard title="Project / Job Contact" context={job.project_customer_name ?? job.customer_name} contact={job.project_contact} fallbackPhone={job.phone} fallbackEmail={job.email} address={job.address} editHref={`/leads/${job.id}/edit`} />
                    <ContactCard title="Job Site Contact" context="Optional field contact" contact={job.job_site_contact} editHref={`/leads/${job.id}/edit`} optional />
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
                <WorkspaceCard title="Production Progress">
                  <ProductionProgress
                    scopes={materialScopes}
                    summary={productionSummary}
                    compact
                    onOpen={() => selectTab("production")}
                  />
                </WorkspaceCard>

                <WorkspaceCard title="Work at a glance">
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Open tasks" value={openTasks.length} />
                    <Metric label="Overdue" value={overdueTasks.length} danger={Boolean(overdueTasks.length)} />
                    <Metric label="Upcoming" value={upcoming.length} />
                    <Metric label="Activity" value={activities.length} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                    <QuickButton onClick={() => selectTab("tasks")}>Open Tasks</QuickButton>
                    <QuickButton onClick={() => schedule()}>Schedule</QuickButton>
                    <QuickButton onClick={() => selectTab("communications")}>Messages</QuickButton>
                  </div>
                </WorkspaceCard>

                <WorkspaceCard title="Upcoming appointments" count={upcoming.length}>
                  {upcoming.length ? (
                    <div className="space-y-2">
                      {upcoming.map((appointment) => (
                        <div key={appointment.id}>
                          <p className="mb-1 text-[11px] font-semibold text-gray-500">
                            {formatDateTime(appointment.starts_at)}
                          </p>
                          <AppointmentCard appointment={appointment} compact showTime={false} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <WorkspaceEmpty
                      text="No upcoming appointments."
                      action={<button type="button" onClick={() => schedule()} className="text-xs font-semibold text-gray-900 hover:underline">Schedule</button>}
                    />
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

        {activeTab === "notes" ? (
          <section>
            <WorkspaceSectionHeader title="Job Notes" description="Durable job records. Internal discussions and customer messages remain in Communications." />
            <div className="mt-2">
              <WorkspaceCard title="Notes" count={notes.length}>
                {notesError ? <WorkspaceError text={notesError} /> : canViewNotes ? (
                  <JobNotesPanel jobId={job.id} initialNotes={notes} currentEmployeeId={currentEmployee?.id ?? null} currentEmployeeRole={currentEmployee?.role ?? null}
                    canCreate={canCreateNotes} canEdit={canEditNotes} canDelete={canDeleteNotes} />
                ) : <WorkspaceError text="You do not have permission to view job notes." />}
              </WorkspaceCard>
            </div>
          </section>
        ) : null}

        {activeTab === "tasks" ? (
          <section>
            <WorkspaceCard title="Tasks" count={openTasks.length}>
              {taskError ? <WorkspaceError text={taskError} /> : (
                <TaskManager compact initialTasks={tasks} customers={customer ? [customer] : []} jobs={[job]} employees={employees} taskTypes={taskTypes} currentEmployeeId={currentEmployee?.id ?? null} currentEmployeeRole={currentEmployee?.role ?? null} fixedCustomerId={customer?.id ?? null} fixedJobId={job.id} />
              )}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "calendar" ? (
          <section>
            <WorkspaceCard title="Calendar" count={appointments.length} action={<Link href="/calendar" className="text-xs font-semibold text-gray-700 hover:underline">Open full calendar</Link>}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <QuickButton onClick={() => schedule()}>Schedule</QuickButton>
              </div>
              {appointments.length ? (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} compact />)}
                </div>
              ) : <WorkspaceEmpty text="No calendar events are linked to this job." />}
            </WorkspaceCard>
          </section>
        ) : null}

        {activeTab === "production" ? (
          <section>
            <WorkspaceSectionHeader
              title="Production"
              description="Coordinate materials, installation scopes, and crew work orders."
            />
            <div className="mt-2">
              <ProductionWorkspace jobId={job.id} scopes={materialScopes} categories={materialCategories} summary={productionSummary} appointments={appointments} installationRequired={currentInstallationRequired} onSchedule={(scopeId, type = "installation") => schedule(type, scopeId ? [scopeId] : [])} onEditInstallation={editInstallation} />
            </div>
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

        {activeTab === "layouts" && layoutsEnabled ? (
          <section>
            <WorkspaceSectionHeader title="Layouts" description="Import, preview, version, and share layouts exported from Note Taker HD." />
            <div className="mt-2">
              <LayoutWorkspace
                jobId={job.id}
                customerName={customer?.full_name ?? job.customer?.full_name ?? job.customer_name}
                jobName={job.customer_name}
                qfNumber={currentQfNumber}
                initialLayouts={layouts}
                canManage={canManageLayouts}
                canArchive={canArchiveLayouts}
                error={layoutError}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "communications" ? (
          <section>
            <WorkspaceSectionHeader title="Communications" description="Customer email and secure internal discussion remain clearly separated." />
            <div className="mt-2 space-y-3">
              {customerEmailError ? <WorkspaceError text={customerEmailError} /> : <CustomerEmailPanel compact jobId={job.id} recipient={job.project_contact?.email ?? job.email ?? job.company_contact?.email ?? customer?.email ?? ""} recipientOptions={[{ label: "Project Contact", email: job.project_contact?.email ?? job.email ?? "" }, { label: "Company Contact", email: job.company_contact?.email ?? customer?.email ?? "" }, { label: "Site Contact", email: job.job_site_contact?.email ?? "" }].filter((item) => item.email)} emails={customerEmails} templates={emailTemplates} attachments={attachments} canSend={canSendCustomerEmail} />}
              {currentEmployee ? <InternalMessagePanel compact initialConversation={conversation} currentEmployee={{ id: currentEmployee.id, name: currentEmployee.name, avatar_url: currentEmployee.avatar_url, color: currentEmployee.color }} employees={employees.map((employee) => ({ id: employee.id, name: employee.name, avatar_url: employee.avatar_url, color: employee.color })) as MessagingEmployee[]} jobId={job.id} attachments={attachments} /> : <WorkspaceError text="Your employee profile could not be loaded for internal messaging." />}
            </div>
          </section>
        ) : null}
      </div>

      <AppointmentDialog open={appointmentOpen} onOpenChange={(open) => { setAppointmentOpen(open); if (!open) setAppointmentBeingEdited(null); }} appointment={appointmentBeingEdited} defaultDate={new Date()} defaultJobId={job.id} defaultAppointmentType={appointmentType} employees={employees} installerCrews={installerCrews} jobs={[job]} appointmentTypes={appointmentTypes} productionScopes={materialScopes.map((scope) => ({ id: scope.id, job_id: scope.job_id, label: scope.description || scope.category.name, abbreviation: scope.category.abbreviation }))} defaultMaterialScopeIds={scheduledMaterialScopeIds} appointmentScopeIds={scheduledMaterialScopeIds} />
      {pendingStatus ? (
        <JobRequirementsDialog
          open
          jobName={jobDisplayName}
          targetStatus={pendingStatus}
          requireQfNumber={isConfiguredQfNumberRequired(pendingStatus, stages) && !currentQfNumber?.trim()}
          requireContractAmount={isConfiguredContractAmountRequired(pendingStatus, stages) && !currentContractAmount}
          requireInstallAppointment={
            isInstallScheduledStage(pendingStatus, stages) &&
            currentInstallationRequired &&
            installationAppointments.length === 0
          }
          requireWorkOrdersSent={
            isWorkOrderSentStage(pendingStatus, stages) &&
            currentInstallationRequired &&
            !workOrdersReady
          }
          installationsHref={`/leads/${job.id}?tab=production`}
          onScheduleInstall={() => {
            setPendingStatus(null);
            schedule("installation");
          }}
          initialQfNumber={currentQfNumber}
          initialContractAmount={currentContractAmount}
          showInstallationQuestion={(() => {
            const approvedStage = stages.find((stage) => stage.slug === "approved");
            const currentStage = resolveConfiguredStage(currentStatus, stages);
            const targetStage = resolveConfiguredStage(pendingStatus, stages);
            const crossesApproval = Boolean(
              approvedStage &&
              currentStage &&
              targetStage &&
              currentStage.sort_order < approvedStage.sort_order &&
              targetStage.sort_order >= approvedStage.sort_order
            );
            return (
              crossesApproval ||
              (isWorkOrderSentStage(pendingStatus, stages) &&
                installationAppointments.length === 0)
            );
          })()}
          showProductionSetup={resolveConfiguredStage(pendingStatus, stages)?.slug === "in_progress" && resolveConfiguredStage(currentStatus, stages)?.slug !== "in_progress" && materialScopes.length === 0}
          materialCategories={materialCategories.map(({ id, name, abbreviation }) => ({ id, name, abbreviation }))}
          initialInstallationRequired={currentInstallationRequired}
          isSaving={statusSaving}
          errorMessage={statusError}
          onOpenChange={(open) => {
            if (!open) {
              setPendingStatus(null);
              setStatusError("");
            }
          }}
          onConfirm={({ qfNumber, contractAmount, installationRequired, materialCategoryIds }) => void saveStatus(pendingStatus, qfNumber, contractAmount, installationRequired, materialCategoryIds)}
        />
      ) : null}
    </>
  );
}

function QuickButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 [&_svg]:h-3.5 [&_svg]:w-3.5">{children}</button>; }
function Fact({ label, value }: { label: string; value: React.ReactNode }) { return <div className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium leading-5 text-gray-900" title={typeof value === "string" ? value : undefined}>{value}</dd></div>; }
function ContactCard({ title, context, contact, fallbackPhone, fallbackEmail, address, editHref, optional = false }: { title: string; context: string; contact: JobContactSummary | null; fallbackPhone?: string | null; fallbackEmail?: string | null; address?: string | null; editHref: string; optional?: boolean }) {
  const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : null;
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{title}</p><p className="mt-0.5 truncate text-xs text-gray-500">{context}</p></div><Link href={editHref} className="shrink-0 text-[11px] font-semibold text-blue-700 hover:underline">Edit</Link></div>
      {contact ? <><p className="mt-2 text-sm font-semibold text-gray-950">{name}</p>{contact.job_title ? <p className="text-xs text-gray-500">{contact.job_title}</p> : null}<div className="mt-1.5 flex flex-col items-start gap-0.5"><PhoneLink value={contact.mobile_phone} label={`${name} mobile`} className="min-h-6 text-xs text-gray-600" />{contact.office_phone && contact.office_phone !== contact.mobile_phone ? <PhoneLink value={contact.office_phone} label={`${name} office`} className="min-h-6 text-xs text-gray-600" /> : null}<EmailLink value={contact.email} label={name ?? title} className="min-h-6 text-xs text-gray-600" /></div></> : fallbackPhone || fallbackEmail ? <><p className="mt-2 text-xs font-medium text-amber-700">Named contact not selected</p><div className="mt-1 flex flex-col items-start"><PhoneLink value={fallbackPhone} label={context} className="min-h-6 text-xs text-gray-600"/><EmailLink value={fallbackEmail} label={context} className="min-h-6 text-xs text-gray-600"/></div></> : <p className="mt-3 text-xs text-gray-500">{optional ? "No separate site contact needed." : "Not selected."}</p>}
      {address ? <div className="mt-2 border-t border-gray-200 pt-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Project Address</p><AddressLink value={address} className="mt-0.5 min-h-0 text-xs text-gray-600" /></div> : null}
    </div>
  );
}
function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className={`rounded-md px-3 py-2 ${danger ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-900"}`}><p className="text-[11px] font-medium opacity-70">{label}</p><p className="text-lg font-bold leading-6">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value)); }
function formatDateTime(value: string) { return formatCompanyDateTime(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
function formatCurrency(value: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value)); }
function isWorkOrderSentStage(status: PipelineStage, stages: PipelineStageView[]) {
  const stage = resolveConfiguredStage(status, stages);
  const normalized = `${stage?.slug ?? status} ${stage?.label ?? ""}`
    .toLowerCase()
    .replaceAll("-", " ")
    .replaceAll("_", " ");
  return normalized.includes("work order") && normalized.includes("sent");
}
