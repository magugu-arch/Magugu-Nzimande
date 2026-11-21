// Copies the supplied concept images into public/media so pages can use
// /media/<file>. The folder is gitignored: the source of truth stays in
// assets/reference at the monorepo root. Nothing is fetched from a network.
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..', '..', '..', 'assets', 'reference');
const target = path.resolve(here, '..', 'public', 'media');
const IMAGE = /\.(png|jpe?g|webp|avif)$/i;

async function main() {
  let entries;
  try {
    entries = await readdir(source);
  } catch {
    console.error(
      `sync-media: cannot read ${source}. Run "npm run assets:build" at the monorepo root.`,
    );
    process.exit(1);
  }
  const wanted = entries.filter((name) => IMAGE.test(name)).sort();
  await mkdir(target, { recursive: true });

  // Drop files that no longer exist upstream, so a renamed asset does not linger.
  const existing = await readdir(target);
  for (const name of existing) {
    if (!wanted.includes(name)) await rm(path.join(target, name), { force: true });
  }

  let copied = 0;
  for (const name of wanted) {
    const from = path.join(source, name);
    const to = path.join(target, name);
    const [a, b] = await Promise.all([stat(from), stat(to).catch(() => null)]);
    if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) continue;
    await copyFile(from, to);
    copied += 1;
  }
  console.log(`sync-media: ${wanted.length} concept images in public/media (${copied} copied).`);
}

await main();
