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
