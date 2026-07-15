import "server-only";

import { cache } from "react";
import { HttpError } from "./http";
import { getPageAuthorization } from "./page-session";
import { requireAgencyUser, requireInternalUser } from "./auth";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

/*
 * 서버 컴포넌트가 자기 /api 경로를 다시 HTTP 호출하지 않고 같은 프로세스에서
 * Supabase를 조회하도록 만드는 요청 단위 컨텍스트입니다. React cache()는 한 페이지
 * 렌더 안에서 인증/역할 조회가 여러 번 필요해도 한 번만 실행되도록 보장합니다.
 */
export const getInternalPageContext = cache(async () => {
  const { authorization } = await getPageAuthorization();
  if (!authorization) {
    throw new HttpError(401, "Authentication is required");
  }

  const request = new Request("http://jht.internal/page-data", {
    headers: { authorization }
  });
  const supabase = createRequestSupabaseClient(request);
  const user = await requireInternalUser(supabase);
  return { supabase, user };
});

export const getAgencyPageContext = cache(async () => {
  const { authorization } = await getPageAuthorization();
  if (!authorization) {
    throw new HttpError(401, "Authentication is required");
  }

  const request = new Request("http://jht.internal/agency-page-data", {
    headers: { authorization }
  });
  const supabase = createRequestSupabaseClient(request);
  const user = await requireAgencyUser(supabase);
  return { supabase, user };
});

export function requirePageFinanceRole(roles: string[]) {
  if (!roles.some((role) => role === "admin" || role === "finance")) {
    throw new HttpError(403, "Finance role is required");
  }
}

export function classifyPageDataError(error: unknown) {
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    return { status: "auth-required" as const, message: error.message };
  }
  console.error("[jht-page-data-error]", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error)
  });
  return {
    status: "error" as const,
    message: "Unable to load server data"
  };
}
