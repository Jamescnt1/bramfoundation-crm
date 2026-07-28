"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createRoleAction,
  updateRoleAction,
  updateRolePermissionsAction,
} from "@/app/settings/roles/actions";
import type {
  PermissionDefinition,
  RoleDefinition,
} from "@/lib/services/roles-admin";

export default function RolesManager({
  initialRoles,
  permissions,
}: {
  initialRoles: RoleDefinition[];
  permissions: PermissionDefinition[];
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedKey, setSelectedKey] = useState(initialRoles[0]?.key ?? "");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editName, setEditName] = useState(initialRoles[0]?.name ?? "");
  const [editDescription, setEditDescription] = useState(initialRoles[0]?.description ?? "");
  const [editActive, setEditActive] = useState(initialRoles[0]?.active ?? true);
  const selectedRole = roles.find((role) => role.key === selectedKey) ?? null;

  function selectRole(role: RoleDefinition) {
    setSelectedKey(role.key);
    setEditName(role.name);
    setEditDescription(role.description ?? "");
    setEditActive(role.active);
    setMessage("");
  }

  async function saveRoleDetails() {
    if (!selectedRole) return;
    setIsSaving(true);
    setMessage("");
    try {
      const updated = await updateRoleAction({
        key: selectedRole.key,
        name: editName,
        description: editDescription,
        active: editActive,
      });
      setRoles((current) => current.map((role) =>
        role.key === selectedRole.key ? { ...role, ...updated } : role,
      ));
      setMessage("Role details saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save role.");
    } finally {
      setIsSaving(false);
    }
  }

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Map<string, PermissionDefinition[]>>((groups, permission) => {
      const items = groups.get(permission.category) ?? [];
      items.push(permission);
      groups.set(permission.category, items);
      return groups;
    }, new Map());
  }, [permissions]);

  async function addRole() {
    setIsSaving(true);
    setMessage("");
    try {
      const role = await createRoleAction({ key, name, description });
      setRoles((current) => [...current, role].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedKey(role.key);
      setEditName(role.name);
      setEditDescription(role.description ?? "");
      setEditActive(role.active);
      setName("");
      setKey("");
      setDescription("");
      setMessage("Role created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create role.");
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePermission(permissionKey: string) {
    if (!selectedRole) return;
    const next = selectedRole.permissions.includes(permissionKey)
      ? selectedRole.permissions.filter((item) => item !== permissionKey)
      : [...selectedRole.permissions, permissionKey];
    setIsSaving(true);
    setMessage("");
    try {
      await updateRolePermissionsAction(selectedRole.key, next);
      setRoles((current) => current.map((role) =>
        role.key === selectedRole.key ? { ...role, permissions: next } : role,
      ));
      setMessage("Permissions saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save permissions.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900">Roles</h2>
        <div className="mt-3 space-y-1">
          {roles.map((role) => (
            <button key={role.key} type="button" onClick={() => selectRole(role)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedKey === role.key ? "bg-black text-white" : "hover:bg-gray-100"}`}>
              {role.name}
            </button>
          ))}
        </div>
        <div className="mt-6 space-y-3 border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">Add role</h3>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Role name" />
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="role_key" />
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
          <Button type="button" onClick={addRole} disabled={isSaving || !name.trim() || !key.trim()} className="w-full">Add role</Button>
        </div>
      </aside>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {selectedRole ? (
          <>
            <div className="grid gap-4 border-b border-gray-200 pb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Role details</h2>
                <p className="mt-1 text-sm text-gray-500">The role key is permanent: {selectedRole.key}</p>
              </div>
              <label className="grid gap-2 text-sm font-medium text-gray-700">
                Role name
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-gray-700">
                Description
                <Input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700">
                <input type="checkbox" checked={selectedRole.system ? true : editActive} disabled={selectedRole.system || isSaving} onChange={(event) => setEditActive(event.target.checked)} />
                Active
                {selectedRole.system ? <span className="text-xs text-gray-500">System role protected</span> : null}
              </label>
              <Button type="button" className="w-fit" disabled={isSaving} onClick={saveRoleDetails}>
                {isSaving ? "Saving..." : "Save role"}
              </Button>
            </div>
            <div className="mt-6 space-y-6">
              {[...groupedPermissions.entries()].map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{category}</h3>
                  <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {items.map((permission) => (
                      <label key={permission.key} className="flex items-start gap-3 p-4">
                        <input type="checkbox" checked={selectedRole.permissions.includes(permission.key)}
                          disabled={isSaving || selectedRole.key === "administrator"}
                          onChange={() => togglePermission(permission.key)} className="mt-1" />
                        <span><span className="block text-sm font-medium text-gray-900">{permission.name}</span>
                          <span className="block text-xs text-gray-500">{permission.description}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-sm text-gray-500">Create a role to begin.</p>}
        {message ? <p className="mt-5 text-sm text-gray-600">{message}</p> : null}
      </section>
    </div>
  );
}
