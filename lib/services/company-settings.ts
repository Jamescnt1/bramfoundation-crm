import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdministrator } from "@/lib/services/employees";

const logoBucket = "company-logos";
const logoExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

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
  await requireAdministrator();
  const companyName = values.company_name.trim();
  if (!companyName) throw new Error("Company name is required.");

  const admin = createAdminClient();
  const { data, error } = await admin
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

export async function uploadCompanyLogo(id: string, file: File) {
  await requireAdministrator();
  const extension = logoExtensions[file.type];
  if (!extension) throw new Error(`The selected file type (${file.type || "unknown"}) is not supported. Choose a JPG, PNG, WebP, or SVG image.`);
  if (file.size <= 0) throw new Error("The selected logo file is empty (0 bytes). Export or download the image, then choose it again.");
  if (file.size > 5 * 1024 * 1024) throw new Error(`The selected logo is ${formatFileSize(file.size)}. The maximum size is 5 MB.`);

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("company_settings")
    .select("logo_url")
    .eq("id", id)
    .single();
  if (existingError) throw new Error(existingError.message);

  const storagePath = `${id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(logoBucket)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = admin.storage.from(logoBucket).getPublicUrl(storagePath);
  const { data, error } = await admin
    .from("company_settings")
    .update({ logo_url: publicUrl.publicUrl })
    .eq("id", id)
    .select(columns)
    .single();

  if (error) {
    await admin.storage.from(logoBucket).remove([storagePath]);
    throw new Error(error.message);
  }

  const previousPath = getManagedLogoPath(existing.logo_url);
  if (previousPath) await admin.storage.from(logoBucket).remove([previousPath]);
  return data as CompanySettings;
}

export async function removeCompanyLogo(id: string) {
  await requireAdministrator();
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("company_settings")
    .select("logo_url")
    .eq("id", id)
    .single();
  if (existingError) throw new Error(existingError.message);

  const { data, error } = await admin
    .from("company_settings")
    .update({ logo_url: null })
    .eq("id", id)
    .select(columns)
    .single();
  if (error) throw new Error(error.message);

  const path = getManagedLogoPath(existing.logo_url);
  if (path) await admin.storage.from(logoBucket).remove([path]);
  return data as CompanySettings;
}

function getManagedLogoPath(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${logoBucket}/`;
  const markerIndex = url.indexOf(marker);
  return markerIndex === -1 ? null : decodeURIComponent(url.slice(markerIndex + marker.length));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
