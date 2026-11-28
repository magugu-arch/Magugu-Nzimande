/**
 * The booking planner on the one-file page (share/Soweto-Towers.html).
 *
 * scripts/build-share-page.mts inlines this file, and its data
 * (scripts/share-page/plan-data.ts) as <script type="application/json"
 * id="plan-data">. Pick an adventure, the number of people, a day on the
 * calendar and a time, then send the request to the crew on WhatsApp or by
 * email. Where scripts don't run (WhatsApp's iPhone viewer), the page keeps
 * its WhatsApp and email buttons with a template message instead.
 *
 * createPlanner() holds the date, slot and message rules. They mirror the
 * website (src/lib/sun.ts, src/lib/hours.ts, src/lib/booking/engine.ts), and
 * src/lib/booking/share-planner.test.ts checks the two against each other.
 * The page works offline, so it can't see live availability: the crew
 * confirms every time.
 */
(function (root) {
  'use strict';

  const DAY = 86400000;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (n) => String(n).padStart(2, '0');
  const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  const toHm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const noon = (ymd) => Date.parse(`${ymd}T12:00:00Z`);
  const addDays = (ymd, n) => new Date(noon(ymd) + n * DAY).toISOString().slice(0, 10);
  const weekday = (ymd) => new Date(noon(ymd)).getUTCDay();
  const diffDays = (from, to) => Math.round((noon(to) - noon(from)) / DAY);
  const rand = (n) => `R${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  function createPlanner(data) {
    /** Sunset at the towers as SAST 'HH:MM' (the sunrise equation, as src/lib/sun.ts). */
    function sunsetHm(ymd) {
      const RAD = Math.PI / 180;
      const J2000 = 2451545.0;
      const lat = data.geo.lat;
      const lng = data.geo.lng;
      const n = Math.round(noon(ymd) / DAY + 2440587.5 - J2000 + 0.0008);
      const meanSolarNoon = n - lng / 360;
      const M = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
      const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
      const lambda = (M + C + 180 + 102.9372) % 360;
      const transit = J2000 + meanSolarNoon + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
      const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
      const cosDec = Math.cos(Math.asin(sinDec));
      const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
      const H = Math.acos(Math.min(1, Math.max(-1, cosH))) / RAD;
      const sast = new Date((transit + H / 360 - 2440587.5) * DAY + 2 * 3600000);
      return `${pad(sast.getUTCHours())}:${pad(sast.getUTCMinutes())}`;
    }

    /** Opening for a day: closed Monday to Wednesday, open till sunset (as src/lib/hours.ts). */
    function dayHours(ymd) {
      const sunset = sunsetHm(ymd);
      const opensAt = data.weeklyOpening[weekday(ymd)] || null;
      if (!opensAt) return { date: ymd, open: false, opensAt: null, sunset, lastStart: null };
      const last = toMin(sunset) - data.lastStartBeforeSunset;
      return { date: ymd, open: true, opensAt, sunset, lastStart: toHm(Math.floor(last / 30) * 30) };
    }

    function slotTimes(opt, day) {
      if (!day.open) return [];
      const start = toMin(day.opensAt);
      const out = [];
      if (opt.session) {
        if (!opt.session.weekdays.includes(weekday(day.date))) return [];
        const endBy = toMin(day.sunset) - opt.session.minutes;
        for (let m = start; m <= endBy; m += 60) out.push(toHm(m));
      } else {
        const last = toMin(day.lastStart);
        for (let m = start; m <= last; m += data.slotMinutes) out.push(toHm(m));
      }
      return out;
    }

    /** Start times for a day, marking the ones too soon to book (as buildSlots in the engine). */
    function slots(opt, ymd, now) {
      const day = dayHours(ymd);
      const sunset = toMin(day.sunset);
      const lead = opt.session ? opt.session.leadHours * 60 : data.cutoffMinutes;
      return slotTimes(opt, day).map((time) => {
        const t = toMin(time);
        const ahead = diffDays(now.date, ymd) * 1440 + t - now.minutes;
        return { time, golden: sunset - t <= 60, closed: ahead < lead };
      });
    }

    /** 'open', or why a day can't be picked: 'past', 'later' (beyond the horizon), 'closed', 'gone' (no times left). */
    function dayState(opt, ymd, now) {
      const ahead = diffDays(now.date, ymd);
      if (ahead < 0) return 'past';
      if (ahead > data.horizonDays) return 'later';
      const list = slots(opt, ymd, now);
      if (!list.length) return 'closed';
      return list.some((s) => !s.closed) ? 'open' : 'gone';
    }

    const total = (opt, qty) => (data.prices[opt.id] || [])[qty - 1] ?? null;

    function nowInSast(ms) {
      const d = new Date(ms + 2 * 3600000);
      return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
    }

    function longDate(ymd) {
      const d = new Date(noon(ymd));
      return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }

    function shortDate(ymd) {
      const d = new Date(noon(ymd));
      return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
    }

    const people = (opt, qty) => `${qty} ${opt.session ? (qty === 1 ? 'player' : 'players') : qty === 1 ? 'person' : 'people'}`;

    /** The request as WhatsApp text and an email, with links that open them. */
    function compose(sel) {
      const sum = total(sel.opt, sel.qty);
      const lines = [
        "Hi Soweto Towers! I'd like to book:",
        '',
        `${sel.opt.name} for ${people(sel.opt, sel.qty)}`,
        `${longDate(sel.date)} at ${sel.time}`,
        `Estimated total: ${rand(sum)}`,
      ];
      if (sel.opt.followUp) lines.push(sel.opt.followUp);
      const details = [];
      if (sel.name) details.push(`Name: ${sel.name}`);
      if (sel.phone) details.push(`Phone: ${sel.phone}`);
      if (sel.note) details.push(`Note: ${sel.note}`);
      if (details.length) lines.push('', ...details);
      lines.push('', 'Please confirm my time. Thank you!');
      const text = lines.join('\n');
      const subject = `Booking request: ${sel.opt.name}, ${shortDate(sel.date)} at ${sel.time}, ${people(sel.opt, sel.qty)}`;
      return {
        text,
        subject,
        whatsapp: `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(text)}`,
        email: `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\n/g, '\r\n'))}`,
      };
    }

    return { sunsetHm, dayHours, slots, dayState, total, nowInSast, longDate, shortDate, people, compose, addDays, weekday, rand };
  }

  // Outside a browser (the unit test), hand the rules over and stop.
  if (typeof document === 'undefined') {
    root.createPlanner = createPlanner;
    return;
  }

  const dataEl = document.getElementById('plan-data');
  const form = document.querySelector('[data-plan-form]'); // the planner's container
  if (!dataEl || !form) return;
  const data = JSON.parse(dataEl.textContent);
  const core = createPlanner(data);
  const options = {};
  data.options.forEach((o) => (options[o.id] = o));
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = () => (still.matches ? 'auto' : 'smooth');
  const $ = (sel) => form.querySelector(sel);
  const now = () => core.nowInSast(Date.now());

  const els = {
    options: Array.from(form.querySelectorAll('input[name="what"]')),
    qty: $('[data-qty]'),
    minus: $('[data-qty-minus]'),
    plus: $('[data-qty-plus]'),
    qtyHint: $('[data-qty-hint]'),
    month: $('[data-month]'),
    prev: $('[data-prev]'),
    next: $('[data-next]'),
    grid: $('[data-grid]'),
    times: $('[data-times]'),
    timeNote: $('[data-time-note]'),
    name: $('[name="name"]'),
    phone: $('[name="phone"]'),
    note: $('[name="note"]'),
    sumWhat: $('[data-sum-what]'),
    sumWhen: $('[data-sum-when]'),
    sumTotal: $('[data-sum-total]'),
    sumEach: $('[data-sum-each]'),
    status: $('[data-status]'),
    send: Array.from(form.querySelectorAll('[data-send]')),
  };
  const steps = { what: $('[data-step="what"]'), day: $('[data-step="day"]'), time: $('[data-step="time"]') };
  els.send.forEach((a) => (a.dataset.template = a.getAttribute('href')));

  const checked = els.options.find((i) => i.checked) || els.options[0];
  const state = { opt: checked ? checked.value : data.options[0].id, qty: 1, date: null, time: null, month: now().date.slice(0, 7) };
  const opt = () => options[state.opt];

  // Open on the month of the next day that can be booked (late on the last open day of a month, that's next month).
  for (let i = 0, today = now(); i <= data.horizonDays; i++) {
    const d = core.addDays(today.date, i);
    if (core.dayState(opt(), d, today) === 'open') {
      state.month = d.slice(0, 7);
      break;
    }
  }

  // Show the planner in place of the scriptless WhatsApp and email buttons.
  document.querySelectorAll('[data-plan-fallback]').forEach((el) => (el.hidden = true));
  form.hidden = false;

  // ---------- People ----------
  function renderQty() {
    const o = opt();
    state.qty = Math.min(o.max, Math.max(o.min, state.qty));
    els.qty.textContent = String(state.qty);
    els.minus.disabled = state.qty <= o.min;
    els.plus.disabled = state.qty >= o.max;
    const each = core.total(o, state.qty) / state.qty;
    const base = core.total(o, Math.max(o.min, 1)) / Math.max(o.min, 1);
    let hint = o.session ? `${o.min} to ${o.max} players, booked at least a day ahead.` : '';
    if (each < base) hint = `Group rate: ${core.rand(each)} each.`;
    else {
      const from = (data.prices[o.id] || []).findIndex((t, i) => t !== null && t / (i + 1) < base);
      if (from > 0) hint = `Groups of ${from + 1} or more pay ${core.rand(data.prices[o.id][from] / (from + 1))} each.`;
    }
    els.qtyHint.textContent = hint;
  }

  // ---------- Calendar ----------
  const monthOf = (ymd) => ymd.slice(0, 7);
  const lastMonth = () => monthOf(core.addDays(now().date, data.horizonDays));

  function shiftMonth(month, by) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }

  // Spring easing from the page's CSS, so the calendar moves like the menu.
  function springEasing() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--spring').trim();
    return v || 'cubic-bezier(.25, 1, .4, 1)';
  }

  function renderCalendar(direction) {
    const o = opt();
    const today = now();
    const [y, m] = state.month.split('-').map(Number);
    els.month.textContent = `${MONTHS[m - 1]} ${y}`;
    els.prev.disabled = state.month <= monthOf(today.date);
    els.next.disabled = state.month >= lastMonth();
    const hadFocus = els.grid.contains(document.activeElement) ? document.activeElement.dataset.date : null;
    const first = `${state.month}-01`;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < (weekday(first) + 6) % 7; i++) frag.appendChild(document.createElement('span'));
    for (let d = 1; d <= days; d++) {
      const ymd = `${state.month}-${pad(d)}`;
      const st = core.dayState(o, ymd, today);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cal__day';
      b.dataset.date = ymd;
      b.textContent = String(d);
      if (ymd === today.date) b.classList.add('is-today');
      if (st !== 'open') b.disabled = true;
      if (st === 'closed') b.classList.add('is-closed');
      b.setAttribute('aria-pressed', String(ymd === state.date));
      const day = core.dayHours(ymd);
      const why = { open: `open ${day.opensAt} till sunset`, closed: 'closed', gone: 'no times left', past: 'past', later: 'not open for booking yet' }[st];
      b.setAttribute('aria-label', `${core.longDate(ymd)}, ${why}`);
      b.tabIndex = -1;
      frag.appendChild(b);
    }
    els.grid.replaceChildren(frag);
    // One day is in the tab order; arrow keys move between the rest.
    const tabbable = els.grid.querySelector('[aria-pressed="true"]:not(:disabled)') || els.grid.querySelector('.cal__day:not(:disabled)');
    if (tabbable) tabbable.tabIndex = 0;
    if (hadFocus) {
      const again = els.grid.querySelector(`[data-date="${hadFocus}"]`) || tabbable;
      if (again) again.focus({ preventScroll: true });
    }
    if (direction && !still.matches && els.grid.animate) {
      const frames = [
        { transform: `translateX(${direction * 28}px)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ];
      try {
        els.grid.animate(frames, { duration: 500, easing: springEasing() });
      } catch {
        els.grid.animate(frames, { duration: 500, easing: 'cubic-bezier(.25, 1, .4, 1)' });
      }
    }
  }

  function moveMonth(by) {
    const target = shiftMonth(state.month, by);
    if (target < monthOf(now().date) || target > lastMonth()) return;
    state.month = target;
    renderCalendar(by);
  }

  // ---------- Times ----------
  function renderTimes() {
    const o = opt();
    if (!state.date) {
      els.times.replaceChildren();
      els.timeNote.textContent = 'Pick a day to see the times.';
      return;
    }
    const day = core.dayHours(state.date);
    const list = core.slots(o, state.date, now()).filter((s) => !s.closed);
    if (!list.some((s) => s.time === state.time)) state.time = null;
    const frag = document.createDocumentFragment();
    list.forEach((s, i) => {
      const label = document.createElement('label');
      label.className = 'slot is-new';
      if (s.time === state.time) label.classList.add('is-checked');
      label.style.setProperty('--i', String(i));
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'time';
      input.value = s.time;
      input.checked = s.time === state.time;
      label.appendChild(input);
      const t = document.createElement('span');
      t.textContent = s.time;
      label.appendChild(t);
      if (s.golden) {
        const small = document.createElement('small');
        small.textContent = 'Sunset';
        label.appendChild(small);
      }
      frag.appendChild(label);
    });
    els.times.replaceChildren(frag);
    const kind = o.session ? '1-hour games' : 'Times are 30 minutes apart';
    els.timeNote.textContent = `${core.longDate(state.date)}: open ${day.opensAt} till sunset (${day.sunset}). ${kind}; the crew confirms yours.`;
  }

  // ---------- Summary and sending ----------
  function selection() {
    return {
      opt: opt(),
      qty: state.qty,
      date: state.date,
      time: state.time,
      name: els.name.value.trim(),
      phone: els.phone.value.trim(),
      note: els.note.value.trim(),
    };
  }

  function missing() {
    if (!state.date) return 'day';
    if (!state.time) return 'time';
    return null;
  }

  let lastTotal = null;
  function renderSummary() {
    const o = opt();
    const sum = core.total(o, state.qty);
    els.sumWhat.textContent = `${o.name}, ${core.people(o, state.qty)}`;
    els.sumWhen.textContent = state.date ? `${core.longDate(state.date)}${state.time ? ` at ${state.time}` : ''}` : 'Pick a day and a time';
    els.sumTotal.textContent = core.rand(sum);
    els.sumEach.textContent = `${core.rand(sum / state.qty)} each${o.followUp ? '. ' + o.followUp : ''}`;
    if (lastTotal !== null && lastTotal !== sum && !still.matches && els.sumTotal.animate) {
      els.sumTotal.animate([{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.25, 1, .4, 1)' });
    }
    lastTotal = sum;
    const gap = missing();
    const msg = gap ? null : core.compose(selection());
    els.send.forEach((a) => {
      a.setAttribute('aria-disabled', String(!!gap));
      // Until the request is complete, the link holds the plain template, never an earlier choice.
      a.href = msg ? (a.dataset.send === 'whatsapp' ? msg.whatsapp : msg.email) : a.dataset.template;
    });
    if (!gap) els.status.textContent = '';
    steps.day.classList.toggle('is-done', !!state.date);
    steps.time.classList.toggle('is-done', !!state.time);
  }

  function render(direction) {
    renderQty();
    renderCalendar(direction);
    renderTimes();
    renderSummary();
  }

  // ---------- Events ----------
  function selectOption(id) {
    if (!options[id]) return;
    state.opt = id;
    els.options.forEach((i) => {
      i.checked = i.value === id;
      i.closest('.opt').classList.toggle('is-checked', i.checked);
    });
    // A day that doesn't suit the new choice (paintball on a Thursday) is let go, with a word why.
    if (state.date && core.dayState(opt(), state.date, now()) !== 'open') {
      els.status.textContent = `${opt().name} isn't on ${core.longDate(state.date)}, so pick another day.`;
      state.date = null;
      state.time = null;
    }
    render();
  }

  els.options.forEach((input) => input.addEventListener('change', () => selectOption(input.value)));
  els.options.forEach((i) => i.closest('.opt').classList.toggle('is-checked', i.checked));

  els.minus.addEventListener('click', () => {
    state.qty -= 1;
    renderQty();
    renderSummary();
  });
  els.plus.addEventListener('click', () => {
    state.qty += 1;
    renderQty();
    renderSummary();
  });
  els.prev.addEventListener('click', () => moveMonth(-1));
  els.next.addEventListener('click', () => moveMonth(1));

  els.grid.addEventListener('click', (e) => {
    const b = e.target.closest('.cal__day');
    if (!b || b.disabled) return;
    state.date = b.dataset.date;
    els.status.textContent = '';
    renderCalendar();
    renderTimes();
    renderSummary();
    steps.time.scrollIntoView({ behavior: behavior(), block: 'nearest' });
  });

  // Arrow keys move between days that can be picked; Home and End go to the first and last.
  els.grid.addEventListener('keydown', (e) => {
    const b = e.target.closest('.cal__day');
    if (!b) return;
    const open = Array.from(els.grid.querySelectorAll('.cal__day:not(:disabled)'));
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let target = null;
    if (e.key === 'Home') target = open[0];
    else if (e.key === 'End') target = open[open.length - 1];
    else if (step) {
      let d = b.dataset.date;
      for (let i = 0; i < 6 && !target; i++) {
        d = core.addDays(d, step);
        if (monthOf(d) !== state.month) break;
        target = open.find((x) => x.dataset.date === d) || null;
      }
      if (!target && Math.abs(step) === 1) {
        const idx = open.indexOf(b) + step;
        target = open[idx] || null;
      }
    } else return;
    e.preventDefault();
    if (!target) return;
    open.forEach((x) => (x.tabIndex = -1));
    target.tabIndex = 0;
    target.focus();
  });

  els.times.addEventListener('change', (e) => {
    if (e.target.name !== 'time') return;
    state.time = e.target.value;
    els.times.querySelectorAll('.slot').forEach((l) => {
      l.classList.toggle('is-checked', l.querySelector('input').checked);
      l.classList.remove('is-new');
    });
    els.status.textContent = '';
    renderSummary();
  });

  [els.name, els.phone, els.note].forEach((f) => f.addEventListener('input', renderSummary));

  // A send button pressed too early says what's missing and takes you there.
  els.send.forEach((a) =>
    a.addEventListener('click', (e) => {
      const gap = missing();
      if (!gap) {
        els.status.textContent = a.dataset.send === 'whatsapp' ? 'Opening WhatsApp…' : 'Opening your email…';
        return;
      }
      e.preventDefault();
      els.status.textContent = gap === 'day' ? 'Pick a day first.' : 'Pick a time first.';
      const step = steps[gap];
      step.scrollIntoView({ behavior: behavior(), block: 'center' });
      const target = gap === 'day' ? els.grid.querySelector('.cal__day[tabindex="0"]') : els.times.querySelector('input');
      if (target) target.focus({ preventScroll: true });
      step.classList.remove('is-missing');
      void step.offsetWidth;
      step.classList.add('is-missing');
    }),
  );
  Object.values(steps).forEach((s) => s.addEventListener('animationend', () => s.classList.remove('is-missing')));

  // Booking buttons elsewhere on the page open the planner, with their adventure chosen.
  const ctaIcon = document.getElementById('plan-cta-icon');
  document.querySelectorAll('[data-plan]').forEach((a) => {
    if (a.dataset.planLabel) {
      a.replaceChildren();
      if (ctaIcon) a.appendChild(ctaIcon.content.cloneNode(true));
      a.appendChild(document.createTextNode(a.dataset.planLabel));
    }
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-plan]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const menu = document.getElementById('menu-toggle');
    if (menu) menu.checked = false;
    if (a.dataset.plan) selectOption(a.dataset.plan);
    document.getElementById('book').scrollIntoView({ behavior: behavior(), block: 'start' });
    const next = els.grid.querySelector('.cal__day[tabindex="0"]');
    if (next) next.focus({ preventScroll: true });
  });

  render();
})(typeof globalThis !== 'undefined' ? globalThis : this);
