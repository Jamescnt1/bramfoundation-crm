import { createClient } from "@/lib/supabase/server";

export type InstallerCrew = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export async function getActiveInstallerCrews(): Promise<InstallerCrew[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installer_crews")
    .select("id, name, active, sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as InstallerCrew[];
}
