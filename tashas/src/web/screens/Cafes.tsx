import { useEffect, useMemo, useState } from 'preact/hooks';
import { sys, track, getDevice } from '../app.ts';
import { openBook, push, switchTab, takeIntent } from '../nav.ts';
import { Banner, Button, IconButton, LinkButton, NavBar, Photo, Row, SampleTag, Segmented, SectionHead, toast } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { InboxButton } from './Today.tsx';
import { branch, km, plural } from '../format.ts';
import { mapsHref } from '../share.ts';
import { branchPolicyLines } from '../../domain/booking/policy.ts';
import { effectivePolicy } from '../../domain/content.ts';
import { formatZar } from '../../domain/util/core.ts';
import type { Branch } from '../../domain/types.ts';

type Coords = { lat: number; lng: number };

function useNearMe() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [state, setState] = useState<'idle' | 'asking' | 'denied'>('idle');
  const ask = () => {
    if (!('geolocation' in navigator)) {
      setState('denied');
      return;
    }
    setState('asking');
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
          setState('idle');
          track('near_me', { granted: true });
        },
        () => {
          setState('denied');
          track('near_me', { granted: false });
        },
        { timeout: 8000, maximumAge: 600000 },
      );
    } catch {
      setState('denied');
    }
  };
  return { coords, state, ask };
}

export function CafesScreen() {
  const [query, setQuery] = useState(() => takeIntent('query') ?? '');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [city, setCity] = useState<string | null>(null);
  const near = useNearMe();

  useEffect(() => {
    const q = takeIntent('query');
    if (q !== undefined) setQuery(q);
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sys.ctx.content.branches.filter(
      (b) => !q || [b.name, b.suburb, b.city, b.province].some((s) => s.toLowerCase().includes(q)),
    );
    if (city) list = list.filter((b) => cityOf(b) === city);
    if (near.coords) list = [...list].sort((a, b) => km(near.coords!, a.coords) - km(near.coords!, b.coords));
    return list;
  }, [query, city, near.coords]);

  return (
    <>
      <NavBar title="Cafés" trailing={<InboxButton />} />
      <div class="page-body tight">
        <form class="search" role="search" onSubmit={(e) => { e.preventDefault(); track('branch_search', { from: 'cafes', hasQuery: !!query.trim() }); }}>
          <Icon name="search" size={19} />
          <label class="vh" for="cafe-search">Search cafés</label>
          <input id="cafe-search" class="input" type="search" enterkeyhint="search" placeholder="Suburb, city or café name" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        </form>
        <div class="row between wrap">
          <div style={{ width: '200px' }}>
            <Segmented label="Show cafés as" value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} />
          </div>
          <Button small icon="pin" busy={near.state === 'asking'} onClick={near.ask}>
            {near.coords ? 'Sorted by distance' : 'Near me'}
          </Button>
        </div>
        {near.state === 'denied' ? (
          <Banner tone="neutral" icon="pin">
            <p>Your location is not available here, so cafés are not sorted by distance. Search by suburb or city instead.</p>
          </Banner>
        ) : null}
        {view === 'map' ? <SchematicMap selected={city} onSelect={setCity} /> : null}
        {city ? (
          <div class="row">
            <span class="callout">Showing {city}</span>
            <button type="button" class="link" onClick={() => setCity(null)}>
              Show all
            </button>
          </div>
        ) : null}
        <p class="footnote" aria-live="polite">
          {plural(results.length, 'café')}. Café details are sample content until Tashas supplies verified addresses, hours and phone numbers.
        </p>
        <div class="stack" style={{ gap: '18px' }}>
          {results.map((b) => (
            <CafeCard key={b.id} b={b} distance={near.coords ? km(near.coords, b.coords) : null} />
          ))}
          {results.length === 0 ? (
            <div class="empty">
              <Icon name="pin" size={34} stroke={1.3} />
              <p class="title-3" style={{ color: 'var(--ink)' }}>No café matches “{query}”</p>
              <p class="footnote">Try a city such as Johannesburg, Pretoria, Cape Town or Durban.</p>
              <Button small onClick={() => { setQuery(''); setCity(null); }}>Clear search</Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function cityOf(b: Branch): string {
  return b.city === 'Sandton' ? 'Johannesburg' : b.city;
}

function CafeCard({ b, distance }: { b: Branch; distance: number | null }) {
  const favourite = sys.db.where('favourites', (f) => f.guestId === getDevice().guestId && f.kind === 'branch' && f.refId === b.id).length > 0;
  return (
    <article class="card pad-0">
      <button type="button" class="pressable" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => { track('branch_view', { id: b.id, from: 'list' }); push({ name: 'cafe', id: b.id }); }}>
        <Photo id={b.heroImageId} ratio="16 / 9" rounded="0" />
        <div class="stack" style={{ padding: '16px 18px 4px' }}>
          <div class="row between">
            <h2 class="title-2">{b.name}</h2>
            {favourite ? <Icon name="heart" size={18} filled /> : null}
          </div>
          <div class="row wrap" style={{ gap: '8px' }}>
            <span class="callout">{b.suburb}, {b.city}</span>
            {distance !== null ? <span class="tag">{distance < 10 ? distance.toFixed(1) : Math.round(distance)} km</span> : null}
            <SampleTag />
          </div>
          <p class="footnote">{b.hours[0]?.days}: {b.hours[0]?.hours} (sample hours)</p>
        </div>
      </button>
      <div class="row wrap" style={{ padding: '12px 18px 18px' }}>
        <Button variant="primary" small icon="calendar" onClick={() => { track('booking_start', { source: 'cafe-card', branchId: b.id }); openBook({ branchId: b.id, source: 'cafe-card' }); }}>
          Book
        </Button>
        <LinkButton small icon="directions" href={mapsHref(`Tashas ${b.suburb} ${b.city}`)}>
          Directions
        </LinkButton>
      </div>
    </article>
  );
}

// South Africa, simplified to a schematic outline (longitude, latitude).
const OUTLINE: [number, number][] = [
  [16.45, -28.63], [17.4, -28.75], [18.2, -28.9], [19.2, -28.9], [20.0, -28.4], [20.0, -24.8], [20.8, -26.0], [22.0, -25.9],
  [23.0, -25.3], [24.3, -25.7], [25.6, -25.7], [26.8, -24.7], [27.1, -23.7], [28.1, -22.6], [29.4, -22.1], [31.3, -22.4],
  [31.9, -24.3], [32.0, -25.9], [32.9, -26.85], [32.4, -28.6], [31.4, -29.4], [30.3, -31.0], [29.2, -32.3], [27.9, -33.05],
  [26.5, -33.8], [25.6, -34.0], [24.8, -34.2], [23.4, -34.1], [22.1, -34.2], [20.0, -34.83], [19.3, -34.6], [18.4, -34.35],
  [18.45, -33.9], [17.9, -33.0], [17.8, -32.0], [17.0, -30.5],
];
const BOUNDS = { west: 15.8, east: 33.4, north: -21.6, south: -35.3 };
const W = 360;
const H = Math.round(W * ((BOUNDS.north - BOUNDS.south) / ((BOUNDS.east - BOUNDS.west) * Math.cos((28 * Math.PI) / 180))));

function projectXY(lng: number, lat: number): [number, number] {
  return [((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W, ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H];
}

function SchematicMap({ selected, onSelect }: { selected: string | null; onSelect: (c: string | null) => void }) {
  const cities = new Map<string, Branch[]>();
  for (const b of sys.ctx.content.branches) cities.set(cityOf(b), [...(cities.get(cityOf(b)) ?? []), b]);
  const path = OUTLINE.map(([lng, lat], i) => `${i ? 'L' : 'M'}${projectXY(lng, lat).map((n) => n.toFixed(1)).join(' ')}`).join(' ') + 'Z';
  return (
    <figure class="map" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schematic map of South Africa showing cafés by city">
        <path d={path} fill="var(--surface)" stroke="var(--stone)" stroke-width="1.2" />
        {[...cities.entries()].map(([name, list]) => {
          const lat = list.reduce((n, b) => n + b.coords.lat, 0) / list.length;
          const lng = list.reduce((n, b) => n + b.coords.lng, 0) / list.length;
          const [x, y] = projectXY(lng, lat);
          const on = selected === name;
          const labelLeft = x > W * 0.62;
          return (
            <g key={name} class="pin" role="button" tabIndex={0} aria-label={`${name}, ${plural(list.length, 'café')}`} aria-pressed={on ? 'true' : 'false'} onClick={() => onSelect(on ? null : name)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(on ? null : name); } }}>
              <circle cx={x} cy={y} r={on ? 15 : 12} fill={on ? 'var(--ink)' : 'var(--sage)'} stroke="var(--surface)" stroke-width="3" />
              <text x={x} y={y + 4.5} text-anchor="middle" font-size="12" font-weight="700" fill={on ? 'var(--paper)' : 'var(--sage-ink)'}>
                {list.length}
              </text>
              <text x={labelLeft ? x - 20 : x + 20} y={y + 4} text-anchor={labelLeft ? 'end' : 'start'} font-size="12.5" font-weight="600" fill="var(--ink)">
                {name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption class="footnote" style={{ padding: '0 14px 12px' }}>
        Schematic map. Tap a city to filter. A live map with verified addresses comes with the maps provider.
      </figcaption>
    </figure>
  );
}

export function CafeDetail({ id }: { id: string }) {
  const b = branch(id);
  const guestId = getDevice().guestId;
  const policy = effectivePolicy(sys.ctx, b.id);
  const fav = sys.db.where('favourites', (f) => f.guestId === guestId && f.kind === 'branch' && f.refId === b.id)[0];
  const events = sys.ctx.content.events.filter((e) => e.branchId === b.id);

  const toggleFav = () => {
    if (fav) sys.db.delete('favourites', fav.id);
    else sys.db.insert('favourites', { id: sys.ctx.ids.id('fav'), guestId, kind: 'branch', refId: b.id, createdAt: sys.ctx.clock.now() });
    toast(fav ? 'Removed from saved cafés' : 'Saved café', fav ? 'close' : 'heart');
  };

  return (
    <div class="on-photo">
      <NavBar title={b.name} large={false} back onPhoto trailing={<IconButton icon="heart" label={fav ? 'Remove from saved cafés' : 'Save café'} onClick={toggleFav} />} />
      <div style={{ position: 'relative' }}>
        <Photo id={b.heroImageId} ratio="4 / 3" rounded="0" eager />
      </div>
      <div class="page-body" style={{ marginTop: '-28px', position: 'relative' }}>
        <div class="card stack" style={{ borderRadius: 'var(--r-xl)' }}>
          <div class="row" style={{ gap: '8px' }}>
            <span class="caption">{b.city}</span>
            <SampleTag label="Sample details" />
          </div>
          <h1 class="title-1">{b.name}</h1>
          <p class="title-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontStyle: 'italic', fontSize: '1.2rem' }}>
            {b.story.title}
          </p>
          <p class="callout">{b.story.body}</p>
          <div class="row wrap">
            <Button variant="primary" icon="calendar" onClick={() => { track('booking_start', { source: 'cafe-detail', branchId: b.id }); openBook({ branchId: b.id, source: 'cafe-detail' }); }}>
              Book a table
            </Button>
            <Button icon="menu" onClick={() => switchTab('menu')}>
              Menu
            </Button>
          </div>
        </div>

        <section class="section">
          <SectionHead title="Visit" />
          <div class="group">
            <Row icon="pin" title="Address" sub="Verified address to be supplied by Tashas" chevron={false} />
            <Row icon="directions" title="Directions" sub="Opens a Google Maps search for this café" href={mapsHref(`Tashas ${b.suburb} ${b.city}`)} />
            <Row icon="clock" title="Hours (sample)" sub={b.hours.map((h) => `${h.days} ${h.hours}`).join(' · ')} chevron={false} />
            <Row icon="phone" title="Call the café" sub="Phone number not yet verified, so calling is switched off" chevron={false} />
          </div>
        </section>

        <section class="section">
          <SectionHead title="Booking at this café" />
          <div class="card stack">
            {branchPolicyLines(policy).map((l) => (
              <p class="callout" key={l}>{l}</p>
            ))}
            {policy.deposits.length > 0 ? (
              <div class="stack-sm">
                <span class="caption">Deposits</span>
                {policy.deposits.map((d) => (
                  <p class="footnote" key={d.id}>
                    {d.label}: {formatZar(d.perGuestMinor)} per guest
                  </p>
                ))}
              </div>
            ) : null}
            <p class="footnote">
              {policy.waitlist && sys.bookings.provider.capabilities.waitlist ? 'A waitlist is available when times are full.' : 'This café does not run an online waitlist.'} Groups larger than {policy.maxOnlinePartySize} should contact the café. Policy {policy.version} (sample).
            </p>
          </div>
          <Banner tone="neutral" icon="cup">
            <p>Order-ahead and collection are not offered at this café yet. They will appear here only once Tashas confirms the café and its ordering system support them.</p>
          </Banner>
        </section>

        {b.amenities.length ? (
          <section class="section">
            <SectionHead title="At the café" />
            <div class="row wrap" style={{ gap: '8px' }}>
              {b.amenities.map((a) => (
                <span class="chip" key={a}>{a}</span>
              ))}
            </div>
          </section>
        ) : null}

        <section class="section">
          <SectionHead title="Inside" />
          <div class="hscroll">
            {b.galleryImageIds.map((img) => (
              <div key={img} style={{ width: 'min(70vw, 280px)' }}>
                <Photo id={img} ratio="4 / 5" />
              </div>
            ))}
          </div>
        </section>

        {events.length ? (
          <section class="section">
            <SectionHead title="Events here" />
            <div class="group">
              {events.map((e) => (
                <Row key={e.id} icon="ticket" title={e.title} sub={e.summary} onClick={() => push({ name: 'event', id: e.id })} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
