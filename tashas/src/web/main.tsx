import { render } from 'preact';
import { App, applyEntryLinks } from './App.tsx';
import { boot, isArtifactViewer, startPump } from './app.ts';

async function start(): Promise<void> {
  const root = document.getElementById('app')!;
  try {
    await boot();
  } catch (err) {
    console.error(err);
    root.innerHTML =
      '<div style="padding:32px;font-family:system-ui"><h1>Something went wrong starting the prototype.</h1><p>Reload the page. If it happens again, clear this site’s storage and reload.</p></div>';
    return;
  }
  render(<App />, root);
  applyEntryLinks();
  startPump();

  // Installable PWA only when served over HTTPS as its own page with a manifest; never in local-file mode.
  if (
    location.protocol === 'https:' &&
    !isArtifactViewer() &&
    window.top === window.self &&
    document.querySelector('link[rel="manifest"]') &&
    'serviceWorker' in navigator
  ) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

void start();
