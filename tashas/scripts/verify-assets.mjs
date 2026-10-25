#!/usr/bin/env node
/**
 * Checks the 28 supplied originals against the manifest the brief names as
 * the source of truth: file present, byte size and SHA-256 identical. Exits
 * non-zero on any mismatch so a build can never ship altered originals.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'assets/Tashas_28_Image_Asset_Metadata.json'), 'utf8'));
const dir = path.join(root, 'assets/originals');
const onDisk = new Set(readdirSync(dir));
let failures = 0;

for (const a of manifest.assets) {
  if (!onDisk.has(a.filename)) {
    console.error(`missing  ${a.filename} (${a.asset_id})`);
    failures++;
    continue;
  }
  const bytes = readFileSync(path.join(dir, a.filename));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== a.file_size_bytes || sha !== a.sha256) {
    console.error(`changed  ${a.filename}: ${bytes.length} bytes, ${sha}`);
    failures++;
  }
  onDisk.delete(a.filename);
}
for (const extra of onDisk) console.error(`unlisted ${extra}`);

if (failures || onDisk.size) {
  console.error(`\n${failures} problem(s); originals must match the manifest exactly.`);
  process.exit(1);
}
console.log(`All ${manifest.assets.length} originals match the manifest (size and SHA-256).`);
