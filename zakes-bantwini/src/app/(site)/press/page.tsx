import { TrackedDownload } from '@/components/forms/PublicForms';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import { ALBUM_KIND_LABEL } from '@/components/ui/Sleeve';
import { getAlbums, getPressKit, getSettings } from '@/content';
import { getMedia, getMediaFile, mediaMasterUrl } from '@/content/media';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Press / EPK',
  description: 'Zakes Bantwini electronic press kit: biographies, press photographs, discography, performance information and technical rider.',
  path: '/press',
  image: 'IMG_6882',
});

export default async function PressPage() {
  const [kit, albums, settings] = await Promise.all([getPressKit(), getAlbums(), getSettings()]);

  return (
    <>
      <PageHero
        eyebrow="Press / EPK"
        title={['Press', 'kit']}
        intro="Biographies, approved photographs, discography and performance information — ready to download."
        media="IMG_6884"
        overlay="left"
        actions={
          settings.pressEmail && (
            <ButtonLink href={`mailto:${settings.pressEmail}`} variant="outline" small>
              Press enquiries
            </ButtonLink>
          )
        }
      />

      {!kit ? (
        <div className="container section">
          <EmptyState title="The press kit is being updated.">
            <p>Approved biographies and photographs will be available here shortly.</p>
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="section" aria-labelledby="bio-title">
            <div className={`container ${styles.split}`}>
              <ArtImage id="IMG_6882" sizes="(max-width: 960px) 100vw, 42vw" />
              <div className={styles.copy}>
                <p className="eyebrow eyebrow-accent">01 &nbsp;Biography</p>
                <h2 id="bio-title" className="statement">
                  Short biography
                </h2>
                <p className="lede">{kit.shortBio}</p>
                <ul role="list" className={styles.downloads} style={{ width: '100%' }}>
                  <li>
                    <TrackedDownload href="/press/downloads/short-bio.txt" item="short-bio">
                      Short bio <span className="muted">TXT</span>
                    </TrackedDownload>
                  </li>
                  <li>
                    <TrackedDownload href="/press/downloads/long-bio.txt" item="long-bio">
                      Long bio <span className="muted">TXT</span>
                    </TrackedDownload>
                  </li>
                </ul>
                <ApprovalFlag approval={kit.approval} label="Press copy pending management approval" />
              </div>
            </div>
          </section>

          <section className={`section ${styles.band}`} aria-labelledby="photos-title">
            <div className="container">
              <SectionHead index="02" eyebrow="Press photographs" id="photos-title" title="Photographs" intro="Original-resolution files. Credit as supplied by management." />
              <ul role="list" className={styles.grid3}>
                {kit.photos.map((id) => {
                  const file = getMediaFile(id);
                  return (
                    <li key={id} className={styles.card}>
                      <ArtImage id={id} sizes="(max-width: 600px) 100vw, 33vw" ratio={{ desktop: '4/5', mobile: '4/5' }} />
                      <TrackedDownload href={mediaMasterUrl(id)} item={id} className={styles.chip}>
                        Download {getMedia(id).title} · {file.width}×{file.height}
                      </TrackedDownload>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="section" aria-labelledby="facts-title">
            <div className="container">
              <SectionHead index="03" eyebrow="Facts" id="facts-title" title="At a glance" />
              <div className={styles.grid2}>
                <div className={styles.copy}>
                  <h3 className="eyebrow">Awards</h3>
                  {kit.awards.length ? (
                    <ul role="list" className={styles.downloads} style={{ width: '100%' }}>
                      {kit.awards.map((a) => (
                        <li key={`${a.year}-${a.title}`}>
                          <span>
                            {a.year} · {a.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">The approved awards list is published here from management’s records.</p>
                  )}
                  <h3 className="eyebrow">Selected quotes</h3>
                  {kit.quotes.length ? (
                    kit.quotes.map((q) => (
                      <blockquote key={q.quote} className="statement" style={{ fontSize: 'var(--step-2)' }}>
                        “{q.quote}” <cite className="muted">— {q.source}</cite>
                      </blockquote>
                    ))
                  ) : (
                    <p className="muted">Press quotes appear here once sourced and approved.</p>
                  )}
                </div>
                <div className={styles.copy}>
                  <h3 className="eyebrow">Discography</h3>
                  <ul role="list" className={styles.downloads} style={{ width: '100%' }}>
                    {albums.map((a) => (
                      <li key={a.slug}>
                        <span>
                          {a.title} <span className="muted">{ALBUM_KIND_LABEL[a.kind]} · {a.year ?? 'year to follow'}</span>
                        </span>
                      </li>
                    ))}
                    <li>
                      <TrackedDownload href="/press/downloads/discography.txt" item="discography">
                        Discography <span className="muted">TXT</span>
                      </TrackedDownload>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className={`section ${styles.band}`} aria-labelledby="perf-title">
            <div className="container">
              <SectionHead index="04" eyebrow="Performance" id="perf-title" title="Performance information" intro={kit.performance.notes} />
              <dl className={styles.facts}>
                {kit.performance.formats.map((f) => (
                  <div key={f.name}>
                    <dt>{f.name}</dt>
                    <dd>{f.detail}</dd>
                  </div>
                ))}
              </dl>
              <ul role="list" className={styles.downloads} style={{ marginTop: 32 }}>
                <li>
                  <TrackedDownload href="/press/downloads/performance.txt" item="performance">
                    Performance information <span className="muted">TXT</span>
                  </TrackedDownload>
                </li>
                <li>
                  {kit.riderUrl ? (
                    <TrackedDownload href={kit.riderUrl} item="rider">
                      Technical rider <span className="muted">PDF</span>
                    </TrackedDownload>
                  ) : (
                    <span>
                      Technical rider <span className="muted">Shared with confirmed bookings, or on request from the booking team</span>
                    </span>
                  )}
                </li>
              </ul>
              <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <ButtonLink href="/book" cursor="Book">
                  Book Zakes
                </ButtonLink>
                <ButtonLink href="/collaborate" variant="outline">
                  Collaborate
                </ButtonLink>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
