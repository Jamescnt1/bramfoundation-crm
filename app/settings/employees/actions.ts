"use server";

import { revalidatePath } from "next/cache";
import type { EmployeeRole } from "@/lib/auth/roles";
import { getRolesAndPermissions } from "@/lib/services/roles-admin";
import {
  EmployeeAdminError,
  createManagedEmployee,
  resetManagedEmployeePassword,
  updateManagedEmployee,
  type EmployeeAdminValues,
} from "@/lib/services/employee-admin";
import { deleteEmployeePermanently } from "@/lib/services/record-lifecycle";
import type { Employee } from "@/lib/services/employees";
import { SupabaseAdminConfigurationError } from "@/lib/supabase/admin";

export type EmployeeActionInput = {
  name: string;
  email: string;
  username: string;
  phone: string;
  role: string;
  active: boolean;
  jobTitle: string;
  bio: string;
  color: string;
};

export type CreateEmployeeActionResult =
  | {
      ok: true;
      employee: Employee;
      message: string;
    }
  | {
      ok: false;
      message: string;
      field?: "email" | "username" | "temporaryPassword";
      reference: string;
    };

export async function createEmployeeAction(
  input: EmployeeActionInput,
  temporaryPassword: string,
): Promise<CreateEmployeeActionResult> {
  const reference = crypto.randomUUID().slice(0, 8);

  try {
    const values = await validateEmployeeInput(input);
    validateTemporaryPassword(temporaryPassword);
    const employee = await createManagedEmployee(values, temporaryPassword);
    revalidatePath("/settings/employees");
    return {
      ok: true,
      employee,
      message: `${employee.name} was created and can sign in with the temporary password.`,
    };
  } catch (error) {
    console.error(`[employee-create:${reference}]`, error);
    return getSafeCreateEmployeeError(error, reference);
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  input: EmployeeActionInput,
) {
  if (!employeeId) throw new Error("Employee ID is required.");
  const employee = await updateManagedEmployee(
    employeeId,
    await validateEmployeeInput(input),
  );
  revalidatePath("/settings/employees");
  return employee;
}

export async function resetEmployeePasswordAction(
  employeeId: string,
  temporaryPassword: string,
) {
  if (!employeeId) throw new Error("Employee ID is required.");
  validateTemporaryPassword(temporaryPassword);
  await resetManagedEmployeePassword(employeeId, temporaryPassword);
}

export async function deleteEmployeeAction(employeeId: string) {
  if (!employeeId) throw new Error("Employee ID is required.");
  await deleteEmployeePermanently(employeeId);
  revalidatePath("/settings/employees");
  revalidatePath("/my-dashboard");
  revalidatePath("/calendar");
}

async function validateEmployeeInput(input: EmployeeActionInput): Promise<EmployeeAdminValues> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const role = input.role as EmployeeRole;

  if (name.length < 2) throw new Error("Employee name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid login email.");
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new Error("Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores.");
  }
  const { roles } = await getRolesAndPermissions();
  if (!roles.some((item) => item.key === role && item.active)) {
    throw new Error("Select a valid employee role.");
  }
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error("Select a valid calendar color.");

  return {
    name,
    email,
    username: username || null,
    phone: input.phone.trim() || null,
    role,
    active: Boolean(input.active),
    job_title: input.jobTitle.trim() || null,
    bio: input.bio.trim() || null,
    color: input.color,
  };
}

function validateTemporaryPassword(password: string) {
  if (
    password.length < 10 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      "Temporary password must be at least 10 characters and include uppercase, lowercase, a number, and a symbol.",
    );
  }
}

function getSafeCreateEmployeeError(
  error: unknown,
  reference: string,
): CreateEmployeeActionResult {
  if (error instanceof EmployeeAdminError) {
    const field =
      error.code === "duplicate_email"
        ? "email"
        : error.code === "duplicate_username"
          ? "username"
          : error.code === "invalid_password"
            ? "temporaryPassword"
            : undefined;
    return { ok: false, message: error.message, field, reference };
  }
  if (error instanceof SupabaseAdminConfigurationError) {
    return {
      ok: false,
      message:
        "Employee login creation is not configured on this server. Ask an administrator to verify the deployment settings.",
      reference,
    };
  }
  if (error instanceof Error) {
    if (error.message.includes("Temporary password")) {
      return {
        ok: false,
        message: error.message,
        field: "temporaryPassword",
        reference,
      };
    }
    if (
      error.message.includes("Employee name") ||
      error.message.includes("valid login email") ||
      error.message.includes("Username") ||
      error.message.includes("employee role") ||
      error.message.includes("calendar color")
    ) {
      return { ok: false, message: error.message, reference };
    }
  }
  return {
    ok: false,
    message:
      "The employee could not be created. No duplicate login was kept. Try again or give support the error reference below.",
    reference,
  };
}
