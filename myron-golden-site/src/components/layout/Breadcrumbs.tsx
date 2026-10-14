import Link from 'next/link';
import { cn } from '@/lib/cn';
import { breadcrumbJsonLd } from '@/lib/seo';
import { JsonLd } from '../seo/JsonLd';
import { ChevronRight } from '../ui/icons';

export interface Crumb {
  name: string;
  path: string;
}

/** Visible trail plus matching BreadcrumbList data, so the two never disagree. */
export function Breadcrumbs({ trail, className }: { trail: Crumb[]; className?: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-ivory/65">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={crumb.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-ivory/90">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <Link href={crumb.path} className={cn('hover:text-ivory')}>
                      {crumb.name}
                    </Link>
                    <ChevronRight size={14} className="opacity-60" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </>
  );
}
