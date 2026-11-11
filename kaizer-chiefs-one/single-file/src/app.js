/* Kaizer Chiefs One · single-file concept app.
   Progressive enhancement: the HTML already contains every screen, so the
   page reads fully without this script. With it, the page becomes an app:
   hash routing (works from file:// and inside WhatsApp's viewer), springs
   that start from the current value and can be interrupted, a sheet that
   follows the finger, and choices remembered on this device only. */
(function () {
  'use strict';

  // The file as it arrived, before this script changes anything, so "Share
  // this file" can hand on an exact working copy even when opened from disk.
  // (The tags are assembled from pieces so this script never contains a
  // literal document wrapper, which matters when the page is embedded.)
  var PRISTINE =
    '<!' +
    'doctype html>\n' +
    document.documentElement.outerHTML.replace(new RegExp('(<' + 'html[^>]*?) class="js"'), '$1');
  var FILE_NAME = 'Kaizer_Chiefs_One_Concept.html';

  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem('kc1.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem('kc1.' + k, JSON.stringify(v));
      } catch (e) {
        /* private mode: keep going */
      }
    },
  };

  // iOS only applies :active styles when a touch listener exists.
  document.addEventListener('touchstart', function () {}, { passive: true });

  /* ------------------------------------------------------------------
     Spring: damping ratio + response (Apple's parameters), integrated per
     frame. Re-targeting keeps the current value and velocity, so motion is
     always interruptible and never jumps.
     ------------------------------------------------------------------ */
  function Spring(value, opts) {
    opts = opts || {};
    this.x = value;
    this.v = 0;
    this.target = value;
    this.precision = opts.precision || 0.01;
    this.onUpdate = opts.onUpdate || null;
    this.onRest = null;
    this.raf = 0;
    this.configure(opts.dampingRatio == null ? 1 : opts.dampingRatio, opts.response || 0.4);
    this.tick = this.tick.bind(this);
  }
  Spring.prototype.configure = function (z, r) {
    this.k = Math.pow((2 * Math.PI) / r, 2);
    this.c = (4 * Math.PI * z) / r;
  };
  Spring.prototype.emit = function () {
    if (this.onUpdate) this.onUpdate(this.x);
  };
  Spring.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };
  Spring.prototype.jump = function (x) {
    this.stop();
    this.x = this.target = x;
    this.v = 0;
    this.emit();
  };
  Spring.prototype.to = function (target, opts) {
    this.target = target;
    if (opts && opts.velocity != null) this.v = opts.velocity;
    if (reduceMotion.matches) {
      this.jump(target);
      if (this.onRest) this.onRest();
      return;
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  };
  Spring.prototype.tick = function (now) {
    var dt = Math.min(0.064, (now - this.last) / 1000);
    this.last = now;
    var steps = Math.max(1, Math.ceil(dt / 0.004)),
      h = dt / steps;
    for (var i = 0; i < steps; i++) {
      var a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    if (Math.abs(this.v) < this.precision * 10 && Math.abs(this.x - this.target) < this.precision) {
      this.x = this.target;
      this.v = 0;
      this.raf = 0;
      this.emit();
      if (this.onRest) this.onRest();
      return;
    }
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  // Apple's momentum projection and rubber-band, from Designing Fluid Interfaces.
  function project(v, d) {
    d = d || 0.998;
    return ((v / 1000) * d) / (1 - d);
  }
  function rubberband(over, dim, c) {
    c = c || 0.55;
    return (over * dim * c) / (dim + c * Math.abs(over));
  }

  function toast(msg) {
    var t = $('[data-toast]');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      t.hidden = true;
    }, 2800);
  }

  /* ------------------------------------------------------------------
     Parallax. Photographs sit further back than the interface: a hero
     photo travels at about a third of the scroll speed, card photos drift
     inside their frames as they cross the screen or their rail, and with
     a mouse the hero leans slightly away from the pointer on two
     independent springs. Only transforms change, once per frame, with all
     reads before all writes. Reduce Motion turns every part of it off and
     clears the offsets, including when the setting changes while open.
     ------------------------------------------------------------------ */
  var HERO_RATE = 0.32;
  var DRIFT_Y = 0.07; // of the frame's height; the image overscans by 8%
  var DRIFT_X = 0.06; // of the frame's width; the image overscans by 7%
  var LEAN_X = 12;
  var LEAN_Y = 8;
  var plx = { hero: null, heroImg: null, ys: [], xs: [], raf: 0 };
  var finePointer = window.matchMedia
    ? window.matchMedia('(hover: hover) and (pointer: fine)')
    : { matches: false };
  var leanX = new Spring(0, { response: 0.5, precision: 0.02 });
  var leanY = new Spring(0, { response: 0.5, precision: 0.02 });
  leanX.onUpdate = schedulePlx;
  leanY.onUpdate = schedulePlx;

  function clearPlx() {
    if (plx.heroImg) plx.heroImg.style.transform = '';
    plx.ys.concat(plx.xs).forEach(function (p) {
      p.img.style.transform = '';
    });
  }
  function collectPlx(view) {
    clearPlx();
    plx.hero = $('.hero', view);
    plx.heroImg = plx.hero ? $('.img', plx.hero) : null;
    plx.ys = $$('.plx-y', view).map(function (f) {
      return { frame: f, img: $('.img', f) };
    });
    plx.xs = $$('.plx-x', view).map(function (f) {
      return { frame: f, img: $('.img', f), rail: f.parentNode };
    });
    leanX.jump(0);
    leanY.jump(0);
    schedulePlx();
  }
  function schedulePlx() {
    if (!plx.raf) plx.raf = requestAnimationFrame(paintPlx);
  }
  function paintPlx() {
    plx.raf = 0;
    if (reduceMotion.matches) {
      clearPlx();
      return;
    }
    var vh = window.innerHeight;
    var writes = [];
    if (plx.heroImg) {
      var hr = plx.hero.getBoundingClientRect();
      var travelled = Math.max(0, Math.min(-hr.top, hr.height));
      writes.push([plx.heroImg, leanX.x, travelled * HERO_RATE + leanY.x]);
    }
    plx.ys.forEach(function (p) {
      var r = p.frame.getBoundingClientRect();
      if (!r.height || r.bottom < -60 || r.top > vh + 60) return;
      var c = Math.max(0, Math.min(1, (r.top + r.height / 2) / vh));
      writes.push([p.img, 0, (0.5 - c) * 2 * DRIFT_Y * r.height]);
    });
    plx.xs.forEach(function (p) {
      var r = p.frame.getBoundingClientRect();
      if (!r.width || r.bottom < -60 || r.top > vh + 60) return;
      var rr = p.rail.getBoundingClientRect();
      var c = Math.max(0, Math.min(1, (r.left + r.width / 2 - rr.left) / rr.width));
      writes.push([p.img, (0.5 - c) * 2 * DRIFT_X * r.width, 0]);
    });
    writes.forEach(function (w) {
      w[0].style.transform = 'translate3d(' + w[1].toFixed(2) + 'px,' + w[2].toFixed(2) + 'px,0)';
    });
  }
  window.addEventListener('scroll', schedulePlx, { passive: true });
  // Rails scroll sideways; their scroll events do not bubble, so capture them.
  document.addEventListener('scroll', schedulePlx, { passive: true, capture: true });

  function relax() {
    leanX.to(0);
    leanY.to(0);
  }
  document.addEventListener(
    'pointermove',
    function (e) {
      if (!plx.hero || e.pointerType !== 'mouse' || !finePointer.matches || reduceMotion.matches)
        return;
      var r = plx.hero.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        relax();
        return;
      }
      leanX.to((-(e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * LEAN_X);
      leanY.to((-(e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * LEAN_Y);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', relax);

  function onMotionPref() {
    leanX.jump(0);
    leanY.jump(0);
    if (reduceMotion.matches) clearPlx();
    else schedulePlx();
  }
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionPref);
  else if (reduceMotion.addListener) reduceMotion.addListener(onMotionPref);

  /* ------------------------------------------------------------------
     Routing
     ------------------------------------------------------------------ */
  var views = {};
  $$('.view').forEach(function (v) {
    views[v.id] = v;
    v.setAttribute('tabindex', '-1');
  });
  var current = null;
  var history_ = [];
  var scrollPos = {};
  var enter = new Spring(1, { response: 0.36, precision: 0.002 });
  var entering = null,
    enterDx = 0;
  enter.onUpdate = function (p) {
    if (!entering) return;
    entering.style.opacity = String(Math.min(1, Math.max(0, p)));
    entering.style.transform = enterDx
      ? 'translate3d(' + ((1 - p) * enterDx).toFixed(2) + 'px,0,0)'
      : '';
  };
  enter.onRest = function () {
    if (entering) {
      entering.style.opacity = '';
      entering.style.transform = '';
    }
  };

  function depth(v) {
    return v && v.dataset.depth ? Number(v.dataset.depth) : 0;
  }
  function tabFor(v) {
    while (v) {
      if (v.dataset.tab) return v.dataset.tab;
      v = views[v.dataset.parent];
    }
    return '';
  }

  function show(id) {
    var next = views[id] || views.home;
    if (next === current) return;
    var prev = current;
    var back = history_.length > 1 && history_[history_.length - 2] === next.id;
    if (back) history_.pop();
    else history_.push(next.id);
    if (prev) {
      scrollPos[prev.id] = window.scrollY;
      prev.classList.remove('is-active');
    }
    next.classList.add('is-active');
    current = next;
    document.body.classList.toggle('chrome-none', next.dataset.chrome === 'none');
    window.scrollTo(0, back ? scrollPos[next.id] || 0 : 0);
    document.title =
      (next.getAttribute('aria-label') || 'Kaizer Chiefs One') + ' · Kaizer Chiefs One (concept)';

    // Screens deeper in the hierarchy push in from the right and return the
    // way they came; tabs cross-fade, as native tab bars do.
    var dir = 0;
    if (prev && depth(next) !== depth(prev)) dir = depth(next) > depth(prev) ? 1 : -1;
    else if (prev && back) dir = -1;
    if (entering && entering !== next) {
      entering.style.opacity = '';
      entering.style.transform = '';
    }
    entering = next;
    enterDx = reduceMotion.matches || !prev ? 0 : dir * 36;
    enter.jump(prev ? 0 : 1);
    enter.to(1);

    setTab(tabFor(next));
    onShow(next);
    if (next.id !== 'welcome') store.set('welcomed', true);
    if (prev) next.focus({ preventScroll: true });
  }

  function route() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) id = store.get('welcomed', false) ? 'home' : 'welcome';
    show(id);
  }
  window.addEventListener('hashchange', route);

  // Back links return along the path the person came, when there is one.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-back]');
    if (a && history_.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  /* ------------------------------------------------------------------
     Tab bar: the gold marker is a spring between tabs.
     ------------------------------------------------------------------ */
  var tabbar = $('.tabbar');
  var marker = $('.tab-marker', tabbar);
  var markerSpring = new Spring(0, { response: 0.4, precision: 0.1 });
  markerSpring.onUpdate = function (x) {
    marker.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
  };
  function setTab(name) {
    var target = null;
    $$('.tab', tabbar).forEach(function (t) {
      var on = t.dataset.tabLink === name;
      t.classList.toggle('is-active', on);
      if (on) {
        t.setAttribute('aria-current', 'page');
        target = t;
      } else t.removeAttribute('aria-current');
    });
    marker.style.opacity = target ? '1' : '0';
    if (target) {
      var x = target.offsetLeft + target.offsetWidth / 2 - 12;
      if (marker.dataset.placed) markerSpring.to(x);
      else {
        markerSpring.jump(x);
        marker.dataset.placed = '1';
      }
    }
  }

  /* ------------------------------------------------------------------
     Segmented controls: the underline re-targets from wherever it is.
     ------------------------------------------------------------------ */
  var segs = $$('.seg').map(function (seg) {
    var m = $('.seg-marker', seg);
    var sx = new Spring(0, { response: 0.3, precision: 0.1 });
    var sw = new Spring(0, { response: 0.3, precision: 0.1 });
    function paint() {
      m.style.transform = 'translate3d(' + sx.x.toFixed(1) + 'px,0,0)';
      m.style.width = sw.x.toFixed(1) + 'px';
    }
    sx.onUpdate = paint;
    sw.onUpdate = paint;
    var host = seg.parentNode;
    var panels = $$('.panel', host).filter(function (p) {
      return p.parentNode === host;
    });
    function select(name, animate) {
      var btn = null;
      $$('.seg-btn', seg).forEach(function (b) {
        var on = b.dataset.panel === name;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        if (on) btn = b;
      });
      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.dataset.panelId === name);
      });
      schedulePlx();
      if (!btn || !btn.offsetWidth) return;
      if (animate) {
        sx.to(btn.offsetLeft);
        sw.to(btn.offsetWidth);
      } else {
        sx.jump(btn.offsetLeft);
        sw.jump(btn.offsetWidth);
      }
    }
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (b) select(b.dataset.panel, true);
    });
    seg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var bs = $$('.seg-btn', seg),
        i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      n.focus();
      select(n.dataset.panel, true);
    });
    var initial = $('.seg-btn[aria-selected="true"]', seg).dataset.panel;
    select(initial, false);
    return {
      el: seg,
      select: select,
      selected: function () {
        var b = $('.seg-btn[aria-selected="true"]', seg);
        return b && b.dataset.panel;
      },
    };
  });
  function layoutSegs(root) {
    segs.forEach(function (s) {
      if (root.contains(s.el)) s.select(s.selected(), false);
    });
  }

  // A quick link can open a specific section, e.g. Home → Squad.
  var pendingSeg = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-seg]');
    if (a) pendingSeg = a.dataset.seg;
  });

  /* ------------------------------------------------------------------
     Chips
     ------------------------------------------------------------------ */
  var TEAM_IMAGE = {
    first: [
      'i-squad',
      'Six players in black and gold kit standing together in a lit stadium tunnel.',
    ],
    women: ['i-women', 'Players in gold and black kit joining hands in a huddle before a match.'],
    academy: [
      'i-academy',
      'Two coaches crouching to talk with a group of young players on a dry pitch at sunset.',
    ],
  };
  $$('.chips').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      $$('.chip', group).forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('chip--on', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      var value = chip.dataset.value;
      if (group.dataset.filter === 'venue') {
        $$('[data-filter-target="venue"] .fixture').forEach(function (f) {
          f.hidden = value !== 'all' && f.dataset.venue !== value;
        });
      } else if (group.dataset.filter === 'team') {
        var img = $('.squad-hero .img');
        var t = TEAM_IMAGE[value];
        img.className = 'img pos-top ' + t[0];
        img.setAttribute('aria-label', t[1]);
      }
    });
  });

  /* ------------------------------------------------------------------
     Bottom sheet: tracks the finger 1:1, rubber-bands upward, projects a
     flick's momentum to decide, and hands its velocity to the spring.
     ------------------------------------------------------------------ */
  var layer = $('[data-sheet]');
  var sheet = $('.sheet', layer);
  var scrim = $('.scrim', layer);
  var sheetH = 600;
  var sheetY = new Spring(0, { dampingRatio: 0.85, response: 0.32, precision: 0.5 });
  var sheetReturn = null;
  sheetY.onUpdate = function (y) {
    sheet.style.transform = 'translate3d(-50%,' + y.toFixed(1) + 'px,0)';
    scrim.style.opacity = String(Math.max(0, Math.min(1, 1 - y / sheetH)));
  };
  sheetY.onRest = function () {
    if (sheetY.target >= sheetH && sheetY.x >= sheetH - 1) {
      layer.hidden = true;
      if (sheetReturn) sheetReturn.focus();
    }
  };
  function openSheet(from) {
    sheetReturn = from || null;
    layer.hidden = false;
    sheetH = sheet.offsetHeight || 600;
    if (sheetY.x === 0 && !sheetY.raf) sheetY.jump(sheetH);
    sheetY.to(0);
    var first = $('[data-reason]', sheet);
    if (first) first.focus({ preventScroll: true });
  }
  function closeSheet(velocity) {
    sheetY.to(sheetH, { velocity: velocity || 0 });
  }
  scrim.addEventListener('click', function () {
    closeSheet(0);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !layer.hidden) closeSheet(0);
  });

  var drag = null;
  sheet.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    drag = { id: e.pointerId, y0: e.clientY, from: sheetY.x, active: false, samples: [] };
  });
  sheet.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = e.clientY - drag.y0;
    if (!drag.active) {
      // A little hysteresis so taps on the reasons stay taps.
      if (Math.abs(dy) < 8) return;
      if (dy < 0 && sheet.scrollTop > 0) {
        drag = null;
        return;
      }
      drag.active = true;
      try {
        sheet.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      sheetY.stop();
      drag.from = sheetY.x; // grab from where it is on screen, even mid-flight
      drag.y0 = e.clientY;
      dy = 0;
    }
    var y = drag.from + dy;
    if (y < 0) y = -rubberband(-y, sheetH);
    sheetY.jump(y);
    drag.samples.push([e.timeStamp, e.clientY]);
    if (drag.samples.length > 6) drag.samples.shift();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (!d.active) return;
    var s = d.samples,
      v = 0;
    if (s.length > 1) {
      var a = s[0],
        b = s[s.length - 1];
      var dt = (b[0] - a[0]) / 1000;
      if (dt > 0) v = (b[1] - a[1]) / dt;
    }
    var projected = sheetY.x + project(v, 0.99);
    if (projected > sheetH * 0.4) closeSheet(v);
    else sheetY.to(0, { velocity: v });
  }
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);

  /* ------------------------------------------------------------------
     Actions
     ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-action],[data-reason]');
    if (!el) return;
    if (el.hasAttribute('data-reason')) {
      closeSheet(0);
      var r = $('[data-report-result]');
      r.hidden = false;
      toast('Report not sent: this is a demo.');
      return;
    }
    switch (el.dataset.action) {
      case 'report':
        openSheet(el);
        break;
      case 'entry-code':
        $('[data-ticket-code]').classList.add('is-shown');
        $('[data-entry-result]').hidden = false;
        el.hidden = true;
        break;
      case 'redeem':
        el.disabled = true;
        el.textContent = 'Not redeemed';
        el.nextElementSibling.hidden = false;
        break;
      case 'read-all':
        markRead(
          $$('[data-alert]').map(function (a) {
            return a.dataset.alert;
          }),
        );
        break;
      case 'save-file':
        saveFile();
        break;
      case 'share-file':
        shareFile();
        break;
    }
  });

  /* Notifications: read state lives on this device. */
  function markRead(ids) {
    var read = store.get('read', []);
    ids.forEach(function (id) {
      if (read.indexOf(id) < 0) read.push(id);
    });
    store.set('read', read);
    paintAlerts();
  }
  function paintAlerts() {
    var read = store.get('read', []);
    var unread = 0;
    $$('[data-alert]').forEach(function (a) {
      var isRead = read.indexOf(a.dataset.alert) >= 0;
      a.classList.toggle('is-read', isRead);
      if (!isRead) unread++;
    });
    $$('[data-unread]').forEach(function (c) {
      c.textContent = unread ? String(unread) : '';
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-alert]');
    if (a) markRead([a.dataset.alert]);
  });

  /* Preferences: everything optional starts off. */
  $$('[data-pref]').forEach(function (input) {
    var prefs = store.get('prefs', {});
    input.checked = !!prefs[input.dataset.pref];
    input.addEventListener('change', function () {
      var p = store.get('prefs', {});
      p[input.dataset.pref] = input.checked;
      store.set('prefs', p);
    });
  });

  /* ------------------------------------------------------------------
     Share a moment: consent first, then media, preview and review.
     Nothing leaves the device.
     ------------------------------------------------------------------ */
  var flow = $('#shareFlow');
  var state = { minors: null, file: null, url: null, kind: null };
  var mine = [];
  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
  var VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

  function stepTo(n) {
    $$('.step', flow).forEach(function (s) {
      s.hidden = Number(s.dataset.step) !== n;
    });
    $$('.steps i', flow).forEach(function (d, i) {
      d.classList.toggle('on', i < Math.min(n, 3));
    });
    window.scrollTo(0, 0);
    var s = $('.step[data-step="' + n + '"]', flow);
    var sp = new Spring(0, { response: 0.32, precision: 0.002 });
    sp.onUpdate = function (p) {
      s.style.opacity = String(p);
      s.style.transform = 'translate3d(' + ((1 - p) * 24).toFixed(1) + 'px,0,0)';
    };
    sp.onRest = function () {
      s.style.opacity = '';
      s.style.transform = '';
    };
    sp.jump(0);
    sp.to(1);
  }
  function consentReady() {
    var c = function (k) {
      return $('[data-consent="' + k + '"]', flow).checked;
    };
    return (
      c('terms') && c('rights') && state.minors !== null && (state.minors === 'no' || c('guardian'))
    );
  }
  function refreshConsent() {
    $('[data-step-next]', flow).disabled = !consentReady();
  }
  flow.addEventListener('change', refreshConsent);
  flow.addEventListener('click', function (e) {
    var m = e.target.closest('[data-minors]');
    if (m) {
      state.minors = m.dataset.minors;
      $$('[data-minors]', flow).forEach(function (b) {
        b.setAttribute('aria-checked', b === m ? 'true' : 'false');
      });
      $('[data-guardian]', flow).hidden = state.minors !== 'yes';
      refreshConsent();
    }
    if (e.target.closest('[data-step-next]')) stepTo(2);
    if (e.target.closest('[data-step-back]'))
      stepTo(Number(e.target.closest('.step').dataset.step) - 1);
    if (e.target.closest('[data-submit]')) submit();
  });

  function mediaError(msg) {
    $('[data-media-error-text]', flow).textContent = msg;
    $('[data-media-error]', flow).hidden = !msg;
  }
  $('[data-media-input]', flow).addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    var isImage = IMAGE_TYPES.indexOf(f.type) >= 0,
      isVideo = VIDEO_TYPES.indexOf(f.type) >= 0;
    if (!isImage && !isVideo)
      return mediaError('Use a photo (JPEG, PNG, HEIC, WebP) or a video (MP4, MOV).');
    if (f.size > (isImage ? 10 : 50) * 1048576)
      return mediaError('Photos can be up to 10 MB and videos up to 50 MB.');
    var url = URL.createObjectURL(f);
    function accept() {
      mediaError('');
      if (state.url) URL.revokeObjectURL(state.url);
      state.file = f;
      state.url = url;
      state.kind = isImage ? 'image' : 'video';
      var p = $('[data-preview]', flow);
      p.innerHTML = '';
      var node = document.createElement(isImage ? 'img' : 'video');
      node.src = url;
      if (isImage) node.alt = 'Your selected photo';
      else {
        node.muted = true;
        node.playsInline = true;
        node.controls = true;
        node.setAttribute('aria-label', 'Your selected video');
      }
      p.appendChild(node);
      stepTo(3);
    }
    if (isVideo) {
      var probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.onloadedmetadata = function () {
        if (probe.duration > 30.5) {
          URL.revokeObjectURL(url);
          mediaError('Videos can be up to 30 seconds long.');
        } else accept();
      };
      probe.onerror = function () {
        accept();
      };
      probe.src = url;
    } else accept();
  });
  var caption = $('[data-caption]', flow);
  caption.addEventListener('input', function () {
    $('[data-caption-count]', flow).textContent = caption.value.length + '/280';
  });

  function submit() {
    var escalated = state.minors === 'yes';
    mine.unshift({
      url: state.url,
      kind: state.kind,
      caption: caption.value.trim(),
      status: escalated ? 'escalated' : 'pending',
    });
    state.url = null;
    $('[data-status-label]', flow).textContent = escalated
      ? 'Safeguarding review'
      : 'Pending review';
    $('[data-status-body]', flow).textContent = escalated
      ? 'Moments that show children get an extra review before they can appear.'
      : 'Moderators review every moment. You’ll see the outcome in My moments.';
    if (navigator.vibrate) navigator.vibrate(12);
    stepTo(4);
  }
  function resetFlow() {
    $$('input[type=checkbox]', flow).forEach(function (c) {
      c.checked = c.dataset.consent === 'name' ? !!store.get('prefs', {}).show_name : false;
    });
    $$('[data-minors]', flow).forEach(function (b) {
      b.setAttribute('aria-checked', 'false');
    });
    $('[data-guardian]', flow).hidden = true;
    state.minors = null;
    caption.value = '';
    $('[data-caption-count]', flow).textContent = '0/280';
    mediaError('');
    refreshConsent();
    $$('.step', flow).forEach(function (s) {
      s.hidden = s.dataset.step !== '1';
    });
    $$('.steps i', flow).forEach(function (d, i) {
      d.classList.toggle('on', i === 0);
    });
  }

  function renderMine() {
    var list = $('[data-mine-list]');
    $('[data-mine-empty]').hidden = mine.length > 0;
    list.innerHTML = '';
    mine.forEach(function (m, i) {
      var row = document.createElement('div');
      row.className = 'mine-item';
      var media = document.createElement(m.kind === 'image' ? 'img' : 'video');
      media.src = m.url;
      if (m.kind === 'image') media.alt = 'Your moment';
      else media.muted = true;
      var body = document.createElement('div');
      body.className = 'grow';
      var label = m.status === 'escalated' ? 'Safeguarding review' : 'Pending review';
      body.innerHTML =
        '<span class="pill pill--outline"></span><p class="small muted" style="margin:6px 0"></p><p class="row-inline"><span class="tag demo">Demo</span><span class="micro">On this device only</span></p>';
      body.firstChild.textContent = label;
      body.children[1].textContent = m.caption || 'No caption';
      row.appendChild(media);
      row.appendChild(body);
      if (m.status !== 'escalated') {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn btn--ghost btn--sm press';
        rm.textContent = 'Remove';
        rm.addEventListener('click', function () {
          URL.revokeObjectURL(m.url);
          mine.splice(i, 1);
          renderMine();
          toast('Removed from this device.');
        });
        row.appendChild(rm);
      }
      list.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     Save / share this file
     ------------------------------------------------------------------ */
  // Inside the claude.ai viewer the page cannot start a download itself; the
  // viewer's downloads capability asks the person first. Anywhere else there
  // is no window.claude at all.
  var viewer = window.claude && typeof window.claude.use === 'function' ? window.claude : null;
  var viewerDownloads = null;
  var hosted = !viewer && /^https?:$/.test(location.protocol);
  var shareFileObj = null;
  try {
    shareFileObj = new File([PRISTINE], FILE_NAME, { type: 'text/html' });
    if (!(navigator.canShare && navigator.canShare({ files: [shareFileObj] }))) shareFileObj = null;
  } catch (e) {
    shareFileObj = null;
  }
  function syncFileButtons() {
    $$('[data-action="share-file"]').forEach(function (b) {
      b.hidden = !shareFileObj;
    });
    // Opened from Downloads, Files or WhatsApp it already is the file.
    $$('[data-action="save-file"]').forEach(function (b) {
      b.hidden = !(hosted || viewerDownloads);
    });
    $$('.btn-pair.js-only').forEach(function (pair) {
      pair.hidden = !$('button:not([hidden])', pair);
    });
  }
  syncFileButtons();
  if (viewer) {
    viewer.use('downloads').then(
      function (d) {
        viewerDownloads = d || null;
        syncFileButtons();
      },
      function () {},
    );
  }

  function shareFile() {
    if (!shareFileObj) return;
    navigator
      .share({
        files: [shareFileObj],
        title: 'Kaizer Chiefs One (concept)',
        text: 'Kaizer Chiefs One · concept prototype, not an official club app.',
      })
      .catch(function () {
        /* dismissed */
      });
  }
  function saveFile() {
    if (viewerDownloads) {
      // The standalone file is published beside this page.
      fetch(FILE_NAME)
        .then(function (r) {
          if (!r.ok) throw new Error('missing');
          return r.blob();
        })
        .then(function (blob) {
          return viewerDownloads.save({ filename: FILE_NAME, data: blob });
        })
        .then(
          function () {
            toast('Saved.');
          },
          function (err) {
            var code = err && err.code;
            if (code === 'declined') return;
            toast(
              code === 'rate_limited'
                ? 'One moment, then try again.'
                : 'Saving is not available here.',
            );
          },
        );
      return;
    }
    var go = function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 4000);
    };
    fetch(location.href.split('#')[0])
      .then(function (r) {
        return r.blob();
      })
      .then(go)
      .catch(function () {
        go(new Blob([PRISTINE], { type: 'text/html' }));
      });
  }

  /* ------------------------------------------------------------------
     Per-screen setup
     ------------------------------------------------------------------ */
  function onShow(v) {
    layoutSegs(v);
    collectPlx(v);
    if (v.id === 'match' && pendingSeg) {
      var s = segs.filter(function (x) {
        return v.contains(x.el);
      })[0];
      if (s) s.select(pendingSeg, false);
      pendingSeg = null;
    }
    if (v.id === 'share' && $('.step[data-step="4"]', flow).hidden === false) resetFlow();
    if (v.id === 'share' && !$('[data-step-next]', flow).dataset.ready) {
      $('[data-step-next]', flow).dataset.ready = '1';
      resetFlow();
    }
    if (v.id === 'mine') renderMine();
  }

  window.addEventListener('resize', function () {
    if (current) {
      layoutSegs(current);
      setTab(tabFor(current));
      schedulePlx();
    }
  });

  paintAlerts();
  route();
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () {
      if (current) {
        layoutSegs(current);
        setTab(tabFor(current));
      }
    });
})();
