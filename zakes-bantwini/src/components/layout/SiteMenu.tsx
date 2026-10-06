'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArtImage } from '@/components/media/ArtImage';
import { MENU_NAV } from '@/lib/site';
import styles from './SiteMenu.module.css';

type Props = { open: boolean; onClose: () => void; pathname: string };

/**
 * Full-screen menu on a native <dialog>: focus is trapped and Escape closes
 * it for free. On desktop each link previews its chapter's image.
 */
export function SiteMenu({ open, onClose, pathname }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    }
    if (!open && dialog.open) dialog.close();
    if (!open) document.documentElement.style.overflow = '';
  }, [open]);

  const current = MENU_NAV[preview] ?? MENU_NAV[0]!;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label="Site menu"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.top}>
        <span className="eyebrow">Zakes Bantwini — The Architect</span>
        <button type="button" className={styles.close} onClick={onClose} autoFocus>
          Close
        </button>
      </div>

      <div className={styles.body}>
        <nav aria-label="Site">
          <ol role="list" className={styles.list}>
            {MENU_NAV.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.item}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onMouseEnter={() => setPreview(i)}
                  onFocus={() => setPreview(i)}
                  onClick={onClose}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.label}>{item.label}</span>
                  {item.note && <span className={styles.note}>{item.note}</span>}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.preview} aria-hidden="true">
          {open && current.media && (
            <ArtImage key={current.media} id={current.media} fill decorative sizes="40vw" className={styles.previewImage} />
          )}
        </div>
      </div>

      <div className={styles.foot}>
        <Link href="/book" className={styles.cta} onClick={onClose}>
          Book Zakes
        </Link>
        <Link href="/community" className={styles.secondary} onClick={onClose}>
          Join the movement
        </Link>
      </div>
    </dialog>
  );
}
