'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Chat, Close, WhatsAppGlyph } from '@/components/ui/icons';
import { quickTopics } from '@/lib/chat-answers';
import { whatsappLink } from '@/content/site';
import styles from './ChatWidget.module.css';

type Msg = { id: number; sender: 'visitor' | 'staff' | 'bot'; staffName: string | null; body: string };

/** Crew and bot replies mention pages ("/book") and links; make them tappable. */
const LINKS = /(https?:\/\/[^\s)]+|(?<![\w/])\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*)/gi;
function linkify(text: string, close: () => void): ReactNode {
  const parts = text.split(LINKS);
  return parts.map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const url = part.replace(/[.,!?]+$/, '');
    const tail = part.slice(url.length);
    return (
      <Fragment key={i}>
        {url.startsWith('/') ? (
          <Link href={url as Route} onClick={close}>
            {url === '/book' ? 'Book your jump' : url}
          </Link>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url.replace(/^https?:\/\//, '')}
          </a>
        )}
        {tail}
      </Fragment>
    );
  });
}

const GREETING: Msg = {
  id: 0,
  sender: 'bot',
  staffName: null,
  body: 'Sawubona! Ask us anything about jumps, prices, safety or groups. We answer here, or carry on with us on WhatsApp.',
};

export function ChatWidget() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hidden = pathname.startsWith('/admin') || pathname.startsWith('/checkout') || pathname.startsWith('/ticket');

  const poll = useCallback(async (peek: boolean) => {
    try {
      const res = await fetch(`/api/chat?after=${lastId.current}${peek ? '&peek=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Msg[]; unread: number };
      if (data.messages.length) {
        lastId.current = data.messages.at(-1)!.id;
        setMsgs((m) => [...m, ...data.messages]);
      }
      setUnread(peek ? data.unread : 0);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    if (hidden) return;
    poll(true);
    const t = window.setInterval(() => document.visibilityState === 'visible' && poll(!open), open ? 4000 : 30000);
    return () => window.clearInterval(t);
  }, [open, hidden, poll]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [msgs, open, reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(body: string, topic?: string) {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    setMsgs((m) => [...m, { id: -Date.now(), sender: 'visitor', staffName: null, body }]);
    setText('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, topic, contact: contact || undefined, page: pathname }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Couldn’t send');
      // Replace the optimistic message with the server copy.
      setMsgs((m) => m.filter((x) => x.id > 0 || x.id === 0));
      await poll(false);
    } catch (e) {
      setError((e as Error).message || 'Couldn’t send. Check your connection.');
    } finally {
      setSending(false);
    }
  }

  if (hidden) return null;

  const spring = reduce ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.38 };
  const conversationStarted = msgs.some((m) => m.sender === 'visitor');
  const transcript = [GREETING, ...msgs];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.launcher} ${open ? styles.launcherOpen : ''}`}
        aria-label={open ? 'Close chat' : unread > 0 ? `Ask the crew, ${unread} new ${unread === 1 ? 'reply' : 'replies'}` : 'Ask the crew'}
        aria-expanded={open}
        aria-controls="crew-chat"
        onClick={() => {
          if (!open) setUnread(0);
          setOpen(!open);
        }}
      >
        {open ? <Close /> : <Chat />}
        <span className={styles.launcherLabel}>{open ? 'Close' : 'Ask the crew'}</span>
        {unread > 0 && !open && <span className={styles.badge}>{unread}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            id="crew-chat"
            role="dialog"
            aria-label="Ask the crew"
            className={styles.panel}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={spring}
          >
            <header className={styles.head}>
              <div>
                <p className={styles.title}>Ask the crew</p>
                <p className={styles.sub}>Real people on site, Thursday to Sunday</p>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)}>
                <Close width={20} height={20} />
                <span className="visually-hidden">Close chat</span>
              </button>
            </header>

            <div ref={listRef} className={styles.list} aria-live="polite">
              {transcript.map((m) => (
                <div key={m.id} className={`${styles.msg} ${m.sender === 'visitor' ? styles.mine : styles.theirs}`}>
                  {m.sender !== 'visitor' && <span className={styles.from}>{m.sender === 'staff' ? m.staffName || 'Crew' : 'Soweto Towers'}</span>}
                  {m.body.split('\n\n').map((p, i) => (
                    <p key={i}>{m.sender === 'visitor' ? p : linkify(p, () => setOpen(false))}</p>
                  ))}
                </div>
              ))}
              {!conversationStarted && (
                <div className={styles.topics}>
                  {quickTopics.map((t) => (
                    <button key={t.id} type="button" className="pill pill--outline" onClick={() => send(t.label, t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              className={styles.compose}
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              {conversationStarted && (
                <input
                  className={styles.contact}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Your WhatsApp number (optional)"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-label="Your WhatsApp number, so we can reply if you leave"
                />
              )}
              <div className={styles.row}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  value={text}
                  rows={1}
                  maxLength={1000}
                  placeholder="Type your question"
                  aria-label="Your message"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(text);
                    }
                  }}
                />
                <button className="btn btn--primary btn--sm" disabled={!text.trim() || sending}>
                  Send
                </button>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <a className={styles.wa} href={whatsappLink(text || 'Hi Soweto Towers! ')} target="_blank" rel="noopener">
                <WhatsAppGlyph size={16} /> Continue on WhatsApp
              </a>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
