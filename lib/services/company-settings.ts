import { createClient } from "@/lib/supabase/server";

export type CompanySettings = {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  timezone: string;
  locale: string;
  currency: string;
  business_hours: Record<string, unknown>;
  logo_url: string | null;
  updated_at: string;
};

export type CompanySettingsValues = Omit<
  CompanySettings,
  "id" | "business_hours" | "logo_url" | "updated_at"
>;

const columns =
  "id, company_name, phone, email, website, address, timezone, locale, currency, business_hours, logo_url, updated_at";

export async function getCompanySettings(): Promise<CompanySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select(columns)
    .eq("singleton_key", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data as CompanySettings;

  const { data: created, error: createError } = await supabase
    .from("company_settings")
    .insert({ singleton_key: true, company_name: "Bram Flooring" })
    .select(columns)
    .single();

  if (createError) throw new Error(createError.message);
  return created as CompanySettings;
}

export async function updateCompanySettings(
  id: string,
  values: CompanySettingsValues,
): Promise<CompanySettings> {
  const companyName = values.company_name.trim();
  if (!companyName) throw new Error("Company name is required.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .update({
      company_name: companyName,
      phone: clean(values.phone),
      email: clean(values.email),
      website: clean(values.website),
      address: clean(values.address),
      timezone: values.timezone.trim() || "America/Phoenix",
      locale: values.locale.trim() || "en-US",
      currency: values.currency.trim().toUpperCase() || "USD",
    })
    .eq("id", id)
    .select(columns)
    .single();

  if (error) throw new Error(error.message);
  return data as CompanySettings;
}

function clean(value: string | null) {
  return value?.trim() || null;
}
