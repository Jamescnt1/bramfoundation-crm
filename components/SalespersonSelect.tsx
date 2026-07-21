"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  name: string;
};

type SalespersonSelectProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export default function SalespersonSelect({
  value,
  onChange,
  required = false,
}: SalespersonSelectProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadEmployees() {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setEmployees(data ?? []);
      setIsLoading(false);
    }

    loadEmployees();
  }, []);

  return (
    <div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={isLoading}
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100"
      >
        <option value="">
          {isLoading ? "Loading employees..." : "Unassigned"}
        </option>

        {employees.map((employee) => (
          <option key={employee.id} value={employee.name}>
            {employee.name}
          </option>
        ))}
      </select>

      {errorMessage && (
        <p className="mt-2 text-sm text-red-600">
          Unable to load employees: {errorMessage}
        </p>
      )}
    </div>
  );
}