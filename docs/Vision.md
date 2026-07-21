# FOUNDATION CRM

## Vision

Foundation CRM is a modern CRM built specifically for Bram Flooring.

It is designed to manage the complete customer lifecycle from the first lead through completed installation while intentionally leaving estimating, accounting, invoicing, payments, inventory, and product management inside QFloors.

Foundation CRM is responsible for:

- Lead Management
- Customer Management
- Job Management
- Sales Pipeline
- Calendar
- Scheduling
- Tasks
- Activity Timeline
- Reporting
- Internal Operations

---

# Technology Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase
- Vercel

---

# Architecture

Every feature follows the same pattern.

Page

↓

Service Layer

↓

Supabase

Pages never communicate directly with Supabase unless specifically approved.

Example:

Calendar Page

↓

appointments.ts

↓

Supabase

Customers

↓

customers.ts

↓

Supabase

Future:

Jobs

↓

jobs.ts

↓

Supabase

---

# Design Principles

- Feature-first organization
- Strong service layer
- Small reusable components
- Server Components by default
- Client Components only when needed
- Complete replacement files instead of snippets
- Production-ready code
- Incremental development

---

# CRM Philosophy

Customer

↓

Jobs

↓

Appointments

↓

Tasks

↓

Activity

Everything revolves around the customer.
