# Employee Access Setup

Employee credentials are managed by Supabase Auth. Foundation CRM never stores plaintext passwords in `public.employees`.

## 1. Apply the migrations

Run these migrations in order in the Supabase SQL Editor (or with the Supabase CLI):

1. `supabase/migrations/202607200001_employee_workspace.sql`
2. `supabase/migrations/202607200002_employee_management.sql`
3. `supabase/migrations/202607200003_roles_permissions.sql`

The second migration adds unique employee usernames and administrator visibility for employee management.
The third migration adds extensible role definitions, permission definitions, and role-permission assignments.

## 2. Configure server-only credentials

Add the following to `.env.local` and to the server-side environment variables in deployment:

```text
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find this value in Supabase under Project Settings → API. Never expose it in browser code, never prefix it with `NEXT_PUBLIC_`, and never commit it.

## 3. Bootstrap the first administrator

Temporarily add the requested initial administrator password to `.env.local`:

```text
INITIAL_ADMIN_PASSWORD=your-temporary-password
```

Then run:

```text
npm run bootstrap:admin
```

The command creates or updates the administrator employee and Auth user for `virgilw@bramflooring.com`, assigns username `virgilw`, and requires a password change at first login.

Remove `INITIAL_ADMIN_PASSWORD` from `.env.local` immediately after the command succeeds. Keep `SUPABASE_SERVICE_ROLE_KEY` configured on the server because Settings → Employees uses it for secure Auth administration.

## 4. Manage employees

Sign in as an Administrator and open Settings → Employees & Access. Administrators can:

- Create employee profiles and Auth accounts
- Assign roles
- Assign an optional username
- Edit login email and employee details
- Activate or deactivate access
- Issue temporary passwords that must be changed on next login
- Maintain profile notes and calendar colors

Open Settings → Roles & Permissions to create additional roles and assign capabilities. The Administrator role always retains every permission.

Passwords are sent only to the server action and Supabase Auth. They are never written to the employees table or returned by the server.

## Security notes

- Only employees with role `administrator` can open employee management or invoke its server actions.
- Every server action independently checks the current authenticated employee and role.
- Deactivating an employee blocks their workspace access and bans the associated Auth account.
- An administrator cannot deactivate themselves or remove their own Administrator role.
