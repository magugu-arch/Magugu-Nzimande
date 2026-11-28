'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { scanTicket, undoCheckInAction, type ScanResult } from '@/app/admin/actions';
import styles from './admin.module.css';

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;
type JsQr = (data: Uint8ClampedArray, width: number, height: number, opts?: object) => { data: string } | null;

const vibrate = (pattern: number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
};

/**
 * Gate scanner. Uses the browser's BarcodeDetector where it exists (Chrome on
 * Android) and falls back to jsQR on canvas frames (iPhone Safari). Manual
 * entry always works.
 */
export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const lastRef = useRef<{ value: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'denied' | 'unsupported'>('off');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState('');
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  const stop = useCallback(() => {
    if (loopRef.current) window.clearTimeout(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera((c) => (c === 'on' || c === 'starting' ? 'off' : c));
  }, []);

  useEffect(() => stop, [stop]);

  const submit = useCallback((value: string) => {
    const now = Date.now();
    if (lastRef.current && lastRef.current.value === value && now - lastRef.current.at < 5000) return;
    lastRef.current = { value, at: now };
    busyRef.current = true;
    startTransition(async () => {
      try {
        const r = await scanTicket(value);
        setResult(r);
        vibrate(r.tone === 'go' ? [60] : r.tone === 'warn' ? [60, 80, 60] : [220]);
      } catch {
        setResult({ tone: 'stop', title: 'No connection', detail: 'Couldn’t reach the server. Check the signal and try again.' });
      } finally {
        busyRef.current = false;
        requestAnimationFrame(() => resultRef.current?.focus());
      }
    });
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      return;
    }
    setCamera('starting');
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera('on');

      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      let detector: Detector | null = null;
      if (Ctor) {
        try {
          detector = new Ctor({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      let jsqr: JsQr | null = null;
      if (!detector) jsqr = (await import('jsqr')).default as unknown as JsQr;

      const tick = async () => {
        if (!streamRef.current) return;
        if (!busyRef.current && video.readyState >= 2) {
          try {
            let value: string | null = null;
            if (detector) {
              const codes = await detector.detect(video);
              value = codes[0]?.rawValue ?? null;
            } else if (jsqr) {
              const w = 480;
              const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
              canvasRef.current ??= document.createElement('canvas');
              const c = canvasRef.current;
              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                value = jsqr(img.data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
              }
            }
            if (value) submit(value);
          } catch {
            /* a bad frame: keep scanning */
          }
        }
        loopRef.current = window.setTimeout(tick, 220);
      };
      tick();
    } catch (err) {
      const name = (err as { name?: string }).name;
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported');
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [submit]);

  const tone = result ? (result.tone === 'go' ? styles.resultGo : result.tone === 'warn' ? styles.resultWarn : styles.resultStop) : '';

  return (
    <div className={styles.scanner}>
      <div className={styles.viewport}>
        <video ref={videoRef} playsInline muted aria-label="Camera preview" hidden={camera !== 'on'} />
        {camera === 'on' ? (
          <span className={styles.reticle} aria-hidden />
        ) : (
          <div style={{ display: 'grid', gap: 12, justifyItems: 'center', padding: 20, textAlign: 'center' }}>
            <p>
              {camera === 'denied'
                ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the reference below.'
                : camera === 'unsupported'
                  ? 'This browser can’t use the camera here. Type the reference below.'
                  : camera === 'starting'
                    ? 'Starting the camera…'
                    : 'Point the camera at the QR code on the visitor’s ticket.'}
            </p>
            {(camera === 'off' || camera === 'denied') && (
              <button type="button" className="btn btn--primary btn--lg" onClick={start}>
                Start scanning
              </button>
            )}
          </div>
        )}
      </div>
      {camera === 'on' && (
        <button type="button" className="btn btn--light" onClick={stop}>
          Stop camera
        </button>
      )}

      <div aria-live="assertive">
        {pending && <p className={styles.muted}>Checking…</p>}
        {result && !pending && (
          <div ref={resultRef} tabIndex={-1} className={`${styles.result} ${tone}`}>
            <span className={styles.resultTitle}>{result.title}</span>
            {result.name && (
              <span className={styles.resultLine}>
                {result.name} · {result.people} {result.people === 1 ? 'person' : 'people'}
              </span>
            )}
            {result.summary && <span>{result.summary}</span>}
            <span>{result.detail}</span>
            {result.ref && <span className={styles.mono}>{result.ref}</span>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                type="button"
                className="btn btn--light btn--sm"
                onClick={() => {
                  setResult(null);
                  lastRef.current = null;
                  if (camera !== 'on') start();
                }}
              >
                Scan next
              </button>
              {result.ref && result.tone !== 'stop' && (
                <>
                  <a className="btn btn--light btn--sm" href={`/admin/bookings/${result.ref}`}>
                    Open booking
                  </a>
                  {result.title === 'Different day' && (
                    <form action={undoCheckInAction}>
                      <input type="hidden" name="ref" value={result.ref} />
                      <button className="btn btn--dark btn--sm">Undo check-in</button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          const v = manual.trim();
          if (v) {
            lastRef.current = null;
            submit(v);
          }
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="manual-ref">
            Or type the booking reference
          </label>
          <input
            id="manual-ref"
            className="input"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="ST-7K4P2Q"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button className="btn btn--dark" disabled={pending}>
          Check in
        </button>
      </form>
    </div>
  );
}
