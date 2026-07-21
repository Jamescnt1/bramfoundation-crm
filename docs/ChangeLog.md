# Change Log

## Job Attachments

- Activated the existing Job Workspace Documents and Photos sections.
- Added private Supabase Storage uploads organized by job.
- Added attachment metadata, signed previews/downloads, upload progress, and mobile photo input.
- Added permission-controlled metadata editing and soft archive.
- Added attachment events to the job activity timeline.

---

## Administration Configuration

- Added database-backed Company Settings.
- Added administrator-managed Lead Sources and Task Types.
- Added reusable list management with editing, ordering, and retirement.
- Replaced hard-coded New Lead sources with active database values.
- Preserved historical values when options are retired.
- Added normalized duplicate-name validation and audit logging.
- Added future-ready business-hours and company-logo fields.
- Corrected configuration audit logging so each settings table resolves its
  label from JSON without referencing columns that do not exist on that table.

## Version 0.2 — Workforce

- Added Settings → Employees & Access.
- Added secure Supabase Auth administration through server-only service-role APIs.
- Added employee create/edit, active status, usernames, profile notes, calendar colors, and avatar placeholders.
- Added temporary password issuance and reset with mandatory first-login password changes.
- Added extensible role and permission tables plus Settings → Roles & Permissions.
- Added administrator bootstrap tooling for `virgilw@bramflooring.com` without storing plaintext passwords.

## Employee Workspace Milestone

- Added employee roles and future profile fields.
- Linked employee profiles to Supabase Auth users.
- Added authenticated route protection and sign-in/sign-out.
- Added role-aware dashboard routing.
- Added My Dashboard and Company Dashboard.
- Added stable employee assignments to jobs, tasks, and appointments.

## Task Automation

- Upgraded automation storage to `automation_rules`.
- Added Settings > Automation Rules management.
- Added create, edit, enable/disable, delete, and reorder controls.
- Added immediate or N-days-later task due timing.
- Added assignment to the job salesperson or a specific employee.
- Added support for multiple ordered rules per pipeline status.
- Added automatic task creation for pipeline status transitions.
- Added initial rules for New Lead, Estimate Sent, Approved,
  Materials Ordered, Install Scheduled, and Complete.
- Added automation logging to `job_activities`.
- Added per-rule transition tracking to prevent duplicate tasks.
- Added full automation rule service functions.

## Current Version

### Sales Pipeline

Rebuilt the pipeline as an interactive six-stage Kanban board.

Completed:

- New Lead, Floor Measure, Estimate Sent, Waiting Approval, Sold, and Lost columns
- Drag-and-drop job movement
- Accessible Move to selector
- Optimistic UI updates and rollback on failed saves
- Job status updates through the Jobs service layer
- Automatic job activity recording through the existing database trigger
- Compatibility mapping for legacy job statuses
- Job Reference # on pipeline cards

Created:

components/pipeline/

- PipelineBoard
- PipelineColumn
- PipelineCard
- constants
- types

---

### Customers

Added customer management module.

Completed:

- Customer List
- Customer Search
- New Customer
- Customer Detail
- Edit Customer

Created:

components/customers/

- CustomerCard
- CustomerList
- CustomerDetails
- CustomerForm
- EditCustomerForm

Created customer service layer.

Added:

lib/services/customers.ts

---

### Calendar

Created appointment service layer.

Refactored calendar to use services instead of direct Supabase queries.

---

### Architecture

Standardized feature-first organization.

Current service layers:

- appointments.ts
- customers.ts

Next service layer:

jobs.ts

---

### Known Technical Debt

Leads page still queries Supabase directly.

Next sprint:

Create jobs.ts

↓

Refactor Leads

↓

Connect Jobs to Customers
# Internal Employee Messaging

- Added secure direct, job, and small-group employee conversations.
- Activated internal discussions in the existing Job Workspace Communications section.
- Added an Employee Dashboard inbox with unread direct, job, and mention badges.
- Added employee mentions, message editing, existing job-file attachments, and message-to-task conversion.
- Added job timeline summaries for internal notes and Supabase Realtime message refreshes.
