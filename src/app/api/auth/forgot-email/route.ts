/**
 * @file 한글 책임: `/api/auth/forgot-email` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { createRecoveryFingerprint, requireRecoveryAccountType } from "@/lib/api/account-recovery";
import { fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { maskEmail, normalizeIdentityText, normalizePhone } from "@/lib/domain/account-recovery.mjs";

type AgencyAccountRow = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  lifecycle_status: string;
  agency_users: Array<{ id: string; email: string; name: string; status: string }> | null;
  agency_contacts: Array<{ name: string; phone: string | null; status: string }> | null;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const accountType = requireRecoveryAccountType(body.accountType);
    const companyName = requireString(body.companyName, "companyName");
    const contactName = requireString(body.contactName, "contactName");
    const phone = normalizePhone(requireString(body.phone, "phone"));
    if (phone.length < 7) throw new HttpError(400, "Enter a valid phone number");

    const requestFingerprint = await createRecoveryFingerprint(request, "email_lookup");
    const service = createServiceSupabaseClient();
    const matchedUser = accountType === "agency" ? await findAgencyUser(service, companyName, contactName, phone) : null;
    const result = matchedUser ? "masked_email_shown" : "pending";

    const { error } = await service.from("account_recovery_requests").insert({
      recovery_type: "email_lookup",
      account_type: accountType,
      company_name: companyName,
      contact_name: contactName,
      phone_last_four: phone.slice(-4),
      matched_agency_user_id: matchedUser?.id ?? null,
      result,
      status: matchedUser ? "resolved" : "pending",
      request_fingerprint: requestFingerprint,
      resolved_at: matchedUser ? new Date().toISOString() : null,
      resolution_note: matchedUser ? "Identity fields matched; masked email displayed." : null
    });
    if (error) throw new HttpError(500, "Email recovery request could not be recorded");

    if (matchedUser) {
      return ok({ status: "matched", maskedEmail: maskEmail(matchedUser.email) });
    }
    return ok({
      status: "pending",
      message: "We could not verify the account automatically. A JHT administrator will review your request."
    });
  } catch (error) {
    return fail(error);
  }
}

async function findAgencyUser(service: ReturnType<typeof createServiceSupabaseClient>, companyName: string, contactName: string, phone: string) {
  const { data, error } = await service
    .from("agency_accounts")
    .select("id, name, phone, status, lifecycle_status, agency_users(id, email, name, status), agency_contacts(name, phone, status)")
    .ilike("name", escapeLikePattern(companyName))
    .eq("status", "active")
    .eq("lifecycle_status", "active")
    .limit(5);
  if (error) throw new HttpError(500, "Unable to verify the partner account");

  const expectedCompany = normalizeIdentityText(companyName);
  const expectedContact = normalizeIdentityText(contactName);
  const account = (data as AgencyAccountRow[] | null)?.find((row) => normalizeIdentityText(row.name) === expectedCompany);
  if (!account) return null;

  const user = account.agency_users?.find(
    (candidate) => candidate.status === "active" && normalizeIdentityText(candidate.name) === expectedContact
  );
  if (!user) return null;

  const accountPhoneMatches = normalizePhone(account.phone) === phone;
  const contactPhoneMatches = account.agency_contacts?.some(
    (contact) =>
      contact.status === "active" &&
      normalizeIdentityText(contact.name) === expectedContact &&
      normalizePhone(contact.phone) === phone
  );
  return accountPhoneMatches || contactPhoneMatches ? user : null;
}

function escapeLikePattern(value: string) {
  return value.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
