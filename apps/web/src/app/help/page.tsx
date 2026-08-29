import type { Metadata } from 'next';
import { DemoFlag, DemoNotice } from '@/components/ui/DemoValue';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Help and allergens',
  description:
    'Answers on delivery timing, the double fry, sauce timing, points and halaal certification, with the full allergen and energy table.',
};

export default function HelpPage() {
  const faqs = api.getFaqs();
  const products = api.getProducts();

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
        <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
        Before you order
      </p>
      <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">Help and allergens</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h2 className="display text-2xl">Questions</h2>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {faqs.map((faq) => (
              <details key={faq.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full border border-line transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2 className="display text-2xl">Contact</h2>
          <ul className="mt-5 space-y-4">
            {api.getStores().map((store) => (
              <li key={store.id} className="rounded-md border border-line bg-white p-5">
                <h3 className="text-sm font-extrabold">{store.name}</h3>
                <p className="mt-1 text-xs text-muted">{store.address}</p>
                <p className="mt-2 text-sm">
                  <a
                    href={`tel:${store.telephone.replace(/\s/g, '')}`}
                    className="font-bold text-red hover:underline"
                  >
                    {store.telephone}
                  </a>
                  <DemoFlag />
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="display text-2xl">Allergen and energy table</h2>
        <p className="mt-2 flex max-w-[62ch] items-start text-sm text-muted">
          <span>
            Indicative values pending the franchisor nutritional analysis. Everything is prepared
            in a kitchen that handles wheat, soya, milk, egg, sesame and fish, so cross-contact
            cannot be excluded.
          </span>
          <DemoFlag />
        </p>

        {/* The table scrolls inside its own box rather than pushing the page
            sideways at 320px. */}
        <div className="mt-5 overflow-x-auto rounded-md border border-line bg-white">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">
              Allergens and indicative energy for all sixteen products
            </caption>
            <thead>
              <tr className="border-b border-line bg-paper text-left">
                <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]">
                  Contains
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.08em]"
                >
                  Energy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => (
                <tr key={product.slug}>
                  <th scope="row" className="px-4 py-3 text-left font-bold">
                    {product.name}
                  </th>
                  <td className="px-4 py-3 text-muted">{product.category}</td>
                  <td className="px-4 py-3">{product.nutrition.allergens}</td>
                  <td className="tabular px-4 py-3 text-right">
                    {product.nutrition.kilojoules.toLocaleString('en-ZA')} kJ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-md border border-line bg-white p-5">
          <DemoNotice className="max-w-3xl" />
        </div>
      </section>
    </div>
  );
}
