import { PageHero } from '@/components/site/PageHero';
import styles from './content.module.css';

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[]; after?: string[] };

/** Shared layout for the legal pages: a plain hero, the draft notice, then numbered sections. */
export function LegalDoc({
  title,
  path,
  name,
  lede,
  updated,
  sections,
}: {
  title: string;
  path: string;
  name: string;
  lede: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageHero crumbs={[{ name, path }]} eyebrow="Legal" title={title} lede={lede} />
      <section className="section section--tight" aria-label={title}>
        <div className="container--narrow">
          <p className={styles.legalNotice} role="note">
            Draft for review by Soweto Towers’ legal adviser. Last updated {updated}.
          </p>
          <div className={`prose ${styles.legalBody}`}>
            {sections.map((s, i) => (
              <section key={s.heading} aria-labelledby={`legal-${i}`}>
                <h2 id={`legal-${i}`}>
                  {i + 1}. {s.heading}
                </h2>
                {s.paragraphs?.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
                {s.list ? (
                  <ul>
                    {s.list.map((li) => (
                      <li key={li.slice(0, 40)}>{li}</li>
                    ))}
                  </ul>
                ) : null}
                {s.after?.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
