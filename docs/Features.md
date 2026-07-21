# Features

## Job Files and Photos

- Private job-scoped storage
- Multi-file uploads with progress
- Photo thumbnails and full-size preview
- PDF and image previews
- Document list with category, uploader, date, and size
- Metadata editing
- Permission-controlled soft archive
- Job activity logging for attachment changes

---

## Employee Workspace

- Supabase Auth sign-in
- Employee profiles and extensible roles
- Role-aware dashboard routing
- Personal dashboard for tasks, appointments, jobs, overdue work, and pipeline
- Company dashboard for administrators and managers

## Completed

### Administration Configuration

- Editable company profile, timezone, locale, and currency
- Future-ready business-hours and company-logo fields
- Configurable lead sources with add, rename, reorder, and retire controls
- Configurable task types with add, rename, reorder, and retire controls
- New Lead and task forms use active database configuration
- Historical records retain retired values
- Configuration changes are written to the administrator audit log

### Workforce & Access

- Supabase Auth login
- Secure server-side employee account creation
- Temporary password reset and forced first-login password change
- Employee profiles, phone, role, status, calendar color, and avatar placeholder
- Extensible Roles & Permissions settings
- Administrator-only workforce management

### Task Automation

- Settings > Automation Rules management page
- Add, edit, enable, disable, delete, and reorder rules
- Configurable pipeline trigger, task title, and due offset
- Assignment to the job salesperson or a specific employee
- Automatic task creation on job status transitions
- Automation entries in the job activity timeline
- Per-rule duplicate protection for each transition

### Dashboard

Base dashboard created.

---

### Leads

- Lead List
- New Lead
- Lead Details
- Activity Timeline

---

### Customers

- Customer List
- Search
- New Customer
- Customer Details
- Edit Customer

---

### Calendar

- Appointment List
- Appointment CRUD
- Appointment Service Layer

---

### Sales Pipeline

- Six-stage Kanban board
- Drag-and-drop status changes
- Accessible status selector fallback
- Optimistic updates with rollback on failure
- Automatic activity timeline entries through the existing status trigger
- Legacy status mapping
- Job Reference # displayed on pipeline cards

---

### Services

appointments.ts

customers.ts

---

### UI

- Sidebar
- Navigation
- Customer Cards
- Customer List
- Customer Detail
- Customer Forms

---

## Planned

### Jobs

- Service Layer
- Job Detail
- Customer Relationship
- Project Address
- Job Reference #

---

### Pipeline

Refactor to use Jobs Service

---

### Dashboard

Real KPI widgets

---

### Reports

Operational reporting
# Internal Employee Messaging

- Direct employee conversations
- Job-specific internal discussions
- Small internal groups
- Read and unread state
- Employee mentions and mention badges
- Existing job-file attachments
- Convert an internal message into a linked task
- Realtime updates through Supabase

Customer email and SMS are intentionally not part of this phase.
