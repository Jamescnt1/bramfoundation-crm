import Link from "next/link";
import { notFound } from "next/navigation";
import EditCustomerForm from "@/components/customers/EditCustomerForm";
import type { Customer } from "@/components/customers/types";
import { getCustomerById } from "@/lib/services/customers";
import { hasPermission } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  let customer: Customer | null = null;
  let canArchiveCustomer = false;
  let errorMessage = "";

  try {
    [customer, canArchiveCustomer] = await Promise.all([
      getCustomerById(id),
      hasPermission("delete_customers"),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load customer.";
  }

  if (errorMessage.includes("JSON object requested") || errorMessage.includes("0 rows") || errorMessage.includes("PGRST116")) {
    notFound();
  }

  if (errorMessage || !customer) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/customers" className="text-sm font-medium text-gray-600 transition hover:text-black">
            ← Back to customers
          </Link>
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage ? `Unable to load customer: ${errorMessage}` : "Unable to load customer."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href={`/customers/${customer.id}`} className="text-sm font-medium text-gray-600 transition hover:text-black">
          ← Back to customer
        </Link>
        <header className="mt-6">
          <p className="text-sm font-medium text-gray-500">{customer.full_name}</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Edit Customer</h1>
          <p className="mt-2 text-gray-600">Update this customer’s contact information and notes.</p>
        </header>
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <EditCustomerForm
            key={customer.id}
            customerId={customer.id}
            initialValues={{
              full_name: customer.full_name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              notes: customer.notes,
            }}
            canArchive={canArchiveCustomer}
          />
        </section>
      </div>
    </main>
  );
}
