import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Private document storage — event briefs, agreements, riders. Documents are
 * never served from /public; they reach a browser only through an
 * authorised route (admin, or the client's own portal).
 */
export interface DocumentStorage {
  readonly kind: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

/** Local disk under .data/uploads — development and single-server previews. */
export class LocalStorage implements DocumentStorage {
  readonly kind = 'local';
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }
}

/**
 * Supabase Storage (a private bucket) over its REST API, authenticated with
 * the service-role key — which therefore must only ever live on the server.
 */
export class SupabaseStorage implements DocumentStorage {
  readonly kind = 'supabase';
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {}

  private object(key: string) {
    return `${this.url.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await fetch(this.object(key), {
      method: 'POST',
      headers: { authorization: `Bearer ${this.serviceKey}`, 'content-type': contentType, 'x-upsert': 'false' },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Storage upload failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  async get(key: string): Promise<Buffer> {
    const res = await fetch(this.object(key), {
      headers: { authorization: `Bearer ${this.serviceKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Storage download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

let storage: DocumentStorage | null = null;

export function getStorage(): DocumentStorage {
  if (storage) return storage;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET } = process.env;
  storage =
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? new SupabaseStorage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET ?? 'booking-documents')
      : new LocalStorage(process.env.UPLOAD_DIR ?? path.join(process.cwd(), '.data', 'uploads'));
  return storage;
}

export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Check the bytes, not just the declared type: a "PDF" must start like one. */
export function sniffMatches(contentType: string, head: Buffer): boolean {
  const starts = (bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (contentType) {
    case 'application/pdf':
      return starts([0x25, 0x50, 0x44, 0x46]);
    case 'image/png':
      return starts([0x89, 0x50, 0x4e, 0x47]);
    case 'image/jpeg':
      return starts([0xff, 0xd8, 0xff]);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return starts([0x50, 0x4b, 0x03, 0x04]);
    case 'application/msword':
      return starts([0xd0, 0xcf, 0x11, 0xe0]);
    default:
      return false;
  }
}
