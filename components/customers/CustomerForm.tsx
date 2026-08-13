"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  updateCustomer,
  type CustomerValues,
} from "@/lib/services/customers";

type CreateCustomerFormProps = {
  mode: "create";
  customerId?: never;
  initialValues?: never;
};

type EditCustomerFormProps = {
  mode: "edit";
  customerId: string;
  initialValues: CustomerValues;
};

type CustomerFormProps =
  | CreateCustomerFormProps
  | EditCustomerFormProps;

const emptyValues: CustomerValues = {
  full_name: "",
  phone: null,
  email: null,
  address: null,
  notes: null,
};

export default function CustomerForm(
  props: CustomerFormProps,
) {
  const router = useRouter();

  const isEditing = props.mode === "edit";

  const currentValues = isEditing
    ? props.initialValues
    : emptyValues;

  const [fullName, setFullName] = useState(
    currentValues.full_name,
  );
  const [phone, setPhone] = useState(
    currentValues.phone ?? "",
  );
  const [email, setEmail] = useState(
    currentValues.email ?? "",
  );
  const [address, setAddress] = useState(
    currentValues.address ?? "",
  );
  const [notes, setNotes] = useState(
    currentValues.notes ?? "",
  );
  const [automatedCommunicationsEnabled, setAutomatedCommunicationsEnabled] = useState(currentValues.automated_communications_enabled ?? false);
  const [preferredCommunicationChannel, setPreferredCommunicationChannel] = useState<"none" | "email" | "sms" | "both">(currentValues.preferred_communication_channel ?? "none");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedFullName = fullName.trim();

    if (!trimmedFullName) {
      setErrorMessage("Customer name is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const values: CustomerValues = {
      full_name: trimmedFullName,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      automated_communications_enabled: automatedCommunicationsEnabled,
      preferred_communication_channel: preferredCommunicationChannel,
    };

    try {
      if (props.mode === "edit") {
        await updateCustomer(
          props.customerId,
          values,
        );

        router.push(
          `/customers/${props.customerId}`,
        );
      } else {
        await createCustomer(values);

        router.push("/customers");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );

      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (props.mode === "edit") {
      router.push(
        `/customers/${props.customerId}`,
      );
      return;
    }

    router.push("/customers");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {isEditing
            ? "Unable to update customer: "
            : "Unable to create customer: "}
          {errorMessage}
        </div>
      )}

      <div>
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-gray-700"
        >
          Full Name
          <span
            className="ml-1 text-red-600"
            aria-hidden="true"
          >
            *
          </span>
        </label>

        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          disabled={isSaving}
          value={fullName}
          onChange={(event) =>
            setFullName(event.target.value)
          }
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700"
          >
            Phone
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={isSaving}
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value)
            }
            placeholder="Example: 602-555-0100"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={isSaving}
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="customer@example.com"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700"
        >
          Customer Address
        </label>

        <input
          id="address"
          name="address"
          type="text"
          autoComplete="street-address"
          disabled={isSaving}
          value={address}
          onChange={(event) =>
            setAddress(event.target.value)
          }
          placeholder="Street address, city, state, ZIP"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100"
        />

        <p className="mt-2 text-sm text-gray-500">
          This is the customer’s contact address. Individual
          jobs can have a different project address.
        </p>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700"
        >
          Notes
        </label>

        <textarea
          id="notes"
          name="notes"
          rows={6}
          disabled={isSaving}
          value={notes}
          onChange={(event) =>
            setNotes(event.target.value)
          }
          placeholder="General customer notes..."
          className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Customer communications</legend>
        <p className="mt-1 text-xs leading-5 text-gray-600">Automatic notices are off by default. Individual jobs and appointments must also be enabled.</p>
        <label className="mt-4 flex items-start gap-3"><input type="checkbox" checked={automatedCommunicationsEnabled} onChange={(event) => setAutomatedCommunicationsEnabled(event.target.checked)} disabled={isSaving} className="mt-1"/><span><span className="block text-sm font-medium text-gray-900">Allow automatic customer communications</span><span className="block text-xs text-gray-500">Global controls and SMS consent still apply.</span></span></label>
        <label className="mt-4 grid gap-1.5 text-sm font-medium text-gray-700">Preferred communication method<select value={preferredCommunicationChannel} onChange={(event) => setPreferredCommunicationChannel(event.target.value as typeof preferredCommunicationChannel)} disabled={isSaving} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="none">No preference</option><option value="email">Email</option><option value="sms">Text message</option><option value="both">Text and email</option></select></label>
        <p className="mt-2 text-xs text-gray-500">Choosing text does not record SMS consent. The recipient must still opt in.</p>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-black px-5 py-2.5 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving
            ? isEditing
              ? "Saving Changes..."
              : "Creating Customer..."
            : isEditing
              ? "Save Changes"
              : "Create Customer"}
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleCancel}
          className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
