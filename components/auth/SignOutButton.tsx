"use client";

import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <button type="button" onClick={signOut} className="text-xs font-medium text-gray-500 hover:text-black">
      Sign out
    </button>
  );
}
