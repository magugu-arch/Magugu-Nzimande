import { NextResponse } from 'next/server';
import { getAlbums, getPressKit } from '@/content';
import { ALBUM_KIND_LABEL } from '@/components/ui/Sleeve';

/** EPK text downloads: short bio, long bio, discography, performance information. */
export async function GET(_request: Request, ctx: RouteContext<'/press/downloads/[name]'>) {
  const { name } = await ctx.params;
  const kit = await getPressKit();
  if (!kit) return new NextResponse('Not found', { status: 404 });

  let body: string;
  switch (name) {
    case 'short-bio.txt':
      body = `ZAKES BANTWINI — SHORT BIO\n\n${kit.shortBio}\n`;
      break;
    case 'long-bio.txt':
      body = `ZAKES BANTWINI — LONG BIO\n\n${kit.longBio.join('\n\n')}\n`;
      break;
    case 'discography.txt': {
      const albums = await getAlbums();
      body = `ZAKES BANTWINI — DISCOGRAPHY\n\n${albums.map((a) => `${a.year ?? '—'}  ${a.title} (${ALBUM_KIND_LABEL[a.kind]})`).join('\n')}\n`;
      break;
    }
    case 'performance.txt':
      body = `ZAKES BANTWINI — PERFORMANCE INFORMATION\n\n${kit.performance.formats.map((f) => `${f.name}\n${f.detail}`).join('\n\n')}\n\n${kit.performance.notes}\n`;
      break;
    default:
      return new NextResponse('Not found', { status: 404 });
  }
  if (kit.approval !== 'approved') body += '\n[Draft — copy pending management approval]\n';
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="Zakes-Bantwini-${name}"`,
    },
  });
}
