/* Sundowns One — fan app (concept prototype).
   One file, no dependencies. Sample data only: fixtures use fictional
   opponents and dates relative to today; nothing is bought, sent or stored
   anywhere but this device. */
(() => {
  'use strict';

  const data = (id) => JSON.parse(document.getElementById(id).textContent);
  const ICONS = data('iconData');
  const PANELS = data('panelData');
  const CONFIG = { appUrl: '__APP_URL__', pwa: '__PWA__', viewer: '__VIEWER__' };
  const ASSETS = data('assetData');
  const A = Object.fromEntries(ASSETS.assets.map((a) => [a.id, a]));

  // ---------- small helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const TZ = 'Africa/Johannesburg';
  const fmt = (d, o) => new Intl.DateTimeFormat('en-ZA', { timeZone: TZ, ...o }).format(d);
  const fmtIn = (d, tz, o) => new Intl.DateTimeFormat('en-ZA', { timeZone: tz, ...o }).format(d);
  const rand = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch { /* not supported */ } };

  const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[n] || ''}</svg>`;
  const alt = (id) => (A[id] ? A[id].alt : '');
  const ph = (id, cls = '', decorative = false) => `<div class="ph a${id} ${cls}" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(alt(id))}"`}></div>`;
  const crest = (cls = 'crest') => `<div class="${cls}" role="img" aria-label="Mamelodi Sundowns crest"></div>`;
  const pill = (t, cls = '') => `<span class="pill ${cls}">${t}</span>`;
  const SAMPLE = pill(`${ic('info')}Sample`, 'sample');

  // ---------- dates (all sample fixtures are placed relative to today, in SAST) ----------
  function sastToday() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-ZA', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const y = +p.year, m = +p.month, d = +p.day;
    return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
  }
  const T0 = sastToday();
  const at = (days, hh, mm) => new Date(Date.UTC(T0.y, T0.m - 1, T0.d + days, hh - 2, mm));
  const SAT = (6 - T0.dow + 7) % 7 || 7; // days until the coming Saturday

  const US = { men: 'Mamelodi Sundowns', women: 'Mamelodi Sundowns Ladies', academy: 'Sundowns Academy' };
  const USS = { men: 'Sundowns', women: 'Sundowns Ladies', academy: 'Sundowns Academy' };
  const TEAMS = { men: 'Men', women: 'Women', academy: 'Academy' };
  const HOME_VENUE = 'Loftus Versfeld Stadium, Pretoria';
  const FIXTURES = [
    { id: 'f1', team: 'men', home: true, opp: 'Highveld Rovers', ab: 'HR', comp: 'League', date: at(SAT, 15, 30) },
    { id: 'f2', team: 'women', home: true, opp: 'Coastal City Ladies', ab: 'CC', comp: 'League', date: at(SAT + 1, 13, 0) },
    { id: 'f3', team: 'men', home: false, opp: 'Lowveld Stars', ab: 'LS', comp: 'Cup', date: at(SAT + 4, 19, 30) },
    { id: 'f4', team: 'academy', home: true, opp: 'Riverside Academy', ab: 'RA', comp: 'Development league', date: at(SAT + 7, 10, 0) },
    { id: 'f5', team: 'men', home: true, opp: 'Karoo United', ab: 'KU', comp: 'Continental', date: at(SAT + 7, 18, 0) },
    { id: 'f6', team: 'women', home: false, opp: 'Bay Athletic Ladies', ab: 'BA', comp: 'League', date: at(SAT + 15, 14, 0) },
    { id: 'f7', team: 'men', home: true, opp: 'Metro City', ab: 'MC', comp: 'League', date: at(SAT + 21, 17, 30) },
  ];
  const RESULTS = [
    { id: 'r1', team: 'men', home: true, opp: 'Bay Athletic', ab: 'BA', comp: 'League', date: at(SAT - 7, 15, 30), us: 2, them: 0 },
    { id: 'r2', team: 'women', home: false, opp: 'Highveld Rovers Ladies', ab: 'HR', comp: 'League', date: at(SAT - 6, 13, 0), us: 3, them: 1 },
    { id: 'r3', team: 'men', home: false, opp: 'Coastal City', ab: 'CC', comp: 'Cup', date: at(SAT - 11, 19, 30), us: 1, them: 1 },
    { id: 'r4', team: 'academy', home: true, opp: 'Valley Stars', ab: 'VS', comp: 'Development league', date: at(SAT - 14, 10, 0), us: 2, them: 2 },
  ];
  const fixture = (id) => FIXTURES.find((f) => f.id === id) || RESULTS.find((f) => f.id === id);
  const venue = (f) => (f.home ? (f.team === 'men' ? HOME_VENUE : 'Venue confirmed by the fixture feed') : 'Away · venue from the fixture feed');
  const venueShort = (f) => (f.home && f.team === 'men' ? 'Loftus Versfeld' : f.home ? 'Home · venue TBC' : 'Away');
  const matchName = (f) => (f.home ? `${USS[f.team]} v ${f.opp}` : `${f.opp} v ${USS[f.team]}`);
  const when = (f, o = { weekday: 'short', day: 'numeric', month: 'short' }) => fmt(f.date, o);
  const kick = (f) => fmt(f.date, { hour: '2-digit', minute: '2-digit', hour12: false });
  const daysTo = (f) => Math.max(0, Math.round((Date.UTC(...ymd(f.date)) - Date.UTC(T0.y, T0.m - 1, T0.d)) / 864e5));
  function ymd(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-ZA', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d).map((x) => [x.type, x.value]));
    return [+p.year, +p.month - 1, +p.day];
  }
  const nextHome = () => FIXTURES.find((f) => f.home && f.team === 'men');

  // ---------- state (this device only) ----------
  const KEY = 'sundowns-one:v1';
  const DEFAULTS = {
    seenWelcome: false,
    teams: { men: true, women: true, academy: true },
    appearance: 'dark',
    textSize: 'default',
    lowData: false,
    consent: { matches: { push: false, whatsapp: false, email: false }, club: { push: false, whatsapp: false, email: false }, partners: { push: false, whatsapp: false, email: false } },
    consentLog: [],
    planner: { fixture: 'f1', group: 2, travel: 'car', access: false, family: false, budget: { ticket: '', travel: '', parking: '', food: '', merch: '' }, checks: [], saved: 0 },
    ticketLinked: false,
    membershipLinked: false,
    prediction: { us: 1, them: 0, locked: false },
    quiz: { answers: {}, done: false },
    potm: null,
    qrEntered: false,
    interests: [],
    survey: null,
    ledger: [],
    segs: {},
    teamFilter: 'all',
    tray: {},
    order: null,
  };
  let state = load();
  function load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { s = {}; }
    const merged = JSON.parse(JSON.stringify(DEFAULTS));
    for (const k of Object.keys(s)) {
      if (merged[k] && typeof merged[k] === 'object' && !Array.isArray(merged[k]) && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) Object.assign(merged[k], s[k]);
      else merged[k] = s[k];
    }
    return merged;
  }
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep going */ } }, 120);
  }

  // ---------- Passport ledger ----------
  const LEDGER_SEED = [
    { id: 's1', d: -40, t: 'Verified attendance · home match', pts: 100, att: true },
    { id: 's2', d: -33, t: 'Welcome to the Yellow Nation', pts: 50 },
    { id: 's3', d: -26, t: 'Verified attendance · home match', pts: 100, att: true },
    { id: 's4', d: -19, t: 'Bring a friend · their entry verified', pts: 150 },
    { id: 's5', d: -7, t: 'Verified attendance · home match', pts: 100, att: true },
  ];
  const ledger = () => [...LEDGER_SEED.map((e) => ({ ...e, when: at(e.d, 12, 0).getTime() })), ...state.ledger].sort((a, b) => b.when - a.when);
  const balance = () => ledger().reduce((n, e) => n + e.pts, 0);
  const verified = () => LEDGER_SEED.filter((e) => e.att).length;
  function earn(id, t, pts) {
    if (state.ledger.some((e) => e.id === id)) return false;
    state.ledger.push({ id, t, pts, when: Date.now() });
    save();
    return true;
  }
  const REWARDS = [
    { id: 'scarf', t: 'Matchday scarf', s: 'Collect at the official store', pts: 400, img: '7698' },
    { id: 'partner', t: 'Partner voucher', s: 'Partner to confirm · funded by the partner', pts: 300, img: '7700' },
    { id: 'training', t: 'Open training day for two', s: 'Subject to the training schedule', pts: 600, img: '7704' },
    { id: 'tour', t: 'Stadium tour for two', s: 'Where the venue allows', pts: 900, img: '7682' },
  ];

  // ---------- content ----------
  const TRAVEL = [
    ['car', 'Own car'], ['carpool', 'Carpool'], ['public', 'Public transport'], ['shuttle', 'Approved shuttle'], ['taxi', 'Taxi or e-hailing'], ['walk', 'Walking'],
  ];
  const CHECKS = [
    ['ticket', 'Tickets bought from the official seller'],
    ['travel', 'Route and departure time agreed'],
    ['crew', 'Crew and meeting point sorted'],
    ['access', 'Access or family needs checked'],
    ['food', 'Food and essentials planned'],
    ['gate', 'Gate and arrival time checked'],
  ];
  const BUDGET = [['ticket', 'Ticket', 'each'], ['travel', 'Travel', 'each'], ['parking', 'Parking', 'for the crew'], ['food', 'Food and drink', 'each'], ['merch', 'Merchandise', 'each']];
  const WATCH = [
    { id: 'w1', img: '7697', type: 'video', t: 'Inside the studio: the week ahead', len: '12 min', rights: 'Club-owned content (to confirm)' },
    { id: 'w2', img: '7689', type: 'video', t: 'Matchday highlights', len: '4 min', rights: 'Needs match footage rights' },
    { id: 'w3', img: '7680', type: 'audio', t: 'The Yellow Nation podcast', len: '38 min', rights: 'Club-owned content (to confirm)' },
    { id: 'w4', img: '7704', type: 'video', t: 'Sundowns Ladies on the training ground', len: '7 min', rights: 'Club-owned content (to confirm)' },
    { id: 'w5', img: '7699', type: 'video', t: 'Legends archive', len: 'Series', rights: 'Archive rights to clear' },
    { id: 'w6', img: '7695', type: 'audio', t: 'Matchday radio, low data', len: 'Live on matchdays', rights: 'Production to confirm' },
  ];
  const EXPERIENCES = [
    { id: 'hosp', img: '7705', k: 'Matchday', t: 'Hospitality', d: 'A lounge seat, a proper meal and a view of the whole pitch.' },
    { id: 'training', img: '7704', k: 'Sundowns Ladies', t: 'Open training day', d: 'Watch a training session from pitch side.' },
    { id: 'academy', img: '7701', k: 'Youth pathway', t: 'Academy day', d: 'See how the club develops its young players.' },
    { id: 'family', img: '7692', k: 'First match', t: 'Family matchday', d: 'A guided first matchday for families, with a meeting point and a welcome.' },
    { id: 'tour', img: '7682', k: 'Behind the scenes', t: 'Stadium tour', d: 'The tunnel, the dressing room and the touchline, where the venue allows.' },
    { id: 'global', img: '7694', k: 'Online', t: 'Global supporter evening', d: 'A live online evening for Masandawana abroad, at a time that suits them.' },
  ];
  const BRANCHES = [
    ['Pretoria Central', 'Gauteng'], ['Mamelodi', 'Gauteng'], ['Soshanguve', 'Gauteng'], ['Soweto', 'Gauteng'], ['Polokwane', 'Limpopo'], ['Mbombela', 'Mpumalanga'],
  ];
  const CHAPTERS = [
    ['London', 'Europe/London'], ['New York', 'America/New_York'], ['Gaborone', 'Africa/Gaborone'], ['Dubai', 'Asia/Dubai'], ['Sydney', 'Australia/Sydney'],
  ];
  const MENU = [
    ['chicken', 'Flame-grilled chicken and chips'], ['wors', 'Boerewors roll'], ['pap', 'Pap, wors and chakalaka'], ['wrap', 'Veggie wrap'], ['cold', 'Cold drink'], ['water', 'Water'],
  ];
  const QUIZ = [
    { q: 'Which year is on the club crest?', a: ['1958', '1970', '1985'], c: 1 },
    { q: 'What does the ribbon on the crest say?', a: ['One Club, One Nation', 'The Sky is the Limit', 'Forward Together'], c: 1 },
    { q: 'Mamelodi, in the club’s name, is a township of which city?', a: ['Pretoria', 'Durban', 'Gqeberha'], c: 0 },
  ];
  const PURPOSES = [
    { k: 'matches', t: 'Match alerts', d: 'Kick-off reminders, team news and full-time scores.' },
    { k: 'club', t: 'Club news and stories', d: 'Stories, videos, events and new kit.' },
    { k: 'partners', t: 'Partner offers', d: 'Offers from club partners. Partners never see your details.' },
  ];
  const CHANNELS = [['push', 'Push notifications'], ['whatsapp', 'WhatsApp'], ['email', 'Email']];

  // ---------- springs (Apple's damping ratio + response) ----------
  class Spring {
    constructor(o) {
      this.x = o.value || 0; this.v = 0; this.target = this.x;
      this.damping = o.damping || 1; this.response = o.response || 0.4;
      this.precision = o.precision || 0.5; this.onUpdate = o.onUpdate; this.onRest = o.onRest; this.raf = 0;
    }
    set(x) { this.stop(); this.x = x; this.v = 0; this.onUpdate && this.onUpdate(x); }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
    to(target, o = {}) {
      this.target = target;
      if (o.velocity != null) this.v = o.velocity;
      if (o.damping != null) this.damping = o.damping;
      if (o.response != null) this.response = o.response;
      if (o.onRest) this.onRest = o.onRest;
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.tick(t)); }
    }
    tick(now) {
      const dt = Math.min(0.064, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const k = (2 * Math.PI / this.response) ** 2, c = (4 * Math.PI * this.damping) / this.response;
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) { const a = -k * (this.x - this.target) - c * this.v; this.v += a * h; this.x += this.v * h; }
      const done = Math.abs(this.x - this.target) < this.precision && Math.abs(this.v) < this.precision * 10;
      if (done) { this.x = this.target; this.v = 0; }
      this.onUpdate && this.onUpdate(this.x);
      if (done) { this.raf = 0; const cb = this.onRest; cb && cb(); } else this.raf = requestAnimationFrame((t) => this.tick(t));
    }
  }
  // Where a flick would come to rest (Apple's projection, scroll-like deceleration).
  const project = (v, d = 0.995) => ((v / 1000) * d) / (1 - d);
  // Past an edge, follow less and less, like a real material.
  const rubber = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
  function velocityOf(samples) {
    const now = samples[samples.length - 1];
    const old = samples.find((s) => now.t - s.t <= 100) || samples[0];
    const dt = now.t - old.t;
    return dt > 0 ? ((now.y - old.y) / dt) * 1000 : 0;
  }

  // ---------- building blocks ----------
  function head(title, o = {}) {
    return `<div class="lt-head"><div>${o.eyebrow ? `<p class="eyebrow">${o.eyebrow}</p>` : ''}<h1 class="lt" data-lt tabindex="-1">${title}</h1></div>${o.trail || ''}</div>`;
  }
  function sec(title, o = {}) {
    return `<div class="sec-head"><h2>${title}</h2>${o.link || ''}</div>${o.note ? `<p class="sec-note">${o.note}</p>` : ''}`;
  }
  // One row of a grouped list. `go` routes, `act` runs an action.
  function row(o) {
    const icon = o.icon ? `<span class="ic ${o.soft ? 'soft' : ''}" style="${o.c ? `--c:${o.c}` : ''}">${ic(o.icon)}</span>` : '';
    const attrs = o.go ? `data-go="${o.go}"${o.seg ? ` data-seg-to="${o.seg}"` : ''}` : o.act ? `data-act="${o.act}" data-arg="${esc(o.arg || '')}"` : '';
    const inner = `${icon}<span class="rt"><b>${o.t}</b>${o.s ? `<small>${o.s}</small>` : ''}</span>${o.v != null ? `<span class="rv">${o.v}</span>` : ''}${o.trail || ''}${o.chev === false || (!o.go && !o.act) ? '' : ic('chevR', 'chev')}`;
    const cls = `row ${icon ? 'has-ic' : ''} ${o.go || o.act ? 'tap' : ''}`;
    return `<li>${o.go || o.act ? `<button type="button" class="${cls}" ${attrs}>${inner}</button>` : `<div class="${cls}">${inner}</div>`}</li>`;
  }
  const list = (rows, cls = '') => `<ul class="list ${cls}">${rows.join('')}</ul>`;
  function seg(name, opts, label) {
    const cur = state.segs[name] || opts[0][0];
    const i = Math.max(0, opts.findIndex((o) => o[0] === cur));
    return `<div class="seg" role="group" aria-label="${label}" data-seg="${name}"><span class="thumb" style="width:calc((100% - 4px) / ${opts.length});transform:translateX(${i * 100}%)"></span>${opts.map((o) => `<button type="button" data-act="seg" data-arg="${o[0]}" aria-pressed="${o[0] === cur}">${o[1]}</button>`).join('')}</div>`;
  }
  const panelHidden = (name, key, first) => ((state.segs[name] || first) === key ? '' : 'hidden');
  // A storyboard as a swipeable set of steps, captions set as real text.
  function steps(id) {
    const a = A[id], p = PANELS[id];
    if (!a || !p) return '';
    return `<div class="rail steps" data-steps tabindex="0" role="region" aria-label="${esc(a.title.replace('Storyboard: ', ''))}, ${a.steps.length} steps">${a.steps.map((s, i) => {
      const [, , w, h] = p.panels[i];
      return `<figure class="step" style="margin:0"><div class="ph a${id} p${id}-${i}" style="aspect-ratio:${w}/${h}" aria-hidden="true"></div><figcaption class="sb"><b>${String(i + 1).padStart(2, '0')}</b><span>${s}</span></figcaption></figure>`;
    }).join('')}</div><div class="dots" role="group" aria-label="Choose a step">${a.steps.map((s, i) => `<button type="button" data-act="step" data-arg="${i}" aria-label="Step ${i + 1}: ${esc(s)}" aria-current="${i === 0}"></button>`).join('')}</div>`;
  }
  function ring(value, max, label, size = 64) {
    const r = 26, C = 2 * Math.PI * r, off = C * (1 - clamp(value / max, 0, 1));
    return `<div class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="${r}"/><circle class="val" cx="32" cy="32" r="${r}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><b>${value}/${max}</b></div>`;
  }
  // A full-bleed photo header. The photo moves slower than the page (parallax),
  // stretches on pull-down, and the large title hands over to the bar on scroll.
  function immersive(id, o) {
    return `<header class="imm${o.lean ? ' lean' : ''}"><div class="imm-media">${ph(id, '', false).replace('class="ph', `style="${o.pos ? `background-position:${o.pos}` : ''}" class="ph`)}</div>${o.top ? `<div class="imm-top">${o.top}</div>` : ''}<div class="imm-body">${o.eyebrow ? `<p class="eyebrow">${o.eyebrow}</p>` : ''}<h1 class="lt" data-lt tabindex="-1">${o.title}</h1>${o.sub ? `<p class="imm-sub">${o.sub}</p>` : ''}${o.actions ? `<div class="btns">${o.actions}</div>` : ''}${o.after || ''}</div></header>`;
  }
  // The Passport as a member card: metallic edge, a sheen that follows you.
  function memberCard(mini) {
    const b = balance(), v = verified();
    return `<${mini ? 'button type="button" data-go="passport"' : 'section'} class="mcard${mini ? ' tap' : ''}" aria-label="Yellow Nation Passport: ${b} points, ${v} of 5 verified matches to your next milestone (sample)"><span class="sheen" aria-hidden="true"></span>
<span class="mc-top"><span class="mc-brand">YELLOW NATION PASSPORT</span>${crest('crest mc-crest')}</span>
<span class="mc-mid"><span class="mc-pts num">${b.toLocaleString('en-ZA')}</span><span class="mc-lbl">points</span></span>
<span class="mc-foot"><span>MEMBER · SAMPLE<br><b>${v} of 5 verified matches</b></span>${ring(v, 5, `${v} of 5`, 54)}</span></${mini ? 'button' : 'section'}>`;
  }
  function countdown(f) {
    const ms = Math.max(0, f.date.getTime() - Date.now());
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    const tile = (n, l) => `<div><b class="num">${String(n).padStart(2, '0')}</b><small>${l}</small></div>`;
    return `<div class="cd" data-countdown="${f.id}" role="timer" aria-label="${d} days, ${h} hours and ${m} minutes to kick-off">${tile(d, d === 1 ? 'day' : 'days')}${tile(h, 'hrs')}${tile(m, 'min')}</div>`;
  }
  function pass(f) {
    return `<section class="pass" aria-labelledby="passT"><div class="ps-top">${crest('crest')}<span><b>Sundowns One</b><small>Matchday pass · sample</small></span>${pill('Linked', 'glass')}</div>
<div class="ps-main"><h3 id="passT">${esc(matchName(f))}</h3><p>${when(f, { weekday: 'long', day: 'numeric', month: 'long' })} · ${kick(f)} · Loftus Versfeld</p>
<dl class="ps-grid">${[['Gate', 'C'], ['Block', '118'], ['Row', '14'], ['Seat', '22']].map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('')}</dl></div>
<div class="perf" aria-hidden="true"></div>
<div class="ps-foot">${ic('lock')}<span>Your entry code stays in the official seller’s wallet. Sundowns One never makes its own ticket codes.</span></div>
<div class="ps-actions"><button type="button" class="btn btn-primary btn-sm tap" data-act="wallet">${ic('ticket')}Open seller wallet</button><button type="button" class="btn btn-glass btn-sm tap" data-go="stadium">Find my seat</button><button type="button" class="btn btn-plain btn-sm tap" style="color:#fff" data-act="unlinkTicket">Unlink</button></div></section>`;
  }
  const badgeUs = () => `<span class="badge us">${crest('crest')}</span>`;
  const badgeThem = (f) => `<span class="badge them" aria-hidden="true">${f.ab}</span>`;
  const note = (html, cls = '', icon = 'info') => `<div class="note ${cls}">${ic(icon)}<span>${html}</span></div>`;
  const footNote = () => `<p class="foot-note">Concept prototype by LegacyLeverage Creative Agency. Not an official Mamelodi Sundowns product. Fixtures, tickets, points, prices and partners are samples. <a href="#about" data-go="about">About this concept</a></p>`;

  function fixtureRow(f, result) {
    const d = ymd(f.date);
    return `<li data-team="${f.team}"><button type="button" class="fx tap" data-act="fixture" data-arg="${f.id}"><span class="date-tile ${f.home ? 'home' : ''}"><b>${d[2]}</b><small>${fmt(f.date, { weekday: 'short' })}</small></span><span class="rt"><b>${esc(matchName(f))}</b><small>${result ? `${f.comp} · ${TEAMS[f.team]}` : `${kick(f)} · ${venueShort(f)} · ${f.comp}`}</small></span>${result ? `<span class="score" aria-label="${USS[f.team]} ${f.us}, ${f.opp} ${f.them}">${f.home ? `${f.us}–${f.them}` : `${f.them}–${f.us}`}</span>` : ''}${ic('chevR', 'chev')}</button></li>`;
  }
  function planProgress() { return state.planner.checks.length; }

  // ---------- screens ----------
  function rToday() {
    const f = nextHome();
    const done = planProgress();
    return `${immersive('7676', { pos: '74% 40%', lean: true, top: `<span class="wordmark">${crest('crest')}<span><b>Sundowns One</b><small>Matchday · Passport · Nation</small></span></span><button type="button" class="menu-pill glass tap" data-go="profile" aria-label="You: profile and settings">${ic('person')}You</button>`, eyebrow: `The Yellow Nation · ${fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}`, title: 'The Sky is<br><em>the Limit.</em>', sub: 'Your club, your people and every matchday, in one place.', actions: `<button type="button" class="btn btn-primary tap" data-go="planner">Plan your matchday${ic('arrowR')}</button><button type="button" class="btn btn-glass tap" data-go="matches">See the fixtures</button>`, after: `<button type="button" class="concept-line tap" data-go="about">${ic('info')}Concept prototype · sample data</button>` })}<div class="wrap">

<section class="card next" aria-labelledby="nextT">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><p class="eyebrow">${daysTo(f) === 0 ? 'Today · home match' : 'Next home match'}</p>${SAMPLE}</div>
  <div class="teams">${badgeUs()}<span class="vs">v</span>${badgeThem(f)}</div>
  <h2 id="nextT" class="t3">${esc(matchName(f))}</h2>
  <div class="meta"><span>${ic('calendar')}${when(f)} · ${kick(f)}</span><span>${ic('pin')}Loftus Versfeld</span><span>${ic('ball')}${f.comp}</span></div>
  ${countdown(f)}
  <div class="btns"><button type="button" class="btn btn-primary btn-sm tap" data-act="tickets" data-arg="${f.id}">${ic('ticket')}Tickets</button><button type="button" class="btn btn-tinted btn-sm tap" data-act="planFor" data-arg="${f.id}">Plan</button><button type="button" class="btn btn-tinted btn-sm tap" data-act="shareFixture" data-arg="${f.id}">${ic('share')}Share</button></div>
</section>

${done ? `<ul class="list" style="margin-top:14px">${row({ go: 'planner', t: 'Your matchday plan', s: `${done} of ${CHECKS.length} ready`, trail: ring(done, CHECKS.length, `${done} of ${CHECKS.length} ready`, 40), chev: true })}</ul>` : ''}

${sec('Quick actions')}
<nav class="quick" aria-label="Quick actions">
  <button type="button" class="tap" data-act="tickets" data-arg="${f.id}"><span class="ic" style="--c:#0c3e2e">${ic('ticket')}</span>Tickets</button>
  <button type="button" class="tap" data-go="planner"><span class="ic" style="--c:#b58500">${ic('list')}</span>Planner</button>
  <button type="button" class="tap" data-go="stadium"><span class="ic" style="--c:#11643f">${ic('map')}</span>Stadium</button>
  <button type="button" class="tap" data-go="fanzone"><span class="ic" style="--c:#c2410c">${ic('trophy')}</span>Fan Zone</button>
  <button type="button" class="tap" data-go="ask"><span class="ic" style="--c:#2563eb">${ic('bubble')}</span>Ask</button>
  <button type="button" class="tap" data-go="store"><span class="ic" style="--c:#7c3aed">${ic('bag')}</span>Store</button>
  <button type="button" class="tap" data-go="community"><span class="ic" style="--c:#0f766e">${ic('people')}</span>Community</button>
  <button type="button" class="tap" data-go="help"><span class="ic" style="--c:#b4231a">${ic('cross')}</span>Help</button>
</nav>

${sec('Your Passport', { link: '<button type="button" class="tap" data-go="passport">See all</button>' })}
${memberCard(true)}

${sec('From the club')}
<div class="rail" role="region" aria-label="From the club">
  <button type="button" class="card media tap" data-act="watchItem" data-arg="w1">${ph('7697')}<div class="mb"><p class="eyebrow">Sundowns TV</p><h3>Inside the studio: the week ahead</h3><p>12 min · sample</p></div></button>
  <button type="button" class="card media tap" data-act="watchItem" data-arg="w4">${ph('7704')}<div class="mb"><p class="eyebrow">Sundowns Ladies</p><h3>On the training ground</h3><p>7 min · sample</p></div></button>
  <button type="button" class="card media tap" data-go="community">${ph('7692')}<div class="mb"><p class="eyebrow">Community</p><h3>Watch parties near you</h3><p>Branches and screenings</p></div></button>
  <button type="button" class="card media tap" data-go="watch">${ph('7680')}<div class="mb"><p class="eyebrow">Watch & Listen</p><h3>Every story, all season</h3><p>Video, audio and low-data radio</p></div></button>
</div>

${sec('Bring your crew')}
<button type="button" class="pcard r-tall tap" data-act="crew">${ph('7681')}<div class="body"><p class="eyebrow">Bring Your Crew</p><h3 class="t1">Better together.</h3><p>Invite friends to a match. Once they're through the gate, you both earn Passport points.</p></div></button>

<div class="grid2" style="margin-top:14px">
  <button type="button" class="pcard r-short tap" data-go="fanzone">${ph('7696')}<div class="body"><p class="eyebrow">Fan Zone</p><h3 class="hd">Score at the stadium, play from home</h3></div></button>
  <button type="button" class="pcard r-short tap" data-go="community" data-seg-to="community:global">${ph('7695')}<div class="body"><p class="eyebrow">Wherever you are</p><h3 class="hd">Kick-off in your time zone</h3></div></button>
</div>

${sec('Partner experience', { note: 'One partner spot at most, and only something useful. Partner to be confirmed.' })}
<button type="button" class="card media tap" data-go="partners">${ph('7700')}<div class="mb"><p class="eyebrow">Member benefit · partner TBC</p><h3>Your membership, at the till</h3><p>See how a partner could fund everyday benefits for members.</p></div></button>

${sec('Club Impact')}
<button type="button" class="card media tap" data-go="impact">${ph('7701')}<div class="mb"><p class="eyebrow">Next generation</p><h3>Football that builds futures</h3><p>Grassroots, women and girls, and community programmes.</p></div></button>
${footNote()}
</div>`;
  }

  function rMatches() {
    const tf = state.teamFilter;
    const show = (f) => tf === 'all' || f.team === tf;
    const byMonth = {};
    FIXTURES.forEach((f) => { (byMonth[fmt(f.date, { month: 'long', year: 'numeric' })] ||= []).push(f); });
    return `<div class="wrap">
${head('Every <em>match.</em>', { eyebrow: 'Matches · all teams' })}
${seg('matches', [['fixtures', 'Fixtures'], ['results', 'Results']], 'Fixtures or results')}
<div class="chips" role="group" aria-label="Team" style="margin-top:12px">${[['all', 'All teams'], ['men', 'Men'], ['women', 'Women'], ['academy', 'Academy']].map(([k, t]) => `<button type="button" class="chip tap" data-act="teamFilter" data-arg="${k}" aria-pressed="${tf === k}">${t}</button>`).join('')}</div>
<button type="button" class="pcard r-short tap" style="margin-top:14px" data-go="live">${ph('7679')}<div class="body"><div style="display:flex;gap:6px;margin-bottom:8px">${pill('● Live preview')}${SAMPLE}</div><h2 class="t3">Match Centre</h2><p>Timeline, stats and the Player of the Match vote, as they'd look during a game.</p></div></button>
<div style="margin-top:14px">${note('Sample fixtures with fictional opponents and dates set from today. The official fixture feed replaces them.')}</div>
<div data-panel-of="matches" data-panel="fixtures" ${panelHidden('matches', 'fixtures', 'fixtures')}>
${Object.entries(byMonth).map(([m, fs]) => `<h2 class="eyebrow" style="margin:22px 4px 8px">${m}</h2>${list(fs.map((f) => fixtureRow(f).replace('<li ', `<li ${show(f) ? '' : 'hidden '}`)))}`).join('')}
</div>
<div data-panel-of="matches" data-panel="results" ${panelHidden('matches', 'results', 'fixtures')}>
<h2 class="eyebrow" style="margin:22px 4px 8px">Recent · sample results</h2>
${list(RESULTS.map((f) => fixtureRow(f, true).replace('<li ', `<li ${show(f) ? '' : 'hidden '}`)))}
<p class="list-foot">Results are invented for the prototype. Real scores come only from the licensed match data feed.</p>
</div>
${footNote()}
</div>`;
  }

  function rLive() {
    const f = nextHome();
    const voted = state.potm;
    const opts = [['a', 'Player A'], ['b', 'Player B'], ['c', 'Player C']];
    const share = { a: 46, b: 31, c: 23 };
    return `<div class="wrap">
${head('Match <em>Centre</em>', { eyebrow: 'Sample match · not a real result' })}
<section class="pcard r-mid" aria-label="Scoreboard, sample">${ph('7677', '', true)}<div class="body" style="justify-content:center">
  <div class="board">
    <div>${badgeUs()}<p class="nm">${USS.men}</p></div>
    <div><p class="sc num">1 – 0</p><p class="min">67′</p></div>
    <div>${badgeThem(f)}<p class="nm">${esc(f.opp)}</p></div>
  </div>
  <p class="cap" style="text-align:center;margin-top:16px;opacity:.85">Sample clock and score. The licensed feed sets both.</p>
</div></section>
<div style="margin-top:14px">${note('Source: sample data · updated just now. Every live update will show its source and time, and say so when the feed is late.', 'info')}</div>
<div style="margin-top:16px">${seg('live', [['timeline', 'Timeline'], ['stats', 'Stats'], ['vote', 'Vote']], 'Match Centre view')}</div>
<div data-panel-of="live" data-panel="timeline" ${panelHidden('live', 'timeline', 'timeline')} style="margin-top:14px">
  <ul class="list tl">
    <li><span class="m">67′</span><span><b>Substitution · ${USS.men}</b><br><small class="muted">Names from the squad feed</small></span></li>
    <li><span class="m">61′</span><span><b>Goal · ${USS.men}</b><br><small class="muted">1–0</small></span></li>
    <li><span class="m">46′</span><span><b>Second half under way</b></span></li>
    <li><span class="m">HT</span><span><b>Half-time · 0–0</b></span></li>
    <li><span class="m">38′</span><span><b>Yellow card · ${esc(f.opp)}</b></span></li>
    <li><span class="m">12′</span><span><b>Chance · ${USS.men}</b><br><small class="muted">Shot saved</small></span></li>
    <li><span class="m">1′</span><span><b>Kick-off</b></span></li>
  </ul>
</div>
<div data-panel-of="live" data-panel="stats" ${panelHidden('live', 'stats', 'timeline')} style="margin-top:14px">
  <div class="list">${[['Possession', 58, 42, '%'], ['Shots', 11, 5, ''], ['On target', 5, 2, ''], ['Corners', 6, 2, ''], ['Fouls', 9, 12, '']].map(([n, a, b2, u]) => `<div class="statrow"><div class="lab"><b>${a}${u}</b><span class="muted">${n}</span><b>${b2}${u}</b></div><div class="bar" role="img" aria-label="${n}: ${USS.men} ${a}${u}, ${esc(f.opp)} ${b2}${u}"><i style="width:${(a / (a + b2)) * 100}%"></i></div></div>`).join('')}</div>
  <p class="list-foot">Sample numbers. Statistics appear only where the data licence allows.</p>
</div>
<div data-panel-of="live" data-panel="vote" ${panelHidden('live', 'vote', 'timeline')} style="margin-top:14px">
  <p class="sec-note" style="margin:0 2px 10px">Player of the Match. One supporter, one vote. Real names come from the official squad feed.</p>
  <ul class="list">${opts.map(([k, t]) => `<li><button type="button" class="vote tap" data-act="potm" data-arg="${k}" ${voted ? 'aria-disabled="true"' : ''} aria-pressed="${voted === k}"><span class="fill" style="width:${voted ? share[k] : 0}%"></span><span class="ic soft">${ic('person')}</span><span class="rt"><b>${t}</b><small>Sample player</small></span><span class="rv num">${voted ? share[k] + '%' : ''}</span>${voted === k ? ic('check', 'chev') : ''}</button></li>`).join('')}</ul>
  <p class="list-foot">${voted ? 'Thanks. Your vote is in. Results here are sample percentages.' : 'Voting is free, and nobody can buy extra votes.'}</p>
</div>
${footNote()}
</div>`;
  }

  function rMatchday() {
    const f = nextHome();
    const done = planProgress();
    return `${immersive('7687', { pos: 'center 32%', eyebrow: `Matchday · ${when(f)} · ${esc(matchName(f))}`, title: 'Your matchday,<br><em>sorted.</em>', sub: 'Ticket, travel, gate, seat and food, in the order you need them.' })}<div class="wrap">

${state.ticketLinked ? pass(f) : `<section class="card card-pad" aria-labelledby="tkT">
  <p class="eyebrow">Your ticket</p>
  <h2 id="tkT" class="t3">No ticket linked yet</h2>
  <p class="muted">Buy from the official ticket seller, then link it here to see your gate and seat.</p>
  <div class="btns"><button type="button" class="btn btn-primary btn-sm tap" data-act="tickets" data-arg="${f.id}">${ic('ticket')}Get tickets</button><button type="button" class="btn btn-tinted btn-sm tap" data-act="linkTicket">Link a ticket (demo)</button></div></section>`}

${sec('How matchday works')}
${steps('7718')}

${sec('Plan and prepare')}
${list([
    row({ go: 'planner', icon: 'list', c: '#b58500', t: 'Matchday planner', s: done ? `${done} of ${CHECKS.length} ready` : 'Crew, travel, budget and checklist' }),
    row({ go: 'travel', icon: 'car', c: '#2563eb', t: 'Getting there', s: 'Driving, parking, shuttles and drop-off' }),
    row({ go: 'stadium', icon: 'map', c: '#11643f', t: 'Stadium guide', s: 'Gates, seats, toilets and first aid' }),
    row({ go: 'food', icon: 'food', c: '#c2410c', t: 'Food and drink', s: 'Menus and order-ahead pilot' }),
    row({ go: 'access', icon: 'access', c: '#0f766e', t: 'Accessibility and family', s: 'Step-free routes and family help' }),
    row({ go: 'help', icon: 'cross', c: '#b4231a', t: 'Help and safety', s: 'Stewards, first aid and a real person' }),
  ])}

${sec('Your matchday timeline', { note: 'What Sundowns One does for you, from a week out to the next match.' })}
${list([
    row({ icon: 'calendar', soft: true, t: 'A week before', s: 'Plan your crew and budget. Invite a friend.' }),
    row({ icon: 'bell', soft: true, t: 'Two days before', s: 'The club’s matchday notice: gate times and travel updates.' }),
    row({ icon: 'gate', soft: true, t: 'On the day', s: 'Your gate, seat and the quickest way in.' }),
    row({ icon: 'food', soft: true, t: 'In the stadium', s: 'Order ahead where it’s offered, or at the counter.' }),
    row({ icon: 'star', soft: true, t: 'After full-time', s: 'Your Passport stamp lands once your entry is verified.' }),
  ])}
${footNote()}
</div>`;
  }

  function rPlanner() {
    const p = state.planner;
    const f = fixture(p.fixture) || nextHome();
    const done = p.checks.length;
    return `${immersive('7688', { pos: 'center 40%', eyebrow: 'Matchday planner', title: 'Less stress.<br><em>More matchday.</em>', sub: 'Crew, travel, budget and a checklist. Your plan stays on this phone.' })}<div class="wrap">

${sec('The match')}
${list([row({ act: 'pickFixture', icon: 'calendar', c: '#0c3e2e', t: esc(matchName(f)), s: `${when(f, { weekday: 'long', day: 'numeric', month: 'long' })} · ${kick(f)} · sample` })])}

${sec('Your crew')}
<ul class="list">
  <li><div class="row has-ic"><span class="ic" style="--c:#0f766e">${ic('people')}</span><span class="rt"><b id="groupLabel">Crew size</b><small>Including you</small></span><span class="stepper" role="group" aria-labelledby="groupLabel"><button type="button" data-act="group" data-arg="-1" aria-label="One fewer">${ic('minus')}</button><i></i><output id="groupOut" aria-live="polite">${p.group}</output><i></i><button type="button" data-act="group" data-arg="1" aria-label="One more">${ic('plus')}</button></span></div></li>
  <li><label class="row has-ic"><span class="ic" style="--c:#2563eb">${ic('access')}</span><span class="rt"><b>Someone needs step-free access</b></span><input type="checkbox" role="switch" class="switch" data-change="planFlag" data-arg="access" ${p.access ? 'checked' : ''}></label></li>
  <li><label class="row has-ic"><span class="ic" style="--c:#b58500">${ic('family')}</span><span class="rt"><b>We’re bringing children</b></span><input type="checkbox" role="switch" class="switch" data-change="planFlag" data-arg="family" ${p.family ? 'checked' : ''}></label></li>
</ul>
${p.access || p.family ? `<p class="list-foot">${p.access ? 'See <a href="#access" data-go="access">accessibility</a> for the step-free entrance and drop-off. ' : ''}${p.family ? 'The family meeting point and first-match guide are in <a href="#access" data-go="access">accessibility and family</a>.' : ''}</p>` : ''}

${sec('Getting there')}
<div class="chips" role="group" aria-label="How you’re travelling" style="flex-wrap:wrap;overflow:visible">${TRAVEL.map(([k, t]) => `<button type="button" class="chip tap" data-act="travel" data-arg="${k}" aria-pressed="${p.travel === k}">${t}</button>`).join('')}</div>
<p class="list-foot"><a href="#travel" data-go="travel">Routes, parking and drop-off</a> come from the venue’s transport plan.</p>

${sec('Budget', { note: 'Your own estimates, not club prices. Ticket prices come from the official seller.' })}
<ul class="list">
${BUDGET.map(([k, t, per]) => `<li><div class="row"><span class="rt"><label for="b_${k}"><b>${t}</b><small>${per}</small></label></span><span class="money"><input id="b_${k}" class="input num" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="0" value="${esc(p.budget[k])}" data-input="budget" data-arg="${k}"></span></div></li>`).join('')}
  <li><div class="row" style="background:var(--surface-2)"><span class="rt"><b>Each person</b><small id="crewLine">Crew of ${p.group}</small></span><span class="rv" style="text-align:right"><b id="bEach" class="num" style="color:var(--label);font-size:1.25rem">${rand.format(perPerson())}</b><br><small id="bCrew" class="num">${rand.format(crewTotal())} for the crew</small></span></div></li>
</ul>

${sec('Checklist', { link: `<span class="muted num" id="checkCount">${done} of ${CHECKS.length}</span>` })}
<ul class="list">${CHECKS.map(([k, t]) => `<li><label class="row check"><input type="checkbox" data-change="planCheck" data-arg="${k}" ${p.checks.includes(k) ? 'checked' : ''}><span class="rt"><b>${t}</b></span></label></li>`).join('')}</ul>

<div class="stack" style="margin-top:20px"><button type="button" class="btn btn-primary btn-block tap" data-act="savePlan">${ic('check')}Save plan</button><button type="button" class="btn btn-tinted btn-block tap" data-act="sharePlan">${ic('share')}Share with your crew</button></div>
<p class="list-foot">${p.saved ? `Saved on this phone at ${fmt(new Date(p.saved), { hour: '2-digit', minute: '2-digit', hour12: false })}. ` : ''}Sharing sends the match, crew size and travel only. Never your ticket or location.</p>
<div class="btns"><button type="button" class="btn btn-plain btn-sm tap" data-act="resetPlan">Start over</button></div>

${sec('Bring your crew')}
<button type="button" class="card media tap" data-act="crew">${ph('7681', 'port')}<div class="mb"><p class="eyebrow">Invite friends</p><h3>Choose a match, invite your crew, go together</h3><p>When a friend’s entry is verified, you both earn Passport points.</p></div></button>
${footNote()}
</div>`;
  }
  const num = (v) => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };
  function perPerson() { const b = state.planner.budget; const g = Math.max(1, state.planner.group); return num(b.ticket) + num(b.travel) + num(b.food) + num(b.merch) + Math.round(num(b.parking) / g); }
  function crewTotal() { const b = state.planner.budget; const g = Math.max(1, state.planner.group); return (num(b.ticket) + num(b.travel) + num(b.food) + num(b.merch)) * g + num(b.parking); }

  function stadiumMap() {
    const mine = state.ticketLinked;
    const M = [
      ['gate', 44, 34, 'A'], ['gate', 296, 34, 'B'], ['gate', 296, 226, 'C'], ['gate', 44, 226, 'D'],
      ['aid', 170, 14, ''], ['aid', 170, 246, ''],
      ['food', 14, 100, ''], ['food', 326, 100, ''], ['food', 14, 160, ''], ['food', 326, 160, ''],
      ['wc', 110, 246, ''], ['wc', 230, 246, ''], ['wc', 110, 14, ''], ['wc', 230, 14, ''],
      ['access', 66, 246, ''], ['help', 274, 246, ''], ['help', 66, 14, ''],
    ];
    const col = { gate: '#11643f', aid: '#c0352b', food: '#c27a00', wc: '#2563eb', access: '#0f766e', help: '#6b21a8' };
    const glyph = { food: 'food', aid: 'cross', access: 'access', help: 'info' };
    return `<div class="map" role="img" aria-label="Illustrative stadium map: four stands around the pitch, gates A to D at the corners, first aid at the north and south, food on the east and west concourses, toilets and help points around the bowl${mine ? ', and your block 118 in the west stand highlighted' : ''}">
<svg viewBox="0 0 340 260" xmlns="http://www.w3.org/2000/svg">
  <polygon class="stand" points="62,26 278,26 252,66 88,66"/>
  <polygon class="stand" points="62,234 278,234 252,194 88,194"/>
  <polygon class="stand ${mine ? 'mine' : ''}" points="30,52 80,74 80,186 30,208"/>
  <polygon class="stand" points="310,52 260,74 260,186 310,208"/>
  <rect class="pitch" x="92" y="74" width="156" height="112" rx="3"/>
  <g class="lines"><rect x="98" y="80" width="144" height="100"/><line x1="170" y1="80" x2="170" y2="180"/><circle cx="170" cy="130" r="14"/><rect x="98" y="108" width="20" height="44"/><rect x="222" y="108" width="20" height="44"/></g>
  <text class="lbl" x="170" y="51">North stand</text><text class="lbl" x="170" y="218">South stand</text>
  <text class="lbl" x="55" y="134" transform="rotate(-90 55 130)">West stand${mine ? ' · 118' : ''}</text><text class="lbl" x="285" y="134" transform="rotate(90 285 130)">East stand</text>
  ${M.map(([t, x, y, l]) => `<g class="mk" data-mk="${t}"><circle cx="${x}" cy="${y}" r="${t === 'gate' ? 11 : 9.5}" fill="${col[t]}"/>${glyph[t] ? `<g transform="translate(${x - 6.5} ${y - 6.5}) scale(.54)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[glyph[t]]}</g>` : `<text x="${x}" y="${y + 0.5}" style="font-size:${t === 'gate' ? 11 : 7.5}px">${t === 'wc' ? 'WC' : l}</text>`}</g>`).join('')}
</svg></div>`;
  }

  function rStadium() {
    return `<div class="wrap">
${head('Find <em>your way.</em>', { eyebrow: 'Stadium guide · illustrative' })}
${note('Illustrative map. The venue’s approved, versioned plan replaces it before anyone relies on it.')}
<div class="chips" role="group" aria-label="Show on the map" style="margin-top:14px">${[['all', 'Everything'], ['gate', 'Gates'], ['food', 'Food'], ['wc', 'Toilets'], ['aid', 'First aid'], ['access', 'Accessible'], ['help', 'Help points']].map(([k, t], i) => `<button type="button" class="chip tap" data-act="mapFilter" data-arg="${k}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>
<div style="margin-top:12px">${stadiumMap()}</div>

${state.ticketLinked ? `${sec('Your seat', { note: 'Sample ticket. Gate and seat come from the official seller once linked.' })}
<section class="card"><div class="ph a7682" style="aspect-ratio:16/9;background-position:center 35%" role="img" aria-label="${esc(alt('7682'))}"></div><div class="card-pad">
<ol class="list" style="background:none;box-shadow:none">${[['gate', 'Gate C', 'South-east corner'], ['stadium', 'Block 118', 'West stand, lower tier'], ['seat', 'Row 14, seat 22', 'Follow the row numbers up from the pitch']].map(([i, t, s]) => row({ icon: i, soft: true, t, s })).join('')}</ol></div></section>`
      : `<div style="margin-top:14px"><button type="button" class="card card-pad tap" style="width:100%;text-align:left;display:flex;gap:14px;align-items:center" data-go="matchday"><span class="ic lg soft">${ic('seat')}</span><span><b class="hd">Link your ticket to see your seat</b><br><span class="muted sub">Your gate, block, row and seat appear here.</span></span></button></div>`}

${sec('Finding your way')}
<div class="rail" tabindex="0" role="region" aria-label="Finding your way">
  <figure class="card media" style="margin:0">${ph('7685', 'port')}<figcaption class="mb"><h3>Use the gate on your ticket</h3><p>Signs list the gates and sections from the concourse.</p></figcaption></figure>
  <figure class="card media" style="margin:0">${ph('7682', 'port')}<figcaption class="mb"><h3>Follow the section numbers</h3><p>Pillars show which sections are on each side.</p></figcaption></figure>
  <figure class="card media" style="margin:0">${ph('7707', 'port')}<figcaption class="mb"><h3>Ask at an information desk</h3><p>People who can help, at every main entrance.</p></figcaption></figure>
</div>

${sec('Live queue times')}
<section class="card card-pad"><div style="display:flex;gap:12px;align-items:center"><span class="ic lg soft">${ic('clock')}</span><div><b class="hd">Not connected</b><p class="muted sub">Wait times show only with live venue data, a timestamp and how sure the estimate is. Until then: arrive early.</p></div></div></section>

${sec('Services')}
${list([
      row({ icon: 'cross', c: '#c0352b', t: 'First aid', s: 'North and south concourses', act: 'mapShow', arg: 'aid' }),
      row({ icon: 'info', c: '#6b21a8', t: 'Help points', s: 'Stewards and information desks', act: 'mapShow', arg: 'help' }),
      row({ icon: 'wc', c: '#2563eb', t: 'Toilets', s: 'Every stand', act: 'mapShow', arg: 'wc' }),
      row({ icon: 'food', c: '#c27a00', t: 'Food and drink', s: 'East and west concourses', go: 'food' }),
      row({ icon: 'access', c: '#0f766e', t: 'Accessible entrance', s: 'Step-free, with stewards', go: 'access' }),
      row({ icon: 'family', c: '#b58500', t: 'Family meeting point', s: 'Ask any steward', go: 'access' }),
    ])}
${footNote()}
</div>`;
  }

  function rTravel() {
    return `${immersive('7683', { pos: '45% center', eyebrow: 'Getting there · Loftus Versfeld', title: 'Arrive<br><em>relaxed.</em>', sub: HOME_VENUE, actions: `<a class="btn btn-primary tap" href="https://maps.google.com/?q=Loftus+Versfeld+Stadium+Pretoria" target="_blank" rel="noopener">${ic('map')}Open in Maps</a><button type="button" class="btn btn-glass tap" data-go="planner">Add to my plan</button>` })}<div class="wrap">
${sec('Ways to get there', { note: 'Details come from the venue’s approved transport plan. Sundowns One never guesses a route or a car park.' })}
${list([
      row({ icon: 'car', c: '#2563eb', t: 'Driving and parking', s: 'Approved parking areas and when they open', act: 'travelInfo', arg: 'car' }),
      row({ icon: 'bus', c: '#0f766e', t: 'Shuttles and park-and-ride', s: 'Club-approved operators only', act: 'travelInfo', arg: 'shuttle' }),
      row({ icon: 'bus', c: '#11643f', t: 'Public transport', s: 'Routes and stops near the stadium', act: 'travelInfo', arg: 'public' }),
      row({ icon: 'car', c: '#b58500', t: 'Taxis and e-hailing', s: 'Pick-up and drop-off points', act: 'travelInfo', arg: 'taxi' }),
      row({ icon: 'walk', c: '#c2410c', t: 'Walking', s: 'Pedestrian routes from nearby areas', act: 'travelInfo', arg: 'walk' }),
      row({ icon: 'access', c: '#6b21a8', t: 'Accessible drop-off', s: 'Closest to the accessible entrance', go: 'access' }),
    ])}
${sec('After the final whistle')}
<section class="card card-pad"><p>Crowds take time to clear. Agree a meeting point with your crew before kick-off, and check the club’s matchday notice for road closures. Departure updates appear here only when the venue sends them.</p></section>
${footNote()}
</div>`;
  }

  function rFood() {
    const items = Object.values(state.tray).reduce((a, b) => a + b, 0);
    const order = state.order;
    return `${immersive('7684', { pos: 'center 35%', eyebrow: 'Food and drink', title: 'Eat well.<br><em>Miss nothing.</em>', sub: 'See what’s on, and order ahead where it’s offered.' })}<div class="wrap">
${sec('Order ahead · pilot')}
${steps('7725')}
<div style="margin-top:14px">${note('Order-ahead runs only at counters that can take payment, give refunds and hand over orders. You can always order at the counter.')}</div>
${sec('Menu', { note: 'Sample menu. Items, prices and stock come from the counter’s till system.' })}
<ul class="list">${MENU.map(([k, t]) => `<li><div class="row"><span class="rt"><b>${t}</b><small>Price at the till</small></span>${state.tray[k] ? `<span class="rv num" aria-label="${state.tray[k]} in your order">×${state.tray[k]}</span>` : ''}<button type="button" class="btn btn-tinted btn-sm tap" data-act="addFood" data-arg="${k}" aria-label="Add ${esc(t)}">${ic('plus')}</button></div></li>`).join('')}</ul>
${order ? `<section class="card card-pad" style="margin-top:14px" aria-live="polite"><div style="display:flex;justify-content:space-between;align-items:center"><p class="eyebrow">Demo order ${order.ref}</p>${SAMPLE}</div><h3>${order.stage === 2 ? 'Ready to collect' : order.stage === 1 ? 'Being prepared' : 'Order received'}</h3><p class="muted">${order.stage === 2 ? 'Collect at counter 4, east concourse (sample).' : 'We’ll tell you when it’s ready.'}</p><div class="bar" style="margin-top:12px" role="img" aria-label="Step ${order.stage + 1} of 3"><i style="width:${((order.stage + 1) / 3) * 100}%"></i></div><div class="btns"><button type="button" class="btn btn-plain btn-sm tap" data-act="clearOrder">Done</button></div></section>`
      : items ? `<div class="btns"><button type="button" class="btn btn-primary btn-block tap" data-act="placeOrder">Place demo order · ${items} ${items === 1 ? 'item' : 'items'}</button><button type="button" class="btn btn-plain btn-sm tap" data-act="clearTray">Clear</button></div><p class="list-foot">Demo only. Nothing is paid or sent.</p>` : ''}
${footNote()}
</div>`;
  }

  function rAccess() {
    return `${immersive('7691', { pos: '40% center', eyebrow: 'Accessibility and family', title: 'Get in,<br><em>your way.</em>', sub: 'Step-free routes, stewards who help, and a person to talk to.' })}<div class="wrap">
${sec('Accessibility', { note: 'Services are confirmed with the venue and tested with supporters who use them before launch.' })}
${list([
      row({ icon: 'access', c: '#0f766e', t: 'Accessible entrance', s: 'Step-free, with stewards on hand' }),
      row({ icon: 'walk', c: '#2563eb', t: 'Step-free routes', s: 'From drop-off to your seat' }),
      row({ icon: 'seat', c: '#11643f', t: 'Wheelchair and companion seats', s: 'Book through the official seller' }),
      row({ icon: 'wc', c: '#6b21a8', t: 'Accessible toilets', s: 'Shown on the stadium map' }),
      row({ icon: 'phone', c: '#b58500', t: 'Arrange assistance', s: 'A person confirms it with you', act: 'human', arg: 'access' }),
    ])}
${sec('Families')}
${list([
      row({ icon: 'star', c: '#c2410c', t: 'First match guide', s: 'What to expect, step by step', act: 'firstMatch' }),
      row({ icon: 'family', c: '#b58500', t: 'Family meeting point', s: 'Agree it before you go in' }),
      row({ icon: 'warn', c: '#c0352b', t: 'If a child gets lost', s: 'Tell the nearest steward straight away' }),
      row({ icon: 'shield', c: '#11643f', t: 'Child-safe by design', s: 'No ads aimed at children. Grown-ups manage settings.' }),
    ])}
${footNote()}
</div>`;
  }

  function rPassport() {
    const b = balance();
    const v = verified();
    const stamps = [
      ['Home match', v >= 1], ['Home match', v >= 2], ['Home match', v >= 3], ['Away day', false],
      ['Cup tie', false], ['Sundowns Ladies', false], ['Community day', false], ['Heritage quiz', state.quiz.done],
    ];
    return `${immersive('7699', { pos: 'center 30%', top: `<span></span><span class="imm-tools"><button type="button" class="nav-btn glass tap" data-act="passportRules" aria-label="Passport rules">${ic('info')}</button></span>`, eyebrow: 'Yellow Nation Passport', title: 'Belonging is<br><em>the reward.</em>', sub: 'Stamps and points for turning up and taking part.' })}<div class="wrap">
${memberCard()}

${sec('Stamps', { note: 'Each stamp is for something you did: a verified match, a community day, a quiz.' })}
<div class="stamps">${stamps.map(([t, got]) => `<div class="stamp ${got ? 'got' : ''}" role="img" aria-label="${t}: ${got ? 'collected' : 'not yet'}"><span>${got ? ic('star') : ''}${t}</span></div>`).join('')}</div>

${sec('How it works')}
${steps('7719')}

${sec('Rewards', { note: 'Sample rewards. Real ones are club-approved or partner-funded, with stock and terms.' })}
<ul class="list">${REWARDS.map((r) => { const got = state.ledger.some((e) => e.id === 'redeem-' + r.id); return `<li><div class="row"><div class="ph a${r.img}" style="width:56px;height:56px;border-radius:12px;flex:none" aria-hidden="true"></div><span class="rt"><b>${r.t}</b><small>${r.s}</small></span>${got ? pill('Redeemed', 'ok') : `<button type="button" class="btn ${b >= r.pts ? 'btn-primary' : 'btn-tinted'} btn-sm tap num" data-act="redeem" data-arg="${r.id}" aria-label="Redeem ${esc(r.t)} for ${r.pts} points">${r.pts}</button>`}</div></li>`; }).join('')}</ul>

${sec('Member benefits')}
${steps('7720')}
<section class="card card-pad" style="margin-top:14px">${state.membershipLinked ? `<p class="eyebrow">Membership · sample</p><h3>Linked</h3><p class="muted">Your benefits show here from the club’s membership system. Nothing about your membership changes in Sundowns One.</p><div class="btns"><button type="button" class="btn btn-plain btn-sm tap" data-act="linkMember">Unlink</button></div>` : `<p class="eyebrow">Membership</p><h3>Already a member?</h3><p class="muted">Link your membership to see your benefits here. It stays with the club’s membership system.</p><div class="btns"><button type="button" class="btn btn-primary btn-sm tap" data-act="linkMember">Link membership (demo)</button></div>`}</section>

${sec('Activity')}
<ul class="list">${ledger().map((e) => `<li><div class="row"><span class="rt"><b>${esc(e.t)}</b><small>${fmt(new Date(e.when), { day: 'numeric', month: 'short' })}${e.id.startsWith('s') ? ' · sample' : ''}</small></span><span class="rv num" style="color:${e.pts > 0 ? 'var(--ok)' : 'var(--label-2)'};font-weight:650">${e.pts > 0 ? '+' : '−'}${Math.abs(e.pts)}</span></div></li>`).join('')}</ul>
<p class="list-foot">Points come from verified attendance and approved activities. Never for just agreeing to marketing. Something missing? <a href="#help" data-act="human" data-arg="passport">Ask a person</a>.</p>
${footNote()}
</div>`;
  }

  function rFanZone() {
    const f = nextHome();
    const pr = state.prediction;
    const qz = state.quiz;
    const score = QUIZ.filter((q, i) => qz.answers[i] === q.c).length;
    return `${immersive('7689', { pos: '40% center', eyebrow: 'Fan Zone', title: 'Play along.<br><em>No betting.</em>', sub: 'Predict, quiz and take the stadium challenge. Bragging rights only.' })}<div class="wrap">

${sec('Predict the score', { note: `${esc(matchName(f))} · ${when(f)} · sample fixture` })}
<section class="card"><div class="ph a7693" style="aspect-ratio:16/8;background-position:center 30%" role="img" aria-label="${esc(alt('7693'))}"></div><div class="card-pad">
  <div class="board" style="margin-bottom:6px">
    <div>${badgeUs()}<p class="nm">${USS.men}</p></div>
    <div class="muted" style="font-weight:700">v</div>
    <div>${badgeThem(f)}<p class="nm">${esc(f.opp)}</p></div>
  </div>
  <div class="board">
    <div style="display:flex;justify-content:center"><span class="stepper" role="group" aria-label="${USS.men} goals"><button type="button" data-act="pred" data-arg="us:-1" aria-label="One goal fewer" ${pr.locked ? 'disabled' : ''}>${ic('minus')}</button><i></i><output class="num" aria-live="polite">${pr.us}</output><i></i><button type="button" data-act="pred" data-arg="us:1" aria-label="One goal more" ${pr.locked ? 'disabled' : ''}>${ic('plus')}</button></span></div>
    <div></div>
    <div style="display:flex;justify-content:center"><span class="stepper" role="group" aria-label="${esc(f.opp)} goals"><button type="button" data-act="pred" data-arg="them:-1" aria-label="One goal fewer" ${pr.locked ? 'disabled' : ''}>${ic('minus')}</button><i></i><output class="num" aria-live="polite">${pr.them}</output><i></i><button type="button" data-act="pred" data-arg="them:1" aria-label="One goal more" ${pr.locked ? 'disabled' : ''}>${ic('plus')}</button></span></div>
  </div>
  <div class="btns" style="justify-content:center">${pr.locked ? `${pill(`${ic('lock')}Locked in: ${pr.us}–${pr.them}`, 'ok')}<button type="button" class="btn btn-plain btn-sm tap" data-act="unlockPred">Change</button>` : '<button type="button" class="btn btn-primary tap" data-act="lockPred">Lock in my prediction</button>'}</div>
</div></section>

${sec('Club history quiz', { note: qz.done ? `You scored ${score} of ${QUIZ.length}. +20 Passport points, once.` : 'Three questions. Answers are on the club crest.' })}
<ul class="list">${QUIZ.map((q, i) => { const a = qz.answers[i]; return `<li><div class="row" style="display:block;padding:14px 16px"><b style="display:block;font-weight:600;margin-bottom:10px">${i + 1}. ${q.q}</b><div class="chips" role="group" aria-label="Answers to question ${i + 1}" style="flex-wrap:wrap;overflow:visible;margin:0;padding:0">${q.a.map((t, j) => { const chosen = a === j; const right = a != null && j === q.c; return `<button type="button" class="chip tap" data-act="quiz" data-arg="${i}:${j}" aria-pressed="${chosen}" ${a != null ? 'aria-disabled="true"' : ''} style="${right ? 'background:var(--ok);color:#fff;box-shadow:none' : chosen ? 'background:var(--danger);color:#fff;box-shadow:none' : ''}">${t}${right ? ' ✓' : ''}</button>`; }).join('')}</div>${a != null ? `<p class="cap ${a === q.c ? '' : 'muted'}" style="margin-top:8px">${a === q.c ? 'Correct.' : `The answer is ${q.a[q.c]}.`}</p>` : ''}</div></li>`; }).join('')}</ul>

${sec('Stadium QR challenge')}
<button type="button" class="pcard r-mid tap" data-act="qr">${ph('7696')}<div class="body"><div style="display:flex;gap:6px;margin-bottom:8px">${pill(`${ic('qr')}No app needed`)}</div><h3 class="t2">Scan, shoot, score.</h3><p>Scan the code on the concourse and take the penalty challenge in your phone’s browser.</p></div></button>

${sec('How challenges work')}
${steps('7722')}

${sec('More to play')}
${list([
      row({ go: 'live', icon: 'trophy', c: '#c2410c', t: 'Player of the Match', s: 'One supporter, one vote', seg: 'live:vote' }),
      row({ act: 'fanMoment', icon: 'camera', c: '#2563eb', t: 'Share a matchday photo', s: 'A person checks it before anyone sees it' }),
    ])}
${footNote()}
</div>`;
  }

  function rWatch() {
    const item = (w) => `<button type="button" class="card media tap" data-act="watchItem" data-arg="${w.id}" data-type="${w.type}">${ph(w.img)}<div class="mb"><p class="eyebrow">${w.type === 'audio' ? 'Listen' : 'Watch'} · ${w.len}</p><h3>${w.t}</h3><p>${w.rights}</p></div></button>`;
    return `${immersive('7697', { pos: '45% center', eyebrow: 'Watch and Listen · Sundowns TV', title: 'Inside<br><em>the studio.</em>', sub: 'The week ahead, with the people who make the club. Sample content.', actions: `<button type="button" class="btn btn-primary tap" data-act="watchItem" data-arg="w1">${ic('play')}Watch now</button>` })}<div class="wrap">
${sec('Latest')}<div>${seg('watch', [['all', 'All'], ['video', 'Video'], ['audio', 'Audio']], 'Show')}</div>
<div class="grid2 wide3" style="margin-top:14px" id="watchGrid">${WATCH.map((w) => `<div data-type="${w.type}" ${(state.segs.watch || 'all') === 'all' || state.segs.watch === w.type ? '' : 'hidden'}>${item(w)}</div>`).join('')}</div>
<div style="margin-top:14px">${note('Every video and clip carries its rights before it goes live. Captions and transcripts come as standard, and low-data audio is there for matchdays.', 'info')}</div>
${footNote()}
</div>`;
  }

  function rCommunity() {
    const f = nextHome();
    const away = FIXTURES.find((x) => !x.home && x.team === 'men');
    return `${immersive('7692', { pos: '35% center', eyebrow: 'Community', title: 'Different places.<br><em>One family.</em>', sub: 'Branches, watch parties, away days and Masandawana around the world.' })}<div class="wrap">
<div style="margin-top:16px">${seg('community', [['near', 'Near you'], ['global', 'Global'], ['away', 'Away days']], 'Community')}</div>

<div data-panel-of="community" data-panel="near" ${panelHidden('community', 'near', 'near')}>
${sec('Supporter branches', { note: 'Sample branches. A branch appears once the club verifies it and its public contact.' })}
${list(BRANCHES.map(([n, p]) => row({ icon: 'people', soft: true, t: `${n} branch`, s: `${p} · sample`, act: 'branch', arg: n })))}
${sec('Watch parties')}
<section class="card media">${ph('7678')}<div class="mb"><p class="eyebrow">Can’t make it to the stadium?</p><h3>Watch with your people</h3><p>Club-approved screenings near you appear here, with times and access details.</p></div></section>
</div>

<div data-panel-of="community" data-panel="global" ${panelHidden('community', 'global', 'near')}>
<section class="pcard r-mid" style="margin-top:14px" aria-label="Global Masandawana">${ph('7694')}<div class="body"><p class="eyebrow">Global Masandawana</p><h2 class="t1">Different places. One family.</h2></div></section>
${sec('Kick-off where you are', { note: `${esc(matchName(f))} · sample fixture` })}
<ul class="list">${[['Pretoria', TZ], ...CHAPTERS].map(([c, tz]) => `<li><div class="row"><span class="rt"><b>${c}</b><small>${tz === TZ ? 'Home' : 'Chapter · sample'}</small></span><span class="rv num">${fmtIn(f.date, tz, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span></div></li>`).join('')}</ul>
<p class="list-foot">Times follow each city’s own clock, including daylight saving.</p>
</div>

<div data-panel-of="community" data-panel="away" ${panelHidden('community', 'away', 'near')}>
${sec('Next away day', { note: 'Sample fixture. Travel only with club-approved operators.' })}
${away ? `<section class="card next"><div class="teams">${badgeThem(away)}<span class="vs">v</span>${badgeUs()}</div><h3 class="t3">${esc(matchName(away))}</h3><div class="meta"><span>${ic('calendar')}${when(away)} · ${kick(away)}</span><span>${ic('flag')}${away.comp}</span></div><div class="btns"><button type="button" class="btn btn-primary btn-sm tap" data-act="awayInterest">${state.interests.includes('away') ? `${ic('check')}Interested` : 'I’m interested'}</button><button type="button" class="btn btn-tinted btn-sm tap" data-act="tickets" data-arg="${away.id}">Tickets</button></div></section>` : ''}
<p class="list-foot">Interest helps the club plan transport. It isn’t a booking, and your location is never shared.</p>
</div>

${sec('Bring your crew')}
${steps('7721')}
<div class="btns"><button type="button" class="btn btn-primary tap" data-act="invite">${ic('share')}Invite a friend</button></div>
<p class="list-foot">When your friend’s entry is verified, you both earn Passport points. Their details stay theirs.</p>

${sec('Supporter Voice')}
<section class="card card-pad">${state.survey ? `<p class="eyebrow">Thank you</p><h3>Your answer is in</h3><p class="muted">You rated your last matchday ${state.survey} out of 5. Every quarter the club says what it changed.</p>` : `<p class="eyebrow">Quick question</p><h3>How was your last matchday?</h3><div class="chips" role="group" aria-label="Rate 1 to 5" style="margin-top:12px;overflow:visible;padding:0;margin-inline:0">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip tap num" style="min-width:48px" data-act="survey" data-arg="${n}">${n}</button>`).join('')}</div>`}</section>
<section class="card card-pad" style="margin-top:12px"><p class="eyebrow">You said, we did · sample</p><p style="margin-top:6px"><b>You said</b> getting out after the match takes too long.</p><p style="margin-top:6px"><b>We did</b> put exit routes and departure updates in the app.</p></section>
${footNote()}
</div>`;
  }

  function rExperiences() {
    return `${immersive('7705', { pos: '30% center', eyebrow: 'Experiences', title: 'Matchday,<br><em>upgraded.</em>', sub: 'A lounge seat, a proper meal and the whole pitch in view.', actions: `<button type="button" class="btn btn-primary tap" data-act="experience" data-arg="hosp">See hospitality${ic('arrowR')}</button>` })}<div class="wrap">
<div style="margin-top:14px">${note('Registering interest isn’t a booking. Dates, prices and availability come from the booking provider.')}</div>
${sec('Choose an experience')}
<div class="grid2">${EXPERIENCES.slice(1).map((e) => `<button type="button" class="card media tap" data-act="experience" data-arg="${e.id}">${ph(e.img, 'sq')}<div class="mb"><p class="eyebrow">${e.k}</p><h3>${e.t}</h3>${state.interests.includes(e.id) ? `<p>${pill(`${ic('check')}Interested`, 'ok')}</p>` : ''}</div></button>`).join('')}</div>
${footNote()}
</div>`;
  }

  function rStore() {
    return `${immersive('7698', { pos: '40% 30%', eyebrow: 'Official Store', title: 'Wear<br><em>the yellow.</em>', sub: 'Kits, training wear and gifts from the official store.', actions: `<button type="button" class="btn btn-primary tap" data-act="storeOpen">Shop the official store${ic('arrowR')}</button>` })}<div class="wrap">
<div class="chips" role="group" aria-label="Categories" style="margin-top:16px">${['Kits', 'Training', 'Lifestyle', 'Kids', 'Accessories', 'Gifts'].map((c) => `<button type="button" class="chip tap" data-act="storeOpen" data-arg="${c}">${c}</button>`).join('')}</div>
<div style="margin-top:14px">${note('Products, prices, member discounts and stock come from the official store. Sundowns One doesn’t take payment.')}</div>
${sec('On matchday')}
${list([
      row({ icon: 'bag', c: '#7c3aed', t: 'Collect at the stadium', s: 'Where store collection runs on matchdays', act: 'storeOpen', arg: 'Matchday collection' }),
      row({ icon: 'bell', c: '#b58500', t: 'New kit alerts', s: 'Choose this under Club news and stories', go: 'profile' }),
    ])}
${footNote()}
</div>`;
  }

  function rPartners() {
    const props = [
      ['Matchday Experience Partner', 'Makes the planner, travel and arrival easier.', 'car', '#2563eb'],
      ['Passport Partner', 'Funds rewards you earn by turning up.', 'star', '#b58500'],
      ['12th Player Partner', 'Powers the predictor, quizzes and stadium QR games.', 'trophy', '#c2410c'],
      ['Family Matchday Partner', 'Welcomes families to their first match.', 'family', '#0f766e'],
      ['Global Masandawana Partner', 'Connects supporters abroad.', 'globe', '#11643f'],
    ];
    return `<div class="wrap">
${head('Partner <em>World</em>', { eyebrow: 'Partners · to be confirmed' })}
${note('No partner is named until a contract is signed. These are the kinds of useful things a partner could fund.')}
<section class="card media" style="margin-top:14px">${ph('7700')}<div class="mb"><p class="eyebrow">Member benefit · partner TBC</p><h2>Your membership, at the till</h2><p>Show your Passport and a partner-funded benefit applies. A claim only counts once it’s actually redeemed.</p></div></section>
${sec('What partners could make possible')}
${list(props.map(([t, s, i, c]) => row({ icon: i, c, t, s })))}
${sec('Your details stay yours')}
<section class="card card-pad"><div style="display:flex;gap:12px"><span class="ic lg soft">${ic('shield')}</span><p>Partners see totals, never your name or contact details. Partner offers reach you only if you choose them, channel by channel, in <a href="#profile" data-go="profile">your settings</a>.</p></div></section>
${footNote()}
</div>`;
  }

  function rImpact() {
    return `${immersive('7701', { pos: 'center 40%', eyebrow: 'Club Impact', title: 'Football that<br><em>builds futures.</em>', sub: 'Programmes in schools, townships and communities.' })}<div class="wrap">
${sec('Programmes', { note: 'Outcomes are published once each programme owner has verified them.' })}
<div class="grid2">
  <section class="card media">${ph('7704', 'sq')}<div class="mb"><p class="eyebrow">Women and girls</p><h3>Room to play, and to lead</h3></div></section>
  <section class="card media">${ph('7692', 'sq')}<div class="mb"><p class="eyebrow">Community</p><h3>Matchdays that bring people together</h3></div></section>
</div>
${list([
      row({ icon: 'ball', c: '#11643f', t: 'Grassroots football', s: 'Coaching in local communities' }),
      row({ icon: 'doc', c: '#2563eb', t: 'Education', s: 'Learning on and off the pitch' }),
      row({ icon: 'heart', c: '#c0352b', t: 'Volunteer', s: 'Register interest to help', act: 'volunteer' }),
    ], '').replace('<ul class="list ', '<ul style="margin-top:14px" class="list ')}
${footNote()}
</div>`;
  }

  // Ask Sundowns: answers only from approved app content, always with a source;
  // anything about money, entry, safety, accessibility or personal data goes to a person.
  const KB = [
    { k: /wheelchair|accessib|disab|step.?free/i, a: 'There’s a step-free accessible entrance with stewards to help. For a specific arrangement, a person confirms it with you.', src: 'Accessibility and family', go: 'access' },
    { k: /\b(store|shop|jersey|jerseys|kits?|merch|merchandise|scarf|scarves)\b/i, a: 'The Official Store has kits, training wear and gifts. Products, prices and stock come from the official store.', src: 'Official Store', go: 'store' },
    { k: /ticket|\bbuy\b|\bbook|\bseats?\b|sold out/i, a: 'Tickets come only from the official ticket seller. Sundowns One sends you there and, once you link your ticket, shows your gate, block, row and seat. Your entry code stays in the seller’s wallet.', src: 'Matchday guide · Tickets', go: 'matchday' },
    { k: /gate|entrance|enter|turnstile|get in/i, a: 'Use the gate on your ticket. The stadium guide shows every gate, and there’s an information desk at each main entrance.', src: 'Stadium guide · Gates', go: 'stadium' },
    { k: /\b(park|parking|car|drive|driving|taxi|uber|bolt|transport|bus|train|shuttle)\b|get there|directions?/i, a: 'Getting there covers driving and parking, approved shuttles, public transport and accessible drop-off. It all comes from the venue’s transport plan.', src: 'Getting there', go: 'travel' },
    { k: /\b(food|eat|drinks?|order|menu|hungry)\b/i, a: 'Food and drink shows what’s on. Order-ahead is a pilot at some counters, and you can always order at the counter.', src: 'Food and drink', go: 'food' },
    { k: /point|passport|reward|stamp|redeem/i, a: 'You earn Passport points for verified attendance and approved activities, like the club history quiz. Never for just agreeing to marketing.', src: 'Passport rules', go: 'passport' },
    { k: /\bmember/i, a: 'Membership stays with the club’s membership system. Link it in Passport to see your benefits here.', src: 'Passport · Member benefits', go: 'passport' },
    { k: /kick.?off|when|fixture|next match|play next|what time/i, a: () => { const f = nextHome(); return `In this prototype the next home match is ${matchName(f)}, ${when(f, { weekday: 'long', day: 'numeric', month: 'long' })} at ${kick(f)}. That’s a sample fixture.`; }, src: 'Fixtures (sample)', go: 'matches' },
    { k: /found|history|1970|motto|sky|crest|nickname|masandawana/i, a: 'The club crest carries the year 1970 and the motto “The Sky is the Limit”. Supporters are the Yellow Nation, or Masandawana.', src: 'Club crest', go: 'fanzone' },
    { k: /watch|stream|tv|highlight|podcast|listen|radio/i, a: 'Watch and Listen has Sundowns TV, podcasts and low-data matchday radio, each with its rights checked first.', src: 'Watch and Listen', go: 'watch' },
    { k: /branch|supporter club|community|watch party|abroad|overseas|london|global/i, a: 'Community lists verified branches, watch parties, away days and Global Masandawana, with kick-off in your own time zone.', src: 'Community', go: 'community' },
  ];
  const HANDOFF = /refund|money back|charged|payment|paid|card|lost (my )?ticket|stolen|scam|dispute|denied|refused|turned away|emergency|injur|hurt|medical|ambulance|police|unsafe|lost child|lost (my )?(kid|son|daughter)|missing|safeguard|abuse|harass|account|password|log ?in|my data|delete|privacy|complain/i;
  const DANGER = /emergency|injur|hurt|medical|ambulance|police|unsafe|lost child|missing|abuse|harass/i;
  let chat = [{ who: 'bot', text: 'Hi. I can find answers in the club’s matchday and app information, and I’ll show you where each answer comes from. For money, entry problems, safety or your personal details, I’ll put you through to a person.' }];
  function answer(q) {
    if (HANDOFF.test(q)) return { who: 'bot', handoff: true, danger: DANGER.test(q), text: DANGER.test(q) ? 'If anyone is in danger, tell the nearest steward now, or call 112 from a mobile. I’ll put you through to a person for the rest.' : 'That needs a person. I can’t handle payments, refunds, entry problems, safety or personal data.' };
    const hit = KB.find((k) => k.k.test(q));
    if (!hit) return { who: 'bot', unknown: true, text: 'I don’t have a checked answer for that, and I’d rather not guess.' };
    return { who: 'bot', text: typeof hit.a === 'function' ? hit.a() : hit.a, src: hit.src, go: hit.go };
  }
  function chatHTML() {
    return chat.map((m) => {
      if (m.who === 'me') return `<div class="msg me">${esc(m.text)}</div>`;
      let extra = '';
      if (m.src) extra = `<div class="src">${ic('doc')}<span>Source: ${esc(m.src)} · updated today (sample)</span></div><button type="button" class="btn btn-tinted btn-sm tap" style="margin-top:8px" data-go="${m.go}">Open ${esc(ROUTES[m.go].title)}</button>`;
      if (m.handoff) extra = `${m.danger ? '<div class="btns" style="margin-top:10px"><a class="btn btn-danger btn-sm" href="tel:112">' + ic('phone') + 'Call 112</a></div>' : ''}<button type="button" class="btn btn-primary btn-sm tap" style="margin-top:10px" data-act="human" data-arg="ask">${ic('person')}Talk to a person</button>`;
      if (m.unknown) extra = `<button type="button" class="btn btn-tinted btn-sm tap" style="margin-top:10px" data-act="human" data-arg="ask">Ask a person instead</button>`;
      return `<div class="msg bot">${esc(m.text)}${extra}</div>`;
    }).join('');
  }
  function rAsk() {
    return `<div class="wrap">
${head('Ask <em>Sundowns</em>', { eyebrow: 'Answers with sources' })}
<section class="card media">${ph('7707')}<div class="mb"><p class="eyebrow">A guide, not the final word</p><h2>Answers with their source, or a person</h2><p>Every answer says where it came from. If there isn’t a checked answer, it says so.</p></div></section>
<div class="chips" role="group" aria-label="Try asking" style="margin-top:16px">${['How do I get tickets?', 'Where is the accessible entrance?', 'When is the next match?', 'How do Passport points work?', 'Can I get a refund?'].map((q) => `<button type="button" class="chip tap" data-act="askChip" data-arg="${esc(q)}">${q}</button>`).join('')}</div>
<div class="chat" id="chatLog" aria-live="polite" style="margin-top:16px">${chatHTML()}</div>
<form class="composer" data-form="ask"><label class="vh" for="askInput">Ask a question</label><input id="askInput" autocomplete="off" enterkeyhint="send" placeholder="Ask about matchday, tickets, the Passport…" maxlength="200"><button type="submit" aria-label="Send">${ic('send')}</button></form>
<p class="list-foot">Prototype: answers come from a small set of approved app content, not a live AI service.</p>
</div>`;
  }

  function rHelp() {
    return `<div class="wrap">
${head('Help is <em>close.</em>', { eyebrow: 'Help and safety' })}
<section class="card card-pad" style="background:var(--danger-fill);box-shadow:none" aria-labelledby="emT"><div style="display:flex;gap:12px"><span class="ic lg" style="--c:#c0352b">${ic('warn')}</span><div><h2 id="emT" class="t3">In an emergency</h2><p style="margin-top:4px">Tell the nearest steward or go to a help point. From a mobile, call 112.</p></div></div><div class="btns"><a class="btn btn-danger btn-sm" href="tel:112">${ic('phone')}112</a><a class="btn btn-danger btn-sm" href="tel:10177">Ambulance 10177</a><a class="btn btn-danger btn-sm" href="tel:10111">Police 10111</a></div></section>
<p class="list-foot">Safety messages never depend on your marketing choices.</p>
${sec('At the stadium')}
<section class="card media">${ph('7707')}<div class="mb"><h3>Information desks and stewards</h3><p>At every main entrance, and on every concourse.</p></div></section>
${sec('Get help from a person')}
${list([
      row({ icon: 'ticket', c: '#0c3e2e', t: 'Ticket or entry problem', s: 'Including a ticket that won’t scan', act: 'human', arg: 'entry' }),
      row({ icon: 'access', c: '#0f766e', t: 'Accessibility assistance', act: 'human', arg: 'access' }),
      row({ icon: 'family', c: '#b58500', t: 'Lost child or family meeting point', s: 'Tell any steward straight away', act: 'human', arg: 'family' }),
      row({ icon: 'search', c: '#2563eb', t: 'Lost and found', act: 'human', arg: 'lost' }),
      row({ icon: 'bubble', c: '#6b21a8', t: 'Ask Sundowns', s: 'Quick answers, with sources', go: 'ask' }),
    ])}
${footNote()}
</div>`;
  }

  const channelsOn = (p) => CHANNELS.filter(([c]) => state.consent[p][c]).map(([, t]) => t.replace(' notifications', ''));
  function rProfile() {
    state.segs.appearance = state.appearance;
    return `<div class="wrap">
${head('Your <em>choices.</em>', { eyebrow: 'You · settings and privacy' })}
<section class="card card-pad" style="display:flex;gap:14px;align-items:center"><span class="avatar" style="width:56px;height:56px;margin:0">${ic('person')}</span><div style="flex:1"><h2 class="t3">Browsing as a guest</h2><p class="muted sub">Everything public works without an account. Sign in only to link tickets or membership.</p></div></section>

${sec('Teams you follow')}
<ul class="list">${Object.entries(TEAMS).map(([k, t]) => `<li><label class="row"><span class="rt"><b>${US[k]}</b><small>${t}</small></span><input type="checkbox" role="switch" class="switch" data-change="team" data-arg="${k}" ${state.teams[k] ? 'checked' : ''}></label></li>`).join('')}</ul>

${sec('Messages you’ve chosen', { note: 'Everything starts off. Choose what you want, and where. Ticket and safety messages for a match you’re going to are separate.' })}
${list(PURPOSES.map((p) => row({ act: 'consent', arg: p.k, icon: p.k === 'partners' ? 'gift' : p.k === 'club' ? 'doc' : 'bell', c: p.k === 'partners' ? '#7c3aed' : p.k === 'club' ? '#2563eb' : '#c2410c', t: p.t, v: channelsOn(p.k).join(', ') || 'Off' })))}
${state.consentLog.length ? `<p class="list-foot">Your last change: ${esc(state.consentLog[state.consentLog.length - 1].label)}, ${fmt(new Date(state.consentLog[state.consentLog.length - 1].t), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}. <button type="button" class="btn-plain" style="padding:0;min-height:0;color:var(--tint)" data-act="consentLog">See every change</button></p>` : ''}

${sec('Display')}
<ul class="list">
  <li><div class="row" style="display:block"><b style="display:block;font-weight:500;margin-bottom:10px">Appearance</b>${seg('appearance', [['dark', 'Dark'], ['light', 'Light'], ['system', 'Automatic']], 'Appearance').replace('data-seg="appearance"', 'data-seg="appearance" data-apply="appearance"')}</div></li>
  <li><div class="row" style="display:block"><b style="display:block;font-weight:500;margin-bottom:10px">Text size</b>${seg('textSize', [['default', 'Default'], ['large', 'Large'], ['xl', 'Larger']], 'Text size').replace('data-seg="textSize"', 'data-seg="textSize" data-apply="textSize"')}</div></li>
</ul>

${sec('Data and connection')}
<section class="card"><div class="ph a7713" style="aspect-ratio:16/9;background-position:center 30%" role="img" aria-label="${esc(alt('7713'))}"></div>
<ul class="list" style="border-radius:0">
  <li><label class="row has-ic"><span class="ic" style="--c:#0f766e">${ic('gauge')}</span><span class="rt"><b>Low-data mode</b><small>Hides photos and keeps the text. Good for patchy signal.</small></span><input type="checkbox" role="switch" class="switch" data-change="lowData" ${state.lowData ? 'checked' : ''}></label></li>
</ul></section>
${CONFIG.pwa === 'on' ? '<p class="list-foot">Once opened, this app keeps working offline.</p>' : ''}

${sec('Language')}
<ul class="list">${[['English', true], ['isiZulu', false], ['Sepedi', false], ['Setswana', false], ['Xitsonga', false], ['Afrikaans', false]].map(([l, on]) => `<li><div class="row"><span class="rt"><b>${l}</b>${on ? '' : '<small>Translation in review</small>'}</span>${on ? ic('check', 'chev') : ''}</div></li>`).join('')}</ul>
<p class="list-foot">Safety, ticket and legal wording is checked by a person in every language before it ships.</p>

${sec('Privacy')}
<section class="card media">${ph('7702')}<div class="mb"><h3>Your data stays yours</h3><p>This prototype keeps everything on this phone. Nothing is sent anywhere.</p></div></section>
${list([
      row({ icon: 'download', c: '#2563eb', t: 'Get a copy of my data', act: 'human', arg: 'data' }),
      row({ icon: 'x', c: '#c0352b', t: 'Delete my data', act: 'human', arg: 'data' }),
      row({ icon: 'reset', c: '#6b7280', t: 'Reset this demo', s: 'Clears everything saved on this phone', act: 'resetDemo' }),
    ])}
${sec('About')}
${list([row({ go: 'about', icon: 'info', c: '#0c3e2e', t: 'About this concept' }), row({ go: 'assets', icon: 'photos', c: '#b58500', t: 'Asset library', s: `${ASSETS.assets.length} images and their status` })])}
${footNote()}
</div>`;
  }

  function rMore() {
    return `<div class="wrap">
${head('<em>More</em>', { eyebrow: 'All of Sundowns One' })}
<button type="button" class="card get-app tap" data-act="install"><span class="ic lg" style="--c:#0c3e2e">${crest('crest')}</span><span class="rt"><b>Get Sundowns One</b><small>Add it to your home screen, or share it on WhatsApp</small></span>${ic('chevR', 'chev')}</button>
<div class="spacer"></div><div class="spacer"></div>
${list([
      row({ go: 'fanzone', icon: 'trophy', c: '#c2410c', t: 'Fan Zone', s: 'Predictor, quiz and stadium games' }),
      row({ go: 'watch', icon: 'play', c: '#0c3e2e', t: 'Watch and Listen', s: 'Sundowns TV, podcasts and radio' }),
      row({ go: 'community', icon: 'people', c: '#0f766e', t: 'Community', s: 'Branches, away days and Global Masandawana' }),
      row({ go: 'experiences', icon: 'sparkles', c: '#b58500', t: 'Experiences', s: 'Hospitality, tours and open days' }),
      row({ go: 'store', icon: 'bag', c: '#7c3aed', t: 'Official Store', s: 'Kits, training wear and gifts' }),
    ])}
<div class="spacer"></div><div class="spacer"></div>
${list([
      row({ go: 'ask', icon: 'bubble', c: '#2563eb', t: 'Ask Sundowns', s: 'Answers with sources' }),
      row({ go: 'help', icon: 'cross', c: '#c0352b', t: 'Help and safety', s: 'Emergencies and a real person' }),
      row({ go: 'partners', icon: 'gift', c: '#6b21a8', t: 'Partner World', s: 'Useful things partners could fund' }),
      row({ go: 'impact', icon: 'heart', c: '#be123c', t: 'Club Impact', s: 'Grassroots, women and girls, community' }),
    ])}
<div class="spacer"></div><div class="spacer"></div>
${list([
      row({ go: 'profile', icon: 'sliders', c: '#6b7280', t: 'You', s: 'Teams, messages, display and privacy' }),
      row({ go: 'about', icon: 'info', c: '#0c3e2e', t: 'About this concept' }),
      row({ go: 'assets', icon: 'photos', c: '#b58500', t: 'Asset library', s: `${ASSETS.assets.length} images and their status` }),
    ])}
${footNote()}
</div>`;
  }

  function rAssets() {
    const counts = {};
    ASSETS.assets.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    const filt = state.segs.assetFilter || 'all';
    const label = { use: 'In the app', cropped: 'Cropped', review: 'Review', hold: 'Hold', staff: 'Staff' };
    const cls = { use: 'ok', cropped: 'tint', review: 'sample', hold: 'warn', staff: '' };
    return `<div class="wrap">
${head('Asset <em>library</em>', { eyebrow: `${ASSETS.assets.length} supplied images` })}
<p class="muted">${esc(ASSETS.note)}</p>
<div class="kpis" style="margin-top:14px"><div><b>${(counts.use || 0) + (counts.cropped || 0) + (counts.review || 0)}</b><small>Placed in the app</small></div><div><b>${counts.hold || 0}</b><small>On hold</small></div><div><b>${counts.staff || 0}</b><small>Club Studio</small></div></div>
<div class="chips" role="group" aria-label="Filter by status" style="margin-top:14px">${[['all', 'All'], ...Object.entries(label)].map(([k, t]) => `<button type="button" class="chip tap" data-act="assetFilter" data-arg="${k}" aria-pressed="${filt === k}">${t}${k === 'all' ? '' : ` · ${counts[k] || 0}`}</button>`).join('')}</div>
<h2 class="vh">Images</h2><div class="agrid" style="margin-top:14px">${ASSETS.assets.map((a) => `<div data-status="${a.status}" ${filt === 'all' || filt === a.status ? '' : 'hidden'}><button type="button" class="card media tap" data-act="asset" data-arg="${a.id}">${a.id === '7674' ? `<div class="crest-tile" style="aspect-ratio:4/3" role="img" aria-label="${esc(a.alt)}"><div class="crest" style="width:60%;height:80%;margin:auto"></div></div>` : ph(a.id)}<div class="mb"><p class="cap faint">IMG_${a.id}</p><h3>${esc(a.title)}</h3><p>${pill(label[a.status], cls[a.status])}</p></div></button></div>`).join('')}</div>
${footNote()}
</div>`;
  }

  function rAbout() {
    return `<div class="wrap">
${head('About this <em>concept</em>', { eyebrow: 'Sundowns One' })}
<section class="card card-pad" style="text-align:center">${crest('crest crest-lg')}<h2 class="t1" style="margin-top:10px">Sundowns One</h2><p class="muted">The Yellow Nation. One home.</p><p class="cap faint" style="margin-top:8px">Concept prototype · built ${'__BUILD_DATE__'}</p></section>
${sec('What this is')}
<section class="card card-pad stack"><p>A concept supporter app for Mamelodi Sundowns, prepared by LegacyLeverage Creative Agency. It is not an official club product and has not been approved by the club.</p><p>It shows how one app could take a supporter from finding a match to coming back for the next one: tickets through the official seller, a matchday plan, the stadium, the Passport, the Fan Zone and the wider Yellow Nation.</p></section>
${sec('What’s sample')}
${list([
      row({ icon: 'calendar', soft: true, t: 'Fixtures and results', s: 'Fictional opponents, dates set from today' }),
      row({ icon: 'ticket', soft: true, t: 'Tickets', s: 'Nothing is sold. No ticket codes are made.' }),
      row({ icon: 'star', soft: true, t: 'Passport points and rewards', s: 'Not redeemable' }),
      row({ icon: 'gift', soft: true, t: 'Partners', s: 'None named or implied' }),
      row({ icon: 'photos', soft: true, t: 'Photography', s: 'Generated concept images; nobody pictured is a real player', go: 'assets' }),
    ])}
${sec('What it promises')}
${list([
      row({ icon: 'shield', soft: true, t: 'Your choices start off', s: 'No pre-ticked boxes. Partners never get your details.' }),
      row({ icon: 'person', soft: true, t: 'A person for what matters', s: 'Money, entry, safety, accessibility and your data' }),
      row({ icon: 'doc', soft: true, t: 'Sources on every answer', s: 'Or an honest “I don’t know”' }),
      row({ icon: 'gauge', soft: true, t: 'Works on any phone', s: 'Low-data mode, large text and offline use' }),
    ])}
<p class="foot-note">Real names used: Mamelodi Sundowns, Loftus Versfeld Stadium and the club crest supplied for this pitch. All need club approval before any public use.</p>
</div>`;
  }

  const ROUTES = {
    today: { tab: 'today', title: 'Today', render: rToday },
    matches: { tab: 'matches', title: 'Matches', render: rMatches },
    matchday: { tab: 'matchday', title: 'Matchday', render: rMatchday },
    passport: { tab: 'passport', title: 'Passport', render: rPassport },
    more: { tab: 'more', title: 'More', render: rMore },
    live: { tab: 'matches', parent: 'matches', title: 'Match Centre', short: 'Match Centre', render: rLive },
    planner: { tab: 'matchday', parent: 'matchday', title: 'Planner', render: rPlanner },
    stadium: { tab: 'matchday', parent: 'matchday', title: 'Stadium guide', short: 'Stadium', render: rStadium },
    travel: { tab: 'matchday', parent: 'matchday', title: 'Getting there', short: 'Travel', render: rTravel },
    food: { tab: 'matchday', parent: 'matchday', title: 'Food and drink', short: 'Food', render: rFood },
    access: { tab: 'matchday', parent: 'matchday', title: 'Accessibility', short: 'Access', render: rAccess },
    fanzone: { tab: 'more', parent: 'more', title: 'Fan Zone', render: rFanZone },
    watch: { tab: 'more', parent: 'more', title: 'Watch and Listen', short: 'Watch', render: rWatch },
    community: { tab: 'more', parent: 'more', title: 'Community', render: rCommunity },
    experiences: { tab: 'more', parent: 'more', title: 'Experiences', short: 'Experiences', render: rExperiences },
    store: { tab: 'more', parent: 'more', title: 'Official Store', short: 'Store', render: rStore },
    partners: { tab: 'more', parent: 'more', title: 'Partner World', short: 'Partners', render: rPartners },
    impact: { tab: 'more', parent: 'more', title: 'Club Impact', render: rImpact },
    ask: { tab: 'more', parent: 'more', title: 'Ask Sundowns', short: 'Ask', render: rAsk },
    help: { tab: 'more', parent: 'more', title: 'Help and safety', short: 'Help', render: rHelp },
    profile: { tab: 'more', parent: 'more', title: 'You', render: rProfile },
    assets: { tab: 'more', parent: 'more', title: 'Asset library', short: 'Assets', render: rAssets },
    about: { tab: 'more', parent: 'more', title: 'About', render: rAbout },
  };

  // ---------- sheets ----------
  let sheetNow = null;
  function setInert(on) { ['#stage', '.navbar', '.tabbar', '.sidebar', '.skip'].forEach((s) => { const el = $(s); if (el) el.inert = on; }); }
  function openSheet({ title, body, onClose, onOpen }) {
    if (sheetNow) killSheet(sheetNow);
    const root = $('#sheetRoot');
    const lastFocus = document.activeElement;
    root.innerHTML = `<div class="scrim" data-sheet-close aria-hidden="true"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><div class="sheet-top" data-drag><div class="sheet-grab" aria-hidden="true"></div><div class="sheet-head"><h2 id="sheetTitle" tabindex="-1">${title}</h2><button type="button" class="sheet-close tap" data-sheet-close aria-label="Close">${ic('x')}</button></div></div><div class="sheet-body">${body}</div></div>`;
    const sheet = $('.sheet', root), scrim = $('.scrim', root);
    const H = () => sheet.offsetHeight;
    const spring = new Spring({
      value: H(), precision: 0.4,
      onUpdate: (y) => { sheet.style.transform = `translate3d(0,${y}px,0)`; scrim.style.opacity = clamp(1 - Math.max(0, y) / H(), 0, 1); },
    });
    const s = { sheet, scrim, spring, H, onClose, lastFocus, root };
    sheetNow = s;
    setInert(true);
    document.documentElement.classList.add('sheet-open');
    if (reduceMotion.matches) { spring.set(0); } else spring.to(0, { damping: 1, response: 0.38 });
    requestAnimationFrame(() => $('#sheetTitle', sheet).focus({ preventScroll: true }));
    dragSheet(s, $('.sheet-top', sheet));
    onOpen && onOpen(sheet);
    return s;
  }
  function killSheet(s) {
    s.spring.stop();
    if (s.root.contains(s.sheet)) s.root.innerHTML = '';
    if (sheetNow === s) sheetNow = null;
    setInert(false);
    document.documentElement.classList.remove('sheet-open');
    s.onClose && s.onClose();
  }
  // Closing hands the page back at once; the sheet finishes its exit on its own.
  function closeSheet(o = {}) {
    const s = sheetNow;
    if (!s) return;
    sheetNow = null;
    setInert(false);
    document.documentElement.classList.remove('sheet-open');
    s.sheet.style.pointerEvents = 'none';
    s.scrim.style.pointerEvents = 'none';
    const done = () => {
      const hadFocus = s.sheet.contains(document.activeElement);
      if (s.root.contains(s.sheet)) s.root.innerHTML = '';
      const lost = hadFocus || document.activeElement === document.body || !document.activeElement;
      if (!sheetNow && lost && s.lastFocus && document.contains(s.lastFocus)) s.lastFocus.focus({ preventScroll: true });
      s.onClose && s.onClose();
    };
    if (reduceMotion.matches) { s.spring.stop(); done(); return; }
    s.spring.to(s.H() + 30, { velocity: o.velocity || 0, damping: 1, response: 0.32, onRest: done });
  }
  // Grab the top of a sheet: it tracks the finger 1:1 from where you grabbed it,
  // resists past the top, and on release carries your velocity into the spring.
  function dragSheet(s, handle) {
    let d = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('button')) return;
      d = { id: e.pointerId, y0: e.clientY, start: s.spring.x, samples: [{ t: e.timeStamp, y: e.clientY }], active: false };
    });
    handle.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id || sheetNow !== s) return;
      if (!d.active) {
        if (Math.abs(e.clientY - d.y0) < 6) return;
        d.active = true;
        handle.setPointerCapture(d.id);
        s.spring.stop();
        d.start = s.spring.x;
        d.y0 = e.clientY;
      }
      let y = d.start + (e.clientY - d.y0);
      if (y < 0) y = -rubber(-y, s.H());
      s.spring.set(y);
      d.samples.push({ t: e.timeStamp, y: e.clientY });
      if (d.samples.length > 12) d.samples.shift();
    });
    const end = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const was = d;
      d = null;
      if (!was.active || sheetNow !== s) return;
      const v = velocityOf(was.samples);
      const rest = s.spring.x + project(v);
      if (rest > s.H() * 0.5 && v > -150) closeSheet({ velocity: v });
      else s.spring.to(0, { velocity: v, damping: 0.8, response: 0.3 });
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  let toastT = 0;
  function toast(msg) {
    const el = $('#toast');
    el.innerHTML = `<span class="ic">${ic('check')}</span><span>${esc(msg)}</span>`;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ---------- sheets' content ----------
  function fixtureSheet(id) {
    const f = fixture(id);
    const past = !!RESULTS.find((r) => r.id === id);
    openSheet({
      title: esc(matchName(f)),
      body: `<div style="display:flex;gap:6px;flex-wrap:wrap">${SAMPLE}${pill(TEAMS[f.team])}${pill(f.comp)}</div>
<dl class="kv"><dt>Date</dt><dd>${when(f, { weekday: 'long', day: 'numeric', month: 'long' })}</dd><dt>Kick-off</dt><dd>${kick(f)} SAST</dd><dt>Venue</dt><dd>${venue(f)}</dd>${past ? `<dt>Result</dt><dd>${USS[f.team]} ${f.us}, ${esc(f.opp)} ${f.them} (sample)</dd>` : ''}</dl>
${past ? note('Invented result for the prototype.') : `<div class="row-actions"><button type="button" class="btn btn-primary tap" data-act="tickets" data-arg="${f.id}">${ic('ticket')}Tickets</button><button type="button" class="btn btn-tinted tap" data-act="planFor" data-arg="${f.id}">Plan</button></div>
<div class="row-actions">${CONFIG.viewer === 'on' ? '' : `<button type="button" class="btn btn-tinted tap" data-act="calendar" data-arg="${f.id}">${ic('calendar')}Add to calendar</button>`}<button type="button" class="btn btn-tinted tap" data-act="shareFixture" data-arg="${f.id}">${ic('share')}Share</button></div>
${note('Sample fixture with a fictional opponent. Don’t add it to a real calendar expecting a match.')}`}`,
    });
  }
  function ticketsSheet(id) {
    const f = fixture(id) || nextHome();
    openSheet({
      title: 'Tickets',
      body: `<div class="sheet-img ph a7687" style="aspect-ratio:16/9;background-position:center 30%" role="img" aria-label="${esc(alt('7687'))}"></div>
<p class="t3">${esc(matchName(f))}</p><p class="muted">${when(f, { weekday: 'long', day: 'numeric', month: 'long' })} · ${kick(f)} · sample fixture</p>
${list([row({ icon: 'ticket', c: '#0c3e2e', t: 'Buy from the official seller', s: 'Prices, seats and payment are theirs' }), row({ icon: 'lock', c: '#11643f', t: 'Your entry code stays with them', s: 'In their app or wallet' }), row({ icon: 'seat', c: '#b58500', t: 'Link it here', s: 'To see your gate, seat and matchday plan' })])}
<button type="button" class="btn btn-primary btn-block tap" data-act="sellerDemo">Continue to the official seller</button>
<p class="cap muted" style="text-align:center">Prototype: the seller link is connected during the build.</p>`,
    });
  }
  function crewSheet() {
    openSheet({
      title: 'Bring your crew',
      body: `${steps('7721')}<p>Pick a match, invite your crew, and everyone buys from the official seller. Once a friend’s entry is verified, you both earn Passport points.</p>${note('Points need a verified entry, not just a click. Your friend’s details stay theirs.', 'info')}<button type="button" class="btn btn-primary btn-block tap" data-act="invite">${ic('share')}Invite a friend</button>`,
      onOpen: bindSteps,
    });
  }
  function human(topic) {
    const T = { access: 'Accessibility assistance', entry: 'Ticket or entry problem', family: 'Lost child or family help', lost: 'Lost and found', data: 'Your data', passport: 'Passport question', ask: 'Talk to a person' }[topic] || 'Talk to a person';
    openSheet({
      title: T,
      body: `${topic === 'family' ? note('If a child is lost at the stadium, tell the nearest steward now. Stewards are trained to help.', 'danger', 'warn') : ''}
<p>A person from the club’s supporter team handles this. In the live app, this connects to the club’s support line, chat or email, with your question attached.</p>
${list([row({ icon: 'bubble', c: '#2563eb', t: 'Chat with the supporter team', s: 'Connected during the build' }), row({ icon: 'phone', c: '#11643f', t: 'Call the supporter line', s: 'Number from the club' }), row({ icon: 'info', c: '#6b21a8', t: 'At the stadium', s: 'Any steward or information desk' })])}
${topic === 'data' ? '<p class="muted sub">Requests about your personal information go to the club’s Information Officer, as POPIA requires.</p>' : ''}`,
    });
  }

  // ---------- actions ----------
  const ACT = {
    seg(el) {
      const g = el.closest('.seg');
      const name = g.dataset.seg, val = el.dataset.arg;
      const btns = $$('button', g), i = btns.indexOf(el);
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      $('.thumb', g).style.transform = `translateX(${i * 100}%)`;
      state.segs[name] = val;
      save();
      $$(`[data-panel-of="${name}"]`).forEach((p) => { p.hidden = p.dataset.panel !== val; });
      if (name === 'watch') $$('#watchGrid > [data-type]').forEach((x) => { x.hidden = !(val === 'all' || x.dataset.type === val); });
      if (g.dataset.apply === 'appearance') { state.appearance = val; applyPrefs(); }
      if (g.dataset.apply === 'textSize') { state.textSize = val; applyPrefs(); }
    },
    step(el) {
      const rail = el.closest('.dots').previousElementSibling;
      const i = +el.dataset.arg;
      const card = rail.children[i];
      rail.scrollTo({ left: card.offsetLeft - parseFloat(getComputedStyle(rail).paddingLeft), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    },
    teamFilter(el) {
      state.teamFilter = el.dataset.arg;
      save();
      $$('[data-act="teamFilter"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      $$('#matches li[data-team]').forEach((li) => { li.hidden = !(state.teamFilter === 'all' || li.dataset.team === state.teamFilter); });
    },
    fixture(el) { fixtureSheet(el.dataset.arg); },
    tickets(el) { ticketsSheet(el.dataset.arg); },
    sellerDemo() { closeSheet(); toast('The official seller opens here in the live app'); },
    planFor(el) { state.planner.fixture = el.dataset.arg; save(); closeSheet(); navigate('planner'); },
    shareFixture(el) { const f = fixture(el.dataset.arg); shareText(`${matchName(f)}, ${when(f, { weekday: 'long', day: 'numeric', month: 'long' })} at ${kick(f)}. Who’s coming? (Sundowns One concept, sample fixture)`); },
    calendar(el) { downloadICS(fixture(el.dataset.arg)); },
    linkTicket() { state.ticketLinked = true; save(); buzz(); rerender(); toast('Sample ticket linked'); },
    unlinkTicket() { state.ticketLinked = false; save(); rerender(); },
    wallet() {
      openSheet({ title: 'Seller wallet', body: `${note('In the live app this opens the official seller’s own wallet, where your entry code lives. Sundowns One never shows a code it made itself.', 'info', 'lock')}<dl class="kv"><dt>Match</dt><dd>${esc(matchName(nextHome()))}</dd><dt>Seat</dt><dd>Gate C · Block 118 · Row 14 · Seat 22 (sample)</dd></dl><button type="button" class="btn btn-primary btn-block tap" data-sheet-close>Done</button>` });
    },
    group(el) {
      state.planner.group = clamp(state.planner.group + +el.dataset.arg, 1, 30);
      save();
      $('#groupOut').textContent = state.planner.group;
      updateBudget();
    },
    travel(el) { state.planner.travel = el.dataset.arg; save(); $$('[data-act="travel"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); },
    savePlan() { state.planner.saved = Date.now(); save(); buzz(); toast('Plan saved on this phone'); rerender(); },
    sharePlan() {
      const p = state.planner, f = fixture(p.fixture) || nextHome();
      const t = TRAVEL.find((x) => x[0] === p.travel);
      shareText(`Matchday plan: ${matchName(f)}, ${when(f)} at ${kick(f)}. Crew of ${p.group}, going by ${t ? t[1].toLowerCase() : 'car'}. ${p.checks.length} of ${CHECKS.length} things sorted. (Sundowns One concept, sample fixture)`);
    },
    resetPlan() { state.planner = JSON.parse(JSON.stringify(DEFAULTS.planner)); save(); rerender(); toast('Plan cleared'); },
    crew() { crewSheet(); },
    install() { installSheet(); },
    async installNow() { if (!installPrompt) return; installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => null); installPrompt = null; closeSheet(); if (r && r.outcome === 'accepted') toast('Sundowns One installed'); },
    shareApp() { const l = appLink(); shareText(`Sundowns One — the Yellow Nation in one app (concept prototype).${l ? '' : ' Ask me for the app file.'}`); },
    copyLink() { shareText('Sundowns One — the Yellow Nation in one app (concept prototype).'); },
    copyShare() {
      const t = $('#shareBody').textContent;
      const sel = () => { const r = document.createRange(); r.selectNodeContents($('#shareBody')); const w = getSelection(); w.removeAllRanges(); w.addRange(r); toast('Text selected: copy it'); };
      try { navigator.clipboard.writeText(t).then(() => toast('Copied'), sel); } catch { sel(); }
    },
    pickFixture() {
      openSheet({
        title: 'Which match?',
        body: `<ul class="list">${FIXTURES.map((x) => `<li><button type="button" class="row tap" data-act="setFixture" data-arg="${x.id}" aria-pressed="${x.id === state.planner.fixture}"><span class="rt"><b>${esc(matchName(x))}</b><small>${when(x)} · ${kick(x)} · ${TEAMS[x.team]} · ${x.comp}</small></span>${x.id === state.planner.fixture ? ic('check', 'chev') : ''}</button></li>`).join('')}</ul><p class="cap muted">Sample fixtures with fictional opponents.</p>`,
      });
    },
    setFixture(el) { state.planner.fixture = el.dataset.arg; save(); closeSheet(); rerender(); },
    invite() { shareText('Come with me to a Sundowns match. Let’s go together. (Sundowns One concept)'); },
    mapFilter(el) {
      const k = el.dataset.arg;
      $$('[data-act="mapFilter"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      $$('.map .mk').forEach((m) => m.classList.toggle('off', k !== 'all' && m.dataset.mk !== k));
    },
    mapShow(el) {
      const b = $(`[data-act="mapFilter"][data-arg="${el.dataset.arg}"]`);
      if (b) { ACT.mapFilter(b); $('.map').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' }); }
    },
    travelInfo(el) {
      const k = el.dataset.arg;
      const t = { car: 'Driving and parking', shuttle: 'Shuttles and park-and-ride', public: 'Public transport', taxi: 'Taxis and e-hailing', walk: 'Walking' }[k];
      openSheet({ title: t, body: `<div class="sheet-img ph a7683" role="img" aria-label="${esc(alt('7683'))}"></div><p>This is where the venue’s approved ${t.toLowerCase()} information appears: where to go, when it opens, and what changes on big matchdays.</p>${note('Sundowns One shows only what the venue and its transport partners confirm. It never guesses a route, a car park or an emergency exit from a map.')}<button type="button" class="btn btn-tinted btn-block tap" data-act="addTravel" data-arg="${k}">Use for my plan</button>` });
    },
    addTravel(el) { state.planner.travel = el.dataset.arg === 'walk' ? 'walk' : el.dataset.arg; save(); closeSheet(); toast('Added to your plan'); },
    addFood(el) { const k = el.dataset.arg; state.tray[k] = (state.tray[k] || 0) + 1; save(); buzz(); rerender(); },
    clearTray() { state.tray = {}; save(); rerender(); },
    placeOrder() {
      state.order = { ref: 'D' + Math.floor(100 + Math.random() * 900), stage: 0 };
      state.tray = {};
      save(); buzz(); rerender();
      const ref = state.order.ref;
      setTimeout(() => { if (state.order && state.order.ref === ref) { state.order.stage = 1; save(); if (current === 'food') rerender(); } }, 2500);
      setTimeout(() => { if (state.order && state.order.ref === ref) { state.order.stage = 2; save(); buzz(); if (current === 'food') rerender(); toast('Demo order ready to collect'); } }, 6000);
    },
    clearOrder() { state.order = null; save(); rerender(); },
    firstMatch() {
      openSheet({ title: 'Your first match', body: `${steps('7718')}${list([row({ icon: 'ticket', soft: true, t: 'Buy from the official seller', s: 'Then link the ticket here' }), row({ icon: 'clock', soft: true, t: 'Arrive early', s: 'Queues are shorter and you’ll find your seat calmly' }), row({ icon: 'family', soft: true, t: 'Agree a meeting point', s: 'Before you go through the gate' }), row({ icon: 'info', soft: true, t: 'Ask anyone in a bib', s: 'Stewards are there to help' })])}`, onOpen: bindSteps });
    },
    potm(el) { if (state.potm) return; state.potm = el.dataset.arg; save(); buzz(); rerender(); toast('Vote cast'); },
    pred(el) {
      if (state.prediction.locked) return;
      const [side, d] = el.dataset.arg.split(':');
      state.prediction[side] = clamp(state.prediction[side] + +d, 0, 9);
      save();
      el.parentElement.querySelector('output').textContent = state.prediction[side];
    },
    lockPred() { state.prediction.locked = true; save(); buzz(); rerender(); toast('Prediction locked in'); },
    unlockPred() { state.prediction.locked = false; save(); rerender(); },
    quiz(el) {
      const [i, j] = el.dataset.arg.split(':').map(Number);
      if (state.quiz.answers[i] != null) return;
      state.quiz.answers[i] = j;
      if (Object.keys(state.quiz.answers).length === QUIZ.length && !state.quiz.done) {
        state.quiz.done = true;
        if (earn('quiz', 'Club history quiz', 20)) setTimeout(() => toast('+20 Passport points'), 250);
      }
      save(); buzz(); rerender();
    },
    qr() {
      openSheet({
        title: 'Stadium QR challenge',
        body: `<div class="sheet-img ph a7696" role="img" aria-label="${esc(alt('7696'))}"></div>
<p>At the stadium, scanning the code opens this in your phone’s browser. No app to install.</p>
${state.qrEntered ? `${note('You’re in the draw. Winners are picked under the published rules.', 'info', 'check')}` : `<label class="box-check"><input type="checkbox" id="qrConsent"><span>Enter me into the prize draw for this challenge only. <span class="muted">Optional. This choice isn’t used for anything else.</span></span></label>
<button type="button" class="btn btn-primary btn-block tap" data-act="qrEnter">Take the challenge</button>`}
<p class="cap muted">Prototype. Prize rules, eligibility and anti-cheat checks are published with each real challenge.</p>`,
      });
    },
    qrEnter() {
      const c = $('#qrConsent');
      if (c && c.checked) state.qrEntered = true;
      save(); buzz(); closeSheet();
      toast(c && c.checked ? 'Challenge done · you’re in the draw' : 'Challenge done · not entered in the draw');
    },
    fanMoment() {
      openSheet({
        title: 'Share a matchday photo',
        body: `<p>A person at the club checks every photo before anyone else sees it.</p>
<label class="btn btn-tinted btn-block tap" style="cursor:pointer">${ic('camera')}Choose a photo<input type="file" accept="image/*" class="vh" data-change="momentFile"></label>
<div id="momentPreview"></div>
<fieldset style="border:0;padding:0;margin:0"><legend class="hd" style="margin-bottom:10px">Where may it appear?</legend>
<label class="box-check" style="margin-bottom:10px"><input type="checkbox"><span>In the Sundowns One fan gallery</span></label>
<label class="box-check"><input type="checkbox"><span>On the stadium big screen</span></label></fieldset>
<p class="cap muted">Nothing is ticked for you. Under-18s need a parent or guardian. You can ask for removal at any time.</p>
<button type="button" class="btn btn-primary btn-block tap" data-act="momentSend">Send for review (demo)</button>`,
      });
    },
    momentSend() { closeSheet(); toast('Demo only: nothing was uploaded'); },
    watchItem(el) {
      const w = WATCH.find((x) => x.id === el.dataset.arg);
      openSheet({
        title: esc(w.t),
        body: `<div class="sheet-img ph a${w.img}" role="img" aria-label="${esc(alt(w.img))}"></div>
<div style="display:flex;gap:6px;flex-wrap:wrap">${SAMPLE}${pill(w.type === 'audio' ? 'Audio' : 'Video')}${pill(w.len)}</div>
<dl class="kv"><dt>Rights</dt><dd>${w.rights}</dd><dt>Captions</dt><dd>${w.type === 'audio' ? 'Transcript' : 'Captions and transcript'}</dd><dt>Low data</dt><dd>${w.type === 'audio' ? 'Yes' : 'Lower-quality stream available'}</dd></dl>
<button type="button" class="btn btn-primary btn-block tap" data-act="playDemo">${ic('play')}${w.type === 'audio' ? 'Listen' : 'Play'}</button>`,
      });
    },
    playDemo() { closeSheet(); toast('The club’s media player connects here'); },
    branch(el) {
      openSheet({ title: `${esc(el.dataset.arg)} branch`, body: `${note('Sample branch. Real branches show only details the branch has agreed to publish, after the club verifies them.')}${list([row({ icon: 'calendar', soft: true, t: 'Next meet-up', s: 'From the branch' }), row({ icon: 'bus', soft: true, t: 'Travel to matches', s: 'Approved operators only' }), row({ icon: 'person', soft: true, t: 'Branch contact', s: 'Public contact once verified' })])}<button type="button" class="btn btn-primary btn-block tap" data-act="branchJoin">Register interest</button>` });
    },
    branchJoin() { closeSheet(); toast('Interest noted on this phone (demo)'); },
    awayInterest() {
      const i = state.interests.indexOf('away');
      if (i >= 0) state.interests.splice(i, 1); else state.interests.push('away');
      save(); rerender(); if (i < 0) toast('Interest noted (demo)');
    },
    survey(el) {
      state.survey = +el.dataset.arg;
      if (earn('survey', 'Supporter Voice survey', 20)) setTimeout(() => toast('+20 Passport points'), 250);
      save(); buzz(); rerender();
    },
    experience(el) {
      const e = EXPERIENCES.find((x) => x.id === el.dataset.arg);
      const on = state.interests.includes(e.id);
      openSheet({
        title: e.t,
        body: `<div class="sheet-img ph a${e.img}" role="img" aria-label="${esc(alt(e.img))}"></div><p class="eyebrow">${e.k}</p><p>${e.d}</p>
<dl class="kv"><dt>Run by</dt><dd>Club experiences team (to confirm)</dd><dt>Dates</dt><dd>From the booking provider</dd><dt>Price</dt><dd>From the booking provider</dd><dt>Ages</dt><dd>To confirm</dd><dt>Access</dt><dd>Step-free details to confirm</dd><dt>Terms</dt><dd>Cancellation and safety terms published with each date</dd></dl>
${note('Registering interest isn’t a booking or a guarantee.')}
<button type="button" class="btn ${on ? 'btn-tinted' : 'btn-primary'} btn-block tap" data-act="interest" data-arg="${e.id}">${on ? `${ic('check')}Interest registered` : 'Register interest'}</button>`,
      });
    },
    interest(el) {
      const id = el.dataset.arg;
      const i = state.interests.indexOf(id);
      if (i >= 0) state.interests.splice(i, 1); else state.interests.push(id);
      save(); buzz(); closeSheet(); rerender();
      toast(i >= 0 ? 'Interest removed' : 'Interest registered on this phone');
    },
    storeOpen(el) {
      const c = el.dataset.arg;
      openSheet({ title: c ? esc(c) : 'Official Store', body: `<div class="sheet-img ph a7698" role="img" aria-label="${esc(alt('7698'))}"></div><p>In the live app this opens the official store${c ? ` at ${esc(c.toLowerCase())}` : ''}, with its own products, prices, stock, checkout, delivery and returns.</p>${note('Sundowns One doesn’t take payment or keep a second basket. One store, one checkout.')}<button type="button" class="btn btn-primary btn-block tap" data-act="storeDemo">Continue to the official store</button>` });
    },
    storeDemo() { closeSheet(); toast('The official store opens here in the live app'); },
    volunteer() { toast('Interest noted on this phone (demo)'); },
    human(el, ev) { if (ev) ev.preventDefault(); human(el.dataset.arg); },
    askChip(el) { ask(el.dataset.arg); },
    redeem(el) {
      const r = REWARDS.find((x) => x.id === el.dataset.arg);
      if (balance() < r.pts) { toast(`You need ${r.pts - balance()} more points`); return; }
      openSheet({
        title: r.t,
        body: `<div class="sheet-img ph a${r.img}" role="img" aria-label="${esc(alt(r.img))}"></div><p>${r.s}.</p><dl class="kv"><dt>Cost</dt><dd>${r.pts} points</dd><dt>Balance after</dt><dd>${balance() - r.pts} points</dd><dt>Terms</dt><dd>Sample reward. Stock, expiry and collection terms are published with real rewards.</dd></dl><button type="button" class="btn btn-primary btn-block tap" data-act="redeemGo" data-arg="${r.id}">Redeem ${r.pts} points (demo)</button>`,
      });
    },
    redeemGo(el) {
      const r = REWARDS.find((x) => x.id === el.dataset.arg);
      if (balance() < r.pts) return;
      const ref = 'YN-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      earn('redeem-' + r.id, `Redeemed: ${r.t} · ${ref}`, -r.pts);
      buzz();
      openSheet({ title: 'Redeemed', body: `<div style="text-align:center;padding:10px 0"><span class="ic lg" style="--c:#17703f;margin:0 auto">${ic('check')}</span><p class="t2" style="margin-top:12px">${r.t}</p><p class="muted">Demo reference <b class="num">${ref}</b></p></div>${note('Demo only. A real reward would come with collection details and an expiry date.')}<button type="button" class="btn btn-primary btn-block tap" data-sheet-close>Done</button>` });
      rerender();
    },
    linkMember() { state.membershipLinked = !state.membershipLinked; save(); rerender(); toast(state.membershipLinked ? 'Sample membership linked' : 'Membership unlinked'); },
    passportRules() {
      openSheet({ title: 'Passport rules', body: `${list([row({ icon: 'check', soft: true, t: 'Earn for turning up', s: 'Only once the ticket system confirms your entry' }), row({ icon: 'star', soft: true, t: 'Earn for taking part', s: 'Approved quizzes, surveys and community days' }), row({ icon: 'x', soft: true, t: 'Never for marketing consent', s: 'Saying yes to messages earns nothing' }), row({ icon: 'clock', soft: true, t: 'Expiry and terms', s: 'Published before launch' }), row({ icon: 'person', soft: true, t: 'Disputes', s: 'A person reviews anything missing', act: 'human', arg: 'passport' })])}<p class="cap muted">Every entry is recorded once, with its source, so nothing is counted twice.</p>` });
    },
    consent(el) {
      const p = PURPOSES.find((x) => x.k === el.dataset.arg);
      openSheet({
        title: p.t,
        body: `<p class="muted">${p.d}</p><ul class="list">${CHANNELS.map(([c, t]) => `<li><label class="row"><span class="rt"><b>${t}</b></span><input type="checkbox" role="switch" class="switch" data-change="consent" data-arg="${p.k}:${c}" ${state.consent[p.k][c] ? 'checked' : ''}></label></li>`).join('')}</ul><p class="cap muted">Change this any time. Every change is recorded with its time, so you can always see what you agreed to. Nothing earns points.</p>`,
        onClose: () => { if (current === 'profile') rerender(); },
      });
    },
    consentLog() {
      openSheet({ title: 'Your message choices', body: `<ul class="list">${state.consentLog.slice().reverse().map((c) => `<li><div class="row"><span class="rt"><b>${esc(c.label)}</b><small>${fmt(new Date(c.t), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</small></span></div></li>`).join('')}</ul><p class="cap muted">Kept on this phone in the prototype. In production, the club keeps this record so it can prove what you agreed to.</p>` });
    },
    assetFilter(el) {
      state.segs.assetFilter = el.dataset.arg; save();
      $$('[data-act="assetFilter"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      $$('.agrid > [data-status]').forEach((x) => { x.hidden = !(el.dataset.arg === 'all' || x.dataset.status === el.dataset.arg); });
    },
    asset(el) {
      const a = A[el.dataset.arg];
      const label = { use: 'Placed in the app', cropped: 'Placed after a crop', review: 'Placed, with an issue to clear', hold: 'On hold: library only', staff: 'Club Studio (staff) material' }[a.status];
      openSheet({
        title: esc(a.title),
        body: `${a.id === '7674' ? `<div class="sheet-img" style="display:grid;place-items:center;background:var(--green)"><div class="crest" style="width:46%;height:86%"></div></div>` : `<div class="sheet-img ph a${a.id}" style="aspect-ratio:auto;padding-top:${a.status === 'staff' || a.status === 'hold' ? 56 : 62}%;background-size:contain;background-repeat:no-repeat;background-color:#000" role="img" aria-label="${esc(a.alt)}"></div>`}
<dl class="kv"><dt>File</dt><dd>${esc(a.file)}</dd><dt>Status</dt><dd>${label}</dd><dt>Used in</dt><dd>${esc(a.use)}</dd>${a.note ? `<dt>Note</dt><dd>${esc(a.note)}</dd>` : ''}${a.steps ? `<dt>Steps</dt><dd>${a.steps.map(esc).join(' · ')}</dd>` : ''}<dt>Alt text</dt><dd>${esc(a.alt)}</dd></dl>`,
      });
    },
    resetDemo() {
      openSheet({ title: 'Reset this demo?', body: `<p>This clears your plan, choices, points activity and settings on this phone.</p><div class="row-actions"><button type="button" class="btn btn-tinted tap" data-sheet-close>Cancel</button><button type="button" class="btn btn-danger tap" data-act="resetGo">Reset</button></div>` });
    },
    resetGo() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } state = load(); state.seenWelcome = true; save(); closeSheet(); applyPrefs(); rerenderAll(); toast('Demo reset'); },
    welcomeDone() { closeSheet(); },
  };
  const CHANGE = {
    planFlag(el) { state.planner[el.dataset.arg] = el.checked; save(); rerender(); },
    planCheck(el) {
      const k = el.dataset.arg, c = state.planner.checks, i = c.indexOf(k);
      if (el.checked && i < 0) c.push(k);
      if (!el.checked && i >= 0) c.splice(i, 1);
      save();
      if (el.checked) buzz();
      $('#checkCount').textContent = `${c.length} of ${CHECKS.length}`;
    },
    team(el) { state.teams[el.dataset.arg] = el.checked; save(); },
    lowData(el) { state.lowData = el.checked; save(); applyPrefs(); toast(el.checked ? 'Low-data mode on' : 'Low-data mode off'); },
    consent(el) {
      const [p, c] = el.dataset.arg.split(':');
      state.consent[p][c] = el.checked;
      const P = PURPOSES.find((x) => x.k === p), C = CHANNELS.find((x) => x[0] === c);
      state.consentLog.push({ t: Date.now(), label: `${P.t} by ${C[1].replace(' notifications', '').toLowerCase()}: ${el.checked ? 'on' : 'off'}` });
      if (state.consentLog.length > 50) state.consentLog.shift();
      save();
    },
    momentFile(el) {
      const f = el.files && el.files[0];
      const box = $('#momentPreview');
      if (!f || !box) return;
      const url = URL.createObjectURL(f);
      box.innerHTML = `<img src="${url}" alt="Your chosen photo, preview only" style="width:100%;border-radius:14px;max-height:260px;object-fit:cover">`;
    },
  };
  const INPUT = {
    budget(el) {
      const clean = el.value.replace(/\D/g, '').slice(0, 6);
      if (clean !== el.value) el.value = clean;
      state.planner.budget[el.dataset.arg] = clean;
      save();
      updateBudget();
    },
  };
  function updateBudget() {
    const e = $('#bEach'), c = $('#bCrew'), l = $('#crewLine');
    if (e) e.textContent = rand.format(perPerson());
    if (c) c.textContent = `${rand.format(crewTotal())} for the crew`;
    if (l) l.textContent = `Crew of ${state.planner.group}`;
  }
  function ask(q) {
    q = q.trim();
    if (!q) return;
    chat.push({ who: 'me', text: q });
    chat.push(answer(q));
    const log = $('#chatLog');
    if (log) { log.innerHTML = chatHTML(); const last = log.lastElementChild; last && last.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'end' }); }
  }
  async function shareText(text) {
    const url = appLink();
    if (CONFIG.viewer === 'on') {
      const full = url ? `${text}\n${url}` : text;
      openSheet({
        title: 'Share',
        body: `<p class="callout" id="shareBody">${esc(full)}</p><div class="row-actions"><a class="btn btn-primary tap" href="https://wa.me/?text=${encodeURIComponent(full)}" target="_blank" rel="noopener">${ic('message')}WhatsApp</a><button type="button" class="btn btn-tinted tap" data-act="copyShare">${ic('doc')}Copy</button></div>`,
      });
      return;
    }
    if (navigator.share) {
      try { await navigator.share(url ? { title: 'Sundowns One', text, url } : { title: 'Sundowns One', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(url ? `${text}\n${url}` : text), '_blank', 'noopener');
  }
  function downloadICS(f) {
    const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(f.date.getTime() + 2 * 3600e3);
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sundowns One concept//EN', 'BEGIN:VEVENT', `UID:${f.id}-${z(f.date)}@sundowns-one.concept`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(f.date)}`, `DTEND:${z(end)}`, `SUMMARY:${matchName(f)} (sample fixture)`, `LOCATION:${venue(f).replace(/,/g, '\\,')}`, 'DESCRIPTION:Sample fixture from the Sundowns One concept prototype. Not a real match.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `sundowns-one-${f.id}-sample.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Calendar file saved');
  }

  // ---------- preferences ----------
  function applyPrefs() {
    const r = document.documentElement;
    // Dark needs no attribute (it's the default), so a viewer's own choice still shows.
    const want = state.appearance === 'light' ? 'light' : state.appearance === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : null;
    if (want) { r.dataset.theme = want; r.dataset.themeBy = 'app'; }
    else if (r.dataset.themeBy === 'app') { r.removeAttribute('data-theme'); delete r.dataset.themeBy; }
    if (state.textSize === 'default') r.removeAttribute('data-text'); else r.dataset.text = state.textSize;
    r.classList.toggle('lowdata', !!state.lowData);
    const light = r.dataset.theme === 'light';
    $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', light ? '#f3f1ea' : '#0b0f0c'));
  }

  // ---------- router: push slides in from the right, back returns the same way ----------
  const stage = $('#stage');
  const section = (r) => document.getElementById(r);
  let current = null;
  let stack = [];
  let anim = null;
  const scrollMem = {};
  const chain = (r) => { const c = [r]; while (ROUTES[c[0]].parent) c.unshift(ROUTES[c[0]].parent); return c; };
  function render(r) {
    const el = section(r);
    el.innerHTML = ROUTES[r].render();
    bindSteps(el);
    bindMotion(el);
  }
  function rerender() {
    if (!current) return;
    const key = document.activeElement && document.activeElement.closest('#' + current) ? focusKey(document.activeElement) : null;
    const y = window.scrollY;
    render(current);
    window.scrollTo(0, y);
    if (key) { const el = $(`#${current} ${key}`); if (el) el.focus({ preventScroll: true }); }
    observeTitle();
  }
  function rerenderAll() { Object.keys(ROUTES).forEach((r) => { if (r === current) render(r); else section(r).innerHTML = ''; }); observeTitle(); }
  function focusKey(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const a = el.dataset.act || el.dataset.change || el.dataset.go;
    if (!a) return null;
    const attr = el.dataset.act ? 'data-act' : el.dataset.change ? 'data-change' : 'data-go';
    return `[${attr}="${a}"]${el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : ''}`;
  }
  const hist = (fn, st, url) => { try { history[fn](st, '', url); } catch { /* sandboxed viewer: keep going without history */ } };
  function navigate(to, o = {}) {
    if (!ROUTES[to]) to = 'today';
    if (sheetNow) killSheet(sheetNow);
    let mode;
    let next;
    if (to === current) { window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); return; }
    const i = stack.indexOf(to);
    if (i >= 0) { mode = 'pop'; next = stack.slice(0, i + 1); }
    else if (!ROUTES[to].parent) { mode = 'tab'; next = [to]; }
    else if (ROUTES[to].tab === ROUTES[current].tab) { mode = 'push'; next = [...stack, to]; }
    else { mode = 'push'; next = chain(to); }
    if (o.mode) mode = o.mode;
    stack = next;
    if (o.history !== false) hist('pushState', { stack }, '#' + to);
    show(to, mode);
  }
  // Back always returns to the screen its label names.
  function back() {
    if (stack.length < 2) return;
    if (sheetNow) killSheet(sheetNow);
    stack = stack.slice(0, -1);
    hist('replaceState', { stack }, '#' + stack[stack.length - 1]);
    show(stack[stack.length - 1], 'pop');
  }
  window.addEventListener('popstate', (e) => {
    const target = (location.hash || '#today').slice(1);
    if (!ROUTES[target]) return;
    const prev = stack;
    stack = (e.state && e.state.stack) || chain(target);
    if (sheetNow) killSheet(sheetNow);
    const mode = prev.includes(target) && prev.indexOf(target) < prev.length - 1 ? 'pop' : stack.length > 1 && ROUTES[target].tab === ROUTES[current].tab ? 'push' : 'tab';
    show(target, mode);
  });

  function show(to, mode) {
    if (anim) anim.finish();
    const from = current ? section(current) : null;
    const toEl = section(to);
    if (from) scrollMem[current] = window.scrollY;
    render(to);
    const y = mode === 'push' ? 0 : scrollMem[to] || 0;
    const prev = current;
    current = to;
    chrome(to);
    const animate = from && from !== toEl && (mode === 'push' || mode === 'pop') && !reduceMotion.matches;
    if (!animate) {
      if (from && from !== toEl) from.classList.remove('active');
      toEl.classList.add('active');
      window.scrollTo(0, y);
      if (from && from !== toEl && reduceMotion.matches && mode !== 'tab' && toEl.animate) toEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      after(to, prev);
      return;
    }
    const r = stage.getBoundingClientRect();
    const W = r.width;
    const top = from.getBoundingClientRect().top;
    from.style.cssText = `position:fixed;top:${top}px;left:${r.left}px;width:${W}px;z-index:${mode === 'pop' ? 3 : 1}`;
    toEl.classList.add('active');
    toEl.style.position = 'relative';
    toEl.style.zIndex = mode === 'push' ? 3 : 1;
    window.scrollTo(0, y);
    const over = mode === 'push' ? toEl : from;
    const under = mode === 'push' ? from : toEl;
    over.classList.add('moving');
    const dim = document.createElement('div');
    dim.className = 'dim';
    under.appendChild(dim);
    const set = (p) => {
      if (mode === 'push') { toEl.style.transform = `translate3d(${(1 - p) * W}px,0,0)`; from.style.transform = `translate3d(${-p * W * 0.28}px,0,0)`; dim.style.opacity = p * 0.1; }
      else { from.style.transform = `translate3d(${p * W}px,0,0)`; toEl.style.transform = `translate3d(${-(1 - p) * W * 0.28}px,0,0)`; dim.style.opacity = (1 - p) * 0.1; }
    };
    set(0);
    const spring = new Spring({ value: 0, damping: 1, response: 0.4, precision: 0.002, onUpdate: set });
    const finish = () => {
      spring.stop();
      from.classList.remove('active', 'moving');
      toEl.classList.remove('moving');
      from.style.cssText = '';
      toEl.style.cssText = '';
      dim.remove();
      anim = null;
    };
    anim = { finish };
    spring.to(1, { onRest: finish });
    after(to, prev);
  }
  function after(to, prev) {
    document.title = to === 'today' ? 'Sundowns One' : `${ROUTES[to].title} · Sundowns One`;
    observeTitle();
    queueParallax();
    if (prev) { const h = $(`#${to} [data-lt]`); if (h) h.focus({ preventScroll: true }); }
    if (to === 'ask') { const log = $('#chatLog'); if (log && chat.length > 1) log.lastElementChild.scrollIntoView({ block: 'end' }); }
  }
  function chrome(to) {
    const R = ROUTES[to];
    $$('.tabbar a').forEach((a) => { if (a.dataset.tab === R.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('.side-nav a').forEach((a) => { const r = a.getAttribute('href').slice(1); if (r === to || (r === R.tab && !$(`.side-nav a[href="#${to}"]`))) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const b = $('#navBack');
    if (stack.length > 1) { const P = ROUTES[stack[stack.length - 2]]; b.hidden = false; $('#navBackLabel').textContent = P.short || P.title; b.setAttribute('aria-label', `Back to ${P.title}`); } else b.hidden = true;
    $('#navTitle').textContent = R.title;
    $('#navbar').classList.remove('compact');
    $('#navbar').classList.toggle('over', !!$(`#${to} .imm`));
    moveLens(R.tab);
  }
  // The large title hands over to the compact bar title as it scrolls under it.
  let io = null;
  function observeTitle() {
    if (io) io.disconnect();
    const h = $(`#${current} [data-lt]`);
    const bar = $('#navbar');
    if (!h || !('IntersectionObserver' in window)) return;
    const navBottom = bar.getBoundingClientRect().bottom;
    io = new IntersectionObserver(([e]) => { bar.classList.toggle('compact', !e.isIntersecting && e.boundingClientRect.top < navBottom); }, { rootMargin: `-${Math.round(navBottom)}px 0px 0px 0px`, threshold: 0 });
    io.observe(h);
  }

  // Step carousels keep their dots in sync with the swipe.
  function bindSteps(root) {
    $$('[data-steps]', root).forEach((rail) => {
      if (rail._bound) return;
      rail._bound = true;
      const dots = rail.nextElementSibling;
      let t = 0;
      rail.addEventListener('scroll', () => {
        cancelAnimationFrame(t);
        t = requestAnimationFrame(() => {
          const w = rail.children[0].getBoundingClientRect().width + 12;
          const i = clamp(Math.round(rail.scrollLeft / w), 0, rail.children.length - 1);
          $$('button', dots).forEach((d, j) => d.setAttribute('aria-current', String(i === j)));
        });
      }, { passive: true });
    });
  }


  // ---------- motion: parallax, lean, sheen, tab lens ----------
  // Photos move slower than the page so the screen has depth. Everything here
  // animates transform or opacity only, and stops under Reduce Motion.
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const visible = new Set();
  const pio = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { rootMargin: '120px 0px' }) : null;
  function bindMotion(root) {
    if (pio) $$('.pcard .ph, .media .ph, .step .ph, .card > .ph, .mcard', root).forEach((el) => { if (!el.closest('.rail, .agrid')) pio.observe(el); });
    $$('.rail', root).forEach((rail) => {
      if (rail._px) return;
      rail._px = true;
      let t = 0;
      const run = () => { t = 0; railParallax(rail); };
      rail.addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(run); }, { passive: true });
      requestAnimationFrame(run);
    });
    const lean = $('.imm.lean', root);
    if (lean) bindLean(lean);
    $$('.mcard', root).forEach((card) => {
      card.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || reduceMotion.matches) return; const r = card.getBoundingClientRect(); card.style.setProperty('--shine', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3)); });
    });
  }
  function railParallax(rail) {
    if (reduceMotion.matches) return;
    const r = rail.getBoundingClientRect(), cx = r.left + r.width / 2;
    for (const card of rail.children) {
      const ph = card.querySelector('.ph');
      if (!ph) continue;
      const c = card.getBoundingClientRect();
      const q = clamp((c.left + c.width / 2 - cx) / (r.width / 2 + c.width / 2), -1, 1);
      ph.style.transform = `translate3d(${(q * -6).toFixed(2)}%,0,0) scale(1.14)`;
    }
  }
  let pxQueued = 0;
  function queueParallax() { if (!pxQueued) pxQueued = requestAnimationFrame(parallax); }
  function parallax() {
    pxQueued = 0;
    if (reduceMotion.matches || !current) return;
    const sec = section(current);
    const y = window.scrollY, vh = window.innerHeight;
    const imm = $('.imm', sec);
    if (imm) {
      const media = imm.firstElementChild, body = $('.imm-body', imm), h = imm.offsetHeight;
      if (y < 0) { media.style.transform = `scale(${(1 + -y / h).toFixed(4)})`; body.style.opacity = 1; body.style.transform = ''; }
      else if (y < h * 1.3) {
        // ease in over the first 160 px so the photo never jolts at the top
        const e = y < 160 ? (y * y) / 320 : y - 80;
        media.style.transform = `translate3d(0,${(e * 0.42).toFixed(1)}px,0)`;
        body.style.opacity = clamp(1 - y / (h * 0.62), 0, 1).toFixed(3);
        body.style.transform = `translate3d(0,${(y * 0.12).toFixed(1)}px,0)`;
      }
    }
    for (const el of visible) {
      if (!el.isConnected) { visible.delete(el); continue; }
      if (!sec.contains(el)) continue;
      const fr = (el.classList.contains('mcard') ? el : el.parentElement).getBoundingClientRect();
      const p = clamp((fr.top + fr.height / 2 - vh / 2) / (vh / 2 + fr.height / 2), -1, 1);
      if (el.classList.contains('mcard')) { if (!fine.matches) el.style.setProperty('--shine', p.toFixed(3)); }
      else el.style.transform = `translate3d(0,${(p * -7).toFixed(2)}%,0) scale(1.15)`;
    }
  }
  window.addEventListener('scroll', queueParallax, { passive: true });
  window.addEventListener('resize', () => { queueParallax(); moveLens(null, true); }, { passive: true });
  reduceMotion.addEventListener?.('change', () => {
    $$('.imm-media, .imm-body, .ph, .mcard').forEach((el) => { el.style.transform = ''; el.style.opacity = ''; el.style.removeProperty('--shine'); });
    queueParallax();
  });
  // With a mouse, the Today photo leans gently away from the pointer, on two
  // critically damped springs (X and Y move independently).
  function bindLean(imm) {
    const ph = $('.imm-media .ph', imm);
    let lx = 0, ly = 0;
    const apply = () => { ph.style.transform = `translate3d(${lx.toFixed(2)}px,${ly.toFixed(2)}px,0) scale(1.04)`; };
    const sx = new Spring({ value: 0, damping: 1, response: 0.55, precision: 0.05, onUpdate: (v) => { lx = v; apply(); } });
    const sy = new Spring({ value: 0, damping: 1, response: 0.55, precision: 0.05, onUpdate: (v) => { ly = v; apply(); } });
    imm.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduceMotion.matches) return;
      const r = imm.getBoundingClientRect();
      sx.to(-(((e.clientX - r.left) / r.width) * 2 - 1) * 12);
      sy.to(-(((e.clientY - r.top) / r.height) * 2 - 1) * 8);
    });
    imm.addEventListener('pointerleave', () => { sx.to(0); sy.to(0); });
  }
  // The glass lens under the active tab slides to the new tab on a spring.
  let lensSpring = null, lensTab = 'today';
  function moveLens(tab, instant) {
    const lens = $('.tabbar .lens');
    if (!lens) return;
    if (tab) lensTab = tab;
    const links = $$('.tabbar a');
    const i = Math.max(0, links.findIndex((a) => a.dataset.tab === lensTab));
    const x = i * lens.offsetWidth;
    if (!lensSpring) lensSpring = new Spring({ value: x, damping: 1, response: 0.38, precision: 0.3, onUpdate: (v) => { lens.style.transform = `translate3d(${v.toFixed(1)}px,0,0)`; } });
    if (instant || reduceMotion.matches || !lens.offsetWidth) lensSpring.set(x); else lensSpring.to(x);
  }
  // Countdowns tick while their screen is open.
  setInterval(() => {
    const cd = current && $(`#${current} [data-countdown]`);
    if (cd) cd.outerHTML = countdown(fixture(cd.dataset.countdown));
  }, 30000);

  // ---------- getting the app: home screen, WhatsApp, the file ----------
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  // In an embedding viewer the page's own address isn't shareable, and there's no file beside it.
  const hosted = /^https?:$/.test(location.protocol) && CONFIG.viewer !== 'on';
  const appLink = () => CONFIG.appUrl || (hosted ? location.href.split('#')[0] : '');
  function installSheet() {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    state.segs.install = state.segs.install || (ios ? 'ios' : 'android');
    openSheet({
      title: 'Get Sundowns One',
      body: `${standalone ? note('You’re already using the installed app.', 'info', 'check') : ''}
${seg('install', [['ios', 'iPhone'], ['android', 'Android']], 'Your phone')}
<div data-panel-of="install" data-panel="ios" ${panelHidden('install', 'ios', 'ios')}>${list([
        row({ icon: 'globe', soft: true, t: '1. Open the link in Safari', s: hosted ? 'You’re in the right place if this is Safari' : 'Ask for the Sundowns One link' }),
        row({ icon: 'share', soft: true, t: '2. Tap Share', s: 'The square with an arrow, in the toolbar' }),
        row({ icon: 'plus', soft: true, t: '3. Tap Add to Home Screen', s: 'Scroll down the share sheet if you don’t see it' }),
        row({ icon: 'check', soft: true, t: '4. Tap Add', s: 'Sundowns One opens full screen, like an app' }),
      ])}</div>
<div data-panel-of="install" data-panel="android" ${panelHidden('install', 'android', 'ios')}>${installPrompt ? `<button type="button" class="btn btn-primary btn-block tap" data-act="installNow">${ic('download')}Install now</button>` : ''}${list([
        row({ icon: 'globe', soft: true, t: '1. Open the link in Chrome' }),
        row({ icon: 'more', soft: true, t: '2. Tap ⋮ (top right)' }),
        row({ icon: 'plus', soft: true, t: '3. Tap Install app or Add to Home screen' }),
        row({ icon: 'check', soft: true, t: '4. Open it from your home screen', s: 'Works offline after the first visit' }),
      ])}</div>
<h3 class="hd">Share with your crew</h3>
<div class="row-actions"><button type="button" class="btn btn-primary tap" data-act="shareApp">${ic('message')}WhatsApp</button>${hosted ? `<a class="btn btn-tinted tap" href="Sundowns_One_Fan_App.html" download>${ic('download')}App file</a>` : `<button type="button" class="btn btn-tinted tap" data-act="copyLink">${ic('share')}Share</button>`}</div>
<p class="cap muted">${hosted ? 'WhatsApp sends the link, with its preview. The app file is the whole app in one file: send it as a WhatsApp document and it opens in any browser, even offline.' : 'You’re using the app file. Send it as a WhatsApp document and it opens in any browser, even offline.'} A concept prototype: not on the App Store or Google Play.</p>`,
    });
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-sheet-close]');
    if (close) { e.preventDefault(); closeSheet(); return; }
    const act = e.target.closest('[data-act]');
    if (act && !act.matches('[aria-disabled="true"]')) {
      const fn = ACT[act.dataset.act];
      if (fn) { e.preventDefault(); fn(act, e); return; }
    }
    if (act && act.matches('[aria-disabled="true"]')) { e.preventDefault(); return; }
    const go = e.target.closest('[data-go]');
    if (go) {
      e.preventDefault();
      if (go.dataset.segTo) { const [n, v] = go.dataset.segTo.split(':'); state.segs[n] = v; save(); }
      navigate(go.dataset.go);
      return;
    }
    const a = e.target.closest('a[href^="#"]');
    if (a && ROUTES[a.getAttribute('href').slice(1)]) { e.preventDefault(); navigate(a.getAttribute('href').slice(1)); }
  });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el); });
  document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el && INPUT[el.dataset.input]) INPUT[el.dataset.input](el); });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form="ask"]');
    if (!f) return;
    e.preventDefault();
    const inp = $('#askInput');
    ask(inp.value);
    inp.value = '';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetNow) closeSheet(); });
  document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active fire on press in iOS Safari
  $('#navBack').addEventListener('click', back);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs);

  // ---------- boot ----------
  if (CONFIG.viewer === 'on') document.documentElement.classList.add('viewer');
  applyPrefs();
  const start = (location.hash || '#today').slice(1);
  const first = ROUTES[start] ? start : 'today';
  stack = chain(first);
  hist('replaceState', { stack }, '#' + first);
  show(first, 'tab');
  ACT.welcome = () => {
      openSheet({
        title: 'Welcome',
        body: `<div style="text-align:center">${crest('crest crest-lg')}<p class="t1" style="margin-top:10px">Sundowns One</p><p class="muted">The Yellow Nation. One home.</p></div>
${list([row({ icon: 'ticket', c: '#0c3e2e', t: 'Plan your matchday', s: 'Tickets, travel, your gate and your crew' }), row({ icon: 'star', c: '#b58500', t: 'Fill your Passport', s: 'Stamps and points for turning up and taking part' }), row({ icon: 'people', c: '#0f766e', t: 'Join the Yellow Nation', s: 'Fan Zone, watch parties and supporters worldwide' })])}
${note('A concept prototype, not an official Mamelodi Sundowns product. Fixtures, tickets, points, prices and partners are samples.')}
<button type="button" class="btn btn-primary btn-block tap" data-act="welcomeDone">Continue</button>`,
        onClose: () => { state.seenWelcome = true; save(); },
      });
  };
  if (!state.seenWelcome && !navigator.webdriver) setTimeout(ACT.welcome, 500);
  if (CONFIG.pwa === 'on' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.SundownsOne = { navigate, routes: Object.keys(ROUTES), state: () => state, welcome: () => ACT.welcome() };
})();
