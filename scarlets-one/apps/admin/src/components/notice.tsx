'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Notice {
  id: number;
  ok: boolean;
  message: string;
}

type Announce = (notice: { ok: boolean; message: string }) => void;

const NoticeContext = createContext<Announce>(() => {});

export function useAnnounce(): Announce {
  return useContext(NoticeContext);
}

/**
 * The result of the last action, in one place at the top of the page.
 *
 * Both live regions stay mounted and only their text changes, which is what
 * makes a screen reader announce them: a success politely, a refusal or
 * error at once.
 */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const announce = useCallback<Announce>((next) => {
    setNotice((previous) => ({ ...next, id: (previous?.id ?? 0) + 1 }));
  }, []);

  const card = notice ? (
    <div
      key={notice.id}
      className={`notice ${notice.ok ? 'notice--ok' : 'notice--problem'}`}
      data-notice={notice.ok ? 'ok' : 'problem'}
    >
      <p className="notice__text">
        <strong>{notice.ok ? 'Done.' : 'Not done.'}</strong> {notice.message}
      </p>
      <button
        type="button"
        className="btn btn--quiet notice__dismiss"
        onClick={() => setNotice(null)}
      >
        Dismiss
      </button>
    </div>
  ) : null;

  return (
    <NoticeContext.Provider value={announce}>
      <div className="notice-dock">
        <div role="status" aria-live="polite">
          {notice?.ok ? card : null}
        </div>
        <div role="alert" aria-live="assertive">
          {notice && !notice.ok ? card : null}
        </div>
      </div>
      {children}
    </NoticeContext.Provider>
  );
}
