import { requireWebhookSecret } from "@/lib/api/guards";
import { writeApiLog } from "@/lib/api/api-log";
import { fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { scoreGmailMatch } from "@/lib/domain/gmail-match.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    requireWebhookSecret(request, "GMAIL_WEBHOOK_SECRET");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createServiceSupabaseClient();
    const gmailThreadId = requireString(body.gmailThreadId, "gmailThreadId");
    const gmailMessageId = requireString(body.gmailMessageId, "gmailMessageId");
    const subject = String(body.subject ?? "");
    const bodyText = String(body.bodyText ?? "");
    const fromEmail = String(body.fromEmail ?? "");

    const { data: existingMessage, error: existingError } = await supabase
      .from("email_messages")
      .select("id, gmail_message_id")
      .eq("gmail_message_id", gmailMessageId)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existingMessage) {
      await writeApiLog(supabase, {
        source: "gmail_webhook",
        endpoint: "/api/gmail/webhook",
        method: "POST",
        statusCode: 200,
        requestPayload: { gmailThreadId, gmailMessageId, duplicate: true },
        responsePayload: { duplicate: true },
        idempotencyKey: gmailMessageId
      });
      return ok({ duplicate: true, gmailMessageId });
    }

    const { data: candidates, error: candidateError } = await supabase
      .from("quote_cases")
      .select("id, case_code, tour_name, gmail_thread_id, agency_account_id, agency_accounts(email_domain)")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (candidateError) throw new HttpError(500, candidateError.message);

    const scored = (candidates ?? [])
      .map((candidate: any) => {
        const agency = Array.isArray(candidate.agency_accounts)
          ? candidate.agency_accounts[0]
          : candidate.agency_accounts;
        const match = scoreGmailMatch({
          message: {
            threadId: gmailThreadId,
            subject,
            body: bodyText,
            from: fromEmail
          },
          quoteCase: {
            caseCode: candidate.case_code,
            gmailThreadId: candidate.gmail_thread_id,
            tourName: candidate.tour_name
          },
          agency: {
            emailDomain: agency?.email_domain
          }
        });
        return { candidate, match };
      })
      .sort((a: any, b: any) => b.match.score - a.match.score);

    const best = scored[0];
    const shouldLink = best && !best.match.requiresManualReview;

    const { data: emailThread, error: threadError } = await supabase
      .from("email_threads")
      .upsert(
        {
          gmail_thread_id: gmailThreadId,
          quote_case_id: shouldLink ? best.candidate.id : null,
          agency_account_id: shouldLink ? best.candidate.agency_account_id : null,
          match_confidence: best?.match.score ?? 0,
          requires_manual_review: !shouldLink
        },
        { onConflict: "gmail_thread_id" }
      )
      .select("id, gmail_thread_id, quote_case_id, agency_account_id, match_confidence, requires_manual_review")
      .single();

    if (threadError) throw new HttpError(500, threadError.message);

    const candidateRows = scored.slice(0, 10).map(({ candidate, match }: any) => ({
      email_thread_id: emailThread.id,
      quote_case_id: candidate.id,
      agency_account_id: candidate.agency_account_id,
      score: match.score,
      reasons: match.reasons,
      requires_manual_review: match.requiresManualReview
    }));

    if (candidateRows.length > 0) {
      const { error: candidateInsertError } = await supabase.from("gmail_match_candidates").upsert(candidateRows, {
        onConflict: "email_thread_id,quote_case_id"
      });
      if (candidateInsertError) throw new HttpError(500, candidateInsertError.message);
    }

    const { data: message, error: messageError } = await supabase
      .from("email_messages")
      .insert({
        email_thread_id: emailThread.id,
        gmail_message_id: gmailMessageId,
        from_email: fromEmail || null,
        to_emails: Array.isArray(body.toEmails) ? body.toEmails : [],
        cc_emails: Array.isArray(body.ccEmails) ? body.ccEmails : [],
        subject,
        body_text: bodyText,
        received_at: body.receivedAt ?? null,
        provider_payload: body.providerPayload ?? body
      })
      .select("id, gmail_message_id, email_thread_id, created_at")
      .single();

    if (messageError) throw new HttpError(500, messageError.message);

    const responsePayload = {
      emailThread,
      message,
      match: {
        score: best?.match.score ?? 0,
        requiresManualReview: !shouldLink,
        reasons: best?.match.reasons ?? [],
        candidateCount: candidateRows.length
      }
    };

    await writeApiLog(supabase, {
      source: "gmail_webhook",
      endpoint: "/api/gmail/webhook",
      method: "POST",
      statusCode: 200,
      requestPayload: {
        gmailThreadId,
        gmailMessageId,
        subjectPresent: subject.length > 0,
        fromDomain: fromEmail.includes("@") ? fromEmail.split("@").pop() : null
      },
      responsePayload: {
        emailThreadId: emailThread.id,
        emailMessageId: message.id,
        match: responsePayload.match
      },
      idempotencyKey: gmailMessageId
    });

    return ok(responsePayload);
  } catch (error) {
    return fail(error);
  }
}
