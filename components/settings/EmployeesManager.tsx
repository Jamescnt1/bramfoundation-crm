"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  createEmployeeAction,
  resetEmployeePasswordAction,
  updateEmployeeAction,
  deleteEmployeeAction,
  type EmployeeActionInput,
} from "@/app/settings/employees/actions";
import EmployeeDialog from "@/components/settings/EmployeeDialog";
import PasswordResetDialog from "@/components/settings/PasswordResetDialog";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/auth/roles";
import type { Employee } from "@/lib/services/employees";
import type { RoleDefinition } from "@/lib/services/roles-admin";
import RecordDeleteDialog from "@/components/ui/RecordDeleteDialog";

export default function EmployeesManager({
  initialEmployees,
  roles,
  canDeleteEmployees,
}: {
  initialEmployees: Employee[];
  roles: RoleDefinition[];
  canDeleteEmployees: boolean;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  function openNewEmployee() {
    setEditingEmployee(null);
    setEmployeeDialogOpen(true);
  }

  function openEditEmployee(employee: Employee) {
    setEditingEmployee(employee);
    setEmployeeDialogOpen(true);
  }

  async function saveEmployee(input: EmployeeActionInput, temporaryPassword: string) {
    const isEditing = Boolean(editingEmployee);
    const saved = editingEmployee
      ? await updateEmployeeAction(editingEmployee.id, input)
      : await createEmployee(input, temporaryPassword);

    setEmployees((current) =>
      isEditing
        ? current.map((employee) => employee.id === saved.id ? saved : employee)
        : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setSuccessMessage(
      isEditing
        ? `${saved.name}'s employee profile was updated.`
        : `${saved.name} was created. They can now sign in with the temporary password.`,
    );
  }

  async function createEmployee(
    input: EmployeeActionInput,
    temporaryPassword: string,
  ) {
    const result = await createEmployeeAction(input, temporaryPassword);
    if (!result.ok) {
      throw new Error(`${result.message} Error reference: ${result.reference}.`);
    }
    return result.employee;
  }

  async function resetPassword(password: string) {
    if (!passwordEmployee) return;
    await resetEmployeePasswordAction(passwordEmployee.id, password);
  }

  function requestDelete(employee: Employee) {
    setEmployeeDialogOpen(false);
    setDeletingEmployee(employee);
  }

  async function deleteSelectedEmployee() {
    if (!deletingEmployee) return;
    await deleteEmployeeAction(deletingEmployee.id);
    setEmployees((current) => current.filter((employee) => employee.id !== deletingEmployee.id));
    setDeletingEmployee(null);
  }

  return (
    <>
      <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Employees</h2>
            <p className="mt-1 text-sm text-gray-500">Manage staff profiles, access roles, login names, and account status.</p>
          </div>
          <Button type="button" size="lg" onClick={openNewEmployee}><Plus /> Add employee</Button>
        </div>

        {successMessage ? (
          <div
            role="status"
            className="border-b border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800"
          >
            {successMessage}
          </div>
        ) : null}

        {employees.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">No employees have been added yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {employees.map((employee) => (
              <article key={employee.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={employee.avatar_url ?? undefined} alt="" />
                    <AvatarFallback style={{ backgroundColor: employee.color }} className="text-white">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${employee.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {employee.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{getRoleLabel(employee.role)}{employee.job_title ? ` · ${employee.job_title}` : ""}</p>
                    <p className="mt-1 text-sm text-gray-500">{employee.email ?? "No login email"}{employee.username ? ` · @${employee.username}` : ""}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setPasswordEmployee(employee)} disabled={!employee.auth_user_id}>
                    <KeyRound /> Reset password
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openEditEmployee(employee)}><Pencil /> Edit</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {employeeDialogOpen ? (
        <EmployeeDialog
          key={editingEmployee?.id ?? "new-employee"}
          open
          employee={editingEmployee}
          onOpenChange={setEmployeeDialogOpen}
          onSave={saveEmployee}
          roles={roles}
          canDelete={canDeleteEmployees}
          onRequestDelete={requestDelete}
        />
      ) : null}

      {passwordEmployee ? (
        <PasswordResetDialog
          open
          employee={passwordEmployee}
          onOpenChange={(open) => !open && setPasswordEmployee(null)}
          onReset={resetPassword}
        />
      ) : null}

      {deletingEmployee ? (
        <RecordDeleteDialog
          open
          title="Permanently delete employee?"
          recordName={deletingEmployee.name}
          description="Permanent beta cleanup: this removes the employee profile and login. Existing assignments will become unassigned. Deletion is blocked if internal message history must retain the employee’s identity. This cannot be undone."
          confirmLabel="Permanently delete"
          onOpenChange={(open) => !open && setDeletingEmployee(null)}
          onConfirm={deleteSelectedEmployee}
        />
      ) : null}
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
