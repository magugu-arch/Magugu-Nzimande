import { CategoryKeySchema } from '@bbq/types';
import type { Metadata } from 'next';
import { MenuBrowser } from '@/components/menu/MenuBrowser';
import { DemoNotice } from '@/components/ui/DemoValue';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Menu',
  description:
    'Whole birds, wings, boneless, meals and sides. Twice fried in olive oil. Tossed to order.',
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const parsed = CategoryKeySchema.safeParse(category);

  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
          <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
            <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
            The full range
          </p>
          <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">Menu</h1>
          <DemoNotice className="mt-3 max-w-2xl" />
        </div>
      </div>

      <MenuBrowser
        products={api.getProducts()}
        categories={api.getCategories()}
        initialCategory={parsed.success ? parsed.data : 'all'}
      />
    </>
  );
}
