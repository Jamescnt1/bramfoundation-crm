# Foundation CRM Architecture

Version: 1.0

---

# Purpose

This document defines the architectural standards for Foundation CRM.

Every new feature should follow these guidelines unless a conscious architectural decision is made to change them.

The goal is consistency, maintainability, scalability, and production-quality code.

---

# Technology Stack

Frontend

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4

Backend

- Supabase

Deployment

- Vercel

---

# Project Philosophy

Foundation CRM is an operational CRM built specifically for Bram Flooring.

Foundation CRM manages:

- Leads
- Customers
- Jobs
- Calendar
- Scheduling
- Tasks
- Sales Pipeline
- Internal Operations

Foundation CRM intentionally does NOT manage:

- Estimates
- Accounting
- Inventory
- Payments
- Invoicing
- Product Ordering

Those responsibilities remain inside QFloors.

---

# Core Business Model

Customer

↓

Jobs

↓

Appointments

↓

Tasks

↓

Activity

Everything revolves around the Customer.

Customers can own multiple Jobs.

Jobs contain operational information.

---

# Folder Organization

app/

Pages only.

Minimal logic.

Server Components whenever possible.

---

components/

Feature-first organization.

Example

components/

calendar/

customers/

jobs/

pipeline/

dashboard/

ui/

layout/

---

lib/

Contains shared business logic.

Current

lib/

services/

appointments.ts

customers.ts

Future

jobs.ts

tasks.ts

reports.ts

notifications.ts

---

docs/

Project documentation.

Database

Architecture

Roadmap

Features

Change Log

---

# Page Responsibilities

Pages should:

- Load data
- Call Services
- Render Components

Pages should NOT:

- Contain business logic
- Contain database logic
- Perform complex transformations

---

# Service Layer

Every database table receives its own service.

Example

appointments.ts

customers.ts

jobs.ts

Each service owns CRUD operations.

Example

getCustomers()

getCustomerById()

createCustomer()

updateCustomer()

deleteCustomer()

Pages communicate ONLY with services.

Services communicate with Supabase.

---

# Data Flow

Page

↓

Service

↓

Supabase

Never

Page

↓

Supabase

unless there is a documented exception.

---

# Components

Components should remain small.

Prefer:

CustomerCard

CustomerList

CustomerDetails

CustomerForm

instead of one 800-line component.

---

# Forms

Create and Edit forms are allowed to be separate.

Reason:

Although similar initially, they often diverge as the application grows.

Examples

Create Customer

Edit Customer

Create Job

Edit Job

Avoid unnecessary abstraction.

---

# Server Components

Preferred whenever possible.

Benefits

- Faster
- Less JavaScript
- Better SEO
- Better performance

Use Client Components only when necessary.

Examples

Forms

Interactive search

Dialogs

Drag and Drop

---

# Styling

Tailwind CSS

Use utility classes.

Avoid inline styles.

Avoid custom CSS unless absolutely necessary.

---

# Naming Conventions

Components

CustomerCard.tsx

CustomerList.tsx

CustomerDetails.tsx

CustomerForm.tsx

PascalCase.

---

Functions

getCustomers()

updateCustomer()

createAppointment()

camelCase.

---

Database

snake_case

customer_id

created_at

updated_at

---

Routes

customers/

customers/new

customers/[id]

customers/[id]/edit

Use REST-like patterns.

---

# Error Handling

Service Layer throws errors.

Pages decide how to display them.

Never silently ignore errors.

---

# Loading States

Every page should eventually support

Loading

Empty

Success

Error

states.

---

# Future Customer Relationship

Current

Jobs contain

customer_name

phone

email

address

Future

Jobs contain

customer_id

Customer contact information belongs ONLY to Customers.

Job address becomes

Project Address.

---

# Job Reference Number

Database field

qfloors_job_number

Displayed everywhere as

Job Reference #

Never rename the database field.

Only rename in the UI.

---

# Activity System

Every significant action should eventually create an activity.

Examples

Lead Created

Customer Updated

Appointment Scheduled

Task Completed

Status Changed

This produces a complete job history.

---

# Dashboard Philosophy

Dashboard should answer

What needs attention today?

Not

What happened last month?

Operational dashboards first.

Reporting second.

---

# Customer Snapshot

Future feature.

Every Job page should display

Customer

Phone

Email

Upcoming Appointment

Open Tasks

Recent Activity

Job Reference #

without navigating away.

---

# Code Quality Standards

Production-ready code.

Small components.

Clear naming.

No duplicated business logic.

No direct database access from pages.

No placeholder code committed.

Incremental improvements.

---

# Development Workflow

1.

Design

↓

2.

Database

↓

3.

Service Layer

↓

4.

Page

↓

5.

Components

↓

6.

Testing

↓

7.

Documentation

Every completed sprint updates

Database.md

Features.md

Roadmap.md

Architecture.md

ChangeLog.md

---

# Current Architecture Status

Completed

✔ Calendar Service

✔ Customer Service

✔ Customer Module

✔ Customer Detail

✔ Customer Editing

Next

Jobs Service

↓

Refactor Leads

↓

Customer ↔ Job relationship

↓

Job Detail

↓

Pipeline Refactor

↓

Dashboard KPIs

---

# Long-Term Vision

Foundation CRM should feel purpose-built for Bram Flooring.

Every screen should minimize clicks.

Every page should answer the user's next question before they ask it.

The CRM should become the operational hub of the business while QFloors remains the accounting and estimating platform.