/**
 * @file 한글 책임: `api` 브라우저에서 공통으로 사용하는 요청·탐색 보조 동작을 제공합니다.
 * 네트워크 실패와 세션 만료를 예측 가능한 결과로 정규화해 각 폼이 로딩 상태를 반드시 해제할 수 있도록 합니다.
 */
/**
 * 클라이언트 mutation용 공용 fetch 래퍼입니다.
 *
 * 기존 컴포넌트들은 `await fetch(...); await response.json()`을 try/catch 없이 호출해,
 * 네트워크 오류나 비-JSON(HTML 502) 응답에서 unhandled rejection이 발생하고
 * 버튼이 영구 비활성(isBusy=true) 상태로 멈췄습니다. 이 헬퍼는 절대 throw하지 않고
 * 항상 { ok, status, data, error } 형태를 돌려주어 호출부가 안전하게 분기하도록 합니다.
 */
export type SubmitJsonResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

export async function submitJson<T = any>(
  url: string,
  body: unknown,
  init: { method?: string; headers?: Record<string, string> } = {}
): Promise<SubmitJsonResult<T>> {
  try {
    const response = await fetch(url, {
      method: init.method ?? "POST",
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : null) ?? `Request failed (${response.status})`;
      return { ok: false, status: response.status, data: null, error };
    }

    return { ok: true, status: response.status, data: (payload ?? null) as T | null, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error. Please check your connection and retry." };
  }
}
