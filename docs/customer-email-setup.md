# Customer Email Setup

Foundation CRM uses Resend for outbound customer email and optional inbound replies.

## 1. Apply the database migration

Apply `supabase/migrations/202607210008_customer_email.sql` through the normal Supabase migration workflow.

## 2. Configure server environment variables

```text
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=Bram Flooring
```

`EMAIL_FROM_ADDRESS` must use a sender/domain verified with the email provider.

## 3. Optional inbound replies and delivery tracking

Configure a Resend receiving domain and set:

```text
EMAIL_INBOUND_DOMAIN=
RESEND_WEBHOOK_SECRET=
```

Register this production webhook URL in Resend:

```text
https://YOUR_CRM_DOMAIN/api/customer-email/webhook
```

Enable these events:

- `email.sent`
- `email.delivered`
- `email.failed`
- `email.bounced`
- `email.received`

Inbound job association uses the reply address format `job+{job_id}@EMAIL_INBOUND_DOMAIN`.

## 4. Verify

1. Open Administration → Email Templates and test-send a seeded template.
2. Open a Job Workspace → Communications and send a manual email.
3. Add a job-status Automation Rule with the **Send a customer email** action.
4. Move a test job into that stage and confirm the message appears in Email History.
5. Confirm provider webhook events move the status from Sent to Delivered or Failed.
