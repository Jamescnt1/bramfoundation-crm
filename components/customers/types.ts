export type Customer = {
  id: string;

  full_name: string;

  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;

  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
};
