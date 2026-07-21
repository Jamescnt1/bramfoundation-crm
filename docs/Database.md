# Database

## job_attachments

- id
- job_id
- uploaded_by_employee_id
- file_name
- storage_path
- mime_type
- file_size
- attachment_kind (`photo` or `file`)
- category
- description
- created_at
- updated_at
- archived_at
- archived_by_employee_id

Files are stored privately in the Supabase Storage bucket `job-attachments` under
`{job_id}/photos/` or `{job_id}/files/`. The application uses short-lived signed
URLs for viewing and downloading.

---

## Workforce access

### employees

Employee profiles are linked to Supabase Auth through `auth_user_id`. Passwords are never stored in this table.

Key profile/access fields: `email`, `username`, `phone`, `role`, `active`, `avatar_url`, `color`, `job_title`, and `bio`.

### role_definitions

Extensible employee roles. System roles are seeded, and administrators may add business-specific roles.

### permission_definitions

The capability catalog used by role-based access control.

### role_permissions

Many-to-many assignments between roles and permissions.

## appointments

- id
- job_id
- title
- appointment_type
- starts_at
- ends_at
- status
- location
- notes
- created_at
- updated_at

---

## customers

- id
- full_name
- phone
- email
- address
- notes
- created_at
- updated_at

---

## employees

Employee profiles are linked to Supabase Auth through `auth_user_id`.

- auth_user_id
- email
- phone
- role
- avatar_url
- color
- job_title
- bio
- updated_at

- id
- name
- active
- created_at

---

## job_activities

- id
- job_id
- activity_type
- description
- old_value
- new_value
- created_at

---

## job_tasks

- id
- job_id
- title
- assigned_to
- due_date
- completed
- completed_at
- created_at
- automation_rule_id
- automation_transition_id

The `(automation_transition_id, automation_rule_id)` pair is unique
when present. It prevents the same rule from creating the same task
twice during one status transition while allowing multiple rules to
run for that transition.

---

## automation_rules

- id
- name
- trigger_status
- task_title
- due_offset_days
- assignment_type
- assigned_employee_id
- active
- sort_order
- created_at
- updated_at

Active rules create a `job_tasks` record whenever a job enters the
matching status. The database trigger also records a `task_automated`
entry in `job_activities`. Rules can assign the task to the job
salesperson or a specific active employee.

---

## jobs

Current

- id
- customer_name
- phone
- email
- address
- lead_source
- status
- salesperson
- next_action
- next_action_due
- notes
- qfloors_job_number
- created_at
- updated_at

---

Future

jobs.customer_id

↓

customers.id

Existing customer fields will be removed after migration.

address will represent the PROJECT ADDRESS.

customers.address will represent the CONTACT ADDRESS.

---

Job Reference #

jobs.qfloors_job_number

Displayed throughout the application as

Job Reference #

No additional reference field will be created.

---

## company_settings

Singleton company configuration managed by administrators. It stores
company contact details, timezone, locale, currency, future-ready
business hours, and a reserved logo URL.

---

## lead_sources

Administrator-managed lead-source options with `active` and
`sort_order` fields. Names are unique after trimming and without regard
to case. Sources are retired by setting `active` to false so historical
`jobs.lead_source` values remain readable.

---

## task_types

Administrator-managed task categories with `active` and `sort_order`
fields. Referenced types are retired rather than deleted, preserving
historical tasks.

Changes to company settings, lead sources, and task types are recorded
in `admin_audit_log` by database triggers.
    
# Internal Messaging

Internal communication uses `conversations`, `conversation_participants`, `messages`, `message_mentions`, `message_attachments`, `message_task_links`, and `employee_notifications`. Internal messages are constrained to the `internal` channel. Job discussions inherit job access rules, while direct and group discussions require participant membership. `job_tasks.source_message_id` preserves task provenance.
