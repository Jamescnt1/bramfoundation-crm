"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmation) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (
      password.length < 10 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setErrorMessage("Use at least 10 characters with uppercase, lowercase, a number, and a symbol.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({
      password,
      data: {
        ...user?.user_metadata,
        must_change_password: false,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div> : null}
      <div>
        <label htmlFor="new-password" className="text-sm font-medium text-gray-700">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
      </div>
      <div>
        <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
      </div>
      <button type="submit" disabled={isSaving} className="w-full rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-60">{isSaving ? "Updating…" : "Change password"}</button>
    </form>
  );
}
