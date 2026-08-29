import { formatMoney } from '@bbq/types';
import { BRAND } from '@bbq/ui/tokens';

export default function Page() {
  return (
    <main className="p-10">
      <h1 className="display text-5xl text-red">bb.q Chicken</h1>
      <p className="tabular">{formatMoney(18900)}</p>
      <p>{BRAND.red}</p>
    </main>
  );
}
