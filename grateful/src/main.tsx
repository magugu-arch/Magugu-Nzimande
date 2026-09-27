import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Self-hosted type: Baskervville (the web cut of Baskerville, per the CI) and Inter for small UI labels.
import '@fontsource-variable/baskervville/wght.css';
import '@fontsource-variable/baskervville/wght-italic.css';
import '@fontsource-variable/inter/wght.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
