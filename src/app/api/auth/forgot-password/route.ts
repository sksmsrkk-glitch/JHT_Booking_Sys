import { createRecoveryFingerprint, requireRecoveryAccountType } from "@/lib/api/account-recovery";
import { fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const email = requireString(body.email, "email").toLowerCase();
    const accountType = requireRecoveryAccountType(body.accountType);
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, "Enter a valid email address");

    const requestFingerprint = await createRecoveryFingerprint(request, "password_reset");
    const service = createServiceSupabaseClient();
    const redirectPath = accountType === "agency" ? "/agency/reset-password" : "/auth/reset-password";
    const redirectUrl = new URL(redirectPath, request.url);

    // Supabase는 존재하지 않는 주소에도 동일한 공개 응답을 반환합니다. 화면에서도 계정 존재 여부를 구분하지 않습니다.
    const { error } = await service.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() });
    if (error && /rate|limit/i.test(error.message)) {
      throw new HttpError(429, "Too many recovery requests. Please try again later.");
    }
    if (error) throw new HttpError(502, "Password recovery email could not be sent");

    const { error: logError } = await service.from("account_recovery_requests").insert({
      recovery_type: "password_reset",
      account_type: accountType,
      submitted_email: email,
      result: "reset_email_requested",
      request_fingerprint: requestFingerprint
    });
    if (logError) throw new HttpError(500, "Password recovery request could not be recorded");

    return ok({
      message: "If a matching account exists, a password reset link has been sent. Check your inbox and spam folder."
    });
  } catch (error) {
    return fail(error);
  }
}
