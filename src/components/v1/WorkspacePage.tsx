/**
 * @file 한글 책임: `Workspace Page` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
import Link from "next/link";
import type { Route } from "next";

type WorkspacePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  backHref: Route;
  backLabel: string;
  primaryAction?: string;
  sections: Array<{
    title: string;
    items: string[];
  }>;
  boundaryNotes: string[];
};

export function WorkspacePage({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  primaryAction,
  sections,
  boundaryNotes
}: WorkspacePageProps) {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Link className="button-secondary" href={backHref}>
          {backLabel}
        </Link>
      </div>

      {primaryAction ? (
        <section className="action-band">
          <div>
            <h2>Next Build Step</h2>
            <p>{primaryAction}</p>
          </div>
          <span className="status-dot status-ready">Planned</span>
        </section>
      ) : null}

      <section className="grid">
        {sections.map((section) => (
          <article className="panel" key={section.title}>
            <h2>{section.title}</h2>
            <ul className="clean-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          {boundaryNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
