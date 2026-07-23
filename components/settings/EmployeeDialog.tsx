"use client";

import { type FormEvent, useState } from "react";
import { type EmployeeRole } from "@/lib/auth/roles";
import type { Employee } from "@/lib/services/employees";
import type { RoleDefinition } from "@/lib/services/roles-admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EmployeeActionInput } from "@/app/settings/employees/actions";

type EmployeeDialogProps = {
  open: boolean;
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: EmployeeActionInput, temporaryPassword: string) => Promise<void>;
  roles: RoleDefinition[];
  canDelete?: boolean;
  onRequestDelete?: (employee: Employee) => void;
};

export default function EmployeeDialog({
  open,
  employee,
  onOpenChange,
  onSave,
  roles,
  canDelete = false,
  onRequestDelete,
}: EmployeeDialogProps) {
  const [name, setName] = useState(employee?.name ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [username, setUsername] = useState(employee?.username ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(employee?.job_title ?? "");
  const [bio, setBio] = useState(employee?.bio ?? "");
  const [role, setRole] = useState<EmployeeRole>(employee?.role ?? "office_staff");
  const [active, setActive] = useState(employee?.active ?? true);
  const [color, setColor] = useState(employee?.color ?? "#111827");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    try {
      await onSave(
        { name, email, username, phone, jobTitle, bio, role, active, color },
        temporaryPassword,
      );
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              {employee
                ? "Update the employee profile, login, access role, or account status."
                : "Create an employee profile and issue a temporary first-login password."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-6">
            <Field label="Name" id="employee-name">
              <Input id="employee-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Login email" id="employee-email">
                <Input id="employee-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </Field>
              <Field label="Username (optional)" id="employee-username">
                <Input
                  id="employee-username"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .toLowerCase()
                        .replace(/\s+/g, ".")
                        .replace(/[^a-z0-9._-]/g, ""),
                    )
                  }
                  placeholder="firstname.lastname"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Lowercase letters, numbers, dots, dashes, or underscores. Spaces become dots.
                </p>
              </Field>
            </div>

            <Field label="Profile notes" id="employee-bio">
              <textarea
                id="employee-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={3}
                placeholder="Responsibilities, certifications, or internal profile notes"
                className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Phone" id="employee-phone">
                <Input id="employee-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field label="Job title" id="employee-job-title">
                <Input id="employee-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Role" id="employee-role">
                <select
                  id="employee-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as EmployeeRole)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                >
                  {roles.filter((item) => item.active).map((item) => (
                    <option key={item.key} value={item.key}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Calendar color" id="employee-color">
                <Input id="employee-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10" />
              </Field>
            </div>

            {!employee ? (
              <Field label="Temporary password" id="employee-password">
                <Input
                  id="employee-password"
                  type="password"
                  autoComplete="new-password"
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  At least 10 characters with uppercase, lowercase, a number, and a symbol. The employee must change it after signing in.
                </p>
              </Field>
            ) : null}

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>
                <span className="block text-sm font-medium text-gray-900">Active employee</span>
                <span className="block text-xs text-gray-500">Inactive employees cannot use Foundation CRM.</span>
              </span>
            </label>

            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}
          </div>

          <DialogFooter>
            {employee && canDelete ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => onRequestDelete?.(employee)}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 sm:mr-auto"
              >
                Delete employee
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : employee ? "Save changes" : "Create employee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">{label}</label>{children}</div>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
