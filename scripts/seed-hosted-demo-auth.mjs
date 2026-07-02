import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readLocalEnv();
const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const secretKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const serviceClient = createClient(supabaseUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const publicClient = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// 호스팅 Supabase에서는 auth.users를 SQL로 직접 seed하면 Auth 내부 identity와 맞지 않을 수 있습니다.
// 이 스크립트는 Admin API로 실제 로그인 가능한 사용자를 만든 뒤 public 업무 테이블에 역할을 연결합니다.
const demoUsers = {
  admin: {
    email: "jht-admin@junghotravel.local",
    password: "JhtDemo!2026",
    displayName: "JHT Demo Admin"
  },
  agency: {
    email: "agency-demo@worldtravellers.example",
    password: "AgencyDemo!2026",
    displayName: "WorldTravellers Demo User"
  }
};

const companyId = "00000000-0000-4000-8000-000000001001";
const agencyAccountId = "00000000-0000-4000-8000-000000003001";
const agencyUserId = "00000000-0000-4000-8000-000000003102";

const adminUser = await ensureAuthUser(demoUsers.admin);
const agencyUser = await ensureAuthUser(demoUsers.agency);

await upsertCompanies();
await upsertInternalAdmin(adminUser);
await upsertAgencyUser(agencyUser);

console.log("Hosted demo auth seed completed.");
console.log(`Internal admin: ${demoUsers.admin.email} / ${demoUsers.admin.password}`);
console.log(`Agency demo: ${demoUsers.agency.email} / ${demoUsers.agency.password}`);

function readLocalEnv() {
  const parsed = {};
  const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    parsed[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }
  return parsed;
}

function requireEnv(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function ensureAuthUser(input) {
  const created = await serviceClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.displayName
    }
  });

  if (!created.error && created.data.user) {
    return created.data.user;
  }

  const message = created.error?.message ?? "";
  if (!/already|registered|exists/i.test(message)) {
    throw new Error(`Could not create ${input.email}: ${message}`);
  }

  const signedIn = await publicClient.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (signedIn.error || !signedIn.data.user) {
    throw new Error(`Could not resolve existing ${input.email}: ${signedIn.error?.message ?? "No user returned"}`);
  }

  return signedIn.data.user;
}

async function upsertCompanies() {
  await assertNoError(
    serviceClient.from("companies").upsert(
      [
        {
          id: companyId,
          code: "JHT",
          name_ko: "Jungho Travel",
          name_en: "Jungho Travel Service",
          status: "active"
        }
      ],
      { onConflict: "id" }
    ),
    "upsert company"
  );

  await assertNoError(
    serviceClient.from("agency_accounts").upsert(
      [
        {
          id: agencyAccountId,
          company_id: companyId,
          name: "World Travellers DMC",
          country_code: "MY",
          email_domain: "worldtravellers.example",
          phone: "+60-3-0000-1000",
          website: "https://worldtravellers.example",
          billing_currency: "USD",
          status: "active"
        }
      ],
      { onConflict: "id" }
    ),
    "upsert agency account"
  );
}

async function upsertInternalAdmin(user) {
  await assertNoError(
    serviceClient.from("profiles").upsert(
      [
        {
          id: user.id,
          email: user.email,
          display_name: demoUsers.admin.displayName,
          default_company_id: companyId,
          status: "active"
        }
      ],
      { onConflict: "id" }
    ),
    "upsert admin profile"
  );

  await assertNoError(
    serviceClient.from("user_roles").upsert(
      ["admin", "sales", "operations", "finance"].map((role) => ({
        user_id: user.id,
        role,
        team: role === "admin" ? null : role
      })),
      { onConflict: "user_id,role" }
    ),
    "upsert admin roles"
  );
}

async function upsertAgencyUser(user) {
  await assertNoError(
    serviceClient.from("agency_users").upsert(
      [
        {
          id: agencyUserId,
          agency_account_id: agencyAccountId,
          auth_user_id: user.id,
          email: user.email,
          name: demoUsers.agency.displayName,
          title: "Demo Partner User",
          is_account_admin: true,
          status: "active"
        }
      ],
      { onConflict: "id" }
    ),
    "upsert agency user"
  );
}

async function assertNoError(operation, label) {
  const { error } = await operation;
  if (error) {
    throw new Error(`${label} failed: ${error.message}`);
  }
}
