import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.INITIAL_ADMIN_PASSWORD;
const email = "virgilw@bramflooring.com";

if (!url || !serviceRoleKey || !password) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and INITIAL_ADMIN_PASSWORD before running this command.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let existingEmployee = null;

for (const [column, value] of [
  ["name", "Virgil Whitehead"],
  ["email", email],
]) {
  const { data, error } = await admin
    .from("employees")
    .select("id, auth_user_id")
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    existingEmployee = data;
    break;
  }
}

let authUser = null;
for (let page = 1; page <= 20 && !authUser; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUser = data.users.find((user) => user.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}

if (authUser && existingEmployee) {
  const { data: linkedEmployee, error: linkedEmployeeError } = await admin
    .from("employees")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (linkedEmployeeError) throw linkedEmployeeError;

  if (linkedEmployee && linkedEmployee.id !== existingEmployee.id) {
    const { error } = await admin
      .from("employees")
      .update({
        auth_user_id: null,
        email: null,
        username: null,
        active: false,
      })
      .eq("id", linkedEmployee.id);

    if (error) throw error;
  }
}

if (existingEmployee) {
  const { error } = await admin
    .from("employees")
    .update({
      auth_user_id: authUser?.id ?? existingEmployee.auth_user_id,
      email,
      username: "virgilw",
      role: "administrator",
      active: true,
    })
    .eq("id", existingEmployee.id);

  if (error) throw error;
}

if (authUser) {
  const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...authUser.user_metadata,
      full_name: "Virgil Whitehead",
      must_change_password: true,
    },
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Virgil Whitehead",
      must_change_password: true,
    },
  });
  if (error) throw error;
  authUser = data.user;
}

const employeeValues = {
  auth_user_id: authUser.id,
  name: "Virgil Whitehead",
  email,
  username: "virgilw",
  role: "administrator",
  active: true,
};

const employeeResult = existingEmployee
  ? await admin
      .from("employees")
      .update(employeeValues)
      .eq("id", existingEmployee.id)
  : await admin.from("employees").insert(employeeValues);

const employeeError = employeeResult.error;

if (employeeError) throw employeeError;

console.log("Administrator account is ready. The initial password must be changed at first login.");
