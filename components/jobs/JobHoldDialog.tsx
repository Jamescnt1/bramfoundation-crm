"use client";

import { useState } from "react";
import { placeJobOnHoldAction } from "@/app/leads/[id]/hold/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const reasons = ["Customer reviewing", "Budgeting", "Builder timeline", "Project delayed", "Seasonal", "Other"];

export default function JobHoldDialog({ open, jobId, currentReason, currentUntil, currentNote, onOpenChange, onSaved }: { open: boolean; jobId: string; currentReason?: string | null; currentUntil?: string | null; currentNote?: string | null; onOpenChange: (open: boolean) => void; onSaved: (values: { reason: string; until: string; note: string }) => void }) {
  const [reason, setReason] = useState(currentReason ?? reasons[0]);
  const [until, setUntil] = useState(currentUntil ?? "");
  const [note, setNote] = useState(currentNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() { if (!until) { setError("Choose a follow-up date."); return; } setSaving(true); setError(""); try { await placeJobOnHoldAction({ jobId, reason, holdUntil: until, note }); onSaved({ reason, until, note }); onOpenChange(false); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to place this job on hold."); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Place Job On Hold</DialogTitle><DialogDescription>Remove this job from the active board while keeping it searchable and scheduled for follow-up.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><label className="grid gap-2 text-sm font-medium">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3">{reasons.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Follow-up date<Input type="date" value={until} onChange={(event) => setUntil(event.target.value)} required /></label><label className="grid gap-2 text-sm font-medium">Note <span className="text-xs font-normal text-gray-500">Optional context for the salesperson or manager</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>{error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Place On Hold"}</Button></DialogFooter></DialogContent></Dialog>;
}
