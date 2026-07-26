import type { Job } from "@/lib/services/jobs";
import { supabase } from "@/lib/supabase";

export type CustomerContact = {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  email: string | null;
  office_phone: string | null;
  mobile_phone: string | null;
  notes: string | null;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; full_name: string } | null;
  jobs?: Job[];
};

export type CustomerContactValues = {
  customer_id: string;
  first_name: string;
  last_name?: string | null;
  job_title?: string | null;
  email?: string | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  notes?: string | null;
  active?: boolean;
};

const columns = `
  id, customer_id, first_name, last_name, job_title, email,
  office_phone, mobile_phone, notes, active, archived_at,
  created_at, updated_at,
  customer:customers!customer_contacts_customer_id_fkey(id, full_name)
`;

function normalize(row: Record<string, unknown>): CustomerContact {
  const relation = row.customer;
  return {
    ...row,
    customer: Array.isArray(relation) ? relation[0] ?? null : relation ?? null,
  } as CustomerContact;
}

export function formatContactName(contact: Pick<CustomerContact, "first_name" | "last_name">) {
  return `${contact.first_name} ${contact.last_name}`.trim();
}

export async function getCustomerContacts(customerId?: string): Promise<CustomerContact[]> {
  let query = supabase
    .from("customer_contacts")
    .select(columns)
    .is("archived_at", null)
    .order("last_name")
    .order("first_name");
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalize(row));
}

export async function getContactJobs(contactId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, customer:customers!jobs_customer_id_fkey(id, full_name)")
    .or(`company_contact_id.eq.${contactId},job_site_contact_id.eq.${contactId}`)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const customer = row.customer;
    return {
      ...row,
      customer: Array.isArray(customer) ? customer[0] ?? null : customer ?? null,
    } as Job;
  });
}
