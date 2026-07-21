"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  createEmployeeAction,
  resetEmployeePasswordAction,
  updateEmployeeAction,
  deactivateEmployeeAction,
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
  canDeactivateEmployees,
}: {
  initialEmployees: Employee[];
  roles: RoleDefinition[];
  canDeactivateEmployees: boolean;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(null);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<Employee | null>(null);

  function openNewEmployee() {
    setEditingEmployee(null);
    setEmployeeDialogOpen(true);
  }

  function openEditEmployee(employee: Employee) {
    setEditingEmployee(employee);
    setEmployeeDialogOpen(true);
  }

  async function saveEmployee(input: EmployeeActionInput, temporaryPassword: string) {
    const saved = editingEmployee
      ? await updateEmployeeAction(editingEmployee.id, input)
      : await createEmployeeAction(input, temporaryPassword);

    setEmployees((current) =>
      editingEmployee
        ? current.map((employee) => employee.id === saved.id ? saved : employee)
        : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function resetPassword(password: string) {
    if (!passwordEmployee) return;
    await resetEmployeePasswordAction(passwordEmployee.id, password);
  }

  function requestDeactivate(employee: Employee) {
    setEmployeeDialogOpen(false);
    setDeactivatingEmployee(employee);
  }

  async function deactivateSelectedEmployee() {
    if (!deactivatingEmployee) return;
    await deactivateEmployeeAction(deactivatingEmployee.id);
    setEmployees((current) => current.map((employee) =>
      employee.id === deactivatingEmployee.id ? { ...employee, active: false } : employee,
    ));
    setDeactivatingEmployee(null);
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
          canDeactivate={canDeactivateEmployees}
          onRequestDeactivate={requestDeactivate}
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

      {deactivatingEmployee ? (
        <RecordDeleteDialog
          open
          title="Deactivate employee?"
          recordName={deactivatingEmployee.name}
          description="This disables the employee’s login and removes them from active assignment lists. Existing jobs, tasks, appointments, and historical records remain assigned for auditing and reporting."
          confirmLabel="Deactivate employee"
          onOpenChange={(open) => !open && setDeactivatingEmployee(null)}
          onConfirm={deactivateSelectedEmployee}
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
