import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@hao/design-system/tokens.css';
import '@hao/design-system/base.css';
import { applyPrefs, loadPrefs } from '@hao/accessibility';
import { createRoot } from 'react-dom/client';
import { Providers } from '@/lib/providers';
import { safeStorage } from '@/lib/storage';
import { Router } from './router';

// Lets the styles hide what a host cannot do (an Artifact cannot open the print dialog).
document.documentElement.dataset.host = process.env.HAO_ROUTER === 'memory' ? 'artifact' : 'file';

// Saved text-size and contrast choices apply before the first screen is drawn.
applyPrefs(document.documentElement, loadPrefs(safeStorage('local')));

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <Providers>
      <Router />
    </Providers>,
  );
}
