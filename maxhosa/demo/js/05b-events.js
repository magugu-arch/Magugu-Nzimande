/* ---------------------------------------------------------------------------
 * Events and fixtures: the calendar that keeps people coming back.
 *
 * Every fixture is a reason to open the app, a look to shop, and an invite
 * to pass on: RSVP → add to calendar → share the invite → wear the event
 * edit → after the night, shop the looks. All sample events, labelled so;
 * dates are generated relative to today so the calendar never goes stale.
 * No invented scarcity: the demo never shows "only N left".
 * ------------------------------------------------------------------------- */

var EVENT_TZ = 'Africa/Johannesburg';
var EVENTS = {};
DATA.events.forEach(function (e) {
  EVENTS[e.id] = e;
});

state.rsvps = store.get('rsvps', {});
state.reminders = store.get('reminders', {});
state.cal = { month: null, day: null, city: 'all', when: 'upcoming' };

function persistEvents() {
  store.set('rsvps', state.rsvps);
  store.set('reminders', state.reminders);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Today's date in South Africa, as the day the sample fixtures count from. */
function sastToday() {
  var d = new Date(Date.now() + 2 * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

function dayKeyFromUTC(ms) {
  var d = new Date(ms + 2 * 3600000);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

function eventStart(e) {
  var t = sastToday();
  var base = new Date(Date.UTC(t.y, t.m, t.d + e.startsInDays));
  var key = base.getUTCFullYear() + '-' + pad2(base.getUTCMonth() + 1) + '-' + pad2(base.getUTCDate());
  return new Date(key + 'T' + e.startTime + ':00+02:00');
}
function eventEnd(e) {
  return new Date(eventStart(e).getTime() + e.durationMinutes * 60000);
}
function isPast(e) {
  return eventEnd(e).getTime() < Date.now();
}

/** Every SAST day an event touches — a weekend pop-up marks both days. */
function eventDays(e) {
  var days = [];
  var s = eventStart(e).getTime();
  var end = eventEnd(e).getTime();
  for (var t = s; t < end; t += 86400000) days.push(dayKeyFromUTC(t));
  var last = dayKeyFromUTC(end - 1);
  if (days.indexOf(last) === -1) days.push(last);
  return days;
}

function fmtInZone(date, opts) {
  try {
    opts.timeZone = EVENT_TZ;
    return new Intl.DateTimeFormat(market().locale, opts).format(date);
  } catch (err) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}
function eventDateLabel(e) {
  var s = eventStart(e);
  var end = eventEnd(e);
  var day = fmtInZone(s, { weekday: 'short', day: 'numeric', month: 'short' });
  var multi = eventDays(e).length > 1;
  if (multi) return day + ' – ' + fmtInZone(end, { weekday: 'short', day: 'numeric', month: 'short' });
  return day + ', ' + fmtInZone(s, { hour: '2-digit', minute: '2-digit' }) + '–' + fmtInZone(end, { hour: '2-digit', minute: '2-digit' }) + ' SAST';
}
function localTimeNote(e) {
  try {
    var zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone === EVENT_TZ || e.kind === 'popup' || e.kind === 'trunk') return '';
    return new Intl.DateTimeFormat(market().locale, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(eventStart(e));
  } catch (err) {
    return '';
  }
}

function kindOf(e) {
  return DATA.eventKinds[e.kind];
}

/** Places left, counting the visitor's own RSVP. Never shown as a number. */
function remaining(e) {
  if (e.capacity == null) return Infinity;
  var mine = state.rsvps[e.id] && state.rsvps[e.id].status === 'going' ? state.rsvps[e.id].guests : 0;
  return e.capacity - e.reserved - mine;
}

function eventStatus(e) {
  if (isPast(e)) return { tone: 'neutral', label: 'Past event', icon: 'clock' };
  if (e.rsvp === 'invite-only') return { tone: 'info', label: 'By invitation', icon: 'shield' };
  if (e.rsvp === 'drop-in') return { tone: 'ok', label: 'Drop in', icon: 'check' };
  if (remaining(e) <= 0) return { tone: 'warn', label: 'Waitlist open', icon: 'clock' };
  return { tone: 'ok', label: 'Spaces available', icon: 'check' };
}

function myStatus(e) {
  var r = state.rsvps[e.id];
  if (!r) return null;
  if (r.status === 'going') return { tone: 'ok', label: r.guests > 1 ? 'You’re going · +1' : 'You’re going' };
  if (r.status === 'waitlist') return { tone: 'warn', label: 'On the waitlist' };
  return { tone: 'info', label: 'Invitation requested' };
}

function tagHTML(t) {
  return '<span class="tag ' + (t.tone === 'neutral' ? '' : t.tone) + '">' + (t.icon ? icon(t.icon) : '') + esc(t.label) + '</span>';
}

function upcomingEvents() {
  return DATA.events
    .filter(function (e) {
      return !isPast(e);
    })
    .sort(function (a, b) {
      return eventStart(a) - eventStart(b);
    });
}

/* ------------------------------------------------------------ calendar file */

function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function icsText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
/**
 * RFC 5545 folds lines longer than 75 octets — octets of UTF-8, not
 * characters, and never through the middle of one. Continuation lines start
 * with a space.
 */
function icsFold(line) {
  var out = [];
  var current = '';
  var bytes = 0;
  Array.from(line).forEach(function (ch) {
    var c = ch.codePointAt(0);
    var n = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    if (bytes + n > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += n;
  });
  out.push(current);
  return out.join('\r\n');
}
function buildIcs(events) {
  var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAXHOSA AFRICA//Concept demo//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:MAXHOSA AFRICA fixtures (sample)'];
  events.forEach(function (e) {
    var k = kindOf(e);
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + e.id + '-' + icsDate(eventStart(e)) + '@concept-demo.invalid',
      'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(eventStart(e)),
      'DTEND:' + icsDate(eventEnd(e)),
      'SUMMARY:' + icsText(e.title + ' (sample event)'),
      'LOCATION:' + icsText(e.city + ' — ' + (e.city === 'Online' ? 'link sent to confirmed guests' : k.place + ', details shared with confirmed guests')),
      'DESCRIPTION:' + icsText('Concept demo — sample event, not a real booking. ' + e.summary),
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** A page shown inside another (a web preview) cannot save files; it gets the entry to copy. */
function isFramed() {
  try {
    return window.self !== window.top;
  } catch (err) {
    return true;
  }
}

function showIcsText(events, text) {
  var sheet = openSheet({
    title: 'Add to calendar',
    body:
      '<p class="note" style="margin-top:0">This preview can’t save files. Open the downloaded demo file to save a calendar file in one tap, or copy the entry below into a new .ics file.</p>' +
      (events.length === 1 ? '<p><strong>' + esc(events[0].title) + '</strong><br>' + esc(eventDateLabel(events[0]) + ' · ' + events[0].city) + '</p>' : '') +
      '<div class="field"><label for="ics-text">Calendar entry (iCalendar)</label><textarea id="ics-text" readonly style="min-height:9rem;font-family:ui-monospace,Menlo,monospace;font-size:0.75rem">' +
      esc(text) +
      '</textarea></div>',
    foot: '<button class="btn btn-primary btn-block" data-copy-ics>' + icon('calendar') + 'Copy calendar entry</button>',
  });
  $('[data-copy-ics]', sheet.el).addEventListener('click', function () {
    var ta = $('#ics-text', sheet.el);
    ta.focus();
    ta.select();
    var done = function () {
      toast('Calendar entry copied', { icon: 'check' });
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          document.execCommand('copy');
          done();
        });
      } else {
        document.execCommand('copy');
        done();
      }
    } catch (err) {
      toast('Selected — copy it from the box', { icon: 'info' });
    }
  });
}

/** Saved as a file the phone hands to its calendar. Works offline; nothing is sent. */
function downloadIcs(events, filename) {
  var text = buildIcs(events);
  if (isFramed()) {
    showIcsText(events, text);
    return;
  }
  try {
    var url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    toast(events.length === 1 ? 'Calendar file saved — open it to add the event' : events.length + ' fixtures saved to a calendar file', { icon: 'calendar' });
  } catch (err) {
    toast('This browser can’t save files. In the app this adds straight to your calendar.', { icon: 'calendar' });
  }
}

/* ---------------------------------------------------------- invite sharing */

function inviteText(e) {
  return (
    e.title +
    ' — ' +
    eventDateLabel(e) +
    ', ' +
    e.city +
    '. Come with me? (MAXHOSA AFRICA concept demo — sample event; in the app this carries a link to the event.)'
  );
}

/**
 * The invite is the marketing: one tap from the event page to a friend.
 * The phone's share sheet where there is one; otherwise the text to copy.
 */
function shareInvite(e) {
  var text = inviteText(e);
  if (navigator.share) {
    navigator.share({ title: e.title, text: text }).catch(function () {
      /* dismissed */
    });
    return;
  }
  var sheet = openSheet({
    title: 'Share the invite',
    body:
      '<p class="note" style="margin-top:0">Send this to a friend. In the app, it opens your phone’s share sheet with a link straight to the event.</p>' +
      '<div class="field"><label for="invite-text">Invite</label><textarea id="invite-text" readonly>' +
      esc(text) +
      '</textarea></div>',
    foot: '<button class="btn btn-primary btn-block" data-copy>' + icon('share') + 'Copy invite</button>',
  });
  $('[data-copy]', sheet.el).addEventListener('click', function () {
    var ta = $('#invite-text', sheet.el);
    ta.focus();
    ta.select();
    var done = function () {
      toast('Invite copied — paste it into a message', { icon: 'check' });
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          document.execCommand('copy');
          done();
        });
      } else {
        document.execCommand('copy');
        done();
      }
    } catch (err) {
      toast('Selected — copy it from the box', { icon: 'info' });
    }
  });
}

/* ------------------------------------------------------------- list items */

function eventCard(e, opts) {
  opts = opts || {};
  var s = eventStart(e);
  var mine = myStatus(e);
  return (
    '<button class="fixture" data-action="open-event" data-id="' +
    e.id +
    '" aria-label="' +
    esc(e.title + ', ' + eventDateLabel(e) + ', ' + e.city + ', ' + eventStatus(e).label + (mine ? ', ' + mine.label : '') + ', sample event') +
    '">' +
    '<span class="fixture-date" aria-hidden="true"><small>' +
    esc(fmtInZone(s, { weekday: 'short' })) +
    '</small><strong>' +
    esc(fmtInZone(s, { day: 'numeric' })) +
    '</strong><small>' +
    esc(fmtInZone(s, { month: 'short' })) +
    '</small></span>' +
    (opts.thumb ? '<span class="fixture-thumb">' + media(e.hero, { decorative: true }) + '</span>' : '') +
    '<span class="fixture-main"><span class="fixture-kind">' +
    esc(kindOf(e).label) +
    ' · ' +
    esc(e.city) +
    '</span><span class="fixture-title">' +
    esc(e.title) +
    '</span><span class="fixture-tags">' +
    (mine ? tagHTML(mine) : tagHTML(eventStatus(e))) +
    '</span></span>' +
    icon('chevronRight') +
    '</button>'
  );
}

/** Home: the next fixture, glanceable, with the one action that matters. */
function nextEventCard() {
  var next = upcomingEvents()[0];
  if (!next) return '';
  return (
    '<section class="section" aria-labelledby="h-next-event"><div class="section-head"><h2 id="h-next-event">Next on the calendar</h2>' +
    '<button class="link-btn" data-action="open-events">All fixtures</button></div>' +
    '<div style="padding:0 var(--gutter)"><button class="event-hero card-link" data-action="open-event" data-id="' +
    next.id +
    '" aria-label="' +
    esc(next.title + ', ' + eventDateLabel(next) + ', ' + next.city + ', sample event') +
    '">' +
    media(next.hero, { decorative: true }) +
    '<span class="event-hero-copy"><span class="eyebrow">Sample event · ' +
    esc(kindOf(next).label) +
    '</span><span class="event-hero-title">' +
    esc(next.title) +
    '</span><span class="event-hero-sub">' +
    esc(eventDateLabel(next) + ' · ' + next.city) +
    '</span></span></button></div></section>'
  );
}

/** Discover: the next three fixtures and the way into the calendar. */
function fixturesPreview() {
  return (
    '<div class="fixtures">' +
    upcomingEvents()
      .slice(0, 3)
      .map(function (e) {
        return eventCard(e);
      })
      .join('') +
    '</div><div style="padding:0.75rem var(--gutter) 0"><button class="btn btn-secondary btn-block" data-action="open-events">' +
    icon('calendar') +
    'Open the events calendar</button></div>'
  );
}

/* --------------------------------------------------------------- calendar */

var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthGrid(y, m) {
  var first = new Date(Date.UTC(y, m, 1));
  var lead = (first.getUTCDay() + 6) % 7; // Monday-first, as calendars are in South Africa
  var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  var cells = [];
  for (var i = 0; i < lead; i++) cells.push(null);
  for (var d = 1; d <= days; d++) cells.push(y + '-' + pad2(m + 1) + '-' + pad2(d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function eventsByDay() {
  var map = {};
  DATA.events.forEach(function (e) {
    eventDays(e).forEach(function (k) {
      (map[k] = map[k] || []).push(e);
    });
  });
  return map;
}

function calendarHTML() {
  var t = sastToday();
  if (!state.cal.month) state.cal.month = { y: t.y, m: t.m };
  var y = state.cal.month.y;
  var m = state.cal.month.m;
  var todayKey = t.y + '-' + pad2(t.m + 1) + '-' + pad2(t.d);
  var byDay = eventsByDay();
  var title = new Intl.DateTimeFormat(market().locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));
  return (
    '<div class="cal" role="group" aria-label="Events calendar">' +
    '<div class="cal-head"><button class="icon-btn" data-cal="prev" aria-label="Previous month">' +
    icon('back') +
    '</button><h2 class="cal-title" aria-live="polite">' +
    esc(title) +
    '</h2><button class="icon-btn" data-cal="next" aria-label="Next month">' +
    icon('chevronRight') +
    '</button></div>' +
    '<div class="cal-week" aria-hidden="true">' +
    WEEKDAYS.map(function (w) {
      return '<span>' + w + '</span>';
    }).join('') +
    '</div><div class="cal-grid-wrap"><div class="cal-grid">' +
    monthGrid(y, m)
      .map(function (k) {
        if (!k) return '<span class="cal-cell blank" aria-hidden="true"></span>';
        var evs = byDay[k] || [];
        var d = Number(k.slice(8, 10));
        var label = new Intl.DateTimeFormat(market().locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(k + 'T12:00:00Z'));
        return (
          '<button class="cal-cell' +
          (k === todayKey ? ' today' : '') +
          (evs.length ? ' has-events' : '') +
          '" data-day="' +
          k +
          '" aria-pressed="' +
          (state.cal.day === k) +
          '" aria-label="' +
          esc(label + (evs.length ? ', ' + evs.length + (evs.length === 1 ? ' event' : ' events') : ', no events') + (k === todayKey ? ', today' : '')) +
          '"><span>' +
          d +
          '</span>' +
          (evs.length
            ? '<i class="cal-dots" aria-hidden="true">' +
              evs
                .slice(0, 3)
                .map(function (e) {
                  return '<b class="' + (isPast(e) ? 'past' : '') + '"></b>';
                })
                .join('') +
              '</i>'
            : '') +
          '</button>'
        );
      })
      .join('') +
    '</div></div></div>'
  );
}

function filteredFixtures() {
  return DATA.events
    .filter(function (e) {
      if (state.cal.city !== 'all' && e.city !== state.cal.city) return false;
      if (state.cal.day) return eventDays(e).indexOf(state.cal.day) !== -1;
      return state.cal.when === 'past' ? isPast(e) : !isPast(e);
    })
    .sort(function (a, b) {
      return state.cal.when === 'past' && !state.cal.day ? eventStart(b) - eventStart(a) : eventStart(a) - eventStart(b);
    });
}

function openEvents() {
  pushScreen({
    title: 'Events and fixtures',
    cls: 'events-screen',
    render: function (el) {
      var cities = ['all'];
      DATA.events.forEach(function (e) {
        if (cities.indexOf(e.city) === -1) cities.push(e.city);
      });
      el._render = function () {
        var sc = $('.scroller', el);
        var keep = sc.scrollTop;
        var list = filteredFixtures();
        var dayLabel = state.cal.day
          ? new Intl.DateTimeFormat(market().locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(state.cal.day + 'T12:00:00Z'))
          : '';
        sc.innerHTML =
          '<p class="note" style="padding:0.75rem calc(var(--gutter) + 0.25rem) 0.5rem;margin:0">Sample fixtures · times in South Africa (SAST)</p>' +
          '<div style="padding:0 var(--gutter)">' +
          calendarHTML() +
          '</div>' +
          '<div class="chips" role="radiogroup" aria-label="City" style="padding-top:1rem">' +
          cities
            .map(function (c) {
              return '<button class="chip" role="radio" data-city="' + esc(c) + '" aria-checked="' + (state.cal.city === c) + '">' + (c === 'all' ? 'All cities' : esc(c)) + '</button>';
            })
            .join('') +
          '</div>' +
          (state.cal.day
            ? '<div class="result-bar"><span>' + esc(dayLabel) + '</span><button class="link-btn" data-cal="clear-day">Show all dates</button></div>'
            : '<div style="padding:0 var(--gutter) 0.75rem"><div class="segmented" role="radiogroup" aria-label="When">' +
              [
                ['upcoming', 'Upcoming'],
                ['past', 'Past'],
              ]
                .map(function (w) {
                  return '<button role="radio" data-when="' + w[0] + '" aria-checked="' + (state.cal.when === w[0]) + '">' + w[1] + '</button>';
                })
                .join('') +
              '</div></div>') +
          '<div class="fixtures" aria-live="polite">' +
          (list.length
            ? list
                .map(function (e) {
                  return eventCard(e, { thumb: true });
                })
                .join('')
            : state.cal.day
              ? emptyState('calendar', 'Nothing on this day', 'Pick a day with a dot, or show all dates.', '')
              : emptyState('calendar', 'No fixtures here yet', 'Try another city, or follow fixtures to hear when one is announced.', '')) +
          '</div>' +
          '<div class="group-title">Stay in the loop</div><div class="group">' +
          '<button class="row" data-ev="ics-all"><span class="row-icon">' +
          icon('calendar') +
          '</span><span class="row-main"><span class="row-title">Add all upcoming fixtures to your calendar</span><span class="row-sub" style="display:block">One calendar file · in the app, a subscription that updates itself</span></span><span class="row-end">' +
          icon('chevronRight') +
          '</span></button>' +
          '<div class="row"><span class="row-icon">' +
          icon('bell') +
          '</span><span class="row-main"><span class="row-title">Tell me when new fixtures are announced</span><span class="row-sub" style="display:block">Marketing · only with your consent</span></span><button class="switch" role="switch" data-ev="follow" aria-checked="' +
          !!state.notif.marketing +
          '" aria-label="Tell me when new fixtures are announced"></button></div></div>' +
          '<p class="note" style="padding:0.75rem calc(var(--gutter) + 0.25rem) 0">Event times, venues and capacity come from MAXHOSA’s event system once it is connected. Venues are shared with confirmed guests, never published in the app.</p>';
        sc.scrollTop = keep;
        sweepImages(el);
        wireCalendarSwipe(el);
      };
      el._render();
      el.addEventListener('click', function (ev) {
        var c = ev.target.closest('[data-cal], [data-day], [data-city], [data-when], [data-ev]');
        if (!c) return;
        if (c.hasAttribute('data-day')) {
          var k = c.getAttribute('data-day');
          state.cal.day = state.cal.day === k ? null : k;
          haptic('tap');
        } else if (c.hasAttribute('data-city')) {
          state.cal.city = c.getAttribute('data-city');
        } else if (c.hasAttribute('data-when')) {
          state.cal.when = c.getAttribute('data-when');
        } else if (c.getAttribute('data-cal') === 'clear-day') {
          state.cal.day = null;
        } else if (c.hasAttribute('data-cal')) {
          slideMonth(el, c.getAttribute('data-cal') === 'next' ? 1 : -1, 0);
          return;
        } else if (c.getAttribute('data-ev') === 'ics-all') {
          downloadIcs(upcomingEvents(), 'maxhosa-fixtures-sample.ics');
          return;
        } else if (c.getAttribute('data-ev') === 'follow') {
          if (state.notif.marketing) {
            state.notif.marketing = false;
            persist();
            el._render();
          } else {
            explainNotifications('marketing', function () {
              state.notif.marketing = true;
              persist();
              el._render();
            });
          }
          return;
        }
        el._render();
      });
    },
  });
}

/**
 * Months page sideways under the finger. Release velocity is projected to
 * choose between turning the page and settling back, and the new month
 * arrives from the side the finger was heading.
 */
function wireCalendarSwipe(el) {
  var wrap = $('.cal-grid-wrap', el);
  var grid = $('.cal-grid', el);
  if (!wrap || wrap._wired) return;
  wrap._wired = true;
  var x = new Spring(0, function (v) {
    grid.style.transform = v ? 'translate3d(' + v + 'px,0,0)' : '';
    grid.style.opacity = String(1 - Math.min(Math.abs(v) / (wrap.clientWidth * 1.4), 0.6));
  }, 0.3);
  draggable(wrap, {
    axis: 'x',
    begin: function () {
      x.stop();
    },
    move: function (dx) {
      x.set(dx);
    },
    end: function (dx, dy, v) {
      var w = wrap.clientWidth;
      var projected = x.value + project(v.x);
      if (Math.abs(projected) > w / 3) slideMonth(el, projected < 0 ? 1 : -1, v.x, x.value);
      else x.to(0, { velocity: v.x });
    },
  });
}

function slideMonth(el, dir, velocity, from) {
  var m = state.cal.month;
  var d = new Date(Date.UTC(m.y, m.m + dir, 1));
  state.cal.month = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  state.cal.day = null;
  var w = ($('.cal-grid-wrap', el) || {}).clientWidth || 360;
  el._render();
  if (reducedMotion.matches) return;
  var grid = $('.cal-grid', el);
  var s = new Spring(dir * w * 0.6 + (from || 0) * 0.2, function (v) {
    grid.style.transform = v ? 'translate3d(' + v + 'px,0,0)' : '';
    grid.style.opacity = String(1 - Math.min(Math.abs(v) / (w * 1.4), 0.6));
  }, 0.3);
  s.to(0, { velocity: velocity || 0 });
}

/* ------------------------------------------------------------ event page */

function openEvent(id) {
  var e = EVENTS[id];
  if (!e) return;
  pushScreen({
    title: e.title,
    media: true,
    cls: 'event-screen',
    end:
      '<button class="icon-btn on-media" data-ev="share" aria-label="Share the invite">' +
      icon('share') +
      '</button>',
    actionBar: '<button class="btn btn-primary" data-ev="primary"><span class="btn-label"></span></button>',
    render: function (el) {
      el._render = function () {
        var sc = $('.scroller', el);
        var keep = sc.scrollTop;
        var past = isPast(e);
        var mine = myStatus(e);
        var k = kindOf(e);
        var local = localTimeNote(e);
        var products = e.products
          .map(function (pid) {
            return PRODUCTS[pid];
          })
          .filter(Boolean);
        sc.innerHTML =
          '<div class="story-hero" data-parallax><img src="' +
          ASSET_URL[e.hero] +
          '" alt="' +
          esc(assetAlt(e.hero)) +
          '" draggable="false"></div>' +
          '<article class="prose" style="padding-bottom:0"><span class="eyebrow">Sample event · ' +
          esc(k.label) +
          '</span><h1>' +
          esc(e.title) +
          '</h1>' +
          '<div style="display:flex;gap:0.375rem;flex-wrap:wrap;margin:-0.25rem 0 1rem">' +
          tagHTML(eventStatus(e)) +
          (mine ? tagHTML(mine) : '') +
          '</div></article>' +
          '<div class="group">' +
          '<div class="row"><span class="row-icon">' +
          icon('calendar') +
          '</span><span class="row-main"><span class="row-title">' +
          esc(eventDateLabel(e)) +
          '</span>' +
          (local ? '<span class="row-sub" style="display:block">Starts ' + esc(local) + ' where you are</span>' : '') +
          '</span>' +
          (past ? '' : '<button class="link-btn" data-ev="ics">Add to calendar</button>') +
          '</div>' +
          '<div class="row"><span class="row-icon">' +
          icon(e.city === 'Online' ? 'video' : e.kind === 'popup' ? 'store' : 'pin') +
          '</span><span class="row-main"><span class="row-title">' +
          esc(e.city === 'Online' ? 'Online' : e.city + ' · ' + k.place) +
          '</span><span class="row-sub" style="display:block">' +
          esc(e.city === 'Online' ? 'The link is sent to confirmed guests' : e.kind === 'popup' ? 'A temporary pop-up, not a permanent store · address shared on the day' : 'The venue is shared with confirmed guests') +
          '</span></span></div>' +
          (past
            ? ''
            : '<div class="row"><span class="row-icon">' +
              icon('bell') +
              '</span><span class="row-main"><span class="row-title">Remind me the day before</span><span class="row-sub" style="display:block">Demo — nothing is sent</span></span><button class="switch" role="switch" data-ev="remind" aria-checked="' +
              !!state.reminders[e.id] +
              '" aria-label="Remind me the day before"></button></div>') +
          '</div>' +
          '<div class="prose"><p>' +
          esc(e.summary) +
          '</p><p class="note">Sample event for the concept demo — the title, date, place and capacity are illustrative.</p></div>' +
          (products.length
            ? '<section class="section" style="padding-top:0.5rem"><div class="section-head"><h2>' +
              (past ? 'Shop the looks from the day' : 'The event edit') +
              '</h2><span class="tag sample">Curated · sample</span></div>' +
              '<p class="note" style="padding:0 var(--gutter) 0.75rem;margin:0">' +
              (past ? 'Photos from the day appear here once MAXHOSA publishes them.' : 'Pieces chosen for the evening — wear them on the night.') +
              '</p><div class="rail">' +
              products.map(function (p) {
                return productCard(p);
              }).join('') +
              '</div></section>'
            : '') +
          (past
            ? ''
            : '<div style="padding:1.5rem var(--gutter) 0;display:grid;gap:0.625rem">' +
              '<button class="btn btn-secondary btn-block" data-ev="share">' +
              icon('share') +
              'Invite a friend</button>' +
              (mine && state.rsvps[e.id].status !== 'requested'
                ? '<button class="btn btn-secondary btn-block" data-ev="cancel">' + (state.rsvps[e.id].status === 'going' ? 'Can’t make it? Release your place' : 'Leave the waitlist') + '</button>'
                : '') +
              '</div>');
        sc.scrollTop = keep;
        sweepImages(el);
        $('.action-bar .btn-label', el).textContent = primaryLabel(e);
      };
      el._render();
      el.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-ev]');
        if (!b) return;
        var what = b.getAttribute('data-ev');
        if (what === 'ics') downloadIcs([e], e.id + '-sample.ics');
        else if (what === 'share') shareInvite(e);
        else if (what === 'remind') {
          state.reminders[e.id] = !state.reminders[e.id];
          persistEvents();
          el._render();
          toast(state.reminders[e.id] ? 'Reminder on for the day before (demo)' : 'Reminder off', { icon: 'bell' });
        } else if (what === 'cancel') {
          var before = state.rsvps[e.id];
          delete state.rsvps[e.id];
          persistEvents();
          el._render();
          renderTab('home');
          toast('Your place is released', {
            icon: 'calendar',
            action: {
              label: 'Undo',
              run: function () {
                state.rsvps[e.id] = before;
                persistEvents();
                el._render();
              },
            },
          });
        } else if (what === 'primary') {
          if (isPast(e)) {
            var rail = $('.rail', el);
            if (rail) rail.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
          } else if (state.rsvps[e.id] && state.rsvps[e.id].status === 'requested') {
            toast('MAXHOSA would reply to your request by email (demo)', { icon: 'shield' });
          } else if (state.rsvps[e.id]) {
            downloadIcs([e], e.id + '-sample.ics');
          } else {
            openRsvp(e, el);
          }
        }
      });
    },
  });
}

function primaryLabel(e) {
  if (isPast(e)) return 'Shop the looks';
  var r = state.rsvps[e.id];
  if (r) return r.status === 'requested' ? 'Invitation requested' : 'Add to calendar';
  if (e.rsvp === 'invite-only') return 'Request an invitation';
  if (e.rsvp === 'drop-in') return dropInLabel(e);
  return remaining(e) > 0 ? 'RSVP' : 'Join the waitlist';
}

/** Drop-in fixtures need no booking; saying you're coming is optional. */
function dropInLabel(e) {
  return e.kind === 'trunk' ? 'Reserve a fitting' : 'I’m going';
}

/* ------------------------------------------------------------------ RSVP */

/**
 * RSVP in one short sheet. The place is held by MAXHOSA's event system in
 * production — here the simulated provider answers going, waitlist or
 * requested, and the follow-ups (calendar, invite, the edit) come straight
 * after, while the intent is fresh.
 */
function openRsvp(e, screenEl) {
  var last = store.get('rsvpContact', { name: '', email: '' });
  var form = { guests: 1, name: last.name, email: last.email, updates: true, future: false };
  var errors = {};
  var phase = 'form';
  var invite = e.rsvp === 'invite-only';
  var sheet = openSheet({
    title: invite ? 'Request an invitation' : e.rsvp === 'drop-in' ? dropInLabel(e) : remaining(e) > 0 ? 'RSVP' : 'Join the waitlist',
    body: function (body) {
      if (phase === 'done') {
        var r = state.rsvps[e.id];
        var copy =
          r.status === 'going'
            ? ['ok', 'check', 'You’re going (demo)', 'Your place is held for ' + eventDateLabel(e) + '. Venue details come with the confirmation.']
            : r.status === 'waitlist'
              ? ['warn', 'clock', 'You’re on the waitlist (demo)', 'The evening is full. MAXHOSA would tell you as soon as a place opens.']
              : ['warn', 'shield', 'Invitation requested (demo)', 'Invitations are checked by MAXHOSA, never by the app alone. You would hear back by email.'];
        body.innerHTML =
          '<div class="outcome" role="status"><span class="outcome-icon ' +
          copy[0] +
          '">' +
          icon(copy[1]) +
          '</span><h3>' +
          esc(copy[2]) +
          '</h3><p>' +
          esc(copy[3]) +
          '</p></div>' +
          '<div class="choice-list" style="margin-top:1rem">' +
          (r.status !== 'requested'
            ? '<button class="choice" data-r="ics"><span class="row-icon">' + icon('calendar') + '</span><span><span class="choice-title">Add to calendar</span><br><span class="choice-sub">So the date is in your diary</span></span></button>'
            : '') +
          '<button class="choice" data-r="share"><span class="row-icon">' +
          icon('share') +
          '</span><span><span class="choice-title">Invite a friend</span><br><span class="choice-sub">Send the invite from your phone</span></span></button>' +
          '<button class="choice" data-r="edit"><span class="row-icon">' +
          icon('sparkle') +
          '</span><span><span class="choice-title">Shop the event edit</span><br><span class="choice-sub">Pieces chosen for the evening</span></span></button></div>';
        return;
      }
      body.innerHTML =
        (invite
          ? '<p class="note" style="margin-top:0">A small, invited evening. Requests are checked by MAXHOSA; the app never grants access on its own.</p>'
          : '<p class="note" style="margin-top:0">' + esc(eventDateLabel(e) + ' · ' + e.city) + '</p>') +
        (invite
          ? ''
          : '<div class="field"><span class="label">Who’s coming</span><div class="segmented" role="radiogroup" aria-label="Guests">' +
            [
              [1, 'Just me'],
              [2, 'Me + 1'],
            ]
              .map(function (g) {
                return '<button role="radio" data-g="' + g[0] + '" aria-checked="' + (form.guests === g[0]) + '">' + g[1] + '</button>';
              })
              .join('') +
            '</div></div>') +
        rsvpField('name', 'Name', 'text', 'name', form.name, errors.name) +
        rsvpField('email', 'Email', 'email', 'email', form.email, errors.email) +
        '<div class="row no-icon" style="padding:0.5rem 0"><span class="row-main"><span class="row-title">Updates about this event</span><span class="row-sub" style="display:block">Changes, venue details, a reminder</span></span><button class="switch" role="switch" data-u="updates" aria-checked="' +
        form.updates +
        '" aria-label="Updates about this event"></button></div>' +
        '<div class="row no-icon" style="padding:0.5rem 0"><span class="row-main"><span class="row-title">Tell me about future events</span><span class="row-sub" style="display:block">Marketing · off unless you switch it on</span></span><button class="switch" role="switch" data-u="future" aria-checked="' +
        form.future +
        '" aria-label="Tell me about future events"></button></div>' +
        '<p class="note">Used only for this event. In this demo nothing is sent and your details stay on this device.</p>';
    },
    foot: function (foot) {
      foot.innerHTML =
        phase === 'done'
          ? '<button class="btn btn-secondary btn-block" data-action="close-sheet">Done</button>'
          : '<button class="btn btn-primary btn-block" data-r="submit">' +
            (invite ? 'Send request (demo)' : remaining(e) > 0 || e.rsvp === 'drop-in' ? 'Confirm RSVP (demo)' : 'Join the waitlist (demo)') +
            '</button>';
    },
  });

  function capture() {
    $$('[data-rf]', sheet.el).forEach(function (input) {
      form[input.getAttribute('data-rf')] = input.value;
    });
  }

  sheet.el.addEventListener('focusout', function (ev) {
    if (!ev.target.matches || !ev.target.matches('[data-rf]')) return;
    capture();
    var k = ev.target.getAttribute('data-rf');
    var msg = validateField(k, form[k]);
    if (msg) errors[k] = msg;
    else delete errors[k];
    var slot = $('[data-rerr="' + k + '"]', sheet.el);
    ev.target.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (slot) slot.innerHTML = msg ? icon('alert') + esc(msg) : '';
  });

  sheet.el.addEventListener('click', function (ev) {
    var g = ev.target.closest('[data-g]');
    if (g) {
      capture();
      form.guests = Number(g.getAttribute('data-g'));
      sheet.rerender();
      return;
    }
    var u = ev.target.closest('[data-u]');
    if (u) {
      capture();
      form[u.getAttribute('data-u')] = !form[u.getAttribute('data-u')];
      u.setAttribute('aria-checked', form[u.getAttribute('data-u')]);
      return;
    }
    var r = ev.target.closest('[data-r]');
    if (!r) return;
    var what = r.getAttribute('data-r');
    if (what === 'submit') {
      capture();
      ['name', 'email'].forEach(function (k) {
        var m = validateField(k, form[k]);
        if (m) errors[k] = m;
        else delete errors[k];
      });
      if (Object.keys(errors).length) {
        sheet.rerender();
        haptic('error');
        return;
      }
      var status = invite ? 'requested' : remaining(e) - form.guests >= 0 || e.rsvp === 'drop-in' ? 'going' : 'waitlist';
      state.rsvps[e.id] = { status: status, guests: invite ? 1 : form.guests, at: new Date().toISOString(), updates: form.updates };
      if (form.future && !state.notif.marketing) state.notif.marketing = true;
      store.set('rsvpContact', { name: form.name, email: form.email });
      persistEvents();
      persist();
      phase = 'done';
      haptic('success');
      sheet.rerender();
      if (screenEl && screenEl._render) screenEl._render();
      renderTab('home');
      renderTab('account');
    } else if (what === 'ics') downloadIcs([e], e.id + '-sample.ics');
    else if (what === 'share') shareInvite(e);
    else if (what === 'edit') {
      sheet.close();
      setTimeout(function () {
        var rail = screenEl && $('.rail', screenEl);
        if (rail) rail.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }, 350);
    }
  });
}

function rsvpField(key, label, type, autocomplete, value, error) {
  var id = 'rsvp-' + key;
  return (
    '<div class="field"><label for="' +
    id +
    '">' +
    label +
    '</label><input id="' +
    id +
    '" data-rf="' +
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
    '-err" data-rerr="' +
    key +
    '">' +
    (error ? icon('alert') + esc(error) : '') +
    '</span></div>'
  );
}

/* -------------------------------------------------------------- my events */

function openMyEvents() {
  pushScreen({
    title: 'My events',
    render: function (el) {
      var mine = DATA.events.filter(function (e) {
        return state.rsvps[e.id];
      });
      $('.scroller', el).innerHTML = mine.length
        ? '<div class="group-title">Your RSVPs on this device</div><div class="fixtures">' +
          mine
            .map(function (e) {
              return eventCard(e, { thumb: true });
            })
            .join('') +
          '</div>'
        : emptyState('calendar', 'No RSVPs yet', 'Events you RSVP to appear here, with the date, your place and the event edit.', '<button class="btn btn-primary" data-action="open-events">Open the events calendar</button>');
      sweepImages(el);
    },
  });
}

/** For a product page: the next fixture whose edit includes this piece. */
function wearItTo(pid) {
  return upcomingEvents().filter(function (e) {
    return e.products.indexOf(pid) !== -1 && e.rsvp !== 'invite-only';
  })[0];
}

function wearItToCallout(pid) {
  var e = wearItTo(pid);
  if (!e) return '';
  return (
    '<button class="wear-it card-link" data-action="open-event" data-id="' +
    e.id +
    '"><span class="row-icon">' +
    icon('calendar') +
    '</span><span class="row-main"><span class="row-title">Wear it to ' +
    esc(e.title) +
    '</span><span class="row-sub" style="display:block">' +
    esc(eventDateLabel(e) + ' · ' + e.city + ' · sample event') +
    '</span></span>' +
    icon('chevronRight') +
    '</button>'
  );
}

function myEventsSummary() {
  var n = Object.keys(state.rsvps).filter(function (id) {
    return EVENTS[id];
  }).length;
  return n ? n + (n === 1 ? ' RSVP (demo)' : ' RSVPs (demo)') : 'RSVPs, invitations and reminders';
}
