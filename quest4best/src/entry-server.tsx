import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

// Used only at build time (scripts/prerender.mjs) to write the page's HTML
// into index.html, so the headline paints before any JavaScript runs.
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
