(() => {
  'use strict';

  /* ======================================================================
     Utilities
     ====================================================================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduce.matches;
  const TZ = 'Africa/Johannesburg';
  const hm = (t = Date.now()) => new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  const dShort = (t) => new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: TZ });
  const ic = (n, c = 'i') => `<svg class="${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const haptic = (p = 10) => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) { /* unsupported */ } };
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rid = (p, n = 4) => p + '-' + Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPH[b % 32]).join('');
  const chip = (cls, icon, text) => `<span class="chip ${cls}">${icon ? ic(icon) : ''}${esc(text)}</span>`;
  document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active press feedback on iOS

  /* ======================================================================
     Embedded assets → Blob URLs (decoded once, reused everywhere)
     ====================================================================== */
  const manifestEl = $('#asset-manifest');
  const MANIFEST = JSON.parse(manifestEl.textContent);
  manifestEl.remove();
  const ASSETS = MANIFEST.assets.map((a) => {
    const bin = atob(a.data);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const { data, ...meta } = a;
    return { ...meta, url: URL.createObjectURL(new Blob([u8], { type: a.format })) };
  });
  const A = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
  function hydrate(root = document) {
    $$('img[data-asset]', root).forEach((img) => {
      if (img.dataset.ready) return;
      const a = A[img.dataset.asset];
      if (!a) return;
      if (!img.hasAttribute('alt')) img.alt = a.alt;
      img.decoding = 'async';
      img.src = a.url;
      img.dataset.ready = '1';
    });
  }
  const imgA = (id, attrs = 'alt=""') => `<img data-asset="${id}" ${attrs}>`;

  /* ======================================================================
     Physics: springs (damping ratio + response), projection, rubber-band
     ====================================================================== */
  class Spring {
    constructor(x = 0, { damping = 1, response = 0.4, restDelta = 0.5 } = {}) {
      this.x = x; this.v = 0; this.target = x; this.restDelta = restDelta;
      this.config(damping, response);
      this.raf = 0; this.onUpdate = () => {}; this._rest = null;
      this._tick = this._tick.bind(this);
    }
    config(damping, response) {
      this.k = Math.pow((2 * Math.PI) / response, 2);
      this.c = (4 * Math.PI * damping) / response;
    }
    to(target, { velocity, damping, response, onRest } = {}) {
      this.target = target;
      if (velocity !== undefined) this.v = velocity;
      if (damping !== undefined || response !== undefined) this.config(damping ?? 1, response ?? 0.4);
      this._rest = onRest || null;
      if (reduced()) { this.set(target); const r = this._rest; this._rest = null; r && r(); return; }
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this._tick); }
    }
    _tick(now) {
      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      const n = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const a = -this.k * (this.x - this.target) - this.c * this.v;
        this.v += a * h;
        this.x += this.v * h;
      }
      if (Math.abs(this.x - this.target) < this.restDelta && Math.abs(this.v) < this.restDelta * 20) {
        this.x = this.target; this.v = 0; this.raf = 0;
        this.onUpdate(this.x);
        const r = this._rest; this._rest = null; r && r();
        return;
      }
      this.onUpdate(this.x);
      this.raf = requestAnimationFrame(this._tick);
    }
    set(x) { this.stop(); this.x = x; this.v = 0; this.target = x; this.onUpdate(x); }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  }
  // Apple's momentum projection (exponential decay), decelerationRate ≈ 0.998 (scroll) / 0.99 (snappy)
  const project = (v, d = 0.998) => ((v / 1000) * d) / (1 - d);
  const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
  const band = (x, min, max, dim) => (x > max ? max + rubberband(x - max, dim) : x < min ? min - rubberband(min - x, dim) : x);
  function velocity(hist) {
    const last = hist[hist.length - 1];
    const first = hist.find((p) => last.t - p.t <= 90) || hist[0];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return { x: 0, y: 0 };
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }

  /* ======================================================================
     State (demo data, persisted locally — never sent anywhere)
     ====================================================================== */
  const KEY = 'bulls-one-demo-v1';
  const T0 = Date.now();
  const ago = (m) => T0 - m * 60000;
  const DAY = 60 * 24;

  const MOMENTS = {
    // {n} marks the supporter's chosen name: set in lime italic on screen
    fancam: { label: 'Fan Cam celebration', desc: 'Show Loftus how you celebrate', asset: '01', head: '{n} is on the big screen!', sub: 'Make some noise, Loftus!' },
    welcome: { label: 'Welcome back', desc: 'For returning supporters', asset: '11', head: 'Welcome back, {n}!', sub: 'It’s good to have you with us at Loftus.' },
    birthday: { label: 'Birthday', desc: 'Celebrate your day here', asset: '13', head: 'Happy birthday, {n}!', sub: 'Loftus is celebrating with you.' },
    first: { label: 'First game at Loftus', desc: 'Your first match here', asset: '07', head: '{n}’s first game at Loftus!', sub: 'Make some noise for our newest Bull.' },
    family: { label: 'Family day', desc: 'Bring the whole crew', asset: '22', head: 'The {n} family is in the house!', sub: 'Loftus welcomes the whole family.' },
  };

  function seed() {
    return {
      v: 1,
      stripDismissed: false,
      seatShown: false,
      subs: [
        { id: 'FC-1042', name: 'Kobus', moment: 'welcome', asset: '11', block: 'C', gate: 'Gate 2', checkIn: '15:48', consents: { screen: true, gallery: true, marketing: false, seat: false }, minor: false, flags: [], status: 'pending', at: ago(9) },
        { id: 'FC-1043', name: 'Mokoena', moment: 'family', asset: '22', block: 'F', gate: 'Gate 4', checkIn: '16:02', consents: { screen: true, gallery: false, marketing: false, seat: true }, minor: true, flags: ['Includes a minor · guardian consent recorded'], status: 'pending', at: ago(6) },
        { id: 'FC-1044', name: 'Block K Crew', moment: 'fancam', asset: '13', block: 'K', gate: 'Gate 1', checkIn: '15:31', consents: { screen: true, gallery: true, marketing: true, seat: true }, minor: false, flags: ['Group photo · confirm everyone pictured agreed'], status: 'pending', at: ago(4) },
        { id: 'FC-1045', name: 'Ref Is Blind', moment: 'fancam', asset: '08', block: 'H', gate: 'Gate 4', checkIn: '16:20', consents: { screen: true, gallery: false, marketing: false, seat: false }, minor: false, flags: ['Word filter: possible abuse of match officials (aid only)'], status: 'pending', at: ago(2) },
      ],
      ledger: [
        { t: ago(DAY * 49), label: 'Opening balance (migrated, demo)', d: 2505 },
        { t: ago(DAY * 21), label: 'Verified attendance · Bulls v Dublin Harps', d: 100 },
        { t: ago(DAY * 21), label: 'Redeemed · supporter cap', d: -600 },
        { t: ago(DAY * 7), label: 'Verified attendance · Bulls v Highveld Comets', d: 100 },
        { t: ago(DAY * 7), label: 'Half-time quiz · correct answer', d: 25 },
        { t: ago(DAY * 7), label: 'Milestone · five home matches', d: 250 },
        { t: ago(48), label: 'Verified attendance · Bulls v Cape Mariners', d: 100 },
      ],
      audit: [
        { t: ago(95), actor: 'system', action: 'Fallback loop armed', target: 'North main LED', outcome: 'OK' },
        { t: ago(48), actor: 'access-control (demo webhook)', action: 'Gate check-in received', target: 'Ticket ••••4821', outcome: 'Verified · Gate 3' },
      ],
      consents: [
        { id: 'C-ESS', purpose: 'Essential matchday messages (service)', version: 'svc-v1.0', at: ago(DAY * 400), essential: true },
        { id: 'C-LIVE', purpose: 'Live score and Fan Cam status notifications', version: 'notif-v1.1', at: ago(DAY * 60) },
        { id: 'C-GREET', purpose: 'Personalised in-app greetings', version: 'greet-v1.0', at: ago(DAY * 60) },
      ],
      prefs: { essentials: true, fancam: true, live: true, offers: false, news: true },
      golden: null, quiz: null, potm: null, prediction: null, draw: null,
      redemptions: {}, requests: [],
      screen: { killed: false, cue: null },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const p = JSON.parse(raw); if (p && p.v === 1) return Object.assign(seed(), p); }
    } catch (_) { /* storage unavailable */ }
    return seed();
  }
  let S = load();
  if (S.screen.cue) { // a cue can't survive a reload — return it to "approved"
    const s = S.subs.find((x) => x.id === S.screen.cue.subId);
    if (s && s.status === 'onair') s.status = 'approved';
    S.screen.cue = null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (_) {
      try { localStorage.setItem(KEY, JSON.stringify({ ...S, subs: S.subs.map((s) => (s.photo ? { ...s, photo: null, asset: MOMENTS[s.moment].asset } : s)) })); } catch (__) { /* ignore */ }
    }
  }
  const session = { role: 'supporter', op: false }; // staff sessions are never persisted

  const points = () => S.ledger.reduce((a, e) => a + e.d, 0);
  const addLedger = (label, d) => S.ledger.push({ t: Date.now(), label, d });
  const audit = (actor, action, target, outcome) => S.audit.push({ t: Date.now(), actor, action, target, outcome });
  const ownSubs = () => S.subs.filter((s) => s.own).sort((a, b) => b.at - a.at);

  /* ======================================================================
     Toasts
     ====================================================================== */
  function toast(title, body = '', icon = 'check', tone = '') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.t = String(Date.now());
    el.innerHTML = `<span class="li-icon ${tone}">${ic(icon)}</span><div><strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}</div>`;
    $('#toasts').append(el);
    while ($('#toasts').children.length > 2) $('#toasts').firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
    }, 4600);
  }

  /* ======================================================================
     Sheet — spring-driven, interruptible, draggable with momentum projection
     ====================================================================== */
  const Sheet = (() => {
    const el = $('#sheet'), scrim = $('#scrim'), app = $('#app'), tabbar = $('#tabbar');
    const body = $('#sheetBody'), title = $('#sheetTitle');
    let open = false, mounted = false, h = 600, trigger = null, onClose = null;
    const y = new Spring(0, { damping: 1, response: 0.38, restDelta: 0.4 });
    const gap = () => (innerWidth >= 720 ? 24 : 0);
    const closedY = () => el.offsetHeight + gap() + 12;
    function render(v) {
      el.style.transform = `translate3d(0, ${v}px, 0)`;
      const p = clamp(1 - v / Math.max(1, h), 0, 1);
      scrim.style.opacity = (p * 0.55).toFixed(3);
      if (!reduced()) app.style.transform = p > 0.001 ? `scale(${(1 - 0.035 * p).toFixed(4)})` : '';
    }
    y.onUpdate = render;
    function unmount() {
      mounted = false;
      el.style.visibility = 'hidden';
      el.classList.remove('wide');
      scrim.classList.remove('on');
      app.style.transform = '';
      app.inert = false; tabbar.inert = false;
      document.documentElement.classList.remove('sheet-open');
      body.innerHTML = '';
      const t = trigger; trigger = null;
      if (t && document.contains(t)) t.focus({ preventScroll: true });
      const cb = onClose; onClose = null; cb && cb();
    }
    function show(html, opts = {}) {
      title.textContent = opts.title || '';
      body.innerHTML = html;
      body.scrollTop = 0;
      el.classList.toggle('wide', !!opts.wide);
      hydrate(body);
      if (!mounted) trigger = opts.trigger || document.activeElement;
      onClose = opts.onClose || null;
      el.style.visibility = 'visible';
      scrim.classList.add('on');
      document.documentElement.classList.add('sheet-open');
      app.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
      app.inert = true; tabbar.inert = true;
      h = closedY();
      if (!mounted) { y.set(h); mounted = true; } // otherwise continue from the live (presentation) value
      open = true;
      y.to(0, { damping: 1, response: 0.38 });
      requestAnimationFrame(() => (opts.focus ? $(opts.focus, el) : $('#sheetClose')).focus({ preventScroll: true }));
      opts.after && opts.after(body);
    }
    function close(vel = 0, instant = false) {
      if (!open) return;
      open = false;
      h = closedY();
      if (instant) { y.set(h); unmount(); return; }
      y.to(h, { velocity: vel, damping: Math.abs(vel) > 250 ? 0.85 : 1, response: 0.32, onRest: () => { if (!open) unmount(); } });
    }
    // drag: 1:1 tracking from the grab point, rubber-band above the top, project on release
    let drag = null;
    function down(e) {
      if (!open || (e.button !== undefined && e.button > 0) || e.target.closest('button, a, input, select, textarea')) return;
      y.stop(); // interrupt: keep the on-screen value
      h = closedY();
      drag = { id: e.pointerId, y0: e.clientY, v0: y.x, hist: [{ t: e.timeStamp, x: 0, y: e.clientY }] };
      e.currentTarget.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      let v = drag.v0 + (e.clientY - drag.y0);
      if (v < 0) v = -rubberband(-v, h);
      y.x = v; y.v = 0; render(v);
      drag.hist.push({ t: e.timeStamp, x: 0, y: e.clientY });
      if (drag.hist.length > 8) drag.hist.shift();
    }
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const vy = velocity(drag.hist).y;
      drag = null;
      el.classList.remove('dragging');
      const projected = y.x + project(vy, 0.99);
      if (projected > h * 0.42 || vy > 900) { close(vy); haptic(8); }
      else y.to(0, { velocity: vy, damping: Math.abs(vy) > 300 ? 0.8 : 1, response: 0.3 });
    }
    [$('#sheetGrab'), $('#sheetHead')].forEach((g) => {
      g.addEventListener('pointerdown', down);
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    scrim.addEventListener('click', () => close());
    $('#sheetClose').addEventListener('click', () => close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) { e.preventDefault(); close(); }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, summary, [tabindex]:not([tabindex="-1"])', el).filter((x) => x.getClientRects().length);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return { show, close, isOpen: () => open, body };
  })();

  /* ======================================================================
     Segmented controls with a spring indicator
     ====================================================================== */
  const SEGS = new Map();
  function initSeg(root) {
    const name = root.dataset.seg;
    const ind = $('.seg-ind', root);
    const btns = $$('.seg-btn', root);
    const sx = new Spring(0, { damping: 1, response: 0.32 });
    const sw = new Spring(0, { damping: 1, response: 0.32 });
    sx.onUpdate = (v) => { ind.style.transform = `translate3d(${v}px,0,0)`; };
    sw.onUpdate = (v) => { ind.style.width = `${v}px`; };
    let cur = Math.max(0, btns.findIndex((b) => b.getAttribute('aria-selected') === 'true'));
    function place(instant) {
      const b = btns[cur];
      if (!b.offsetWidth) return;
      if (instant) { sx.set(b.offsetLeft); sw.set(b.offsetWidth); } else { sx.to(b.offsetLeft); sw.to(b.offsetWidth); }
    }
    function select(i, { instant = false, silent = false } = {}) {
      cur = i;
      btns.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
      place(instant);
      const val = btns[i].dataset.value;
      $$(`[data-panel-of="${name}"]`).forEach((p) => {
        const on = p.dataset.panel === val;
        if (on && p.hidden) { p.hidden = false; p.classList.remove('panel-in'); void p.offsetWidth; if (!instant) p.classList.add('panel-in'); hydrate(p); }
        else if (!on) p.hidden = true;
      });
      if (!silent) SEG_HOOKS[name]?.(val);
    }
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(i));
      b.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = (cur + d + btns.length) % btns.length;
        select(n); btns[n].focus();
      });
    });
    const api = { select, refresh: () => place(true), value: () => btns[cur].dataset.value, index: (v) => btns.findIndex((b) => b.dataset.value === v) };
    SEGS.set(name, api);
    select(cur, { instant: true, silent: true });
    return api;
  }
  const SEG_HOOKS = {};

  /* ======================================================================
     Tab bar indicator (critically damped spring)
     ====================================================================== */
  const tabInd = $('.tab-ind');
  const tabX = new Spring(0, { damping: 1, response: 0.36 });
  tabX.onUpdate = (v) => { tabInd.style.transform = `translate3d(${v}px,0,0)`; };
  function moveTabInd(tab, instant) {
    const t = $(`.tab[data-tab="${tab}"]`);
    if (!t || !t.offsetWidth) return;
    const x = t.offsetLeft + (t.offsetWidth - tabInd.offsetWidth) / 2;
    instant ? tabX.set(x) : tabX.to(x);
  }

  /* ======================================================================
     Router
     ====================================================================== */
  const BASE_TITLE = document.title;
  const VIEWS = {
    home: { title: 'Home', tab: 'home', render: renderHome },
    fixtures: { title: 'Fixtures & results', tab: 'fixtures', render: renderFixtures },
    live: { title: 'Live Centre', tab: 'fixtures', render: renderLive },
    matchday: { title: 'Matchday', tab: 'matchday', render: renderMatchday },
    fancam: { title: 'Fan Cam', tab: 'matchday', render: renderFanCamView },
    stadium: { title: 'Stadium guide', tab: 'matchday' },
    rewards: { title: 'Rewards', tab: 'rewards', render: renderRewards },
    club: { title: 'Club', tab: 'home' },
    profile: { title: 'Profile & privacy', tab: 'profile', render: renderProfile },
    privacy: { title: 'Privacy notice', tab: 'profile' },
    operator: { title: 'Operator console', tab: 'profile', render: renderOperator },
    assets: { title: 'Asset library', tab: 'profile', render: renderAssets },
  };
  const SEG_TO_VIEW = { '': 'home', fixtures: 'fixtures', live: 'live', matchday: 'matchday', 'fan-cam': 'fancam', stadium: 'stadium', rewards: 'rewards', club: 'club', profile: 'profile', privacy: 'privacy', operator: 'operator', assets: 'assets' };
  const ORDER = Object.keys(VIEWS);
  let current = null, currentParam = null, first = true, titleObs = null;

  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { view: SEG_TO_VIEW[parts[0] || ''] || 'home', param: parts[1] || null };
  }
  function route() {
    const { view, param } = parseHash();
    if (Sheet.isOpen()) Sheet.close(0, true);
    if (!first) $$('#toasts .toast').forEach((t) => { if (Date.now() - Number(t.dataset.t) > 400) t.remove(); }); // toasts belong to the screen that raised them
    const meta = VIEWS[view];
    const el = $(`.view[data-view="${view}"]`);
    const back = current && ORDER.indexOf(view) < ORDER.indexOf(current);
    $$('.view').forEach((v) => { if (v !== el) v.classList.remove('active', 'back'); });
    el.classList.remove('active', 'back'); void el.offsetWidth;
    el.classList.add('active'); if (back) el.classList.add('back');
    hydrate(el);
    $$('[data-nav]').forEach((a) => (a.dataset.nav === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $$('.tab').forEach((a) => (a.dataset.tab === meta.tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    moveTabInd(meta.tab, first);
    document.title = view === 'home' ? BASE_TITLE : `${meta.title} · Bulls One — The Loftus Experience`;
    $('#topbarTitle').textContent = meta.title;
    if (!first) window.scrollTo(0, 0);
    current = view; currentParam = param;
    meta.render && meta.render(param);
    $$('[data-seg]', el).forEach((s) => SEGS.get(s.dataset.seg)?.refresh());
    observeTitle(el);
    if (!first) {
      const t = $$('.view-title', el).find((x) => x.getClientRects().length);
      if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    }
    first = false;
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function rerender() { VIEWS[current]?.render?.(currentParam); updateGlobal(); }
  function observeTitle(view) {
    const bar = $('#topbar');
    titleObs && titleObs.disconnect();
    const t = $$('.view-title', view).find((x) => x.getClientRects().length);
    if (!t || !('IntersectionObserver' in window)) { bar.classList.add('show-title'); return; }
    bar.classList.remove('show-title');
    titleObs = new IntersectionObserver(([e]) => bar.classList.toggle('show-title', !e.isIntersecting && e.boundingClientRect.top < 100), { rootMargin: '-60px 0px 0px 0px' });
    titleObs.observe(t);
  }
  addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 8), { passive: true });

  /* ======================================================================
     Live match (simulated feed — demo data)
     ====================================================================== */
  const LIVE = { startMin: 54, t0: Date.now(), score: { home: 24, away: 17 }, lastFeed: Date.now(), injected: false };
  const EVENTS = [
    { m: 6, team: 'home', type: 'Try', who: 'T. Nkosi', sc: '5–0' },
    { m: 7, team: 'home', type: 'Conversion', who: 'M. Swart', sc: '7–0' },
    { m: 15, team: 'away', type: 'Penalty goal', who: 'Cape Mariners', sc: '7–3' },
    { m: 24, team: 'home', type: 'Penalty goal', who: 'M. Swart', sc: '10–3' },
    { m: 31, team: 'away', type: 'Try', who: 'Cape Mariners', sc: '10–8' },
    { m: 32, team: 'away', type: 'Conversion', who: 'Cape Mariners', sc: '10–10' },
    { m: 38, team: 'home', type: 'Try', who: 'J. Mahlangu', sc: '15–10' },
    { m: 39, team: 'home', type: 'Conversion', who: 'M. Swart', sc: '17–10' },
    { m: 40, team: null, type: 'Half-time', who: 'Bulls lead at the break', sc: '17–10' },
    { m: 47, team: 'away', type: 'Try', who: 'Cape Mariners', sc: '17–15' },
    { m: 48, team: 'away', type: 'Conversion', who: 'Cape Mariners', sc: '17–17' },
    { m: 52, team: 'home', type: 'Try', who: 'K. Theron', sc: '22–17' },
    { m: 53, team: 'home', type: 'Conversion', who: 'M. Swart', sc: '24–17' },
  ];
  const STATS = [['Possession', 54, 46, '%'], ['Territory', 58, 42, '%'], ['Tackles made', 98, 112, ''], ['Line breaks', 6, 3, ''], ['Turnovers won', 5, 4, ''], ['Penalties conceded', 7, 9, '']];
  const XV = ['T. Masilela', 'H. Joubert', 'L. Dlamini', 'C. Venter', 'M. Sithole', 'F. Lombard', 'B. Khumalo', 'S. Ndlovu', 'A. Fourie', 'M. Swart', 'T. Nkosi', 'P. Mabuza', 'J. Mahlangu', 'K. Theron', 'N. Zulu'];
  const POTM = [['swart', 'M. Swart', 'Fly-half · 10', 38], ['mahlangu', 'J. Mahlangu', 'Centre · 13', 27], ['ndlovu', 'S. Ndlovu', 'No. 8', 21], ['khumalo', 'B. Khumalo', 'Flanker · 7', 14]];
  const clockSecs = () => LIVE.startMin * 60 + Math.floor((Date.now() - LIVE.t0) / 1000);
  function clockText() {
    const s = clockSecs();
    if (s >= 80 * 60) return 'FT';
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  const minute = () => Math.min(80, Math.floor(clockSecs() / 60) + 1);
  function updateScores() {
    $$('[data-score="home"]').forEach((e) => { e.textContent = LIVE.score.home; });
    $$('[data-score="away"]').forEach((e) => { e.textContent = LIVE.score.away; });
  }
  function fmtCountdown(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'now';
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return d > 0 ? `${d}d ${h}h ${String(m).padStart(2, '0')}m` : `${h}h ${String(m).padStart(2, '0')}m`;
  }
  function renderFeedStatus() {
    const el = $('#feedStatus');
    if (!el || current !== 'live') return;
    const age = Math.round((Date.now() - LIVE.lastFeed) / 1000);
    const stale = age > 30;
    el.innerHTML = `${chip('chip-demo', '', 'Demo data')}${stale ? chip('chip-warn', 'clock', `Feed delayed · last update ${age}s ago`) : chip('chip-info', 'live', `Mock provider · updated ${age}s ago`)}`;
  }
  function tick() {
    const ct = clockText();
    $$('[data-live-clock]').forEach((e) => { e.textContent = ct; });
    $$('[data-half]').forEach((e) => { e.textContent = ct === 'FT' ? 'Full time' : '2nd half'; });
    $$('[data-countdown]').forEach((e) => { e.textContent = fmtCountdown(e.dataset.countdown); });
    if (!LIVE.injected && Date.now() - LIVE.t0 > 45000) {
      LIVE.injected = true;
      LIVE.score.home = 27;
      EVENTS.push({ m: minute(), team: 'home', type: 'Penalty goal', who: 'M. Swart', sc: '27–17', fresh: true });
      LIVE.lastFeed = Date.now();
      updateScores();
      if (current === 'live') renderEvents();
      if (S.prefs.live) toast('Penalty goal · Bulls 27–17', 'Live score alert (simulated feed)', 'live');
    }
    if (!document.hidden && Date.now() - LIVE.lastFeed > 15000) LIVE.lastFeed = Date.now();
    renderFeedStatus();
  }

  /* ======================================================================
     HOME / shared bits
     ====================================================================== */
  function renderHome() { updateSeat(); }
  function updateSeat() {
    $$('[data-seat-value]').forEach((e) => { e.textContent = S.seatShown ? '50' : '••'; });
    $$('[data-action="toggle-seat"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(S.seatShown));
      b.querySelector('span').textContent = S.seatShown ? 'Hide seat' : 'Show seat';
      b.querySelector('use').setAttribute('href', S.seatShown ? '#i-eye-off' : '#i-eye');
    });
  }
  function updateGlobal() {
    const n = S.subs.filter((s) => s.status === 'pending').length;
    $$('[data-queue-count]').forEach((e) => { e.textContent = n; e.hidden = n === 0; });
    const rb = $('#roleBtn');
    rb.dataset.role = session.role;
    $('#roleLabel').textContent = session.role === 'operator' ? 'Operator' : 'Supporter';
    rb.setAttribute('aria-label', `Demo role: ${session.role === 'operator' ? 'screen producer (staff)' : 'supporter'}. Change role`);
    $('#demoStrip').hidden = S.stripDismissed;
  }

  function qrSVG() {
    let s = 4821;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const n = 25; let r = '';
    const fin = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#0B0B0A"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0B0B0A"/>`;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      const inC = x > 8 && x < 16 && y > 9 && y < 15;
      if (!inF && !inC && rnd() > 0.52) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><g fill="#0B0B0A">${r}</g>${fin(0, 0)}${fin(n - 7, 0)}${fin(0, n - 7)}<rect x="8.5" y="10" width="8" height="5" rx="0" fill="#D4E86E"/><text x="12.5" y="13.4" text-anchor="middle" font-size="2.4" font-weight="500" fill="#11130A" font-family="DM Mono,monospace" letter-spacing=".3">DEMO</text></svg>`;
  }
  function openPass(trigger) {
    Sheet.show(`
      <div class="pass">
        <div class="card-head" style="margin-bottom:6px">
          <div><p class="eyebrow" style="color:rgba(255,255,255,.8)">Bulls One · digital pass</p><p class="title-2">Bulls v Cape Mariners</p><p class="caption" style="color:rgba(255,255,255,.78)">Today · 17:00 · Loftus Versfeld</p></div>
          <span class="mono" aria-hidden="true">B1</span>
        </div>
        <div class="seat-grid"><div><small>Gate</small><strong>3</strong></div><div><small>Block</small><strong>E</strong></div><div><small>Row</small><strong>05</strong></div><div><small>Seat</small><strong>50</strong></div></div>
        <div class="qr-ph" role="img" aria-label="Placeholder pattern. This is not a ticket code.">${qrSVG()}</div>
        <p class="caption" style="text-align:center;color:rgba(255,255,255,.8)">Placeholder only. Your real entry code stays with the ticketing provider.</p>
      </div>
      <ul class="list" style="margin-top:10px">
        <li><span class="li-icon ok">${ic('shield')}</span><span class="li-main"><strong>Checked in · Gate 3 · 16:12</strong><span>From the stadium’s access-control scan (demo webhook)</span></span></li>
        <li><span class="li-icon">${ic('ticket')}</span><span class="li-main"><strong>Ticketpro reference ••••4821</strong><span>Signed reference only. Bulls One never stores the raw barcode.</span></span></li>
        <li><span class="li-icon">${ic('download')}</span><span class="li-main"><strong>Offline access</strong><span>Only where the ticket provider allows secure offline storage.</span></span></li>
      </ul>
      <a class="btn btn-primary btn-block" href="https://tickets.bullsrugby.co.za/" target="_blank" rel="noopener" style="margin-top:8px">Open the official ticket portal ${ic('ext', 'i i-sm')}</a>
      <div class="media-row" style="margin-top:18px">${imgA('12', 'alt="Concept reference: a phone showing a digital match ticket with block, row and seat"')}<p class="caption">Concept reference for the pass layout (generated image). The prototype never implies that an unverified ticket is valid for entry.</p></div>
    `, { title: 'Digital pass · demo', trigger });
  }
  function openHelp(trigger) {
    Sheet.show(`
      <p class="body-2">Stewards and guest-services staff wear high-visibility vests. Help points and first aid are marked on the stadium map.</p>
      <ul class="navlist" style="margin-top:10px">
        <li><a href="#/stadium"><span class="li-icon ok">${ic('help')}</span>Find the nearest help point${ic('chev', 'i chev')}</a></li>
        <li><a href="#/stadium"><span class="li-icon" style="background:var(--err-soft);color:var(--err)">${ic('medical')}</span>First aid on the map${ic('chev', 'i chev')}</a></li>
        <li><a href="#/stadium"><span class="li-icon">${ic('access')}</span>Accessible routes and assistance${ic('chev', 'i chev')}</a></li>
      </ul>
      <p class="source-note">${ic('info')}<span><strong>In an emergency, follow steward instructions and stadium announcements.</strong> Emergency contacts load from the venue’s approved source. They are not hard-coded in this prototype.</span></p>
      <button class="btn btn-quiet btn-block" type="button" data-action="report" style="margin-top:14px">${ic('flag')}Report an issue to guest services (demo)</button>
    `, { title: 'Help & safety', trigger });
  }

  /* ======================================================================
     FIXTURES
     ====================================================================== */
  const FIXTURES = [
    { id: 'evt-r10', iso: '2026-11-14T17:00:00+02:00', opp: 'Dublin Harps', home: true, round: 'Round 10' },
    { id: 'evt-r11', iso: '2026-11-21T15:00:00+02:00', opp: 'Durban Breakers', home: false, round: 'Round 11', venue: 'Away · Durban (demo)' },
    { id: 'evt-r12', iso: '2026-12-05T19:00:00+02:00', opp: 'Glasgow Thistles', home: true, round: 'Round 12' },
    { id: 'evt-r13', iso: '2026-12-12T17:30:00+02:00', opp: 'Highveld Comets', home: false, round: 'Round 13', venue: 'Away · Johannesburg (demo)' },
  ];
  const RESULTS = [
    { day: 'Sat 24 Oct', opp: 'Highveld Comets', home: true, us: 31, them: 20 },
    { day: 'Sat 17 Oct', opp: 'Glasgow Thistles', home: false, us: 18, them: 22 },
    { day: 'Sat 10 Oct', opp: 'Dublin Harps', home: true, us: 27, them: 13 },
    { day: 'Fri 2 Oct', opp: 'Durban Breakers', home: false, us: 24, them: 24 },
  ];
  const TABLE = [['Bulls', 8, 5, 1, 2, 64, 27], ['Dublin Harps', 8, 5, 0, 3, 41, 25], ['Cape Mariners', 8, 4, 1, 3, 22, 21], ['Glasgow Thistles', 8, 4, 0, 4, 9, 19], ['Durban Breakers', 8, 3, 1, 4, -18, 16], ['Highveld Comets', 8, 1, 1, 6, -118, 7]];
  const fxTitle = (f) => (f.home ? `Bulls v ${f.opp}` : `${f.opp} v Bulls`);
  const fxVenue = (f) => (f.home ? 'Loftus Versfeld' : f.venue);
  const fxParts = (iso) => {
    const d = new Date(iso);
    const p = (o) => d.toLocaleDateString('en-ZA', { timeZone: TZ, ...o });
    return { wd: p({ weekday: 'short' }), day: p({ day: 'numeric' }), mon: p({ month: 'short' }), time: d.toLocaleTimeString('en-ZA', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) };
  };
  function renderFixtures(param) {
    $('#upcomingList').innerHTML = FIXTURES.map((f) => {
      const p = fxParts(f.iso);
      return `<article class="card">
        <div class="fixture"><div class="fx-date"><small>${esc(p.wd)}</small><strong>${esc(p.day)}</strong><small>${esc(p.mon)}</small></div>
          <div><p class="title-3">${esc(fxTitle(f))}</p><p class="caption" style="margin-top:4px">${p.time} · ${esc(fxVenue(f))} · ${f.round}</p><div class="chips" style="margin-top:8px">${chip('chip-demo', '', 'Demo')}${f.home ? chip('chip-info', 'home', 'Home') : chip('', 'arrow', 'Away')}</div></div></div>
        <div class="fx-actions">
          <button class="btn btn-quiet btn-sm" type="button" data-action="fixture" data-id="${f.id}">Details</button>
          <button class="btn btn-quiet btn-sm" type="button" data-action="ics" data-id="${f.id}">${ic('calendar', 'i i-sm')}Add to calendar</button>
          ${f.home ? `<a class="btn btn-quiet btn-sm" href="https://tickets.bullsrugby.co.za/" target="_blank" rel="noopener">Tickets${ic('ext', 'i i-sm')}</a>` : ''}
        </div></article>`;
    }).join('');
    $('#resultsList').innerHTML = RESULTS.map((r) => {
      const res = r.us > r.them ? ['W', 'chip-ok', 'Won'] : r.us < r.them ? ['L', 'chip-err', 'Lost'] : ['D', 'chip-warn', 'Drawn'];
      return `<li><span class="chip ${res[1]}" aria-label="${res[2]}" style="min-width:32px;justify-content:center">${res[0]}</span><span class="li-main"><strong>${r.home ? `Bulls v ${esc(r.opp)}` : `${esc(r.opp)} v Bulls`}</strong><span>${r.day} · ${r.home ? 'Loftus Versfeld' : 'Away'} · demo result</span></span><span class="li-end result">${r.home ? `${r.us}–${r.them}` : `${r.them}–${r.us}`}</span></li>`;
    }).join('');
    $('#tableBody').innerHTML = TABLE.map((t, i) => `<tr class="${t[0] === 'Bulls' ? 'us' : ''}"><td>${i + 1}</td><td>${t[0]}</td><td>${t[1]}</td><td>${t[2]}</td><td>${t[3]}</td><td>${t[4]}</td><td>${t[5] > 0 ? '+' : ''}${t[5]}</td><td><strong>${t[6]}</strong></td></tr>`).join('');
    if (param && FIXTURES.some((f) => f.id === param)) requestAnimationFrame(() => openFixture(param));
  }
  function openFixture(id, trigger) {
    const f = FIXTURES.find((x) => x.id === id);
    if (!f) return;
    const p = fxParts(f.iso);
    Sheet.show(`
      <div class="feature" style="min-height:200px">${imgA(f.home ? '09' : '02')}<div class="feature-body"><div class="chips">${chip('chip-demo', '', 'Demo fixture')}</div><p class="title-2" style="margin-top:8px">${esc(fxTitle(f))}</p></div></div>
      <ul class="list" style="margin-top:8px">
        <li><span class="li-icon">${ic('calendar')}</span><span class="li-main"><strong>${esc(`${p.wd} ${p.day} ${p.mon}`)} · ${p.time} SAST</strong><span>Kick-off in <span class="num" data-countdown="${f.iso}">${fmtCountdown(f.iso)}</span></span></span></li>
        <li><span class="li-icon">${ic('pin')}</span><span class="li-main"><strong>${esc(fxVenue(f))}</strong><span>${f.home ? '416 Kirkness Street, Pretoria' : 'Travelling supporters: check the host venue’s guidance'}</span></span></li>
        <li><span class="li-icon">${ic('trophy')}</span><span class="li-main"><strong>Club Championship · ${f.round}</strong><span>Fictional competition for demo purposes</span></span></li>
        <li><span class="li-icon muted">${ic('info')}</span><span class="li-main"><strong>Weather</strong><span>Shown only when a reliable weather feed is connected.</span></span></li>
      </ul>
      <div class="row-gap" style="margin-top:12px">
        ${f.home ? `<a class="btn btn-primary btn-sm" href="https://tickets.bullsrugby.co.za/" target="_blank" rel="noopener">Official tickets${ic('ext', 'i i-sm')}</a>` : ''}
        <button class="btn btn-quiet btn-sm" type="button" data-action="ics" data-id="${f.id}">${ic('calendar', 'i i-sm')}Add to calendar</button>
      </div>`, { title: fxTitle(f), trigger });
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function downloadICS(id) {
    const f = FIXTURES.find((x) => x.id === id);
    if (!f) return;
    const icsEsc = (s) => s.replace(/[,;\\]/g, (c) => '\\' + c);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const start = new Date(f.iso), end = new Date(start.getTime() + 2 * 36e5);
    const loc = f.home ? 'Loftus Versfeld Stadium, 416 Kirkness Street, Pretoria' : f.venue;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bulls One//Concept Prototype//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${f.id}@bulls-one.example`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${icsEsc(fxTitle(f))} (DEMO)`, `LOCATION:${icsEsc(loc)}`, 'DESCRIPTION:Demo fixture from the Bulls One concept prototype. Confirm official fixtures at bullsrugby.co.za.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    download(`bulls-one-${f.id}.ics`, ics, 'text/calendar');
    toast('Calendar file downloaded', `${fxTitle(f)} · demo fixture`, 'calendar');
  }

  /* ======================================================================
     LIVE CENTRE
     ====================================================================== */
  function renderLive() {
    renderEvents();
    $('#statsList').innerHTML = STATS.map(([label, a, b, u]) => {
      const t = a + b;
      return `<div class="stat"><div class="stat-top"><span>${a}${u}</span><span>${label}</span><span>${b}${u}</span></div><div class="stat-bar" role="img" aria-label="${label}: Bulls ${a}${u}, Cape Mariners ${b}${u}"><i style="flex:${a / t}"></i><i style="flex:${b / t}"></i></div></div>`;
    }).join('') + `<p class="caption" style="margin-top:12px">Stats in production come from a licensed provider (for example Opta), with a source timestamp.</p>`;
    $('#lineupList').innerHTML = XV.map((n, i) => `<li><b>${i + 1}</b>${esc(n)}</li>`).join('');
    renderPotm();
    renderPrediction();
  }
  function renderEvents() {
    const list = $('#eventList');
    if (!list) return;
    list.innerHTML = EVENTS.slice().reverse().map((e) => `<li class="${e.fresh ? 'new' : ''}"><span class="min">${e.m}′</span><span class="ev"><strong>${esc(e.type)}${e.team ? ` · ${e.team === 'home' ? 'Bulls' : 'Cape Mariners'}` : ''}</strong><span>${esc(e.who)}</span></span><span class="sc">${e.sc}</span></li>`).join('');
    EVENTS.forEach((e) => { e.fresh = false; });
  }
  function renderPotm() {
    const voted = S.potm;
    $('#potmOptions').innerHTML = POTM.map(([id, name, pos, pct]) => `
      <label class="vote-opt">${voted ? `<span class="bar" style="transform:scaleX(${pct / 100})"></span>` : ''}
        <input class="check" type="radio" name="potm" value="${id}" ${voted === id ? 'checked' : ''} ${voted ? 'disabled' : ''}>
        <span><strong style="display:block;font-weight:650">${esc(name)}</strong><span class="caption">${pos}</span></span>
        ${voted ? `<span class="pct">${pct}%</span>` : ''}
      </label>`).join('');
    const btn = $('#potmForm button[type="submit"]');
    btn.disabled = !!voted;
    btn.textContent = voted ? 'Vote recorded · demo results' : 'Vote';
  }
  function renderPrediction() {
    const p = S.prediction || { home: 27, away: 20 };
    $('[data-pred-out="home"]').textContent = p.home;
    $('[data-pred-out="away"]').textContent = p.away;
    $$('[data-pred]').forEach((b) => { b.disabled = !!S.prediction; });
    const lock = $('[data-action="lock-prediction"]');
    lock.disabled = !!S.prediction;
    lock.textContent = S.prediction ? 'Prediction locked' : 'Lock in prediction';
    $('#predictNote').textContent = S.prediction ? `Locked at ${hm(S.prediction.at)}: Bulls ${p.home}–${p.away} Mariners. Points after full time if you’re right.` : '';
  }

  /* ======================================================================
     MATCHDAY
     ====================================================================== */
  const STATUS_TEXT = { pending: 'In the moderation queue', held: 'On hold', approved: 'Approved · scheduled', onair: 'On the big screen now', shown: 'Shown on the big screen', rejected: 'Not approved', withdrawn: 'Withdrawn', expired: 'Removed from future use' };
  function renderMatchday() {
    updateSeat();
    const own = ownSubs()[0];
    const items = [
      ['Ticket linked', 'Ticketpro (demo) · ref ••••4821', true, 'ticket'],
      ['Checked in', 'Gate 3 · 16:12 · gate scan', true, 'shield'],
      ['Fan Cam moment', own ? STATUS_TEXT[own.status] : 'Optional · submit a photo for the big screen', !!own && ['approved', 'onair', 'shown'].includes(own.status), 'camera'],
      ['Golden Ticket Drop', S.golden ? `Entered · ${S.golden.ref}` : 'Open now · enter before 70′', !!S.golden, 'gift'],
      ['Half-time quiz', S.quiz ? (S.quiz.correct ? 'Answered correctly · +25 pts' : 'Answered') : 'Not answered yet', !!S.quiz, 'spark'],
    ];
    $('#mdChecklist').innerHTML = items.map(([t, s, done, icon]) => `<li><span class="li-icon ${done ? 'ok' : 'muted'}">${ic(done ? 'check' : icon)}</span><span class="li-main"><strong>${t}</strong><span>${esc(s)}</span></span><span class="li-end caption">${done ? 'Done' : 'To do'}</span></li>`).join('');
    const teaser = $('[data-fc-teaser]');
    if (teaser) teaser.textContent = own ? `Your moment: ${STATUS_TEXT[own.status].toLowerCase()}.` : 'Choose a moment, add a photo and say exactly what you agree to share.';
    $$('[data-golden-short]').forEach((e) => { e.textContent = S.golden ? 'Entered' : 'Enter the drop'; });
  }

  /* ======================================================================
     Creative (identical in supporter preview and operator studio)
     ====================================================================== */
  const displayName = (s) => (s.moment === 'family' ? s.name.trim().replace(/\s*family$/i, '') : s.name.trim());
  const headline = (s) => MOMENTS[s.moment].head.replace('{n}', displayName(s));
  const headHTML = (s) => MOMENTS[s.moment].head.split('{n}').map(esc).join(`<em>${esc(displayName(s))}</em>`);
  const photoImg = (s, attrs = 'alt=""') => (s.photo ? `<img src="${s.photo}" ${attrs}>` : imgA(s.asset || MOMENTS[s.moment].asset, attrs));
  const fallbackBG = () => `<div class="led-bg">${imgA('18')}<p class="loop-copy"><small>Bulls One · Loftus</small>Make some <em>noise!</em></p></div>`;
  function creativeHTML(s, { region = 'full', anim = false } = {}) {
    const head = headHTML(s);
    const len = headline(s).length;
    const size = len <= 22 ? 'xl' : len <= 32 ? 'lg' : 'md';
    const m = MOMENTS[s.moment];
    const block = s.consents.seat ? `<span class="cr-block">BLOCK ${esc(s.block)}</span>` : '';
    const a = anim ? ' materialize' : '';
    if (region === 'lower') {
      return `<div class="creative lower${a}"><div class="lower-bar"><div class="cr-photo">${photoImg(s)}</div><div><span class="cr-tag">BULLS ONE · FAN CAM</span><p class="cr-head">${head}</p><p class="cr-sub">${esc(m.sub)}</p></div>${block}</div><span class="cr-demo">DEMO</span></div>`;
    }
    return `<div class="creative full${a}"><div class="cr-photo">${photoImg(s)}</div><div class="cr-copy"><span class="cr-tag">BULLS ONE · FAN CAM</span><p class="cr-head ${size}">${head}</p><p class="cr-sub">${esc(m.sub)}</p>${block}</div><span class="cr-mono">B1</span><span class="cr-demo">DEMO</span></div>`;
  }
  const ledLabel = (s) => `Stadium screen preview: ${headline(s)} ${MOMENTS[s.moment].sub}${s.consents.seat ? ` Block ${s.block}.` : ''}`;
  function ledHTML(s, opts = {}) {
    return `<div class="led" role="img" aria-label="${esc(ledLabel(s))}">${opts.region === 'lower' ? fallbackBG() : ''}${creativeHTML(s, opts)}${opts.guides ? '<div class="safe-guides"><span>Action safe 90% · title safe 80%</span></div>' : ''}</div>`;
  }

  /* ======================================================================
     FAN CAM (supporter)
     ====================================================================== */
  const STEPS = ['Ticket', 'Moment', 'Photo & name', 'Permissions', 'Preview'];
  const LIMIT = 2;
  const blankDraft = () => ({ moment: null, name: '', src: null, kind: null, crop: null, photo: null, consents: { screen: false, gallery: false, marketing: false, seat: false, everyone: false, guardian: false }, age: null, touched: false });
  const FC = { step: 0, dir: 'fwd', creating: false, d: blankDraft(), err: {}, cropExport: null };
  const WORDS = ['blind', 'idiot', 'stupid', 'loser', 'useless', 'rubbish', 'sucks', 'hate', 'kill', 'damn'];
  function nameError(v, family) {
    const n = v.trim().replace(/\s+/g, ' ');
    if (!n) return family ? 'Enter your family name.' : 'Enter the name you want on screen.';
    if (n.length < 2) return 'Use at least 2 letters.';
    if (n.length > 16) return 'Keep it to 16 characters so it fits the screen.';
    if (/@|\d{3,}|www\.|\.(com|co\.za|net)/i.test(n)) return 'Don’t include contact details, numbers or links.';
    if (!/^[\p{L}][\p{L}\p{M}'’\- ]*$/u.test(n)) return 'Use letters, spaces, hyphens and apostrophes only.';
    return null;
  }
  const usedSubs = () => ownSubs().filter((s) => s.status !== 'withdrawn').length;

  function renderFanCamView() { renderFC(); renderGallery(); }
  function renderGallery() {
    const items = S.subs.filter((s) => ['approved', 'onair', 'shown'].includes(s.status) && s.consents.gallery);
    $('#fanGallery').innerHTML = items.length
      ? `<div class="gallery">${items.map((s) => `<figure>${photoImg(s, `alt="${esc(displayName(s))}’s Fan Cam photo"`)}<figcaption>${esc(displayName(s))} · ${esc(MOMENTS[s.moment].label)}</figcaption></figure>`).join('')}</div>`
      : `<div class="empty">No gallery moments yet. Approved moments appear here only when the supporter opted in.</div>`;
    hydrate($('#fanGallery'));
  }
  function renderFC(focusHeading = false) {
    const panel = $('#fcPanel');
    if (!panel) return;
    const latest = ownSubs()[0];
    FC.cropExport = null;
    if (latest && !FC.creating) {
      panel.innerHTML = statusHTML(latest);
      hydrate(panel);
      return;
    }
    const st = FC.step;
    panel.innerHTML = `
      <div class="steps" aria-hidden="true">${STEPS.map((_, i) => `<span class="${i < st ? 'done' : i === st ? 'now' : ''}"></span>`).join('')}</div>
      <p class="step-label"><span>Step ${st + 1} of ${STEPS.length} · ${STEPS[st]}</span>${latest ? '<button class="link-btn" type="button" data-fc="cancel">Cancel</button>' : ''}</p>
      <div class="step-body ${FC.dir}">${stepHTML(st)}</div>
      <div class="step-actions">
        ${st > 0 ? `<button class="btn btn-quiet" type="button" data-fc="back">${ic('back')}Back</button>` : ''}
        <button class="btn btn-primary" type="button" data-fc="${st === STEPS.length - 1 ? 'submit' : 'next'}">${st === STEPS.length - 1 ? `${ic('send')}Submit for review` : `Continue${ic('arrow')}`}</button>
      </div>`;
    FC.dir = '';
    hydrate(panel);
    if (st === 2) initCrop();
    if (focusHeading) $('.step-body h3', panel)?.focus({ preventScroll: false });
  }
  const errHTML = (msg, id = '') => (msg ? `<p class="error-msg" ${id ? `id="${id}"` : ''} role="alert">${ic('info', 'i i-sm')}<span>${esc(msg)}</span></p>` : '');
  function stepHTML(st) {
    const d = FC.d;
    if (st === 0) {
      return `<h3 class="title-2" tabindex="-1">Check your ticket</h3>
        <p class="body-2" style="margin-top:6px">Fan Cam is open to supporters with a verified ticket who’ve checked in at the gate.</p>
        <ul class="list" style="margin-top:8px">
          <li><span class="li-icon ok">${ic('ticket')}</span><span class="li-main"><strong>Ticket linked</strong><span>Ticketpro (demo) · signed ref ••••4821</span></span>${chip('chip-ok', 'check', 'Verified')}</li>
          <li><span class="li-icon ok">${ic('shield')}</span><span class="li-main"><strong>Checked in · Gate 3 · 16:12</strong><span>From the gate scan, not your phone’s location</span></span>${chip('chip-ok', 'check', 'Verified')}</li>
          <li><span class="li-icon">${ic('pin')}</span><span class="li-main"><strong>Block E · Row 05</strong><span>Routes your moment to the producer. Your exact seat is never shown on screen.</span></span></li>
        </ul>
        <p class="caption" style="margin-top:8px">${usedSubs()} of ${LIMIT} Fan Cam submissions used for this match.</p>`;
    }
    if (st === 1) {
      return `<fieldset><legend class="title-2" tabindex="-1">Choose your moment</legend>
        <p class="body-2" style="margin:6px 0 14px">This sets the message on the big screen.</p>
        <div class="choices">${Object.entries(MOMENTS).map(([k, m]) => `
          <label class="choice">${imgA(m.asset)}<input class="check" type="radio" name="fcMoment" value="${k}" ${d.moment === k ? 'checked' : ''}><strong>${esc(m.label)}</strong><span>${esc(m.desc)}</span></label>`).join('')}
        </div></fieldset>${errHTML(FC.err.moment)}`;
    }
    if (st === 2) {
      const fam = d.moment === 'family';
      const nErr = d.touched ? nameError(d.name, fam) : null;
      return `<h3 class="title-2" tabindex="-1">Photo &amp; name</h3>
        <p class="body-2" style="margin-top:6px">Use a photo of yourself, or your group if everyone agrees. Drag to frame it.</p>
        <div style="margin-top:16px">${d.src
          ? `<div class="crop" tabindex="0" role="group" aria-roledescription="photo framer" aria-label="Photo framing. Drag, or use the arrow keys, to move the photo."><img src="${d.src}" alt="Your photo"></div>
             <div class="zoom"><span class="caption">Zoom</span><input type="range" min="1" max="3" step="0.01" value="${d.crop ? d.crop.zoom : 1}" data-fc-zoom aria-label="Zoom photo"></div>`
          : `<div class="crop crop-empty">${ic('camera', 'i i-lg')}<span>No photo yet</span></div>`}</div>
        <div class="upload-row">
          <label class="btn btn-quiet btn-sm file-btn">${ic('upload')}Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" data-fc-file aria-label="Upload a photo: JPG, PNG or WebP, up to 8 megabytes"></label>
          <button class="btn btn-quiet btn-sm" type="button" data-fc="sample">${ic('image')}Use sample photo</button>
        </div>
        ${errHTML(FC.err.photo)}
        <p class="caption" style="margin-top:10px;display:flex;gap:6px;align-items:center">${ic('shield', 'i i-sm')}Location and camera data are removed before upload. JPG, PNG or WebP, up to 8 MB.</p>
        <div class="field" style="margin-top:20px">
          <label for="fcName">${fam ? 'Family name' : 'Name on screen'}</label>
          <input class="input" id="fcName" maxlength="16" autocomplete="nickname" spellcheck="false" value="${esc(d.name)}" aria-describedby="fcNameHint${nErr ? ' fcNameErr' : ''}" ${nErr ? 'aria-invalid="true"' : ''}>
          <p class="hint" id="fcNameHint" style="display:flex;gap:8px"><span>${fam ? 'For example “Mokoena” — the screen shows “The Mokoena family”.' : 'First name or nickname. Never your full name, phone or email.'}</span><span class="counter" data-fc-count>${d.name.length}/16</span></p>
          <div data-fc-name-err>${errHTML(nErr, 'fcNameErr')}</div>
        </div>`;
    }
    if (st === 3) {
      const c = d.consents;
      const cb = (k, title, sub, req) => `<label class="consent"><input class="check" type="checkbox" data-consent="${k}" ${c[k] ? 'checked' : ''}><div><strong>${title}${req ? '<span class="req">Required</span>' : ''}</strong><span>${sub}</span></div></label>`;
      return `<h3 class="title-2" tabindex="-1">Your permissions</h3>
        <p class="body-2" style="margin-top:6px">Each choice is separate. Nothing is ticked for you.</p>
        <p class="fieldset-title">Stadium screen</p>
        ${cb('screen', 'Show my photo and display name on the stadium screen at today’s match', 'Consent wording v1.2. You can withdraw any time before it’s shown.', true)}
        <p class="fieldset-title">Optional — choose separately</p>
        ${cb('gallery', 'Add it to the Bulls One fan gallery', 'Visible to other supporters in the app after approval.')}
        ${cb('marketing', 'Let the club reuse it in marketing and on social media', 'Separate from the screen. Off unless you tick it.')}
        ${cb('seat', 'Show my block on screen (“BLOCK E”)', 'Your row and exact seat are never shown.')}
        <p class="fieldset-title" id="ageLbl">Who’s in the photo?</p>
        <div role="radiogroup" aria-labelledby="ageLbl">
          <label class="consent"><input class="check" type="radio" name="fcAge" value="adult" ${d.age === 'adult' ? 'checked' : ''}><div><strong>Only adults (18+)</strong></div></label>
          <label class="consent"><input class="check" type="radio" name="fcAge" value="minor" ${d.age === 'minor' ? 'checked' : ''}><div><strong>Someone under 18 is pictured</strong><span>A parent or guardian must give permission.</span></div></label>
        </div>
        ${d.age === 'minor' ? `<div style="margin-top:10px">${cb('guardian', 'I’m the parent or legal guardian of every child pictured, and I give permission', 'Without this, photos of children aren’t shown publicly.', true)}</div>` : ''}
        <div style="margin-top:10px">${cb('everyone', 'I’m in this photo, and everyone pictured agreed to appear', 'Don’t submit photos of people who haven’t agreed.', true)}</div>
        ${errHTML(FC.err.consent)}`;
    }
    const s = draftSub();
    const yn = (v) => (v ? 'Yes' : 'No');
    return `<h3 class="title-2" tabindex="-1">Preview</h3>
      <p class="body-2" style="margin:6px 0 14px">This is exactly what the screen producer sees and may show.</p>
      ${ledHTML(s)}
      <dl class="summary">
        <dt>Moment</dt><dd>${esc(MOMENTS[s.moment].label)}</dd>
        <dt>Name</dt><dd>${esc(displayName(s))}</dd>
        <dt>Stadium screen</dt><dd>Yes</dd>
        <dt>Fan gallery</dt><dd>${yn(s.consents.gallery)}</dd>
        <dt>Marketing reuse</dt><dd>${yn(s.consents.marketing)}</dd>
        <dt>Block on screen</dt><dd>${yn(s.consents.seat)}</dd>
        <dt>Ticket</dt><dd>Verified · checked in at Gate 3</dd>
      </dl>
      <p class="caption" style="margin-top:12px">Submitting doesn’t guarantee screen time. You’ll get an in-app update after review.</p>`;
  }
  function draftSub() {
    const d = FC.d;
    return { name: d.name.trim().replace(/\s+/g, ' '), moment: d.moment || 'fancam', photo: d.photo, asset: d.photo ? null : '01', block: 'E', consents: { screen: d.consents.screen, gallery: d.consents.gallery, marketing: d.consents.marketing, seat: d.consents.seat } };
  }
  function validateStep(st) {
    const d = FC.d;
    FC.err = {};
    if (st === 1 && !d.moment) FC.err.moment = 'Choose a moment to continue.';
    if (st === 2) {
      if (!d.src) FC.err.photo = 'Add a photo, or use the sample photo for this demo.';
      d.touched = true;
      if (nameError(d.name, d.moment === 'family')) FC.err.name = true;
    }
    if (st === 3) {
      const c = d.consents;
      if (!c.screen) FC.err.consent = 'Tick the stadium-screen permission to submit. Without it, nothing can be shown.';
      else if (!d.age) FC.err.consent = 'Tell us who’s in the photo.';
      else if (d.age === 'minor' && !c.guardian) FC.err.consent = 'A parent or guardian must give permission for children pictured.';
      else if (!c.everyone) FC.err.consent = 'Confirm that everyone pictured agreed to appear.';
    }
    return !Object.keys(FC.err).length;
  }
  function fcNext() {
    const st = FC.step;
    if (st === 2 && FC.cropExport) {
      try { FC.d.photo = FC.cropExport(); } catch (_) { FC.d.photo = null; }
    }
    if (!validateStep(st)) {
      renderFC();
      const e = $('#fcPanel [aria-invalid="true"], #fcPanel .error-msg');
      if (e) (e.matches('input') ? e : $('#fcPanel .step-body h3, #fcPanel legend'))?.focus();
      haptic([8, 40, 8]);
      return;
    }
    FC.step = Math.min(STEPS.length - 1, st + 1);
    FC.dir = 'fwd';
    renderFC(true);
  }
  function fcBack() {
    if (FC.step === 2 && FC.cropExport) { try { FC.d.photo = FC.cropExport(); } catch (_) { /* keep */ } }
    FC.err = {};
    FC.step = Math.max(0, FC.step - 1);
    FC.dir = 'back';
    renderFC(true);
  }
  function fcSubmit() {
    if (usedSubs() >= LIMIT) { toast('Submission limit reached', `${LIMIT} Fan Cam submissions per ticket per match.`, 'info', 'gold'); return; }
    const d = FC.d;
    const n = 1046 + S.subs.length - 4;
    const s = {
      id: `FC-${n}`, own: true, name: d.name.trim().replace(/\s+/g, ' '), moment: d.moment, photo: d.photo, asset: d.photo ? null : '01',
      block: 'E', gate: 'Gate 3', checkIn: '16:12',
      consents: { screen: true, gallery: d.consents.gallery, marketing: d.consents.marketing, seat: d.consents.seat },
      minor: d.age === 'minor', flags: [], status: 'pending', at: Date.now(),
    };
    if (WORDS.some((w) => s.name.toLowerCase().includes(w))) s.flags.push('Word filter: review the display name (aid only)');
    if (s.minor) s.flags.push('Includes a minor · guardian consent recorded');
    S.subs.push(s);
    [['screen', 'Fan Cam: show photo & name on the stadium screen (this match)'], ['gallery', 'Fan Cam: show in the Bulls One fan gallery'], ['marketing', 'Fan Cam: club marketing & social reuse'], ['seat', 'Fan Cam: show my block on screen']]
      .forEach(([k, label]) => { if (s.consents[k]) S.consents.push({ id: rid('C'), purpose: label, version: 'fc-v1.2', at: Date.now(), event: 'evt-r9', subId: s.id, key: k }); });
    if (s.minor) S.consents.push({ id: rid('C'), purpose: 'Parent/guardian permission for a child pictured (Fan Cam)', version: 'fc-guardian-v1.0', at: Date.now(), event: 'evt-r9', subId: s.id, key: 'guardian' });
    audit('supporter (Lerato)', 'Fan Cam submitted', s.id, 'Queued for moderation');
    audit('system', 'Ticket & attendance check', s.id, 'Verified · Gate 3 check-in');
    audit('system', 'Consent recorded', s.id, `fc-v1.2 · ${Object.keys(s.consents).filter((k) => s.consents[k]).join(', ')}`);
    save();
    FC.creating = false; FC.d = blankDraft(); FC.step = 0; FC.err = {};
    haptic(15);
    toast('Submitted for review', 'A screen producer checks it before anything goes live.', 'check');
    renderFC(); updateGlobal();
    $('#fcPanel').scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }
  function statusHTML(s) {
    const order = ['submitted', 'checks', 'review', 'approved', 'screen'];
    const map = { pending: 2, held: 2, rejected: 2, approved: 3, onair: 4, shown: 5, withdrawn: -1, expired: 5 };
    const pos = map[s.status];
    const reviewSub = { pending: 'A producer is reviewing it now', held: 'On hold — a producer may come back to it', rejected: `Not approved${s.reason ? `: ${s.reason}` : ''}` }[s.status] || 'Photo, name and permissions checked';
    const rows = [
      ['Submitted', hm(s.at)],
      ['Ticket & consent checks', 'Verified · Gate 3 check-in'],
      ['Human review', reviewSub],
      ['Approved & scheduled', s.status === 'approved' ? 'Waiting for a screen slot' : s.approvedAt ? `Approved ${hm(s.approvedAt)}` : 'Not yet'],
      ['On the big screen', s.status === 'onair' ? 'Showing now' : s.shownAt ? `Shown ${hm(s.shownAt)}` : 'Not yet'],
    ];
    const tracker = s.status === 'withdrawn'
      ? `<div class="empty">You withdrew this submission. It won’t be shown, and the producer can no longer see it.</div>`
      : `<ol class="tracker">${rows.map(([t, sub], i) => {
          let cls = i < pos ? 'done' : i === pos ? 'now' : '';
          if (s.status === 'rejected' && i === 2) cls = 'bad';
          if (s.status === 'expired' && i >= 3 && !s.shownAt) cls = '';
          const icon = cls === 'done' ? 'check' : cls === 'bad' ? 'x' : cls === 'now' ? 'clock' : '';
          return `<li class="${cls}"><span class="t-dot">${icon ? ic(icon) : ''}</span><div><strong>${t}</strong><span>${esc(sub)}</span></div></li>`;
        }).join('')}</ol>`;
    const canWithdraw = ['pending', 'held', 'approved'].includes(s.status);
    const canNew = usedSubs() < LIMIT && ['shown', 'rejected', 'withdrawn', 'expired'].includes(s.status);
    const recap = s.status === 'shown' ? `
      <div class="card-gold card" style="margin-top:16px">
        <p class="eyebrow" style="color:var(--champagne)">${ic('star', 'i i-sm')}Recap</p>
        <p class="title-2">You were on the big screen!</p>
        <p class="body-2" style="margin:6px 0 14px">North main LED · ${hm(s.shownAt)} · +50 points and the Fan Cam star badge.</p>
        ${ledHTML(s, { region: s.region || 'full' })}
      </div>` : '';
    return `
      <div class="card-head"><div><p class="eyebrow">Your Fan Cam · ${s.id}</p><h3 class="title-2" tabindex="-1">${esc(STATUS_TEXT[s.status])}</h3></div>${statusChip(s)}</div>
      ${s.status !== 'shown' ? `<div style="margin-bottom:16px">${ledHTML(s)}</div>` : ''}
      ${tracker}
      ${recap}
      <div class="row-gap" style="margin-top:18px">
        ${canWithdraw ? `<button class="btn btn-quiet btn-sm" type="button" data-fc="withdraw" data-id="${s.id}">${ic('x')}Withdraw</button>` : ''}
        ${canNew ? `<button class="btn btn-primary btn-sm" type="button" data-fc="new">${ic('camera')}New submission</button>` : ''}
        ${s.status === 'pending' && session.role === 'supporter' ? `<button class="btn btn-glass btn-sm" type="button" data-fc="to-operator">${ic('screen')}Demo: review as an operator</button>` : ''}
      </div>
      <p class="caption" style="margin-top:12px">${usedSubs()} of ${LIMIT} submissions used · Approval isn’t guaranteed and timing depends on the match.</p>`;
  }
  function statusChip(s) {
    const m = {
      pending: ['chip-info', 'clock', 'In review'], held: ['chip-warn', 'pause', 'Held'], approved: ['chip-ok', 'check', 'Approved'],
      onair: ['chip-live', 'live', 'On air'], shown: ['chip-gold', 'star', 'Shown'], rejected: ['chip-err', 'x', 'Rejected'],
      withdrawn: ['', 'x', 'Withdrawn'], expired: ['', 'history', 'Expired'],
    }[s.status];
    return chip(m[0], m[1], m[2]);
  }
  async function handleFile(file) {
    FC.err.photo = null;
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { FC.err.photo = 'Use a JPG, PNG or WebP photo.'; renderFC(); return; }
    if (file.size > 8 * 1024 * 1024) { FC.err.photo = 'That photo is over 8 MB. Choose a smaller one.'; renderFC(); return; }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); // re-encode: strips EXIF/GPS
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      FC.d.src = URL.createObjectURL(blob); FC.d.kind = 'upload'; FC.d.crop = null; FC.d.photo = null;
    } catch (_) {
      FC.err.photo = 'We couldn’t read that photo. Try another one.';
    } finally { URL.revokeObjectURL(url); }
    renderFC();
  }
  function initCrop() {
    const frame = $('#fcPanel .crop:not(.crop-empty)');
    if (!frame) return;
    const img = frame.querySelector('img');
    const start = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const fw = frame.clientWidth, fh = frame.clientHeight;
      if (!fw || !W) return;
      const base = Math.max(fw / W, fh / H);
      const st = FC.d.crop || { zoom: 1, cx: 0.5, cy: 0.4 };
      let zoom = st.zoom;
      const scale = () => base * zoom;
      const bounds = () => ({ minX: fw - W * scale(), minY: fh - H * scale() });
      const sx = new Spring(0, { damping: 1, response: 0.4 }), sy = new Spring(0, { damping: 1, response: 0.4 });
      img.style.width = `${W}px`; img.style.height = `${H}px`;
      const apply = () => { img.style.transform = `translate3d(${sx.x}px, ${sy.x}px, 0) scale(${scale()})`; };
      sx.onUpdate = apply; sy.onUpdate = apply;
      const center = () => ({ cx: (fw / 2 - sx.x) / (W * scale()), cy: (fh / 2 - sy.x) / (H * scale()) });
      const persist = () => { FC.d.crop = { zoom, ...center() }; };
      const fromCenter = (cx, cy) => { const b = bounds(); sx.set(clamp(fw / 2 - cx * W * scale(), b.minX, 0)); sy.set(clamp(fh / 2 - cy * H * scale(), b.minY, 0)); };
      fromCenter(st.cx, st.cy);
      let drag = null;
      frame.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        frame.setPointerCapture(e.pointerId);
        sx.stop(); sy.stop(); // grab mid-flight from the live position
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ox: sx.x, oy: sy.x, hist: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
      });
      frame.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const b = bounds();
        sx.x = band(drag.ox + e.clientX - drag.x0, b.minX, 0, fw);
        sy.x = band(drag.oy + e.clientY - drag.y0, b.minY, 0, fh);
        apply();
        drag.hist.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
        if (drag.hist.length > 8) drag.hist.shift();
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const v = velocity(drag.hist);
        drag = null;
        const b = bounds();
        sx.to(clamp(sx.x + project(v.x, 0.995), b.minX, 0), { velocity: v.x, onRest: persist });
        sy.to(clamp(sy.x + project(v.y, 0.995), b.minY, 0), { velocity: v.y, onRest: persist });
      };
      frame.addEventListener('pointerup', end);
      frame.addEventListener('pointercancel', end);
      frame.addEventListener('keydown', (e) => {
        const k = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
        if (!k) return;
        e.preventDefault();
        const b = bounds();
        sx.to(clamp(sx.target + k[0], b.minX, 0), { onRest: persist });
        sy.to(clamp(sy.target + k[1], b.minY, 0), { onRest: persist });
      });
      const z = $('#fcPanel [data-fc-zoom]');
      z && z.addEventListener('input', () => { const c = center(); zoom = Number(z.value); fromCenter(c.cx, c.cy); persist(); });
      FC.cropExport = () => {
        persist();
        const k = 800 / fw;
        const c = document.createElement('canvas');
        c.width = 800; c.height = Math.round(fh * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0B0B0A'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, sx.x * k, sy.x * k, W * scale() * k, H * scale() * k);
        return c.toDataURL('image/jpeg', 0.86);
      };
    };
    if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
  }
  function withdrawSub(id, by = 'supporter (Lerato)') {
    const s = S.subs.find((x) => x.id === id);
    if (!s || !['pending', 'held', 'approved'].includes(s.status)) return;
    s.status = 'withdrawn';
    S.consents.filter((c) => c.subId === id && !c.withdrawnAt).forEach((c) => { c.withdrawnAt = Date.now(); });
    audit(by, 'Consent withdrawn · submission removed', id, 'Removed from queue');
    save();
  }

  // Fan Cam event delegation
  const fcPanel = $('#fcPanel');
  fcPanel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fc]');
    if (!b) return;
    const a = b.dataset.fc;
    if (a === 'next') fcNext();
    else if (a === 'back') fcBack();
    else if (a === 'submit') { if (validateStep(3)) fcSubmit(); else { FC.step = 3; renderFC(true); } }
    else if (a === 'sample') { FC.d.src = A['01'].url; FC.d.kind = 'sample'; FC.d.crop = null; FC.d.photo = null; FC.err.photo = null; renderFC(); }
    else if (a === 'new') { FC.creating = true; FC.d = blankDraft(); FC.step = 0; FC.dir = 'fwd'; renderFC(true); }
    else if (a === 'cancel') { FC.creating = false; FC.d = blankDraft(); FC.step = 0; renderFC(); }
    else if (a === 'withdraw') {
      confirmSheet('Withdraw this submission?', 'It will be removed from the producer’s queue and won’t be shown. Your related permissions are withdrawn too.', 'Withdraw', () => {
        withdrawSub(b.dataset.id); toast('Submission withdrawn', 'Nothing will be shown.', 'x'); renderFC(); updateGlobal();
      }, b);
    } else if (a === 'to-operator') openRole(b);
  });
  fcPanel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'fcMoment') { FC.d.moment = t.value; FC.err.moment = null; const m = $('#fcPanel .error-msg'); m && m.remove(); }
    else if (t.matches('[data-consent]')) { FC.d.consents[t.dataset.consent] = t.checked; }
    else if (t.name === 'fcAge') { FC.d.age = t.value; if (t.value !== 'minor') FC.d.consents.guardian = false; renderFC(); $(`#fcPanel input[name="fcAge"][value="${t.value}"]`)?.focus(); }
    else if (t.matches('[data-fc-file]')) handleFile(t.files && t.files[0]);
  });
  fcPanel.addEventListener('input', (e) => {
    if (e.target.id !== 'fcName') return;
    FC.d.name = e.target.value;
    $('#fcPanel [data-fc-count]').textContent = `${FC.d.name.length}/16`;
    if (FC.d.touched) showNameErr();
  });
  fcPanel.addEventListener('focusout', (e) => { if (e.target.id === 'fcName' && FC.d.name) { FC.d.touched = true; showNameErr(); } });
  function showNameErr() {
    const err = nameError(FC.d.name, FC.d.moment === 'family');
    const inp = $('#fcName');
    $('#fcPanel [data-fc-name-err]').innerHTML = errHTML(err, 'fcNameErr');
    inp.toggleAttribute('aria-invalid', !!err);
    inp.setAttribute('aria-describedby', `fcNameHint${err ? ' fcNameErr' : ''}`);
  }

  /* ======================================================================
     REWARDS
     ====================================================================== */
  function badgeList() {
    const shown = ownSubs().some((s) => s.status === 'shown');
    return [
      ['First match', 'Earned 2019', true, 'star'],
      ['Five home matches', 'Season milestone', true, 'trophy'],
      ['Season pass', '2026 season', true, 'ticket'],
      ['Quiz whizz', S.quiz && S.quiz.correct ? 'Half-time quiz' : 'Answer the quiz', !!(S.quiz && S.quiz.correct), 'spark'],
      ['Fan Cam star', shown ? 'On the big screen' : 'Get on the big screen', shown, 'camera'],
      ['Ten home matches', '8 of 10', false, 'trophy'],
      ['Family day', 'Attend with family', false, 'people'],
    ];
  }
  function renderRewards() {
    $('#pointsBal').innerHTML = `${points().toLocaleString('en-ZA')}<small>PTS</small>`;
    $('#badgeGrid').innerHTML = badgeList().map(([n, d, on, icon]) => `<div class="badge ${on ? '' : 'locked'}"><span class="medal">${ic(on ? icon : 'lock')}</span><strong>${n}</strong><span>${on ? d : `Locked · ${d}`}</span></div>`).join('');
    $('#ledgerList').innerHTML = S.ledger.slice().reverse().map((e) => `<li><span class="li-main"><strong>${esc(e.label)}</strong><span>${dShort(e.t)} · ${hm(e.t)}</span></span><span class="d ${e.d >= 0 ? 'pos' : 'neg'}">${e.d >= 0 ? '+' : '−'}${Math.abs(e.d).toLocaleString('en-ZA')}</span></li>`).join('');
    const gb = $('[data-action="enter-golden"]');
    gb.textContent = S.golden ? `Entered · ${S.golden.ref}` : 'Enter the drop';
    gb.disabled = !!S.golden;
    $('#gtStatus').textContent = S.draw ? 'Drawn' : S.golden ? 'Entered' : 'Open';
    $$('#quizOpts .quiz-opt').forEach((b) => {
      b.disabled = !!S.quiz;
      b.classList.toggle('right', !!S.quiz && b.dataset.quiz === '5');
      b.classList.toggle('wrong', !!S.quiz && !S.quiz.correct && b.dataset.quiz === S.quiz.val);
      b.innerHTML = `${b.dataset.quiz} points${S.quiz && b.dataset.quiz === '5' ? ` ${ic('check', 'i i-sm')}<span class="sr-only">(correct answer)</span>` : ''}`;
    });
    $('#quizNote').textContent = S.quiz ? (S.quiz.correct ? 'Correct — a try is worth 5 points. +25 points added.' : 'Not quite — a try is worth 5 points. Better luck at the next quiz.') : 'One attempt per supporter. Sponsored by a quiz partner (demo).';
  }
  const OFFERS = {
    combo: { title: 'Supporter Combo', asset: '10', vendor: 'North Stand Grill (demo vendor)', terms: ['Valid today until full time at participating vendors.', 'One redemption per supporter. Not exchangeable for cash.', 'R95 is a demo price. Real prices and availability come from the vendor system.'] },
    merch: { title: 'Matchday merch drop', asset: '04', vendor: 'Club store (demo)', terms: ['15% off scarves and caps today, while stock lasts.', 'One use per supporter. Can’t be combined with other offers.'] },
    spin: { title: 'Fan zone spin', asset: '21', vendor: 'Fan zone partner (sponsored, demo)', terms: ['One free spin per checked-in supporter.', 'Sponsored activation, clearly labelled. Partners receive aggregated reports only.', 'Prizes subject to availability. No purchase necessary.'] },
  };
  function redeem(id, trigger) {
    const o = OFFERS[id];
    let code = S.redemptions[id];
    const fresh = !code;
    if (fresh) { code = rid('B1', 6); S.redemptions[id] = code; audit('supporter (Lerato)', 'Offer redeemed', o.title, 'Single-use code issued'); save(); haptic(12); }
    Sheet.show(`
      ${imgA(o.asset, 'alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px"')}
      <div class="card" style="text-align:center;margin-top:14px">
        <p class="caption">Show this single-use code at the counter</p>
        <p class="code" style="margin:8px 0">${code}</p>
        <p class="caption">${fresh ? 'Valid once · today only' : 'Already issued — this is the same code'}</p>
      </div>
      <p class="caption" style="margin-top:12px">${esc(o.vendor)}</p>
      <details class="rules" open><summary>Terms</summary><ul>${o.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>`, { title: o.title, trigger });
  }

  /* ======================================================================
     PROFILE & PRIVACY
     ====================================================================== */
  const PREFS = [
    ['essentials', 'Matchday essentials', 'Tickets, gates and safety messages. Always on while you have a ticket.', true],
    ['fancam', 'Fan Cam updates', 'When your moment is reviewed or shown.'],
    ['live', 'Live score alerts', 'Tries, half-time and full time.'],
    ['news', 'Club news', 'Team news and stories.'],
    ['offers', 'Offers & partners', 'Marketing. Off unless you switch it on.'],
  ];
  function renderProfile() {
    $('#prefList').innerHTML = PREFS.map(([k, t, d, locked]) => `
      <label class="switch-row"><span class="li-main"><strong>${t}</strong><span>${d}</span></span><input class="switch" type="checkbox" role="switch" data-pref="${k}" ${S.prefs[k] ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="${t}"></label>`).join('');
    $('#consentList').innerHTML = S.consents.slice().reverse().map((c) => `
      <li><span class="li-icon ${c.withdrawnAt ? 'muted' : 'ok'}">${ic(c.withdrawnAt ? 'x' : 'check')}</span>
        <span class="li-main"><strong>${esc(c.purpose)}</strong><span>${c.version} · ${c.withdrawnAt ? `withdrawn ${dShort(c.withdrawnAt)} ${hm(c.withdrawnAt)}` : `granted ${dShort(c.at)}`}${c.event ? ' · this match' : ''}</span></span>
        <span class="li-end">${c.essential ? '<span class="caption">Required</span>' : c.withdrawnAt ? '<span class="caption">Withdrawn</span>' : `<button class="btn btn-quiet btn-sm" type="button" data-withdraw="${c.id}">Withdraw</button>`}</span></li>`).join('');
    $('#requestList').innerHTML = S.requests.slice().reverse().map((r) => `<li><span class="li-icon">${ic('history')}</span><span class="li-main"><strong>${esc(r.type)} · ${r.ref}</strong><span>${dShort(r.at)} ${hm(r.at)} · ${esc(r.status)}</span></span></li>`).join('');
  }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-pref]')) {
      const k = t.dataset.pref;
      S.prefs[k] = t.checked;
      if (k === 'offers') {
        if (t.checked) S.consents.push({ id: rid('C'), purpose: 'Offers & partner messages (marketing)', version: 'mkt-v1.0', at: Date.now(), key: 'offers' });
        else S.consents.filter((c) => c.key === 'offers' && !c.withdrawnAt).forEach((c) => { c.withdrawnAt = Date.now(); });
        renderProfile();
      }
      save();
      toast('Notification settings saved', `${PREFS.find((p) => p[0] === k)[1]}: ${t.checked ? 'on' : 'off'}`, 'bell');
    }
    if (t.id === 'langSel' && t.value !== 'en') { toast('Not available yet', 'Translations need approved copy. Staying in English.', 'globe'); t.value = 'en'; }
  });

  /* ======================================================================
     OPERATOR CONSOLE
     ====================================================================== */
  const OP = { filter: 'pending', sel: null, region: 'full', screen: 'north', duration: 10, guides: true, checks: {}, reason: '' };
  const SCREENS = { north: 'North main LED', south: 'South LED' };
  const REASONS = ['Offensive or abusive content', 'Abuse aimed at players or officials', 'Consent unclear or person not the submitter', 'Shows private information', 'Unauthorised brand marks', 'Poor image — request a new crop', 'Guardian consent missing'];
  let cueTimer = 0;
  SEG_HOOKS.operator = () => {};
  function renderOperator(param) {
    $('#opGate').hidden = session.op;
    $('#opConsole').hidden = !session.op;
    if (!session.op) return;
    const seg = SEGS.get('operator');
    if (param === 'campaigns') seg.select(1, { instant: true });
    else if (param === 'audit') seg.select(2, { instant: true });
    else if (param === 'fan-cam' || param === 'screens') seg.select(0, { instant: true });
    if (!OP.sel || !S.subs.some((s) => s.id === OP.sel)) {
      OP.sel = (S.subs.find((s) => s.own && s.status === 'pending') || S.subs.find((s) => s.status === 'pending') || S.subs[0]).id;
    }
    renderQueue(); renderStudio(); renderDraw(); renderAudit(); updateScreenChip();
    if (param === 'screens') requestAnimationFrame(() => $('#onAir')?.scrollIntoView({ block: 'center' }));
  }
  function renderQueue() {
    const counts = S.subs.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});
    const F = [['pending', 'Pending'], ['held', 'Held'], ['approved', 'Approved'], ['shown', 'Shown'], ['rejected', 'Rejected'], ['all', 'All']];
    $('#qFilters').innerHTML = F.map(([k, l]) => `<button class="filter" type="button" data-qf="${k}" aria-pressed="${OP.filter === k}">${l}${k !== 'all' ? ` <span class="num">${counts[k] || 0}</span>` : ''}</button>`).join('');
    const list = S.subs.filter((s) => (OP.filter === 'all' ? true : OP.filter === 'approved' ? ['approved', 'onair'].includes(s.status) : s.status === OP.filter)).filter((s) => OP.filter === 'all' || s.status !== 'withdrawn').sort((a, b) => a.at - b.at);
    $('#queueList').innerHTML = list.length ? list.map((s) => `
      <button class="q-item" type="button" data-sel="${s.id}" aria-pressed="${OP.sel === s.id}">
        <span class="thumb">${photoImg(s)}</span>
        <span><strong>${esc(displayName(s))}</strong><span class="meta">${esc(MOMENTS[s.moment].label)} · ${s.id} · ${hm(s.at)}${s.own ? ' · demo supporter' : ''}</span>
          <span class="chips">${s.status === 'withdrawn' ? chip('', 'x', 'Withdrawn') : `${chip('chip-ok', 'ticket', 'Ticket')}${chip('chip-ok', 'shield', 'Checked in')}${chip(s.consents.screen ? 'chip-ok' : 'chip-err', s.consents.screen ? 'check' : 'x', 'Consent')}`}${s.flags.length ? chip('chip-warn', 'flag', `${s.flags.length} flag${s.flags.length > 1 ? 's' : ''}`) : ''}${statusChip(s)}</span></span>
      </button>`).join('') : `<div class="empty">Nothing here.</div>`;
    hydrate($('#queueList'));
  }
  function renderStudio() {
    const s = S.subs.find((x) => x.id === OP.sel);
    const studio = $('#studio');
    if (!s) { studio.innerHTML = '<div class="card empty">Select a submission.</div>' + onAirCard(); hydrate(studio); return; }
    const checks = OP.checks[s.id] || (OP.checks[s.id] = {});
    const allChecked = checks.photo && checks.name && checks.consent;
    const yn = (v) => (v ? 'Yes' : 'No');
    let actions = '';
    if (['pending', 'held'].includes(s.status)) {
      actions = `
        <fieldset class="checks" style="margin-top:16px"><legend class="title-3">Moderation checklist</legend>
          <label><input class="check" type="checkbox" data-chk="photo" ${checks.photo ? 'checked' : ''}>Photo is safe, appropriate and shows no private information</label>
          <label><input class="check" type="checkbox" data-chk="name" ${checks.name ? 'checked' : ''}>Display name is appropriate</label>
          <label><input class="check" type="checkbox" data-chk="consent" ${checks.consent ? 'checked' : ''}>Consent, age and attendance confirmed</label>
        </fieldset>
        <div class="row-gap" style="margin-top:12px">
          <button class="btn btn-ok btn-sm" type="button" data-op="approve" ${allChecked ? '' : 'disabled'}>${ic('check')}Approve</button>
          ${s.status === 'pending' ? `<button class="btn btn-quiet btn-sm" type="button" data-op="hold">${ic('pause')}Hold</button>` : ''}
        </div>
        ${allChecked ? '' : '<p class="caption" style="margin-top:6px">Complete the checklist to approve.</p>'}
        <div class="field" style="margin-top:14px"><label for="rejReason">Reject with reason</label>
          <div style="display:flex;gap:8px"><select class="select" id="rejReason"><option value="">Choose a reason…</option>${REASONS.map((r) => `<option ${OP.reason === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <button class="btn btn-danger btn-sm" type="button" data-op="reject">Reject</button></div></div>`;
    } else if (s.status === 'approved') {
      actions = `
        <div class="grid grid-2" style="margin-top:16px;gap:10px">
          <div class="field"><label for="scrSel">Screen</label><select class="select" id="scrSel">${Object.entries(SCREENS).map(([k, v]) => `<option value="${k}" ${OP.screen === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label for="durSel">Duration</label><select class="select" id="durSel">${[8, 10, 15].map((d) => `<option value="${d}" ${OP.duration === d ? 'selected' : ''}>${d} seconds</option>`).join('')}</select></div>
        </div>
        <p class="caption" style="margin-top:8px">Expires at the end of this match.</p>
        <div class="row-gap" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" type="button" data-op="send" ${S.screen.killed || S.screen.cue ? 'disabled' : ''}>${ic('send')}Send to ${SCREENS[OP.screen]}</button>
          <button class="btn btn-quiet btn-sm" type="button" data-op="expire">${ic('history')}Remove from future use</button>
        </div>
        ${S.screen.killed ? '<p class="caption" style="margin-top:6px;color:var(--err)">Kill switch is engaged. Re-arm the screen to send.</p>' : S.screen.cue ? '<p class="caption" style="margin-top:6px">Another cue is on air. Wait for it to finish.</p>' : ''}`;
    } else if (s.status === 'onair') {
      actions = `<p class="body-2" style="margin-top:14px">On air now. Use the kill switch to cut to the fallback loop.</p>`;
    } else if (s.status === 'shown') {
      actions = `<div class="row-gap" style="margin-top:14px"><span class="caption">Shown at ${hm(s.shownAt)} on ${SCREENS[s.screen || 'north']}.</span><button class="btn btn-quiet btn-sm" type="button" data-op="expire">${ic('history')}Remove from future use</button></div>`;
    } else {
      actions = `<p class="body-2" style="margin-top:14px">${s.status === 'rejected' ? `Rejected: ${esc(s.reason || '')}` : s.status === 'withdrawn' ? 'The supporter withdrew consent. This item can’t be used.' : 'Removed from future use.'}</p>`;
    }
    studio.innerHTML = `
      <article class="card">
        <div class="card-head"><div><p class="eyebrow">Preview · not on air</p><h3 class="title-2">${esc(displayName(s))} · ${esc(MOMENTS[s.moment].label)}</h3></div>${statusChip(s)}</div>
        ${ledHTML(s, { region: OP.region, guides: OP.guides })}
        <div class="row-gap" style="margin-top:12px">
          <div class="segmented" style="margin:0;flex:1;min-width:220px" role="group" aria-label="Screen region">
            <button class="seg-btn" type="button" data-region="full" aria-pressed="${OP.region === 'full'}">Full screen</button>
            <button class="seg-btn" type="button" data-region="lower" aria-pressed="${OP.region === 'lower'}">Lower third</button>
          </div>
          <button class="filter" type="button" data-op="guides" aria-pressed="${OP.guides}">Safe area</button>
        </div>
        <dl class="summary">
          <dt>Ticket</dt><dd>Verified · Ticketpro (demo) signed reference</dd>
          <dt>Attendance</dt><dd>Checked in · ${s.gate} · ${s.checkIn}</dd>
          <dt>Block</dt><dd>${s.block} <span class="caption">(for routing; seat hidden)</span></dd>
          <dt>Screen consent</dt><dd>${yn(s.consents.screen)} · fc-v1.2</dd>
          <dt>Gallery / marketing</dt><dd>${yn(s.consents.gallery)} / ${yn(s.consents.marketing)}</dd>
          <dt>Block on screen</dt><dd>${yn(s.consents.seat)}</dd>
          <dt>Who’s pictured</dt><dd>${s.minor ? 'Includes a minor · guardian consent ✓' : 'Adults only'}</dd>
        </dl>
        ${s.flags.length ? `<div class="source-note" style="margin-top:14px">${ic('flag')}<span><strong>Moderation aids — you make the decision.</strong><br>${s.flags.map(esc).join('<br>')}</span></div>` : ''}
        ${actions}
      </article>
      ${onAirCard()}`;
    hydrate(studio);
    startProgress();
  }
  function onAirCard() {
    const cue = S.screen.cue;
    const s = cue && S.subs.find((x) => x.id === cue.subId);
    const label = S.screen.killed ? 'Killed · fallback loop' : cue ? `On air · ${SCREENS[cue.screen]}` : 'Fallback loop';
    return `<article class="card" id="onAir">
      <div class="card-head"><h3 class="title-3">On air (simulated)</h3>${S.screen.killed ? chip('chip-err', 'power', 'Kill switch engaged') : cue ? chip('chip-live', 'live', 'Live') : chip('', 'refresh', 'Fallback armed')}</div>
      <div class="led" role="img" aria-label="${esc(cue && s ? `On air: ${ledLabel(s)}` : 'Fallback loop: Make some noise!')}">
        ${fallbackBG()}${cue && s ? creativeHTML(s, { region: cue.region, anim: true }) : ''}
        <span class="led-label ${cue ? 'onair' : ''}">${esc(label)}</span>
        ${cue ? '<span class="led-progress"><i id="onAirProg"></i></span>' : ''}
      </div>
      <p class="caption" style="margin-top:10px">Playout adapter: simulated · fallback loop pre-approved · safety announcements and broadcast are never affected.</p>
    </article>`;
  }
  function startProgress() {
    const bar = $('#onAirProg');
    const cue = S.screen.cue;
    if (!bar || !cue) return;
    const total = cue.duration * 1000;
    const elapsed = Date.now() - cue.startedAt;
    bar.style.transform = `scaleX(${clamp(elapsed / total, 0, 1)})`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = `transform ${Math.max(0, total - elapsed)}ms linear`;
      bar.style.transform = 'scaleX(1)';
    }));
  }
  function updateScreenChip() {
    const c = $('#screenChip');
    if (!c) return;
    const cue = S.screen.cue;
    c.className = `chip ${S.screen.killed ? 'chip-err' : cue ? 'chip-live' : ''}`;
    c.innerHTML = S.screen.killed ? `${ic('power')}Screen killed · fallback` : cue ? `${ic('live')}On air · ${SCREENS[cue.screen]}` : `${ic('refresh')}Fallback loop`;
    const k = $('#killBtn');
    k.className = `btn btn-sm ${S.screen.killed ? 'btn-quiet' : 'btn-danger'}`;
    k.innerHTML = S.screen.killed ? `${ic('refresh')}Re-arm screen` : `${ic('power')}Kill switch`;
  }
  const OP_ACTOR = 'demo-op-01';
  function notifySupporter(s, title, body) {
    if (!s.own || !S.prefs.fancam) return;
    toast(title, `${body} · notification to supporter (simulated)`, 'bell');
  }
  function opAction(a) {
    const s = S.subs.find((x) => x.id === OP.sel);
    if (!s) return;
    if (a === 'approve') {
      const c = OP.checks[s.id] || {};
      if (!(c.photo && c.name && c.consent)) return;
      s.status = 'approved'; s.approvedAt = Date.now();
      audit(OP_ACTOR, 'Approved', s.id, 'Checklist complete · expires end of match');
      notifySupporter(s, 'Fan Cam approved', 'Your moment is scheduled for the big screen');
      haptic(12);
    } else if (a === 'hold') {
      s.status = 'held'; audit(OP_ACTOR, 'Held', s.id, 'Kept for later review');
    } else if (a === 'reject') {
      const r = $('#rejReason').value;
      if (!r) { toast('Choose a reason', 'Rejections need a reason code for the audit log.', 'info'); $('#rejReason').focus(); return; }
      s.status = 'rejected'; s.reason = r; OP.reason = '';
      audit(OP_ACTOR, 'Rejected', s.id, r);
      notifySupporter(s, 'Fan Cam not approved', r);
    } else if (a === 'send') {
      if (s.status !== 'approved') { toast('Not approved', 'Only approved items can be sent to a screen.', 'lock'); return; }
      if (S.screen.killed) { toast('Screen is killed', 'Re-arm the screen first.', 'power'); return; }
      if (S.screen.cue) return;
      const cue = { id: rid('CUE'), subId: s.id, screen: OP.screen, region: OP.region, duration: OP.duration, startedAt: Date.now() };
      S.screen.cue = cue; s.status = 'onair'; s.screen = OP.screen; s.region = OP.region;
      audit(OP_ACTOR, 'Playout command sent', `${s.id} → ${SCREENS[OP.screen]}`, `${OP.region === 'lower' ? 'Lower third' : 'Full screen'} · ${OP.duration}s · ${cue.id}`);
      clearTimeout(cueTimer);
      cueTimer = setTimeout(() => finishCue(cue.id), OP.duration * 1000);
      haptic([10, 30, 10]);
    } else if (a === 'expire') {
      s.status = 'expired'; audit(OP_ACTOR, 'Removed from future use', s.id, 'Media scheduled for deletion per retention policy');
    } else if (a === 'guides') { OP.guides = !OP.guides; renderStudio(); return; }
    save();
    renderQueue(); renderStudio(); updateScreenChip(); updateGlobal();
  }
  function finishCue(id) {
    const cue = S.screen.cue;
    if (!cue || cue.id !== id) return;
    const s = S.subs.find((x) => x.id === cue.subId);
    if (s && s.status === 'onair') {
      s.status = 'shown'; s.shownAt = Date.now();
      audit('playout adapter (simulated)', 'Playout acknowledged · cue ended', cue.id, `${s.id} shown ${cue.duration}s`);
      if (s.own) {
        addLedger('Fan Cam · on the big screen', 50);
        notifySupporter(s, 'You were on the big screen!', '+50 points and the Fan Cam star badge');
      }
    }
    S.screen.cue = null;
    save();
    if (current === 'operator' && session.op) { renderQueue(); renderStudio(); updateScreenChip(); }
    else rerender();
  }
  function killSwitch() {
    if (S.screen.killed) {
      S.screen.killed = false;
      audit(OP_ACTOR, 'Screen re-armed', 'North main LED', 'Fallback loop running');
      toast('Screen re-armed', 'Approved items can be sent again.', 'refresh');
    } else {
      const cue = S.screen.cue;
      if (cue) { const s = S.subs.find((x) => x.id === cue.subId); if (s && s.status === 'onair') s.status = 'approved'; }
      clearTimeout(cueTimer);
      S.screen.cue = null; S.screen.killed = true;
      audit(OP_ACTOR, 'KILL SWITCH', 'All Fan Cam screens', 'Cut to pre-approved fallback loop');
      toast('Kill switch engaged', 'Screens cut to the fallback loop.', 'power', '');
      haptic([20, 40, 20]);
    }
    save();
    renderQueue(); renderStudio(); updateScreenChip();
  }
  function renderDraw() {
    const desk = $('#drawDesk');
    const entries = 1284 + (S.golden ? 1 : 0);
    const d = S.draw;
    desk.innerHTML = `
      <div class="card-head"><div><p class="eyebrow" style="color:var(--champagne)">Prize desk</p><h3 class="title-2">Golden Ticket Drop</h3></div>${d ? chip('chip-gold', 'check', 'Drawn') : chip('chip-info', 'clock', 'Open')}</div>
      <div class="kv"><div><small>Entries</small><strong>${entries.toLocaleString('en-ZA')}</strong></div><div><small>Eligible</small><strong>${(entries - 37).toLocaleString('en-ZA')}</strong></div><div><small>Ineligible</small><strong>37</strong></div></div>
      <p class="caption" style="margin-top:10px">Ineligible: no gate check-in. Demo numbers.</p>
      ${d ? `
        <dl class="summary">
          <dt>Method</dt><dd>Uniform random pick over the eligible entry list (crypto RNG)</dd>
          <dt>Seed</dt><dd style="font-family:ui-monospace,monospace;overflow-wrap:anywhere">${d.seed}</dd>
          <dt>Winner</dt><dd>${d.winner} <span class="caption">(pseudonymous)</span></dd>
          <dt>Drawn</dt><dd>${hm(d.at)} by ${OP_ACTOR}</dd>
          <dt>Status</dt><dd>${esc(d.status)}</dd>
        </dl>
        ${d.validated ? '' : `<button class="btn btn-gold btn-sm" type="button" data-op2="validate" style="margin-top:14px">${ic('shield')}Validate ticket &amp; attendance</button>`}
        <p class="caption" style="margin-top:10px">The draw runs once. Running it again is blocked so the result can’t be cherry-picked.</p>`
      : `<button class="btn btn-gold btn-block" type="button" data-op2="draw" style="margin-top:16px">${ic('spark')}Run auditable draw</button>
         <p class="caption" style="margin-top:10px">The seed and result go to the audit log. The winner is validated before any announcement, and their seat is never revealed first.</p>`}`;
  }
  function runDraw() {
    if (S.draw) { toast('Draw already completed', 'See the audit log for the seed and result.', 'lock'); return; }
    const seed = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    const winner = `SUP-••${rid('X', 3).slice(2)}`;
    S.draw = { seed, winner, at: Date.now(), status: 'Validation pending (ticket + attendance)' };
    audit(OP_ACTOR, 'Prize draw run', 'Golden Ticket Drop', `Seed ${seed.slice(0, 12)}… · winner ${winner}`);
    save(); renderDraw(); haptic(15);
  }
  function validateDraw() {
    if (!S.draw || S.draw.validated) return;
    S.draw.validated = true;
    S.draw.status = 'Validated · winner notified in app (simulated)';
    audit(OP_ACTOR, 'Winner validated', 'Golden Ticket Drop', 'Ticket and gate check-in confirmed');
    save(); renderDraw();
  }
  function renderAudit() {
    $('#auditBody').innerHTML = S.audit.slice().reverse().map((e) => `<tr><td>${dShort(e.t)} ${hm(e.t)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td><td>${esc(e.target)}</td><td>${esc(e.outcome)}</td></tr>`).join('');
  }
  SEG_HOOKS.operator = (v) => { if (v === 'audit') renderAudit(); if (v === 'campaigns') renderDraw(); };

  $('#opConsole').addEventListener('click', (e) => {
    const t = e.target;
    const qf = t.closest('[data-qf]');
    if (qf) { OP.filter = qf.dataset.qf; renderQueue(); return; }
    const sel = t.closest('[data-sel]');
    if (sel) { OP.sel = sel.dataset.sel; renderQueue(); renderStudio(); if (innerWidth < 1100) $('#studio').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); return; }
    const rg = t.closest('[data-region]');
    if (rg) { OP.region = rg.dataset.region; renderStudio(); return; }
    const op = t.closest('[data-op]');
    if (op) { opAction(op.dataset.op); return; }
    const op2 = t.closest('[data-op2]');
    if (op2) { op2.dataset.op2 === 'draw' ? runDraw() : validateDraw(); }
  });
  $('#opConsole').addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-chk]')) { (OP.checks[OP.sel] = OP.checks[OP.sel] || {})[t.dataset.chk] = t.checked; const keep = t.dataset.chk; renderStudio(); $(`#studio [data-chk="${keep}"]`)?.focus(); }
    else if (t.id === 'scrSel') { OP.screen = t.value; renderStudio(); }
    else if (t.id === 'durSel') { OP.duration = Number(t.value); }
    else if (t.id === 'rejReason') { OP.reason = t.value; }
  });
  const pushMsg = $('#pushMsg');
  const pushCount = () => { $('#pushCount').textContent = `${pushMsg.value.length}/120`; };
  pushMsg.addEventListener('input', pushCount); pushCount();
  $('#pushForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const seg = $('#pushSeg').value;
    const msg = pushMsg.value.trim();
    if (!msg) { $('#pushNote').textContent = 'Write a message first.'; pushMsg.focus(); return; }
    const reaches = seg === 'essentials' ? S.prefs.essentials : S.prefs.offers;
    audit(OP_ACTOR, 'Push sent (simulated)', seg === 'essentials' ? 'Checked-in attendees · essentials' : 'Opted-in · offers & partners', `${msg.length} chars`);
    save();
    $('#pushNote').textContent = reaches ? 'Sent (simulated). Delivered to Lerato’s device.' : 'Sent (simulated) to opted-in supporters only. Not delivered to Lerato: no marketing opt-in.';
    if (reaches) toast('Bulls One', msg, 'bell');
  });

  /* ======================================================================
     ROLE switching (demo) & staff sign-in placeholder
     ====================================================================== */
  function openRole(trigger) {
    Sheet.show(`
      <p class="body-2">Switch between the supporter app and the staff console. Staff access needs sign-in.</p>
      <div style="margin-top:16px">
        <button class="q-item" type="button" data-role-pick="supporter" aria-pressed="${session.role === 'supporter'}"><span class="avatar" aria-hidden="true">L</span><span><strong>Supporter · Lerato</strong><span class="meta">Home, matchday, Fan Cam and rewards</span></span></button>
        <button class="q-item" type="button" data-role-pick="operator" aria-pressed="${session.role === 'operator'}"><span class="li-icon" style="width:40px;height:40px">${ic('screen')}</span><span><strong>Screen producer (staff)</strong><span class="meta">Moderation queue, Screen Studio, draws and audit log</span></span></button>
      </div>`, { title: 'Demo role', trigger });
  }
  const MENU = [
    ['#/', 'home', 'Home'], ['#/fixtures', 'fixtures', 'Fixtures & results'], ['#/live/evt-r9', 'live', 'Live Centre'],
    ['#/matchday/evt-r9', 'matchday', 'Matchday'], ['#/fan-cam/evt-r9', 'fancam', 'Fan Cam'], ['#/stadium', 'stadium', 'Stadium guide'],
    ['#/rewards', 'rewards', 'Rewards'], ['#/club', 'club', 'Club'], ['#/profile', 'profile', 'Profile & privacy'],
  ];
  function openMenu(trigger) {
    const row = ([href, view, name], i) => `<li><a href="${href}" ${current === view ? 'aria-current="page"' : ''}><span class="idx">${String(i + 1).padStart(2, '0')}</span><span class="nm">${esc(name)}</span>${view === 'live' ? '<span class="chip chip-live tag">Live</span>' : ''}</a></li>`;
    const pending = S.subs.filter((s) => s.status === 'pending').length;
    Sheet.show(`
      <nav aria-label="All sections"><ul class="menu-list">${MENU.map(row).join('')}</ul></nav>
      <p class="fieldset-title" style="margin-top:28px">Staff · demo</p>
      <ul class="menu-list">
        <li><a href="#/operator" ${current === 'operator' ? 'aria-current="page"' : ''}><span class="idx">10</span><span class="nm">Operator console</span>${pending ? `<span class="chip chip-live tag">${pending} pending</span>` : ''}</a></li>
        <li><a href="#/assets" ${current === 'assets' ? 'aria-current="page"' : ''}><span class="idx">11</span><span class="nm">Asset library</span></a></li>
      </ul>
      <button class="btn btn-quiet btn-block" type="button" data-action="role" style="margin-top:24px">${ic('swap')}Demo role: ${session.role === 'operator' ? 'Screen producer' : 'Supporter'}</button>
      <p class="caption" style="margin-top:16px">Concept prototype · not an official Bulls product · all data is sample data.</p>`,
    { title: 'Menu', trigger });
    $$('.menu-list a', Sheet.body).forEach((a) => a.addEventListener('click', () => { if (a.getAttribute('href') === location.hash || (a.getAttribute('href') === '#/' && !location.hash)) Sheet.close(); }));
  }
  function openSignIn(trigger) {
    Sheet.show(`
      <form id="mfaForm" novalidate>
        <p class="body-2">Enter the 6-digit code from your authenticator app.</p>
        <p class="caption" style="margin-top:4px">Demo placeholder: any 6 digits work. Production uses real staff accounts with MFA and server-side role checks.</p>
        <div class="field" style="margin-top:16px"><label for="mfaCode">Verification code</label>
          <input class="input" id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="letter-spacing:.5em;font:500 1.5rem/1 var(--mono);text-align:center" aria-describedby="mfaErr">
          <div id="mfaErr"></div></div>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:16px">${ic('shield')}Verify &amp; sign in</button>
      </form>`, { title: 'Staff sign-in', trigger, focus: '#mfaCode' });
    $('#mfaForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#mfaCode').value.trim();
      if (!/^\d{6}$/.test(v)) { $('#mfaErr').innerHTML = errHTML('Enter all 6 digits.'); $('#mfaCode').setAttribute('aria-invalid', 'true'); $('#mfaCode').focus(); return; }
      session.op = true; session.role = 'operator';
      audit(OP_ACTOR, 'Operator signed in', 'Operator console', 'MFA placeholder verified');
      save();
      Sheet.close();
      updateGlobal();
      go('#/operator');
      toast('Signed in as demo-op-01', 'Screen producer · session ends when you switch back', 'shield');
    });
  }
  function signOut() {
    if (!session.op) return;
    audit(OP_ACTOR, 'Operator signed out', 'Operator console', 'Session ended');
    session.op = false; session.role = 'supporter';
    save(); updateGlobal();
  }
  function confirmSheet(title, text, cta, onYes, trigger) {
    Sheet.show(`<p class="body-2">${esc(text)}</p><div class="row-gap" style="margin-top:18px"><button class="btn btn-danger" type="button" data-yes>${esc(cta)}</button><button class="btn btn-quiet" type="button" data-no>Cancel</button></div>`, { title, trigger });
    $('[data-yes]', Sheet.body).addEventListener('click', () => { Sheet.close(); onYes(); });
    $('[data-no]', Sheet.body).addEventListener('click', () => Sheet.close());
  }

  /* ======================================================================
     ASSET LIBRARY
     ====================================================================== */
  function renderAssets() {
    const grid = $('#assetGrid');
    if (grid.dataset.done) return;
    const total = ASSETS.reduce((a, x) => a + x.bytes, 0);
    $('#assetSummary').textContent = `${ASSETS.length} images · ${(total / 1048576).toFixed(1)} MB embedded (WebP, metadata stripped)`;
    grid.innerHTML = ASSETS.map((a) => `
      <article class="asset">
        <button type="button" data-asset-open="${a.id}" aria-label="Enlarge reference ${a.id}: ${esc(a.title)}">${imgA(a.id, 'alt="" loading="lazy"')}</button>
        <div class="asset-meta">
          <p class="eyebrow" style="margin-bottom:4px">Ref ${a.id}</p>
          <p class="title-3">${esc(a.title)}</p>
          <dl>
            <dt>Source</dt><dd>${esc(a.file)}</dd>
            <dt>Used in</dt><dd>${esc(a.use)}</dd>
            <dt>Embedded</dt><dd>${a.width}×${a.height} · ${a.ratio} · ${Math.round(a.bytes / 1024)} KB</dd>
            <dt>Alt text</dt><dd>${esc(a.alt)}</dd>
          </dl>
        </div>
      </article>`).join('');
    grid.dataset.done = '1';
    hydrate(grid);
  }
  function openAsset(id, trigger) {
    const a = A[id];
    Sheet.show(`<div class="lightbox">${imgA(a.id, `alt="${esc(a.alt)}"`)}</div>
      <dl class="summary"><dt>Reference</dt><dd>${a.id} · ${esc(a.title)}</dd><dt>Source file</dt><dd>${esc(a.file)}</dd><dt>Used in</dt><dd>${esc(a.use)}</dd><dt>Original</dt><dd>${a.srcWidth}×${a.srcHeight} JPEG</dd><dt>Embedded</dt><dd>${a.width}×${a.height} WebP · ${Math.round(a.bytes / 1024)} KB</dd><dt>Alt text</dt><dd>${esc(a.alt)}</dd></dl>
      <p class="caption" style="margin-top:12px">Generated concept visual. Not official Bulls photography or approved brand artwork.</p>`, { title: `Reference ${a.id}`, trigger, wide: true });
  }

  /* ======================================================================
     Global event delegation
     ====================================================================== */
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
  document.addEventListener('click', (e) => {
    const t = e.target;
    const act = t.closest('[data-action]');
    if (act) {
      const a = act.dataset.action;
      if (act.tagName === 'A' && a === 'help') e.preventDefault();
      switch (a) {
        case 'dismiss-strip': S.stripDismissed = true; save(); updateGlobal(); break;
        case 'role': openRole(act); break;
        case 'menu': openMenu(act); break;
        case 'open-pass': openPass(act); break;
        case 'toggle-seat': S.seatShown = !S.seatShown; save(); updateSeat(); break;
        case 'fixture': openFixture(act.dataset.id, act); break;
        case 'ics': downloadICS(act.dataset.id); break;
        case 'help': openHelp(act); break;
        case 'report': Sheet.close(); toast('Report sent to guest services (demo)', 'A steward will follow up at Block E.', 'flag'); break;
        case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; $('#installBtn').hidden = true; } break;
        case 'enter-golden':
          if (S.golden) { toast('You’re already entered', 'One entry per verified ticket.', 'info'); break; }
          S.golden = { ref: rid('GT'), at: Date.now() };
          audit('supporter (Lerato)', 'Prize entry', 'Golden Ticket Drop', `${S.golden.ref} · eligible (verified attendance)`);
          save(); haptic(12);
          toast('You’re in the Golden Ticket Drop', `Entry ${S.golden.ref} · draw after the 70th minute`, 'ticket', 'gold');
          renderRewards(); break;
        case 'redeem': redeem(act.dataset.offer, act); break;
        case 'lock-prediction': {
          const h = Number($('[data-pred-out="home"]').textContent), w = Number($('[data-pred-out="away"]').textContent);
          S.prediction = { home: h, away: w, at: Date.now() };
          audit('supporter (Lerato)', 'Score prediction locked', 'evt-r9', `${h}–${w}`);
          save(); renderPrediction(); toast('Prediction locked', `Bulls ${h}–${w} Mariners`, 'check'); break;
        }
        case 'link-ticket':
          Sheet.show(`<p class="body-2">Tickets are linked through the official ticketing partner. In production you’d sign in with Ticketpro and approve sharing only what Bulls One needs: event, ticket status, block, row, seat and a signed reference.</p>
            <ul class="list" style="margin-top:8px"><li><span class="li-icon">${ic('lock')}</span><span class="li-main"><strong>No raw barcodes or card details</strong><span>Bulls One never stores them.</span></span></li><li><span class="li-icon">${ic('info')}</span><span class="li-main"><strong>Partner access required</strong><span>No public Ticketpro API is assumed. Until access is agreed, Bulls One deep-links to the official portal.</span></span></li></ul>
            <a class="btn btn-primary btn-block" href="https://tickets.bullsrugby.co.za/" target="_blank" rel="noopener" style="margin-top:10px">Open the official ticket portal ${ic('ext', 'i i-sm')}</a>`, { title: 'Link a ticket', trigger: act });
          break;
        case 'reset':
          confirmSheet('Reset demo data?', 'This clears Fan Cam submissions, points changes, entries, consents you added and the audit log on this device.', 'Reset', () => {
            try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
            S = seed(); session.op = false; session.role = 'supporter'; FC.creating = false; FC.d = blankDraft(); FC.step = 0;
            clearTimeout(cueTimer); OP.sel = null; OP.checks = {};
            save(); updateGlobal(); rerender(); toast('Demo data reset', '', 'refresh');
          }, act);
          break;
        case 'op-signin': openSignIn(act); break;
        case 'op-signout': signOut(); go('#/'); toast('Signed out', 'Back to the supporter app.', 'user'); break;
        case 'kill': killSwitch(); break;
        case 'download-manifest':
          download('bulls-one-asset-metadata.json', JSON.stringify({ source: MANIFEST.source, generated: MANIFEST.generated, note: MANIFEST.note, assets: ASSETS.map(({ url, ...m }) => m) }, null, 2), 'application/json');
          break;
        default: break;
      }
      return;
    }
    const rp = t.closest('[data-role-pick]');
    if (rp) {
      const r = rp.dataset.rolePick;
      if (r === 'operator') { if (session.op) { Sheet.close(); go('#/operator'); } else openSignIn(rp); }
      else { const was = session.op; signOut(); Sheet.close(); if (current === 'operator') go('#/'); else rerender(); if (was) toast('Signed out of the staff console', 'Back to the supporter app.', 'user'); }
      return;
    }
    const q = t.closest('[data-quiz]');
    if (q && !S.quiz) {
      const correct = q.dataset.quiz === '5';
      S.quiz = { val: q.dataset.quiz, correct, at: Date.now() };
      if (correct) addLedger('Half-time quiz · correct answer', 25);
      audit('supporter (Lerato)', 'Quiz answered', 'Half-time quiz', correct ? 'Correct · +25' : 'Incorrect');
      save(); haptic(correct ? 12 : [8, 40, 8]); renderRewards();
      if (correct) $$('#badgeGrid .badge')[3]?.classList.add('pop');
      return;
    }
    const pr = t.closest('[data-pred]');
    if (pr && !S.prediction) {
      const out = $(`[data-pred-out="${pr.dataset.pred}"]`);
      out.textContent = clamp(Number(out.textContent) + Number(pr.dataset.d), 0, 99);
      return;
    }
    const fl = t.closest('[data-filter]');
    if (fl) {
      const on = fl.getAttribute('aria-pressed') !== 'true';
      fl.setAttribute('aria-pressed', String(on));
      if (fl.dataset.filter === 'acc') $('[data-acc-route]').toggleAttribute('hidden', !on);
      else $(`.map .amen[data-amen="${fl.dataset.filter}"]`).classList.toggle('off', !on);
      return;
    }
    const wd = t.closest('[data-withdraw]');
    if (wd) {
      const c = S.consents.find((x) => x.id === wd.dataset.withdraw);
      if (!c) return;
      confirmSheet('Withdraw this permission?', c.key === 'screen' ? 'Your Fan Cam submission will be removed from the queue and won’t be shown. A moment already shown live can’t be un-shown, but it won’t be used again.' : 'We’ll stop using your information for this purpose from now on.', 'Withdraw', () => {
        c.withdrawnAt = Date.now();
        const s = c.subId && S.subs.find((x) => x.id === c.subId);
        if (s) {
          if (c.key === 'screen') withdrawSub(s.id);
          else if (c.key && s.consents[c.key] !== undefined) { s.consents[c.key] = false; audit('supporter (Lerato)', 'Consent withdrawn', s.id, c.purpose); }
        } else audit('supporter (Lerato)', 'Consent withdrawn', c.purpose, c.version);
        if (c.key === 'offers') S.prefs.offers = false;
        save(); renderProfile(); updateGlobal(); toast('Permission withdrawn', c.purpose, 'x');
      }, wd);
      return;
    }
    const rq = t.closest('[data-request]');
    if (rq) {
      const r = { ref: rid('DR'), type: rq.dataset.request, at: Date.now(), status: 'Received · identity check next' };
      S.requests.push(r);
      audit('supporter (Lerato)', 'Data request', r.type, r.ref);
      save(); renderProfile();
      toast('Request received', `${r.type} · reference ${r.ref}`, 'history');
      return;
    }
    const ao = t.closest('[data-asset-open]');
    if (ao) { openAsset(ao.dataset.assetOpen, ao); }
  });
  $('#potmForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (S.potm) return;
    const v = new FormData(e.target).get('potm');
    if (!v) { toast('Choose a player first', '', 'info'); return; }
    S.potm = v;
    addLedger('Player of the match vote', 10);
    audit('supporter (Lerato)', 'POTM vote', 'evt-r9', v);
    save(); renderPotm(); toast('Vote counted', '+10 points', 'check');
  });

  /* ======================================================================
     Boot
     ====================================================================== */
  $$('[data-seg]').forEach(initSeg);
  updateGlobal();
  updateScores();
  route();
  addEventListener('hashchange', route);
  addEventListener('resize', () => {
    const m = VIEWS[current];
    if (m) moveTabInd(m.tab, true);
    SEGS.forEach((s) => s.refresh());
  });
  tick();
  setInterval(tick, 1000);
})();
