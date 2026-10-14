'use client';

/** Last resort when the root layout itself fails. Plain HTML, no dependencies. */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#111114',
          color: '#f8f5ee',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '20vh 24px' }}>
          <h1
            style={{ fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 40, lineHeight: 1.1 }}
          >
            Something went wrong
          </h1>
          <p style={{ opacity: 0.75, lineHeight: 1.6 }}>
            The site could not load just now. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 24,
              height: 44,
              padding: '0 20px',
              borderRadius: 999,
              border: 0,
              background: '#cba45d',
              color: '#111114',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
