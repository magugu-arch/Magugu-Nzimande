import type { Product } from '@bbq/types';
import Link from 'next/link';
import { FoodImage } from '@/components/food/FoodImage';
import { HeatMeter } from '@/components/ui/HeatMeter';
import { Price } from '@/components/ui/Price';

export function ProductCard({
  product,
  priority = false,
  sizes = '(min-width: 1024px) 280px, (min-width: 640px) 45vw, 80vw',
}: {
  product: Product;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-md bg-white shadow-e1 transition-shadow hover:shadow-e2">
      <div className="relative aspect-4/5 overflow-hidden bg-paper">
        <FoodImage
          imageKey={product.imageKey}
          alt={product.name}
          sizes={sizes}
          priority={priority}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {product.tag && (
          <span className="absolute left-3 top-3 rounded-full bg-yellow px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black">
            {product.tag}
          </span>
        )}
        {product.soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-black/65">
            <span className="display rounded-full border-2 border-white px-4 py-1.5 text-lg text-white">
              Sold out today
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-extrabold leading-tight">
            {/* The whole card is the link target, so the card needs no second
                tab stop for a button that goes to the same place. */}
            <Link href={`/menu/${product.slug}`} className="after:absolute after:inset-0">
              {product.name}
            </Link>
          </h3>
          <span className="flex shrink-0 items-center text-sm font-extrabold text-red">
            <Price cents={product.priceCents} compact />
          </span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
          {product.description}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 pt-1">
          <HeatMeter heat={product.heat} />
          <span className="text-[11px] font-semibold text-muted">{product.sauce}</span>
        </div>
      </div>
    </article>
  );
}
