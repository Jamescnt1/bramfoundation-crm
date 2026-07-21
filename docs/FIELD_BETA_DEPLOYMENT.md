# Foundation CRM private field beta

## Required Vercel environment variables

Set these for Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never use a `NEXT_PUBLIC_` prefix)

Optional dashboard thresholds:

- `COMPANY_DASHBOARD_FOLLOW_UP_DAYS=5`
- `COMPANY_DASHBOARD_WAITING_APPROVAL_DAYS=7`

Customer email variables (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
`EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, and `EMAIL_INBOUND_DOMAIN`) may remain
unset until email DNS and provider setup are complete. Customer email sending will
remain unavailable, but the rest of the beta is unaffected.

Do not add `INITIAL_ADMIN_PASSWORD` to Vercel. It is a one-time local bootstrap
value only and should be removed after account creation.

## Supabase production configuration

1. Apply every SQL file in `supabase/migrations` in filename order, including
   `202607210009_private_beta_security.sql`.
2. Run `npm run audit:beta` locally to verify required tables, configuration,
   the private `job-attachments` bucket, and the initial administrator link.
3. In Authentication > URL Configuration, set Site URL to the Vercel production
   URL and add these Redirect URLs:
   - `https://YOUR-PROJECT.vercel.app/**`
   - `http://localhost:3000/**`
4. Keep the `job-attachments` Storage bucket private.
5. Confirm `virgilw@bramflooring.com` is linked to an active employee with the
   Administrator role. The account already exists when the readiness audit passes.

## Employee access

Administrators manage users under Settings > Employees. New accounts receive a
temporary password and must change it on first login. Password resets use the same
temporary-password flow. Passwords are handled by Supabase Auth and are never
stored in the employees table or source code.

## Release checks

Before each beta release:

1. `npm run lint`
2. `npm run build`
3. `npm run audit:beta`
4. Deploy the `main` branch to Vercel.
5. Test login in a private browser window and confirm unauthenticated routes
   redirect to `/login`.

## Field-beta smoke checklist

- Sign in, sign out, and forced first-password change
- Create a New Lead for a new customer and an existing customer
- Move a job through Pipeline and confirm QF# is required at Estimate Sent
- Open Customers and a Job Workspace
- Create, assign, complete, and filter Tasks
- Create/edit an appointment and check month/week/3-day/day/list views
- Open Employee and Company dashboards
- Open Settings and verify employee/role/configuration access
- Upload, preview, and download a job photo and document
- Send/read an internal direct or job message
- At 390px phone width, open the menu and navigate all primary sections

Email delivery is intentionally outside the first beta until DNS/provider setup is
completed with IT.
