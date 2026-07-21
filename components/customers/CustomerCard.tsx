import Link from "next/link";
import type { Customer } from "./types";

type CustomerCardProps = {
  customer: Customer;
};

export default function CustomerCard({
  customer,
}: CustomerCardProps) {
  return (
    <Link
      href={`/customers/${customer.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-gray-900">
            {customer.full_name}
          </h2>

          <div className="mt-3 space-y-1.5 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-700">
                Phone:
              </span>{" "}
              {customer.phone ?? "Not provided"}
            </p>

            <p className="truncate">
              <span className="font-medium text-gray-700">
                Email:
              </span>{" "}
              {customer.email ?? "Not provided"}
            </p>

            <p>
              <span className="font-medium text-gray-700">
                Address:
              </span>{" "}
              {customer.address ?? "Not provided"}
            </p>
          </div>
        </div>

        <span className="flex-shrink-0 text-xl text-gray-400">
          →
        </span>
      </div>

      {customer.notes && (
        <p className="mt-4 line-clamp-2 border-t border-gray-100 pt-4 text-sm text-gray-500">
          {customer.notes}
        </p>
      )}
    </Link>
  );
}