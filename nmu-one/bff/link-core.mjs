/**
 * After `tsc -p bff`: the console modules the BFF shares (admin/src/lib)
 * import the core as `@core/...`. tsc leaves that specifier as it is, so this
 * links bff/dist/node_modules/@core to the compiled core, where Node's
 * module resolution finds it — one copy, so the clock and contexts are shared.
 */
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const link = join(dist, 'node_modules', '@core');
mkdirSync(dirname(link), { recursive: true });
rmSync(link, { recursive: true, force: true });
symlinkSync(join('..', 'src', 'core'), link, process.platform === 'win32' ? 'junction' : 'dir');
