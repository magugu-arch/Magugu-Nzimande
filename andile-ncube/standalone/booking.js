/* ---------------- Booking: fixture availability, one decision at a time ----------------
   Availability is generated from BOOKING (data/booking.ts): working days and
   hours in SAST (fixed UTC+2), minimum notice, a horizon, closed public
   holidays, and a deterministic share of taken slots so the same day always
   looks the same. Requests are kept in localStorage so a requested slot shows
   as yours, and can be changed or cancelled — nothing leaves the device. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- read by the page script this fragment is inlined into
const Booking = (() => {
  const cfg = BOOKING;
  const OFF = cfg.utcOffsetMinutes * 60000;
  const form = $("#book-form"), done = $("#b-done");
  const daysEl = $("#b-days"), slotsEl = $("#b-slots"), emptyEl = $("#b-empty"), countEl = $("#b-count");
  const bar = $("#b-bar"), sumEl = $("#b-sum"), details = $("#b-details");
  const STORE = "andile-booking-requests";
  const pad2 = (n) => String(n).padStart(2, "0");
  const closed = new Map(cfg.closedDates.map((c) => [c.date, c.label]));
  const [sh, sm] = cfg.hours.start.split(":").map(Number);
  const [eh, em] = cfg.hours.end.split(":").map(Number);
  const dayFmt = new Intl.DateTimeFormat("en-ZA", { timeZone: cfg.timezone, weekday: "short", day: "numeric", month: "short" });
  const longFmt = new Intl.DateTimeFormat("en-ZA", { timeZone: cfg.timezone, weekday: "long", day: "numeric", month: "long" });
  const monthFmt = new Intl.DateTimeFormat("en-ZA", { timeZone: cfg.timezone, month: "long", year: "numeric" });
  const localFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // A small deterministic hash, so the fixture is stable across visits.
  function rand(str) {
    let h = 2166136261 ^ cfg.seed;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch {} };
  let requests = load();

  // Days: SAST-midnight values whose UTC fields read as the SAST wall date.
  const isoOf = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const instantOf = (d) => new Date(d.getTime() - OFF + 12 * 3600e3); // midday SAST, for formatting
  function bookableDays() {
    const start = new Date(Date.now() + OFF); start.setUTCHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i <= cfg.horizonDays; i++) {
      const d = new Date(start.getTime() + i * 864e5);
      if (cfg.workingDays.includes(d.getUTCDay() || 7)) out.push(d);
    }
    return out;
  }
  function slotsFor(day, type) {
    const key = isoOf(day);
    if (closed.has(key)) return { closed: closed.get(key), slots: [] };
    const full = rand(key + "|full") < cfg.fullDayRatio;
    const earliest = Date.now() + cfg.minNoticeHours * 3600e3;
    const slots = [];
    for (let m = sh * 60 + sm; m + type.minutes <= eh * 60 + em; m += cfg.slotStepMinutes) {
      const start = day.getTime() + m * 60000 - OFF;
      if (start < earliest) continue;
      const end = start + type.minutes * 60000;
      const mine = requests.find((r) => r.start < end && start < r.end);
      let taken = full;
      for (let b = m; b < m + type.minutes && !taken; b += cfg.slotStepMinutes) if (rand(`${key}|${b}`) < cfg.busyRatio) taken = true;
      if (mine) {
        // Your own request shows as yours; times it overlaps are simply unavailable.
        if (mine.start === start && mine.type === type.id) slots.push({ start, end, m, mine: true });
        continue;
      }
      if (!taken) slots.push({ start, end, m });
    }
    return { full, slots };
  }

  const days = bookableDays();
  const state = { type: null, day: null, slot: null, started: false };
  const typeOf = (id) => cfg.types.find((t) => t.id === id);
  const sastLabel = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  const differentZone = (ms) => -new Date(ms).getTimezoneOffset() !== cfg.utcOffsetMinutes;
  const begin = () => { if (!state.started) { state.started = true; track("booking_start", { source: "booking" }); } };

  /* Day strip */
  daysEl.innerHTML = days.map((d, i) => {
    const parts = dayFmt.formatToParts(instantOf(d));
    const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
    return `<li><button type="button" class="day" data-i="${i}" aria-pressed="false"><span class="dw">${get("weekday")}</span><span class="dn">${get("day")}</span><span class="ds" data-month="${get("month")}">${get("month")}</span></button></li>`;
  }).join("");
  const dayBtns = $$(".day", daysEl);
  const dayRail = new Rail($("#b-days").closest(".bstep"));
  const monthEl = $("#b-month");
  dayRail.onMove = (x) => {
    const first = dayBtns.find((b) => b.parentElement.offsetLeft + b.parentElement.offsetWidth / 2 >= -x) || dayBtns[0];
    const label = monthFmt.format(instantOf(days[+first.dataset.i]));
    if (monthEl.textContent !== label) monthEl.textContent = label;
  };
  dayRail.onMove(0);

  function refreshDays() {
    const type = typeOf(state.type);
    dayBtns.forEach((b) => {
      const d = days[+b.dataset.i], info = slotsFor(d, type);
      const free = info.slots.filter((s) => s.mine === undefined).length;
      const ds = b.querySelector(".ds");
      ds.textContent = info.closed ? "Closed" : free ? ds.dataset.month : "Full";
      b.disabled = !free && !info.slots.some((s) => s.mine);
      b.setAttribute("aria-label", `${longFmt.format(instantOf(d))} — ${info.closed ? `closed, ${info.closed}` : free ? `${free} times available` : "fully booked"}`);
    });
  }

  function selectDay(i, from) {
    const prev = state.day;
    state.day = i;
    dayBtns.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
    renderSlots(prev === null ? 1 : i >= prev ? 1 : -1);
    if (from === "user") begin();
  }
  daysEl.addEventListener("click", (e) => { const b = e.target.closest(".day"); if (b && !b.disabled) selectDay(+b.dataset.i, "user"); });

  /* Slots */
  function renderSlots(dir) {
    const type = typeOf(state.type), day = days[state.day];
    const info = slotsFor(day, type);
    const keep = state.slot && info.slots.find((s) => s.start === state.slot.start && s.mine === undefined);
    if (!keep) setSlot(null);
    const zoneNote = info.slots.length && differentZone(info.slots[0].start);
    $("#b-tz").textContent = `${longFmt.format(instantOf(day))} · times in ${cfg.tzLabel} (UTC+2)` + (zoneNote ? ` · your time (${localZone.replace(/_/g, " ")}) shown beneath` : "");
    const free = info.slots.filter((s) => s.mine === undefined);
    countEl.textContent = info.closed ? "" : `${free.length} ${free.length === 1 ? "time" : "times"} available`;
    if (!info.slots.length) {
      slotsEl.innerHTML = ""; emptyEl.hidden = false;
      emptyEl.textContent = info.closed ? `Closed — ${info.closed}.` : "No times left on this day. Try another.";
      return;
    }
    emptyEl.hidden = true;
    slotsEl.innerHTML = info.slots.map((s, i) => {
      const t = sastLabel(s.m), local = zoneNote ? localFmt.format(new Date(s.start)) : "";
      if (s.mine !== undefined) return `<div class="slot mine" style="animation-delay:${i * 18}ms"><span class="st">${t}</span><span class="sl">Requested</span></div>`;
      return `<label class="slot" style="animation-delay:${i * 18}ms"><input type="radio" name="bslot" value="${s.start}"${keep && keep.start === s.start ? " checked" : ""}><span class="st">${t}</span>${local ? `<span class="sl">${local}</span>` : ""}</label>`;
    }).join("");
    slotsEl.classList.remove("enter", "from-left"); slotsEl.getBoundingClientRect(); // restart the entrance animation
    slotsEl.classList.add("enter"); if (dir < 0) slotsEl.classList.add("from-left");
  }
  slotsEl.addEventListener("change", (e) => {
    if (e.target.name !== "bslot") return;
    const start = +e.target.value, type = typeOf(state.type);
    setSlot({ start, end: start + type.minutes * 60000, m: Math.round(((start + OFF) % 864e5) / 60000) });
    begin(); track("booking_slot_select", { type: state.type });
  });

  /* Summary bar: rises from below when there is something to confirm, returns the same way */
  let barP = 0, barAnim = null;
  const setBar = (p) => { barP = p; bar.style.opacity = String(Math.min(1, Math.max(0, p))); bar.style.transform = `translate3d(0,${(1 - p) * 24}px,0)`; };
  function showBar(on) {
    if (on) bar.hidden = false;
    if (barAnim) barAnim.stop();
    barAnim = spring({ from: barP, to: on ? 1 : 0, response: 0.35, onUpdate: setBar, onDone: () => { if (!on) bar.hidden = true; } });
  }
  function summary() {
    const type = typeOf(state.type), s = state.slot;
    const when = `${dayFmt.format(new Date(s.start))}, ${sastLabel(s.m)} ${cfg.tzLabel}`;
    const local = differentZone(s.start) ? ` · ${localFmt.format(new Date(s.start))} your time` : "";
    return { type, when, local };
  }
  function setSlot(slot) {
    state.slot = slot;
    if (!slot) { details.classList.remove("open"); details.querySelector("div").inert = true; if (!bar.hidden) showBar(false); return; }
    const { type, when, local } = summary();
    sumEl.innerHTML = `${type.name} · ${type.minutes} min<small>${when}${local}</small>`;
    details.classList.add("open"); details.querySelector("div").inert = false;
    if (bar.hidden || barP < 1) showBar(true);
  }

  /* Types */
  form.addEventListener("change", (e) => {
    if (e.target.name !== "btype") return;
    state.type = e.target.value; begin();
    refreshDays();
    if (state.day === null || dayBtns[state.day].disabled) {
      const first = dayBtns.find((b) => !b.disabled);
      if (first) selectDay(+first.dataset.i);
    } else renderSlots(1);
  });

  /* Validation: inline, cleared as soon as it is fixed */
  const f = form.elements;
  const rules = {
    name: () => (f.name.value.trim() ? "" : "Enter your name."),
    company: () => (f.company.value.trim() ? "" : "Enter your company name."),
    email: () => (EMAIL.test(f.email.value.trim()) ? "" : "Enter an email address in the format name@company.com."),
    consent: () => (f.consent.checked ? "" : "Confirm that we may use these details to arrange the call."),
  };
  function validate(live) {
    let first = null;
    for (const [k, rule] of Object.entries(rules)) {
      const el = document.getElementById("be-" + k), msg = rule();
      if (live && el.hidden) continue;
      el.hidden = !msg; el.textContent = msg;
      if (f[k].type !== "checkbox") f[k].setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg && !first) first = k;
    }
    return first;
  }
  form.addEventListener("input", () => validate(true));

  /* Request */
  let current = null;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.slot) { slotsEl.querySelector("input")?.focus(); return; }
    const bad = validate(false);
    if (bad) { f[bad].focus(); return; }
    const type = typeOf(state.type);
    const req = {
      ref: "BK-" + Date.now().toString(36).toUpperCase().slice(-6),
      type: type.id, start: state.slot.start, end: state.slot.end,
      name: f.name.value.trim(), company: f.company.value.trim(), email: f.email.value.trim(), note: f.note.value.trim(),
    };
    if (BOOKING_ENDPOINT) {
      try {
        const res = await fetch(BOOKING_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...req, start: new Date(req.start).toISOString(), end: new Date(req.end).toISOString(), timezone: cfg.timezone }) });
        if (!res.ok) throw new Error();
      } catch { showErr("be-consent", "The request could not be sent. Check your connection and try again."); return; }
    }
    requests = [...requests.filter((r) => r.ref !== req.ref), req]; save(requests);
    current = req;
    track("booking_request", { type: req.type });
    if (navigator.vibrate) navigator.vibrate(12);
    const s = summary();
    $("#b-done-list").innerHTML = `<div><dt>Call</dt><dd>${type.name} · ${type.minutes} min · ${type.format}</dd></div><div><dt>When</dt><dd>${longFmt.format(new Date(req.start))}, ${sastLabel(state.slot.m)} ${cfg.tzLabel}${s.local ? `<br><span class="muted">${s.local.slice(3)}</span>` : ""}</dd></div><div><dt>Name</dt><dd>${esc(req.name)}, ${esc(req.company)}</dd></div><div><dt>Reference</dt><dd>${req.ref}</dd></div>`;
    form.hidden = true; done.hidden = false; done.focus();
  });
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* After the request: a tentative calendar hold, or undo */
  $("#b-ics").addEventListener("click", () => {
    if (!current) return;
    const type = typeOf(current.type);
    const z = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Andile Ncube//Booking fixture//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
      `UID:${current.ref}@andile-ncube.fixture`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(current.start)}`, `DTEND:${z(current.end)}`,
      `SUMMARY:Requested (unconfirmed): ${type.name} — Andile Ncube`,
      "DESCRIPTION:Requested on a sample calendar. Nothing has been booked or confirmed.",
      "STATUS:TENTATIVE", "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `andile-ncube-${current.ref}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  function reopen(keepDetails) {
    if (current) { requests = requests.filter((r) => r.ref !== current.ref); save(requests); }
    current = null;
    done.hidden = true; form.hidden = false;
    if (!keepDetails) form.reset();
    const t = form.querySelector(`input[name="btype"][value="${state.type}"]`); if (t) t.checked = true;
    refreshDays(); setSlot(null); renderSlots(1);
    $("#b-day-h").scrollIntoView({ block: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
    dayBtns[state.day]?.focus({ preventScroll: true });
  }
  $("#b-change").addEventListener("click", () => reopen(true));
  $("#b-cancel").addEventListener("click", () => reopen(false));

  function prefill(typeId) {
    const input = form.querySelector(`input[name="btype"][value="${typeId}"]`);
    if (!input) return;
    if (!done.hidden) reopen(true);
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Start on the most common path: the first call type and the first day with room.
  form.querySelector('input[name="btype"]').checked = true;
  state.type = cfg.types[0].id;
  refreshDays();
  const first = dayBtns.find((b) => !b.disabled);
  if (first) selectDay(+first.dataset.i);
  return { prefill };
})();
