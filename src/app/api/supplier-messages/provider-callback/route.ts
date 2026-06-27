import { requireWebhookSecret } from "@/lib/api/guards";
import { writeApiLog } from "@/lib/api/api-log";
import { fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { buildSupplierProviderCallbackUpdate } from "@/lib/domain/supplier-messages.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    requireWebhookSecret(request, "SUPPLIER_MESSAGE_WEBHOOK_SECRET");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createServiceSupabaseClient();

    const idempotencyKey = optionalString(body.idempotencyKey);
    const providerMessageId = optionalString(body.providerMessageId);
    if (!idempotencyKey && !providerMessageId) {
      throw new HttpError(400, "idempotencyKey or providerMessageId is required");
    }

    const eventType = requireString(body.eventType, "eventType");
    const provider = optionalString(body.provider) ?? "provider";
    const errorMessage = optionalString(body.errorMessage);
    const occurredAt = optionalString(body.occurredAt);
    let update: Record<string, unknown>;
    try {
      update = buildSupplierProviderCallbackUpdate({
        eventType,
        providerMessageId,
        errorMessage,
        occurredAt
      }) as unknown as Record<string, unknown>;
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid provider event");
    }

    let query = supabase
      .from("supplier_message_outbox")
      .select("id, status, idempotency_key, provider_message_id")
      .limit(1);

    query = idempotencyKey ? query.eq("idempotency_key", idempotencyKey) : query.eq("provider_message_id", providerMessageId);
    const { data: matches, error: matchError } = await query;

    if (matchError) throw new HttpError(500, matchError.message);
    const message = matches?.[0];
    if (!message) throw new HttpError(404, "Supplier message outbox record not found");

    const { error: eventError } = await supabase.from("supplier_message_events").insert({
      supplier_message_outbox_id: message.id,
      event_type: eventType,
      provider,
      provider_payload: body
    });

    if (eventError) throw new HttpError(500, eventError.message);

    let updated = message;
    if (Object.keys(update).length > 0) {
      const { data, error } = await supabase
        .from("supplier_message_outbox")
        .update(update)
        .eq("id", message.id)
        .select("id, status, idempotency_key, provider_message_id, sent_at, error_message")
        .single();

      if (error) throw new HttpError(500, error.message);
      updated = data;
    }

    const responsePayload = { message: updated, eventType, provider };
    await writeApiLog(supabase, {
      source: "supplier_message_provider_callback",
      endpoint: "/api/supplier-messages/provider-callback",
      method: "POST",
      statusCode: 200,
      requestPayload: {
        eventType,
        provider,
        hasIdempotencyKey: Boolean(idempotencyKey),
        hasProviderMessageId: Boolean(providerMessageId)
      },
      responsePayload: {
        messageId: updated.id,
        status: updated.status,
        eventType,
        provider
      },
      idempotencyKey: idempotencyKey ?? providerMessageId
    });

    return ok(responsePayload);
  } catch (error) {
    return fail(error);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}
