/**
 * @file 한글 책임: `Route Loading Shell` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
export function RouteLoadingShell({ label = "Loading workspace" }: { label?: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="route-loading-shell" role="status">
      <div className="route-loading-heading">
        <span className="route-loading-line route-loading-line-short" />
        <span className="route-loading-line route-loading-line-title" />
        <span className="route-loading-line route-loading-line-copy" />
      </div>
      <div className="route-loading-toolbar">
        <span />
        <span />
        <span />
      </div>
      <div className="route-loading-table">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </section>
  );
}
