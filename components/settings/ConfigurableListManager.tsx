"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ConfigurableItem = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

type Props = {
  initialItems: ConfigurableItem[];
  itemLabel: string;
  usageDescription: string;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (item: ConfigurableItem) => Promise<void>;
  onReorder: (items: ConfigurableItem[]) => Promise<void>;
  onRemove: (id: string) => Promise<"deleted" | "retired">;
};

export default function ConfigurableListManager({
  initialItems,
  itemLabel,
  usageDescription,
  onCreate,
  onUpdate,
  onReorder,
  onRemove,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return setError(`${itemLabel} name is required.`);
    await run(async () => {
      await onCreate(newName);
      window.location.reload();
    });
  }

  async function save(item: ConfigurableItem) {
    const name = editingName.trim();
    if (!name) return setError(`${itemLabel} name is required.`);
    await run(async () => {
      await onUpdate({ ...item, name });
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, name } : entry)),
      );
      setEditingId(null);
    });
  }

  async function toggle(item: ConfigurableItem) {
    await run(async () => {
      const updated = { ...item, active: !item.active };
      await onUpdate(updated);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? updated : entry)),
      );
    });
  }

  async function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((item, sort_order) => ({ ...item, sort_order }));
    const previous = items;
    setItems(normalized);
    await run(async () => {
      try {
        await onReorder(normalized);
      } catch (caught) {
        setItems(previous);
        throw caught;
      }
    });
  }

  async function remove(item: ConfigurableItem) {
    const confirmed = window.confirm(
      `Remove “${item.name}”? If it is used by historical records, it will be retired instead of deleted.`,
    );
    if (!confirmed) return;
    await run(async () => {
      const result = await onRemove(item.id);
      if (result === "deleted") {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        setMessage(`${item.name} was deleted.`);
      } else {
        setItems((current) =>
          current.map((entry) => entry.id === item.id ? { ...entry, active: false } : entry),
        );
        setMessage(`${item.name} is used by historical records and was retired.`);
      }
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to update ${itemLabel.toLowerCase()}s.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <form
        onSubmit={add}
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row"
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={`New ${itemLabel.toLowerCase()}`}
          disabled={busy}
        />
        <Button disabled={busy} className="gap-2">
          <Plus className="h-4 w-4" /> Add {itemLabel}
        </Button>
      </form>

      {error ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {items.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-3 border-b border-gray-100 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <div className="flex max-w-lg gap-2">
                  <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus />
                  <Button type="button" onClick={() => save(item)} disabled={busy}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)} disabled={busy} aria-label="Cancel edit"><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.active ? usageDescription : "Retired — preserved on historical records and hidden from new forms."}</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label={`Move ${item.name} up`}><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(index, 1)} disabled={busy || index === items.length - 1} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label={`Move ${item.name} down`}><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setEditingId(item.id); setEditingName(item.name); }} disabled={busy} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={`Edit ${item.name}`}><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => remove(item)} disabled={busy} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`Delete or retire ${item.name}`}><Trash2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => toggle(item)} disabled={busy} className={`ml-2 rounded-full px-3 py-1 text-xs font-semibold ${item.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{item.active ? "Active" : "Retired"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
