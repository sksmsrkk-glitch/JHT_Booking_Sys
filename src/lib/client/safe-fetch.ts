/**
 * @file 한글 책임: `safe fetch` 브라우저에서 공통으로 사용하는 요청·탐색 보조 동작을 제공합니다.
 * 네트워크 실패와 세션 만료를 예측 가능한 결과로 정규화해 각 폼이 로딩 상태를 반드시 해제할 수 있도록 합니다.
 */
/**
 * 브라우저 fetch는 HTTP 오류와 달리 네트워크 단절 시 Promise 자체를 reject합니다.
 * 폼이 기존의 !response.ok 분기에서 메시지와 busy 상태를 정상 복구할 수 있도록
 * 네트워크 오류를 동일한 Response 형태로 변환합니다.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init);
    if (response.status === 204) return response;

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const isJson = contentType.includes("application/json") || contentType.includes("+json");
    if (isJson) {
      // Content-Type만 JSON이고 본문이 잘못된 프록시 응답도 폼의 response.json()을
      // 예외로 중단시키지 않도록 복제본으로 유효성을 먼저 확인합니다.
      try {
        await response.clone().json();
        return response;
      } catch {
        return invalidApiResponse(response);
      }
    }

    // 이 helper를 사용하는 경로는 JSON API입니다. 프록시의 HTML 502 또는
    // 만료된 세션이 로그인 HTML로 리다이렉트된 경우를 일관된 JSON 오류로 바꿉니다.
    return invalidApiResponse(response);
  } catch {
    return jsonErrorResponse(
      503,
      "Network connection failed. Please check your connection and retry.",
      "Network request failed"
    );
  }
}

function invalidApiResponse(response: Response) {
  const status = response.redirected ? 401 : response.ok ? 502 : response.status;
  const message = response.redirected
    ? "Your session has expired. Please log in again."
    : status >= 500
      ? "The server is temporarily unavailable. Please retry."
      : "The server returned an invalid response. Please retry.";
  return jsonErrorResponse(status, message, response.statusText || "Invalid API response", response.headers);
}

function jsonErrorResponse(status: number, error: string, statusText: string, sourceHeaders?: Headers) {
  const headers = new Headers(sourceHeaders);
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ error }), { status, statusText, headers });
}
