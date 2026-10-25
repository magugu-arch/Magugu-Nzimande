import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sys, track, getDevice } from '../app.ts';
import { openBook, openSheet, takeIntent } from '../nav.ts';
import { Banner, Button, NavBar, Photo, SampleTag, toast } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { SheetHead, useSheet } from '../components/Sheet.tsx';
import { InboxButton } from './Today.tsx';
import { formatZar } from '../../domain/util/core.ts';
import { tick } from '../motion/spring.ts';

export function MenuScreen() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>('all');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const { menuCategories, menuItems } = sys.ctx.content;

  useEffect(() => {
    track('menu_view', {});
    const wanted = takeIntent('menuCategory');
    if (wanted) {
      setActive(wanted);
      window.setTimeout(() => sectionRefs.current[wanted]?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menuItems.filter((m) => !q || `${m.name} ${m.description}`.toLowerCase().includes(q));
  }, [query]);

  const categories = menuCategories.filter((c) => filtered.some((m) => m.categoryId === c.id) && (active === 'all' || active === c.id));

  return (
    <>
      <NavBar title="Menu" trailing={<InboxButton />} />
      <div class="page-body tight">
        <Banner icon="info">
          <p class="callout" style={{ color: 'var(--ink)' }}>
            Sample menu for design review. Dishes are named from the supplied photographs; prices are placeholders until Tashas supplies its approved menu for each café.
          </p>
        </Banner>
        <div class="search">
          <Icon name="search" size={19} />
          <label class="vh" for="menu-search">Search the menu</label>
          <input id="menu-search" class="input" type="search" placeholder="Search dishes and drinks" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        </div>
        <div class="hscroll" role="tablist" aria-label="Menu categories" style={{ position: 'sticky', top: '52px', zIndex: 10, background: 'var(--paper)', paddingTop: '6px', paddingBottom: '10px' }}>
          <button type="button" class="chip" role="tab" aria-selected={active === 'all'} aria-pressed={active === 'all' ? 'true' : 'false'} onClick={() => setActive('all')}>
            Everything
          </button>
          {menuCategories.map((c) => (
            <button type="button" class="chip" key={c.id} role="tab" aria-selected={active === c.id} aria-pressed={active === c.id ? 'true' : 'false'} onClick={() => setActive(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <details class="disclosure">
          <summary>
            <span class="row" style={{ gap: '10px' }}>
              <Icon name="leaf" size={19} /> Dietary and allergen filters
            </span>
            <Icon name="down" size={18} />
          </summary>
          <div class="disclosure-body">
            <p class="callout">
              Filters for vegetarian, vegan, gluten-free and allergens switch on once Tashas has verified that information for every dish. Until then, please ask your server about ingredients.
            </p>
            <div class="row wrap" style={{ gap: '8px' }}>
              {['Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'].map((f) => (
                <button type="button" class="chip" key={f} disabled>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </details>

        {categories.map((c) => (
          <section class="section" key={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} style={{ scrollMarginTop: '120px' }}>
            <div class="stack-sm">
              <h2 class="title-2">{c.label}</h2>
              <p class="footnote">{c.blurb}</p>
            </div>
            <div class="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 220px), 1fr))', gap: '16px 12px' }}>
              {filtered
                .filter((m) => m.categoryId === c.id)
                .map((m) => (
                  <MenuTile key={m.id} id={m.id} />
                ))}
            </div>
          </section>
        ))}
        {categories.length === 0 ? (
          <div class="empty">
            <Icon name="search" size={34} stroke={1.3} />
            <p class="title-3" style={{ color: 'var(--ink)' }}>Nothing matches “{query}”</p>
            <Button small onClick={() => { setQuery(''); setActive('all'); }}>Clear</Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function MenuTile({ id }: { id: string }) {
  const m = sys.ctx.content.menuItems.find((x) => x.id === id)!;
  const fav = isFavourite(id);
  return (
    <button type="button" class="ed-card pressable" onClick={() => { track('menu_item_view', { id }); openSheet({ name: 'menu-item', id }); }}>
      <div style={{ position: 'relative' }}>
        <Photo id={m.imageId} />
        {fav ? (
          <span style={{ position: 'absolute', top: '10px', right: '10px', color: '#fbf8f2', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.4))' }}>
            <Icon name="heart" size={20} filled />
          </span>
        ) : null}
      </div>
      <span class="copy">
        <span class="title-3">{m.name}</span>
        <span class="price">{formatZar(m.priceMinor)}</span>
      </span>
    </button>
  );
}

function isFavourite(itemId: string): boolean {
  const guestId = getDevice().guestId;
  return sys.db.where('favourites', (f) => f.guestId === guestId && f.kind === 'menu-item' && f.refId === itemId).length > 0;
}

export function toggleFavourite(itemId: string): boolean {
  const guestId = getDevice().guestId;
  const existing = sys.db.where('favourites', (f) => f.guestId === guestId && f.kind === 'menu-item' && f.refId === itemId)[0];
  if (existing) {
    sys.db.delete('favourites', existing.id);
    return false;
  }
  sys.db.insert('favourites', { id: sys.ctx.ids.id('fav'), guestId, kind: 'menu-item', refId: itemId, createdAt: sys.ctx.clock.now() });
  return true;
}

export function MenuItemSheet({ id }: { id: string }) {
  const m = sys.ctx.content.menuItems.find((x) => x.id === id)!;
  const category = sys.ctx.content.menuCategories.find((c) => c.id === m.categoryId);
  const { close } = useSheet();
  const [fav, setFav] = useState(isFavourite(id));
  const heartRef = useRef<HTMLSpanElement>(null);
  return (
    <>
      <SheetHead title={m.name} sub={category?.label} />
      <div class="sheet-body">
        <Photo id={m.imageId} ratio="4 / 5" rounded="lg" />
        <div class="row between">
          <span class="title-2 num">{formatZar(m.priceMinor)}</span>
          <SampleTag label="Sample price" />
        </div>
        <p class="body">{m.description}</p>
        <Banner tone="neutral" icon="leaf">
          <p class="callout" style={{ color: 'var(--ink)' }}>
            Allergen and dietary information for this dish has not been verified yet. Please ask your server before ordering.
          </p>
        </Banner>
        <p class="footnote">Served at {m.periods.map((p) => (p === 'breakfast' ? 'breakfast' : 'lunch')).join(' and ')}. Availability varies by café.</p>
      </div>
      <div class="sheet-foot">
        <div class="row">
          <Button
            icon="heart"
            onClick={() => {
              const on = toggleFavourite(id);
              setFav(on);
              if (on) {
                tick(10);
                heartRef.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
              }
              toast(on ? 'Added to favourites' : 'Removed from favourites', on ? 'heart' : 'close');
            }}
            aria-pressed={fav ? 'true' : 'false'}
          >
            <span ref={heartRef} style={{ display: 'inline-flex' }}>{fav ? 'Saved' : 'Save'}</span>
          </Button>
          <Button variant="primary" block icon="calendar" onClick={() => { close(); track('booking_start', { source: 'menu-item' }); openBook({ source: 'menu-item', period: m.periods[0] }); }}>
            Book a table
          </Button>
        </div>
      </div>
    </>
  );
}
