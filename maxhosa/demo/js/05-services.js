/* ---------------------------------------------------------------------------
 * Services: delivery tracking, styling appointments, notifications and the
 * account sheets. Every provider here is simulated and says so.
 * ------------------------------------------------------------------------- */

/* --------------------------------------------------------------- tracking */

var EXCEPTIONS = {
  delayed: {
    title: 'Delayed',
    text: 'The courier has reported a delay. There is no new estimate yet — we will show one as soon as the courier sends it.',
    actions: [
      ['carrier-page', 'Courier tracking page'],
      ['client-care', 'Contact client care'],
    ],
  },
  address_issue: {
    title: 'Address needs checking',
    text: 'The courier could not match the delivery address. Confirm it so they can try again.',
    actions: [
      ['verify-address', 'Check address'],
      ['client-care', 'Contact client care'],
    ],
  },
  delivery_attempted: {
    title: 'Delivery attempted',
    text: 'The courier came by and nobody was available to receive the parcel (simulated).',
    actions: [
      ['redelivery', 'Arrange redelivery'],
      ['delivery-prefs', 'Choose a safe place'],
      ['client-care', 'Contact client care'],
    ],
  },
  customs_hold: {
    title: 'Held at customs',
    text: 'The parcel is waiting for customs clearance. Clearance times are set by customs, so there is no date to show yet.',
    actions: [
      ['client-care', 'Ask about customs'],
      ['carrier-page', 'Courier tracking page'],
    ],
  },
};

function exceptionCopy(o) {
  return EXCEPTIONS[o.tracking.exception] || { title: '', text: '', actions: [] };
}

function lastEventTime(o) {
  var ev = o.tracking.events[o.tracking.events.length - 1];
  return ev ? ev.at : o.createdAt;
}

/**
 * What the status card says. An estimate appears only once the carrier has
 * the parcel, is always attributed, and disappears on any exception rather
 * than pretending the old one still holds.
 */
function statusCopy(o) {
  var t = o.tracking;
  var stage = STAGES[t.stage];
  if (t.exception) {
    return { title: EXCEPTIONS[t.exception].title, eta: 'Delivery estimate not available while this is resolved' };
  }
  if (t.stage === 6) return { title: 'Delivered', eta: 'Delivered ' + fmtDayTime(lastEventTime(o)) + ' · courier-confirmed (simulated)' };
  if (t.stage < 3) return { title: stage.label, eta: 'Delivery estimate not yet available — it arrives with the courier' };
  var base = new Date(lastEventTime(o));
  if (t.mode === 'local' && t.stage === 5) {
    var a = new Date(Date.now() + 18 * 60000);
    var b = new Date(Date.now() + 42 * 60000);
    return { title: stage.label, eta: 'Estimate from courier (simulated): ' + fmtTime(a.toISOString()) + '–' + fmtTime(b.toISOString()) };
  }
  var day = new Date(base.getTime() + (t.stage === 5 ? 0 : t.mode === 'local' ? 0 : 2 * 86400000));
  day.setHours(9, 0, 0, 0);
  var end = new Date(day.getTime());
  end.setHours(17, 0, 0, 0);
  return {
    title: stage.label,
    eta: 'Estimate from courier (simulated): ' + (isToday(day.toISOString()) ? 'today' : fmtDay(day.toISOString())) + ', ' + fmtTime(day.toISOString()) + '–' + fmtTime(end.toISOString()),
  };
}

function stageBar(o, compact) {
  var t = o.tracking;
  return (
    '<span class="stage-bar' +
    (compact ? ' mini' : '') +
    '" aria-hidden="true">' +
    STAGES.map(function (s, i) {
      return '<i class="' + (i <= t.stage ? 'done' : '') + '"><b style="transform:scaleX(' + (i <= t.stage ? 1 : 0) + ')"></b></i>';
    }).join('') +
    '</span>'
  );
}

var trackerTimer = null;

function openTracker(orderId) {
  var o = orderById(orderId);
  if (!o) return;
  var courier = null;
  var layer = pushScreen({
    title: 'Order ' + o.id,
    cls: 'tracker',
    onHide: function () {
      clearInterval(trackerTimer);
      trackerTimer = null;
    },
    render: function (el) {
      el._render = function () {
        var keep = $('.scroller', el).scrollTop;
        $('.scroller', el).innerHTML = trackerBody(o);
        $('.scroller', el).scrollTop = keep;
        sweepImages(el);
        courier = setupCourier(el, o);
      };
      el._render();
      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-t]');
        if (!a) return;
        trackerAction(o, a.getAttribute('data-t'), a.getAttribute('data-v'), el);
      });
    },
  });
  return layer;
}

function trackerBody(o) {
  var t = o.tracking;
  var copy = statusCopy(o);
  var updated = t.mode === 'local' && t.stage === 5 && !t.exception ? new Date().toISOString() : lastEventTime(o);
  var html =
    '<div style="padding:0.5rem 0 0">' +
    '<section class="status-card" aria-live="polite" aria-labelledby="status-h"><span class="eyebrow">' +
    esc(t.mode === 'local' ? 'Same-day courier' : o.serviceLevel) +
    ' · simulated</span><h2 id="status-h">' +
    esc(copy.title) +
    '</h2><div class="eta">' +
    esc(copy.eta) +
    '</div><div class="updated">Updated ' +
    esc(fmtTime(updated)) +
    (t.stale ? ' · location may be out of date' : '') +
    '</div>' +
    stageBar(o) +
    '</section></div>';

  if (t.exception) {
    var ex = EXCEPTIONS[t.exception];
    html +=
      '<section class="exception" role="alert"><h3>' +
      icon('alert') +
      esc(ex.title) +
      '</h3><p>' +
      esc(ex.text) +
      '</p><div class="actions">' +
      ex.actions
        .map(function (a, i) {
          return '<button class="btn ' + (i ? 'btn-secondary' : 'btn-primary') + '" data-t="' + a[0] + '">' + esc(a[1]) + '</button>';
        })
        .join('') +
      '</div></section>';
  }
  if (t.unknown) {
    html +=
      '<div class="no-map">' +
      icon('info') +
      '<div>The courier sent an update we haven’t reviewed yet, so it isn’t shown as a status. Your last confirmed status is <strong>' +
      esc(STAGES[t.stage].label.toLowerCase()) +
      '</strong>.</div></div>';
  }

  // Map only for the simulated same-day courier with a position; parcels get the honest version.
  if (t.mode === 'local' && t.stage === 5 && !t.exception) {
    html +=
      '<div class="map" role="img" aria-label="Simulated map: courier approaching the delivery area. Demo location, not GPS.">' +
      mapArt() +
      '<span class="tag sample map-label" style="background:var(--card)">Demo location — not GPS</span>' +
      '<span class="tag map-updated" style="background:var(--card)" data-map-updated>' +
      (t.stale ? 'Last position 18 min ago' : 'Updated just now') +
      '</span>' +
      '<div class="courier' +
      (t.stale ? ' stale' : '') +
      '" aria-hidden="true">' +
      icon('truck') +
      '</div></div>';
  } else if (t.mode === 'local' && t.stage === 5) {
    html +=
      '<div class="no-map">' +
      icon('pin') +
      '<div>Live location is hidden while this is sorted out. It returns if the courier resumes the delivery.</div></div>';
  } else if (t.stage >= 3 && t.stage < 6) {
    html +=
      '<div class="no-map">' +
      icon('pin') +
      '<div>Location tracking isn’t available for this shipment. Each scan from the courier appears below as it happens.</div></div>';
  }

  html += '<div class="group-title">Progress</div><ol class="timeline" aria-label="Delivery progress">';
  STAGES.forEach(function (s, i) {
    var ev = t.events.filter(function (e) {
      return e.stage === s.id;
    })[0];
    var cls = i < t.stage ? 'done' : i === t.stage ? 'done current' : 'pending';
    html +=
      '<li class="' +
      cls +
      '"><span class="t-dot">' +
      (i <= t.stage ? icon('check') : '') +
      '</span><div><div class="t-title">' +
      esc(s.label) +
      (i <= t.stage ? '<span class="tag ' + (s.source === 'carrier' ? 'info' : '') + '">' + (s.source === 'carrier' ? 'Courier' : 'MAXHOSA') + '</span>' : '') +
      '</div>' +
      (i <= t.stage ? '<div class="t-desc">' + esc(s.desc) + '</div>' : '') +
      '<div class="t-time">' +
      (ev ? esc(fmtDayTime(ev.at)) : 'Not yet') +
      '</div></div></li>';
  });
  html += '</ol>';

  var lines = o.lines
    .map(function (l) {
      var p = PRODUCTS[l.productId];
      return (
        '<div class="row"><span style="width:3rem;flex:none">' +
        media(p.media[0], { decorative: true, eager: true }) +
        '</span><span class="row-main"><span class="row-title">' +
        esc(p.name) +
        '</span><span class="row-sub" style="display:block">Size ' +
        esc(l.size) +
        ' · Qty ' +
        l.quantity +
        '</span></span></div>'
      );
    })
    .join('');
  html +=
    '<div class="group-title">Details</div><div class="group">' +
    lines +
    detailRow('Courier', o.carrier) +
    detailRow('Tracking reference', o.trackingReference || 'Not assigned yet') +
    detailRow('Delivery method', o.serviceLevel + (t.mode === 'local' ? ' · same-day (simulated)' : '')) +
    '</div>';

  var canChange = t.stage < 5 && t.stage !== 6;
  html +=
    '<div class="group-title">Help with this delivery</div><div class="group">' +
    (t.mode === 'local' && t.stage === 5
      ? actionRow('message', 'Contact the courier', 'Through a masked relay — demo', 'courier-contact')
      : '') +
    actionRow(
      'pin',
      'Delivery preferences',
      canChange ? 'Safe place, reception or instructions' : 'Closed — the courier is on the way',
      'delivery-prefs',
    ) +
    actionRow('external', 'Courier tracking page', 'Needs internet · demo link', 'carrier-page') +
    actionRow('help', 'Client care', 'Questions about this order', 'client-care') +
    '</div>';

  html += presenterControls(o);
  return html;
}

function detailRow(k, v) {
  return (
    '<div class="row no-icon"><span class="row-main"><span class="row-sub" style="display:block">' +
    esc(k) +
    '</span><span class="row-title">' +
    esc(v) +
    '</span></span></div>'
  );
}

function actionRow(ic, title, sub, action) {
  return (
    '<button class="row" data-t="' +
    action +
    '"><span class="row-icon">' +
    icon(ic) +
    '</span><span class="row-main"><span class="row-title">' +
    esc(title) +
    '</span><span class="row-sub" style="display:block">' +
    esc(sub) +
    '</span></span><span class="row-end">' +
    icon(action === 'carrier-page' ? 'external' : 'chevronRight') +
    '</span></button>'
  );
}

function presenterControls(o) {
  var t = o.tracking;
  function seg(name, options, current) {
    return (
      '<div class="segmented" role="radiogroup" aria-label="' +
      name +
      '">' +
      options
        .map(function (op) {
          return '<button role="radio" data-t="' + name.toLowerCase().replace(/\s/g, '-') + '" data-v="' + op[0] + '" aria-checked="' + (current === op[0]) + '">' + op[1] + '</button>';
        })
        .join('') +
      '</div>'
    );
  }
  return (
    '<section class="presenter" aria-labelledby="presenter-h"><h3 id="presenter-h">Presenter controls</h3>' +
    '<p class="note" style="margin:0">Simulated courier data for demonstrations. The production tracker shows only what the commerce platform and courier confirm.</p>' +
    '<div class="field"><span>Advance the timeline</span><button class="btn btn-primary btn-block" data-t="advance"' +
    (t.stage >= 6 ? ' aria-disabled="true"' : '') +
    '>' +
    icon('arrowRight') +
    'Advance demo status</button></div>' +
    '<div class="field"><span>Delivery type</span>' +
    seg('Mode', [
      ['parcel', 'Standard parcel'],
      ['local', 'Same-day courier'],
    ], t.mode) +
    '</div>' +
    '<div class="field"><span>Simulate a problem</span><div class="chips" style="flex-wrap:wrap;padding:0;overflow:visible">' +
    [
      ['none', 'None'],
      ['delayed', 'Delay'],
      ['address_issue', 'Address issue'],
      ['delivery_attempted', 'Missed delivery'],
      ['customs_hold', 'Customs hold'],
    ]
      .map(function (x) {
        var on = (t.exception || 'none') === x[0];
        return '<button class="chip" role="radio" aria-checked="' + on + '" data-t="exception" data-v="' + x[0] + '">' + x[1] + '</button>';
      })
      .join('') +
    '</div></div>' +
    '<div class="field"><span>Data quality</span><div class="chips" style="flex-wrap:wrap;padding:0;overflow:visible">' +
    '<button class="chip" aria-pressed="' +
    t.stale +
    '" data-t="stale">Stale location</button>' +
    '<button class="chip" aria-pressed="' +
    t.unknown +
    '" data-t="unknown">Unrecognised courier event</button></div></div>' +
    '<div class="field"><button class="btn btn-secondary btn-block" data-t="reset">' +
    icon('refresh') +
    'Restart this order’s timeline</button></div></section>'
  );
}

function trackerAction(o, what, value, el) {
  var t = o.tracking;
  var rerender = true;
  if (what === 'advance') {
    if (t.stage >= 6) return;
    t.exception = null;
    t.stage += 1;
    var prev = new Date(lastEventTime(o)).getTime();
    t.events.push({ stage: STAGES[t.stage].id, at: new Date(Math.max(Date.now(), prev + 60000)).toISOString() });
    if (t.stage >= 3 && !o.trackingReference) o.trackingReference = DATA.sampleOrder.trackingReference;
    haptic('tap');
  } else if (what === 'mode') {
    t.mode = value;
  } else if (what === 'exception') {
    t.exception = value === 'none' ? null : value;
  } else if (what === 'stale') {
    t.stale = !t.stale;
  } else if (what === 'unknown') {
    t.unknown = !t.unknown;
  } else if (what === 'reset') {
    var fresh = makeOrder(o.id, o.lines, new Date(Date.now() - 2.5 * 3600000), 2);
    o.tracking = fresh.tracking;
    o.trackingReference = null;
  } else {
    rerender = false;
    serviceAction(o, what);
  }
  if (rerender) {
    persist();
    el._render();
    renderTab('home');
  }
}

function serviceAction(o, what) {
  if (what === 'courier-contact') openCourierContact();
  else if (what === 'delivery-prefs') openDeliveryPrefs(o);
  else if (what === 'client-care') openHelp('order');
  else if (what === 'carrier-page') toast('Courier pages need internet and a real tracking reference — this demo has neither.', { icon: 'external' });
  else if (what === 'verify-address') openVerifyAddress(o);
  else if (what === 'redelivery') openRedelivery(o);
}

/** Courier position updates arrive every few seconds; the marker springs in X and Y separately. */
var ROUTE = [
  [0.12, 0.8],
  [0.22, 0.66],
  [0.3, 0.52],
  [0.42, 0.5],
  [0.52, 0.42],
  [0.62, 0.36],
  [0.7, 0.3],
];

function setupCourier(el, o) {
  clearInterval(trackerTimer);
  trackerTimer = null;
  var map = $('.map', el);
  if (!map) return null;
  var marker = $('.courier', map);
  var w = map.clientWidth;
  var h = map.clientHeight;
  var step = o.tracking._step || 0;
  function place(pt) {
    return [pt[0] * w, pt[1] * h];
  }
  var start = place(ROUTE[step]);
  var pos = { x: start[0], y: start[1] };
  function paint() {
    marker.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
  }
  var sx = new Spring(pos.x, function (v) {
    pos.x = v;
    paint();
  }, 0.1);
  var sy = new Spring(pos.y, function (v) {
    pos.y = v;
    paint();
  }, 0.1);
  paint();
  if (o.tracking.stale) return null;
  trackerTimer = setInterval(function () {
    if (!document.contains(map)) {
      clearInterval(trackerTimer);
      return;
    }
    step = Math.min(ROUTE.length - 1, step + 1);
    o.tracking._step = step;
    var next = place(ROUTE[step]);
    sx.to(next[0], { config: { damping: 1, response: 0.9 } });
    sy.to(next[1], { config: { damping: 1, response: 0.9 } });
    var label = $('[data-map-updated]', map);
    if (label) label.textContent = 'Updated ' + fmtTime(new Date().toISOString());
  }, 4000);
  return { sx: sx, sy: sy };
}

function mapArt() {
  // A stylised neighbourhood, deliberately not a real place.
  return (
    '<svg class="map-art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<rect width="320" height="200" fill="var(--sunk)"/>' +
    '<g fill="var(--card)" opacity="0.9">' +
    '<rect x="14" y="14" width="70" height="48" rx="6"/><rect x="100" y="12" width="90" height="40" rx="6"/><rect x="206" y="14" width="96" height="52" rx="6"/>' +
    '<rect x="16" y="120" width="60" height="64" rx="6"/><rect x="94" y="140" width="84" height="46" rx="6"/><rect x="196" y="122" width="54" height="62" rx="6"/><rect x="262" y="96" width="44" height="88" rx="6"/></g>' +
    '<g stroke="var(--hairline-strong)" stroke-width="10" fill="none" stroke-linecap="round"><path d="M0 92 H320"/><path d="M90 0 V200"/><path d="M190 0 V200"/></g>' +
    '<path d="M38 160 L70 132 L96 104 L134 100 L166 84 L198 72 L224 60" stroke="var(--ochre)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" fill="none"/>' +
    '<g transform="translate(232 50)"><circle r="14" fill="var(--ink)"/><path d="M-6 2 L0 -5 L6 2 V7 H-6 Z" fill="var(--paper)"/></g>' +
    '</svg>'
  );
}

function openCourierContact() {
  openSheet({
    title: 'Contact the courier',
    body:
      '<p class="note" style="margin-top:0">Calls and messages go through the courier’s masked relay, so neither side sees the other’s number.</p>' +
      '<div class="choice-list" style="margin-top:0.75rem">' +
      '<button class="choice" data-action="demo-only" data-msg="Demo — no call is placed. In the app this rings the courier through a masked number.">' +
      '<span class="row-icon">' +
      icon('phone') +
      '</span><span><span class="choice-title">Call through relay</span><br><span class="choice-sub">Masked number · demo</span></span></button>' +
      '<button class="choice" data-action="demo-only" data-msg="Demo — no message is sent. In the app this opens a masked chat with the courier.">' +
      '<span class="row-icon">' +
      icon('message') +
      '</span><span><span class="choice-title">Message the courier</span><br><span class="choice-sub">Masked chat · demo</span></span></button></div>',
  });
}

/**
 * A change request is not saved because it was sent. The sheet waits for the
 * (simulated) courier to accept before it says so, and refuses once the
 * courier's cut-off has passed.
 */
function openDeliveryPrefs(o) {
  var t = o.tracking;
  var closed = t.stage >= 5;
  var choice = (t.prefs && t.prefs.place) || 'door';
  var phase = 'edit';
  var sheet = openSheet({
    title: 'Delivery preferences',
    body: function (body) {
      if (closed) {
        body.innerHTML =
          '<div class="callout" style="margin-top:0">' +
          icon('clock') +
          '<div><p><strong>Changes are closed for this delivery.</strong></p><p>The courier is already on the way. Client care can still help.</p></div></div>';
        return;
      }
      if (phase === 'sent') {
        body.innerHTML =
          '<div class="outcome"><span class="outcome-icon ok">' +
          icon('check') +
          '</span><h3>Courier accepted the change</h3><p>Simulated acknowledgement from the courier. In production this appears only after the courier confirms.</p></div>';
        return;
      }
      body.innerHTML =
        '<p class="note" style="margin-top:0">Options depend on what the courier supports in your market. This demo shows the common set.</p>' +
        '<div class="choice-list" role="radiogroup" aria-label="Where to leave the parcel" style="margin-top:0.75rem">' +
        [
          ['door', 'Hand it to me', 'A signature may be needed'],
          ['reception', 'Leave it at reception', 'Building or office reception'],
          ['neighbour', 'Leave with a neighbour', 'The courier notes who has it'],
          ['safe', 'Leave in a safe place', 'Describe it below'],
        ]
          .map(function (c) {
            return (
              '<button class="choice" role="radio" data-place="' +
              c[0] +
              '" aria-checked="' +
              (choice === c[0]) +
              '"><span><span class="choice-title">' +
              c[1] +
              '</span><br><span class="choice-sub">' +
              c[2] +
              '</span></span></button>'
            );
          })
          .join('') +
        '</div><div class="field" style="margin-top:1rem"><label for="dp-notes">Instructions for the courier (optional)</label>' +
        '<textarea id="dp-notes" maxlength="140" placeholder="e.g. Gate code at reception">' +
        esc((t.prefs && t.prefs.notes) || '') +
        '</textarea><span class="hint">Avoid personal details — instructions are shared with the courier.</span></div>';
    },
    foot: function (foot) {
      if (closed || phase === 'sent') foot.innerHTML = '<button class="btn btn-secondary btn-block" data-action="close-sheet">Done</button>';
      else if (phase === 'sending')
        foot.innerHTML =
          '<button class="btn btn-primary btn-block is-busy" aria-disabled="true"><span class="spinner" style="border-top-color:currentColor" aria-hidden="true"></span>Sending to the courier…</button>';
      else foot.innerHTML = '<button class="btn btn-primary btn-block" data-dp="send">Send to courier</button>';
    },
  });
  sheet.el.addEventListener('click', function (e) {
    var c = e.target.closest('[data-place]');
    if (c) {
      choice = c.getAttribute('data-place');
      $$('[data-place]', sheet.body).forEach(function (b) {
        b.setAttribute('aria-checked', b === c);
      });
      return;
    }
    if (e.target.closest('[data-dp="send"]')) {
      var notes = $('#dp-notes', sheet.body).value;
      phase = 'sending';
      sheet.rerender();
      var ta = $('#dp-notes', sheet.body);
      if (ta) ta.value = notes;
      setTimeout(function () {
        t.prefs = { place: choice, notes: notes };
        persist();
        phase = 'sent';
        haptic('success');
        sheet.rerender();
      }, 900);
    }
  });
}

function openVerifyAddress(o) {
  openSheet({
    title: 'Check address',
    body:
      '<p class="note" style="margin-top:0">In the app you would see your saved address here, masked until you confirm it is you. This demo holds no address.</p>' +
      '<div class="callout">' +
      icon('shield') +
      '<div><p>Tracking pages and notifications never show your full address.</p></div></div>',
    foot: '<button class="btn btn-primary btn-block" data-action="demo-only" data-msg="Demo — nothing was sent. In the app the corrected address goes to the courier for approval.">Confirm address (demo)</button>',
  });
}

function openRedelivery(o) {
  openSheet({
    title: 'Arrange redelivery',
    body:
      '<p class="note" style="margin-top:0">Redelivery days come from the courier. These are sample options.</p>' +
      '<div class="choice-list" style="margin-top:0.75rem">' +
      [1, 2, 3]
        .map(function (d) {
          var day = new Date(Date.now() + d * 86400000);
          return (
            '<button class="choice" data-action="demo-only" data-msg="Demo — no redelivery was booked. In the app the courier confirms the day.">' +
            '<span class="row-icon">' +
            icon('calendar') +
            '</span><span><span class="choice-title">' +
            esc(fmtDay(day.toISOString())) +
            '</span><br><span class="choice-sub">09:00–17:00 · sample window</span></span></button>'
          );
        })
        .join('') +
      '</div>',
  });
}

/* ------------------------------------------------------------ appointments */

var STUDIO_TZ = 'Africa/Johannesburg';

function openAppointment(prefill) {
  prefill = prefill || {};
  var form = {
    type: null,
    format: null,
    date: null,
    time: null,
    name: '',
    email: '',
    phone: '',
    notes: prefill.productId ? 'Interested in: ' + PRODUCTS[prefill.productId].name + ' (' + PRODUCTS[prefill.productId].code + ')' : '',
  };
  var errors = {};
  var sent = null;
  pushScreen({
    title: 'Styling appointment',
    actionBar: '<button class="btn btn-primary" data-ap="submit"><span class="btn-label">Send enquiry (demo)</span></button>',
    render: function (el) {
      el._render = function () {
        var sc = $('.scroller', el);
        var keep = sc.scrollTop;
        sc.innerHTML = sent ? appointmentSent(sent) : appointmentForm(form, errors);
        sc.scrollTop = sent ? 0 : keep;
        $('.action-bar', el).hidden = !!sent;
      };
      el._render();
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ap]');
        if (!b || b.getAttribute('aria-disabled') === 'true') return;
        var what = b.getAttribute('data-ap');
        var v = b.getAttribute('data-v');
        if (what === 'type') {
          form.type = v;
          var t = DATA.appointmentTypes.filter(function (x) {
            return x.id === v;
          })[0];
          form.format = t.format;
          form.time = null;
          delete errors.type;
        } else if (what === 'date') {
          form.date = v;
          form.time = null;
          delete errors.date;
        } else if (what === 'time') {
          form.time = v;
          delete errors.time;
        } else if (what === 'submit') {
          submitAppointment(el, form, errors, function (record) {
            sent = record;
            el._render();
          });
          return;
        } else if (what === 'another') {
          sent = null;
          form.type = form.date = form.time = null;
        }
        captureFields(el, form);
        el._render();
      });
      el.addEventListener('focusout', function (e) {
        // Validate a field as you leave it, not all at once on submit.
        if (!e.target.matches || !e.target.matches('[data-field]')) return;
        captureFields(el, form);
        var key = e.target.getAttribute('data-field');
        var msg = validateField(key, form[key]);
        if (msg) errors[key] = msg;
        else delete errors[key];
        showFieldError(el, key, errors[key]);
      });
    },
  });
}

function captureFields(el, form) {
  $$('[data-field]', el).forEach(function (input) {
    form[input.getAttribute('data-field')] = input.value;
  });
}

function validateField(key, value) {
  value = (value || '').trim();
  if (key === 'name' && !value) return 'Add your name so client care knows who to ask for.';
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter an email address like name@example.com.';
  if (key === 'phone' && value && !/^[+\d][\d\s()-]{6,}$/.test(value)) return 'Use digits, spaces and an optional + country code.';
  return '';
}

function showFieldError(el, key, msg) {
  var input = $('[data-field="' + key + '"]', el);
  var slot = $('[data-error="' + key + '"]', el);
  if (!input || !slot) return;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  slot.innerHTML = msg ? icon('alert') + esc(msg) : '';
}

function sampleDays() {
  var days = [];
  var today = new Date();
  for (var i = 1; i <= 14; i++) {
    var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    var closed = d.getDay() === 0 || i === 6;
    days.push({ iso: d.toISOString().slice(0, 10), date: d, closed: closed, reason: d.getDay() === 0 ? 'Closed (sample)' : 'Unavailable (sample)' });
  }
  return days;
}

var SAMPLE_TIMES = ['10:00', '11:30', '13:00', '14:30', '16:00'];

function slotTaken(dateIso, time) {
  // Deterministic, so the same sample day always shows the same gaps.
  var n = 0;
  var s = dateIso + time;
  for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 97;
  return n % 4 === 0;
}

function studioTimeToLocal(dateIso, time) {
  // SAST is UTC+2 all year; show the visitor's own clock when it differs.
  var utc = new Date(dateIso + 'T' + time + ':00+02:00');
  try {
    var local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local === STUDIO_TZ) return '';
    return new Intl.DateTimeFormat(market().locale, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(utc);
  } catch (e) {
    return '';
  }
}

function appointmentForm(form, errors) {
  var types = DATA.appointmentTypes;
  var days = sampleDays();
  var html =
    '<div class="steps" style="padding-top:0.75rem">' +
    '<div class="callout" style="margin:0">' +
    icon('info') +
    '<div><p><strong>Enquiry — not a booking.</strong></p><p>No booking system is connected, so these times are samples. MAXHOSA client care would confirm a real time. Nothing is sent in this demo.</p></div></div>' +
    '<div class="step"><h2><span class="num">1</span>Choose a service</h2><div class="choice-list" role="radiogroup" aria-label="Service">' +
    types
      .map(function (t) {
        return (
          '<button class="choice" role="radio" data-ap="type" data-v="' +
          t.id +
          '" aria-checked="' +
          (form.type === t.id) +
          '"><span class="row-icon">' +
          icon(t.format === 'virtual' ? 'video' : t.id === 'studio' ? 'store' : 'sparkle') +
          '</span><span><span class="choice-title">' +
          esc(t.label) +
          '</span><br><span class="choice-sub">' +
          (t.format === 'virtual' ? 'Video call' : 'In person · location confirmed by client care') +
          ' · about ' +
          t.minutes +
          ' min</span></span></button>'
        );
      })
      .join('') +
    '</div>' +
    (errors.type ? '<p class="field"><span class="error">' + icon('alert') + esc(errors.type) + '</span></p>' : '') +
    '</div>';

  html +=
    '<div class="step"><h2><span class="num">2</span>Pick a day</h2>' +
    '<p class="note" style="margin:-0.25rem 0 0.75rem">Sample availability · times in South Africa (SAST)</p>' +
    '<div class="dates" role="radiogroup" aria-label="Day">' +
    days
      .map(function (d) {
        var label = d.date.toLocaleDateString(market().locale, { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          '<button class="date" role="radio" data-ap="date" data-v="' +
          d.iso +
          '" aria-checked="' +
          (form.date === d.iso) +
          '"' +
          (d.closed ? ' aria-disabled="true"' : '') +
          ' aria-label="' +
          esc(label + (d.closed ? ', ' + d.reason : '')) +
          '"><small>' +
          esc(d.date.toLocaleDateString(market().locale, { weekday: 'short' })) +
          '</small><strong>' +
          d.date.getDate() +
          '</strong></button>'
        );
      })
      .join('') +
    '</div>' +
    (errors.date ? '<p class="field"><span class="error">' + icon('alert') + esc(errors.date) + '</span></p>' : '');

  if (form.date) {
    html +=
      '<div class="times" role="radiogroup" aria-label="Time">' +
      SAMPLE_TIMES.map(function (t) {
        var taken = slotTaken(form.date, t);
        return (
          '<button class="chip' +
          (taken ? ' is-unavailable' : '') +
          '" role="radio" data-ap="time" data-v="' +
          t +
          '" aria-checked="' +
          (form.time === t) +
          '"' +
          (taken ? ' aria-disabled="true" aria-label="' + t + ', taken"' : '') +
          '>' +
          t +
          '</button>'
        );
      }).join('') +
      '</div>';
    if (form.time) {
      var local = studioTimeToLocal(form.date, form.time);
      if (local) html += '<p class="note">That is ' + esc(local) + ' where you are.</p>';
    }
  }
  html += (errors.time ? '<p class="field"><span class="error">' + icon('alert') + esc(errors.time) + '</span></p>' : '') + '</div>';

  html +=
    '<div class="step"><h2><span class="num">3</span>Your details</h2>' +
    field('name', 'Name', 'text', 'name', form.name, errors.name) +
    field('email', 'Email', 'email', 'email', form.email, errors.email) +
    field('phone', 'Phone (optional)', 'tel', 'tel', form.phone, errors.phone) +
    '<div class="field"><label for="ap-notes">Anything we should know? (optional)</label><textarea id="ap-notes" data-field="notes" maxlength="400">' +
    esc(form.notes) +
    '</textarea></div>' +
    '<p class="note">Your details are used only to reply to this enquiry. In this demo they stay on this device and are not sent anywhere.</p></div>' +
    '</div>';
  return html;
}

function field(key, label, type, autocomplete, value, error) {
  var id = 'ap-' + key;
  return (
    '<div class="field"><label for="' +
    id +
    '">' +
    label +
    '</label><input id="' +
    id +
    '" data-field="' +
    key +
    '" type="' +
    type +
    '" autocomplete="' +
    autocomplete +
    '" value="' +
    esc(value) +
    '" aria-invalid="' +
    (error ? 'true' : 'false') +
    '" aria-describedby="' +
    id +
    '-err"><span class="error" id="' +
    id +
    '-err" data-error="' +
    key +
    '">' +
    (error ? icon('alert') + esc(error) : '') +
    '</span></div>'
  );
}

function submitAppointment(el, form, errors, done) {
  captureFields(el, form);
  if (!form.type) errors.type = 'Choose the kind of appointment.';
  if (!form.date) errors.date = 'Choose a day.';
  else if (!form.time) errors.time = 'Choose a time.';
  ['name', 'email', 'phone'].forEach(function (k) {
    var m = validateField(k, form[k]);
    if (m) errors[k] = m;
    else delete errors[k];
  });
  if (Object.keys(errors).length) {
    el._render();
    haptic('error');
    var first = $('[aria-invalid="true"], .error:not(:empty)', el);
    if (first) first.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    return;
  }
  var btn = $('[data-ap="submit"]', el);
  btn.classList.add('is-busy');
  btn.setAttribute('aria-disabled', 'true');
  $('.btn-label', btn).textContent = 'Sending…';
  setTimeout(function () {
    var type = DATA.appointmentTypes.filter(function (t) {
      return t.id === form.type;
    })[0];
    var record = {
      ref: 'DEMO-APT-' + String(Math.floor(1000 + Math.random() * 9000)),
      type: type.label,
      minutes: type.minutes,
      format: form.format,
      date: form.date,
      time: form.time,
      createdAt: new Date().toISOString(),
    };
    state.appointments.unshift(record);
    persist();
    haptic('success');
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-disabled');
    $('.btn-label', btn).textContent = 'Send enquiry (demo)';
    done(record);
  }, 700);
}

function appointmentSent(r) {
  var day = new Date(r.date + 'T12:00:00');
  return (
    '<div class="outcome" style="padding:2rem var(--gutter) 0" role="status"><span class="outcome-icon warn">' +
    icon('clock') +
    '</span><h3>Enquiry received (demo)</h3><p>Pending confirmation — no time has been booked. MAXHOSA client care would reply to confirm.</p></div>' +
    '<div class="group" style="margin-top:1.5rem">' +
    detailRow('Reference', r.ref) +
    detailRow('Service', r.type + ' · about ' + r.minutes + ' min') +
    detailRow('Requested', fmtDay(day.toISOString()) + ' at ' + r.time + ' SAST (sample)') +
    detailRow('Where', r.format === 'virtual' ? 'Video call — link sent on confirmation' : 'In person — location confirmed by client care') +
    detailRow('Changes', 'Reschedule and cancellation follow the policy sent with the confirmation') +
    '</div>' +
    '<div style="padding:1rem var(--gutter) 0;display:grid;gap:0.625rem">' +
    '<button class="btn btn-secondary btn-block" aria-disabled="true">' +
    icon('calendar') +
    'Add to calendar — after confirmation</button>' +
    '<button class="btn btn-secondary btn-block" data-ap="another">Send another enquiry</button></div>'
  );
}

/* ---------------------------------------------------------- notifications */

var NOTIF_ROWS = [
  {
    key: 'transactional',
    title: 'Order and delivery updates',
    kind: 'Transactional',
    sub: 'Confirmations, shipping and delivery problems for orders you place.',
  },
  { key: 'restock', title: 'Restock alerts', kind: 'You request these', sub: 'Only for pieces and sizes you ask about.' },
  {
    key: 'marketing',
    title: 'Collection announcements',
    kind: 'Marketing',
    sub: 'New collections and events. Only with your consent; unsubscribe any time.',
  },
];

function openNotifications() {
  pushScreen({
    title: 'Notifications',
    render: function (el) {
      el._render = function () {
        $('.scroller', el).innerHTML =
          '<div class="group-title">Choose what you hear about</div><div class="group">' +
          NOTIF_ROWS.map(function (r) {
            return (
              '<div class="row"><span class="row-icon">' +
              icon(r.key === 'marketing' ? 'sparkle' : r.key === 'restock' ? 'bell' : 'truck') +
              '</span><span class="row-main"><span class="row-title">' +
              esc(r.title) +
              '</span><span class="row-sub" style="display:block">' +
              esc(r.kind) +
              ' · ' +
              esc(r.sub) +
              '</span></span><button class="switch" role="switch" aria-checked="' +
              !!state.notif[r.key] +
              '" data-n="' +
              r.key +
              '" aria-label="' +
              esc(r.title) +
              '"></button></div>'
            );
          }).join('') +
          '</div>' +
          '<p class="note" style="padding:0.75rem calc(var(--gutter) + 0.25rem) 0">Previews never show your address, what you ordered or payment details. Marketing consent is recorded separately from order updates.</p>' +
          '<p class="note" style="padding:0 calc(var(--gutter) + 0.25rem)">Demo: switches are stored on this device. No permission is requested and nothing is sent.</p>';
      };
      el._render();
      el.addEventListener('click', function (e) {
        var sw = e.target.closest('[data-n]');
        if (!sw) return;
        var key = sw.getAttribute('data-n');
        if (state.notif[key]) {
          state.notif[key] = false;
          persist();
          el._render();
          renderTab('account');
          return;
        }
        // Explain the benefit first; the OS prompt would only follow a yes.
        explainNotifications(key, function () {
          state.notif[key] = true;
          persist();
          el._render();
          renderTab('account');
        });
      });
    },
  });
}

function explainNotifications(key, onYes) {
  var row = NOTIF_ROWS.filter(function (r) {
    return r.key === key;
  })[0];
  var sheet = openSheet({
    title: row.title,
    body:
      '<div class="outcome" style="padding-top:0.5rem"><span class="outcome-icon ok">' +
      icon('bell') +
      '</span><p>' +
      esc(row.sub) +
      '</p></div>' +
      (key === 'marketing'
        ? '<div class="callout">' + icon('info') + '<div><p>This is marketing. We only send it because you said yes, and every message lets you unsubscribe.</p></div></div>'
        : '') +
      '<p class="note">In the app, your phone would now ask permission to send notifications. This demo asks for nothing.</p>',
    foot:
      '<div style="display:flex;gap:0.625rem"><button class="btn btn-secondary" data-action="close-sheet">Not now</button><button class="btn btn-primary" style="flex:1" data-yes>Turn on</button></div>',
  });
  sheet.el.addEventListener('click', function (e) {
    if (e.target.closest('[data-yes]')) {
      onYes();
      sheet.close();
      toast(row.title + ' on (demo)', { icon: 'bell' });
    }
  });
}

/* ---------------------------------------------------------- account sheets */

function openMarket() {
  var sheet = openSheet({
    title: 'Market and currency',
    body: function (body) {
      body.innerHTML =
        '<div class="choice-list" role="radiogroup" aria-label="Market">' +
        DATA.markets
          .map(function (m) {
            return (
              '<button class="choice" role="radio" data-m="' +
              m.id +
              '" aria-checked="' +
              (state.market === m.id) +
              '"><span class="row-icon">' +
              icon('globe') +
              '</span><span><span class="choice-title">' +
              esc(m.label) +
              '</span><br><span class="choice-sub">' +
              esc(m.currencyCode) +
              ' · sample prices</span></span></button>'
            );
          })
          .join('') +
        '</div><p class="note">Prices switch to that market’s sample price list — they are not converted on the device. Delivery, duties and taxes come from checkout for the address you use, never from a guess.</p>';
    },
  });
  sheet.el.addEventListener('click', function (e) {
    var m = e.target.closest('[data-m]');
    if (!m) return;
    state.market = m.getAttribute('data-m');
    persist();
    sheet.rerender();
    refreshAll();
    toast('Showing sample prices for ' + market().label, { icon: 'globe' });
  });
}

function openSizes() {
  var options = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  var sheet = openSheet({
    title: 'Sizes and preferences',
    body: function (body) {
      body.innerHTML =
        '<p class="note" style="margin-top:0">Optional. Your sizes are marked on product pages so they are easy to spot — they are never chosen for you.</p>' +
        '<div class="chips" style="flex-wrap:wrap;padding:0.5rem 0;overflow:visible">' +
        options
          .map(function (s) {
            return '<button class="chip" aria-pressed="' + (state.profileSizes.indexOf(s) !== -1) + '" data-sz="' + s + '">' + s + '</button>';
          })
          .join('') +
        '</div><p class="note">No body measurements are collected. In this demo, this stays on the device.</p>';
    },
  });
  sheet.el.addEventListener('click', function (e) {
    var c = e.target.closest('[data-sz]');
    if (!c) return;
    var s = c.getAttribute('data-sz');
    var i = state.profileSizes.indexOf(s);
    if (i === -1) state.profileSizes.push(s);
    else state.profileSizes.splice(i, 1);
    persist();
    sheet.rerender();
    renderTab('account');
  });
}

function openHelp(context) {
  openSheet({
    title: 'Help and client care',
    detent: 'large',
    body:
      (context === 'order' ? '<p class="note" style="margin-top:0">About your sample order.</p>' : '') +
      '<div class="field"><span class="label">Frequently asked</span></div>' +
      '<div class="group" style="margin:0">' +
      ['Delivery times and costs', 'Returns and size exchanges', 'Payment methods', 'Pre-orders and lead times', 'Caring for knitwear']
        .map(function (q) {
          return (
            '<button class="row no-icon" data-action="external"><span class="row-main"><span class="row-title">' +
            esc(q) +
            '</span><span class="row-sub" style="display:block">Answered on maxhosa.africa · needs internet</span></span><span class="row-end">' +
            icon('external') +
            '</span></button>'
          );
        })
        .join('') +
      '</div><p class="note">The app will load approved FAQ answers from MAXHOSA’s help content rather than repeat them here, so they never go out of date.</p>' +
      '<div class="field" style="margin-top:1rem"><span class="label">Talk to a person</span></div>' +
      '<div class="choice-list">' +
      [
        ['message', 'Chat with client care', 'Channel to be confirmed by MAXHOSA'],
        ['phone', 'Call client care', 'Number to be confirmed by MAXHOSA'],
        ['help', 'Email client care', 'Address to be confirmed by MAXHOSA'],
      ]
        .map(function (c) {
          return (
            '<button class="choice" data-action="demo-only" data-msg="Demo — contact channels are not connected yet."><span class="row-icon">' +
            icon(c[0]) +
            '</span><span><span class="choice-title">' +
            c[1] +
            '</span><br><span class="choice-sub">' +
            c[2] +
            '</span></span></button>'
          );
        })
        .join('') +
      '</div>',
  });
}

function openStores() {
  openSheet({
    title: 'Stores',
    body:
      emptyState(
        'store',
        'Store details load from MAXHOSA',
        'Addresses, opening hours and services are shown only from verified location data. Boutiques, pop-ups and event venues are labelled separately. Contact client care for availability.',
        '',
      ),
  });
}

function openPrivacy() {
  openSheet({
    title: 'Privacy and your data',
    body:
      '<div class="group" style="margin:0">' +
      [
        ['Download my data', 'Prepared by the account provider'],
        ['Delete my account', 'Handled by the account provider, with confirmation'],
        ['Marketing consent', 'Managed in Notifications'],
      ]
        .map(function (r) {
          return (
            '<button class="row no-icon" data-action="demo-only" data-msg="Demo — accounts are not connected."><span class="row-main"><span class="row-title">' +
            r[0] +
            '</span><span class="row-sub" style="display:block">' +
            r[1] +
            '</span></span><span class="row-end">' +
            icon('chevronRight') +
            '</span></button>'
          );
        })
        .join('') +
      '</div><p class="note">This demo stores only your bag, saved pieces and sample orders, on this device. It sends nothing anywhere.</p>',
  });
}

function openAbout() {
  openSheet({
    title: 'What is real here',
    detent: 'large',
    body:
      '<p style="margin-top:0">' +
      esc(DEMO_LINE) +
      '.</p>' +
      '<div class="group" style="margin:0">' +
      [
        ['Images', 'The 24 verified concept assets, plus one client-supplied event photograph — not approved product photography or live SKUs'],
        ['Products, prices, sizes, stock', 'Invented sample data, labelled throughout'],
        ['Checkout', 'Simulated; no payment form, no order leaves this device'],
        ['Delivery tracking', 'Simulated courier, timeline and map — "Demo location, not GPS"'],
        ['Appointments', 'Enquiry only, sample times, nothing is sent'],
        ['Events', 'Sample fixtures; RSVPs stay on this device, nothing is sent and no place is held'],
        ['Stories', 'Placeholder copy until MAXHOSA approves the text'],
        ['Wordmark', 'Typeset placeholder until the approved logo is supplied'],
      ]
        .map(function (r) {
          return '<div class="row no-icon"><span class="row-main"><span class="row-title">' + r[0] + '</span><span class="row-sub" style="display:block">' + esc(r[1]) + '</span></span></div>';
        })
        .join('') +
      '</div><p class="note">Motion follows Apple’s fluid-interface principles: sheets and screens follow your finger, keep your speed when you let go, and can be caught mid-way. Reduce Motion swaps them for cross-fades.</p>',
  });
}

function refreshAll() {
  TABS.forEach(function (t) {
    renderTab(t.id);
  });
  updateBagBadges(false);
}
