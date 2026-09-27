import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import './index.css';

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
