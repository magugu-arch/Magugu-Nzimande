import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getPressKit } from '@/content';
import { getMediaFile } from '@/content/media';

/** Original-resolution press photographs — only the ones the press kit lists. */
export async function GET(_request: Request, ctx: RouteContext<'/press/photos/[file]'>) {
  const { file } = await ctx.params;
  const kit = await getPressKit();
  const id = kit?.photos.find((p) => getMediaFile(p).file === file);
  if (!id) return new NextResponse('Not found', { status: 404 });
  const meta = getMediaFile(id);
  const body = await readFile(path.join(process.cwd(), 'assets', 'masters', meta.file));
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'content-type': `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`,
      'content-disposition': `attachment; filename="Zakes-Bantwini-${meta.file}"`,
      'cache-control': 'public, max-age=86400',
    },
  });
}
