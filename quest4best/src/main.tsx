import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import './index.css';

// Clickjacking guard for the hosted site: GitHub Pages cannot send
// frame-ancestors or X-Frame-Options, so refuse to run inside another site's
// frame. Skipped for the single file, which mail and file apps preview in
// frames of their own.
if (!__SINGLE_FILE__ && window.top !== window.self) {
  // Hide first: browsers often block the break-out silently.
  document.documentElement.style.visibility = 'hidden';
  try {
    window.top!.location.href = window.location.href;
  } catch {
    // Stay hidden inside the foreign frame.
  }
}

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Both builds ship pre-rendered HTML to hydrate; render from scratch only if
// the markup is missing (e.g. the dev server).
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
