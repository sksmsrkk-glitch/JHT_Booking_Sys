/**
 * 브라우저 fetch는 HTTP 오류와 달리 네트워크 단절 시 Promise 자체를 reject합니다.
 * 폼이 기존의 !response.ok 분기에서 메시지와 busy 상태를 정상 복구할 수 있도록
 * 네트워크 오류를 동일한 Response 형태로 변환합니다.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(
      JSON.stringify({ error: "Network connection failed. Please check your connection and retry." }),
      {
        status: 503,
        statusText: "Network request failed",
        headers: { "content-type": "application/json" }
      }
    );
  }
}
