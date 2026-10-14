/*
 * Runtime for the single-file export of the site.
 *
 * The Next.js site renders every page on the server and hydrates React on
 * the client. A downloaded file has neither, so this script stands in for
 * both: it shows one page at a time from <template> elements (a hash
 * router), fills in embedded images, and re-creates the interactions in
 * plain JavaScript — with the same spring physics as the site (an
 * interruptible spring that inherits gesture velocity, Apple's momentum
 * projection, and rubber-banding at the edges).
 *
 * Forms cannot send from a file, so they say so instead of pretending.
 */
(function () {
  'use strict';

  var doc = document;
  var main = doc.getElementById('main');
  var shell = doc.getElementById('site-shell');
  var header = doc.querySelector('.site-header');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var metadata = JSON.parse(doc.getElementById('mg-site-metadata').textContent);
  var assets = JSON.parse(doc.getElementById('mg-assets').textContent);
  var templates = {};
  Array.prototype.forEach.call(doc.querySelectorAll('template[data-route]'), function (t) {
    templates[t.getAttribute('data-route')] = t;
  });

  // ---------------------------------------------------------------- physics

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  /** Distance a flick travels before resting — scroll-style exponential decay. */
  function project(velocity, rate) {
    rate = rate || 0.998;
    return ((velocity / 1000) * rate) / (1 - rate);
  }

  /** Progressive resistance past an edge. */
  function rubberband(overshoot, dimension) {
    var c = 0.55;
    if (!dimension || !overshoot) return 0;
    return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
  }

  function velocityOf(samples) {
    if (samples.length < 2) return 0;
    var last = samples[samples.length - 1];
    var first = last;
    for (var i = samples.length - 2; i >= 0; i--) {
      if (last.t - samples[i].t > 100) break;
      first = samples[i];
    }
    var dt = last.t - first.t;
    return dt > 0 ? ((last.v - first.v) / dt) * 1000 : 0;
  }

  /**
   * A spring in Apple's terms: `response` (seconds) and `damping` (ratio).
   * Retargeting keeps the current value and velocity, so motion can be
   * grabbed, reversed or redirected at any moment without a jump.
   */
  function Spring(value, onUpdate, restDelta) {
    this.x = value;
    this.v = 0;
    this.target = value;
    this.k = 0;
    this.c = 0;
    this.raf = 0;
    this.last = 0;
    this.done = null;
    this.restDelta = restDelta || 0.5;
    this.onUpdate = onUpdate;
    this.tick = this.step.bind(this);
    onUpdate(value);
  }

  Spring.prototype.set = function (value) {
    this.stop();
    this.x = value;
    this.v = 0;
    this.target = value;
    this.onUpdate(value);
  };

  Spring.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.done = null;
  };

  Spring.prototype.to = function (target, opts, done) {
    opts = opts || {};
    var response = opts.response || 0.35;
    var damping = opts.damping === undefined ? 1 : opts.damping;
    var omega = (2 * Math.PI) / response;
    this.k = omega * omega;
    this.c = 2 * damping * omega;
    this.target = target;
    if (opts.velocity !== undefined) this.v = opts.velocity;
    this.done = done || null;
    if (reduceMotion.matches || opts.instant) {
      this.set(target);
      if (done) done();
      return;
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  /** One frame: integrate in small fixed substeps so stiff springs stay stable. */
  Spring.prototype.step = function (t) {
    var dt = Math.min((t - this.last) / 1000, 0.064);
    this.last = t;
    var n = Math.max(1, Math.ceil(dt / 0.004));
    var h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    if (Math.abs(this.v) < this.restDelta * 2 && Math.abs(this.x - this.target) < this.restDelta) {
      this.x = this.target;
      this.v = 0;
      this.raf = 0;
      this.onUpdate(this.x);
      var cb = this.done;
      this.done = null;
      if (cb) cb();
      return;
    }
    this.onUpdate(this.x);
    this.raf = requestAnimationFrame(this.tick);
  };

  var SPRING_SETTLE = { response: 0.4, damping: 1 };
  var SPRING_SHEET = { response: 0.32, damping: 1 };
  var SPRING_FLICK = { response: 0.32, damping: 0.82 };
  var FLICK = 400;
  var THRESHOLD = 10;

  // ---------------------------------------------------------------- helpers

  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    if (attrs)
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    (children || []).forEach(function (c) {
      node.appendChild(c);
    });
    return node;
  }

  var ICONS = {
    close:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  };

  function iconButton(icon, label) {
    return el('button', {
      type: 'button',
      class: 'mg-icon-button',
      html: ICONS[icon] + '<span class="sr-only">' + label + '</span>',
    });
  }

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
      function (n) {
        return n.offsetParent !== null || n === doc.activeElement;
      },
    );
  }

  function trapTab(e, root) {
    if (e.key !== 'Tab') return;
    var list = focusables(root);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  var locks = 0;
  function lockPage(on) {
    locks += on ? 1 : -1;
    var locked = locks > 0;
    doc.documentElement.style.overflow = locked ? 'hidden' : '';
    if (locked) shell.setAttribute('inert', '');
    else shell.removeAttribute('inert');
  }

  function normalise(text) {
    return String(text)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---------------------------------------------------------------- images

  function fillImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-sa]'), function (node) {
      var data = assets[node.getAttribute('data-sa')];
      if (!data) return;
      if (node.tagName === 'SOURCE') node.srcset = data;
      else node.src = data;
    });
  }

  // ---------------------------------------------------------------- router

  var currentPath = '/';

  function parseHash() {
    var raw = decodeURIComponent(location.hash.slice(1));
    if (!raw || raw.charAt(0) !== '/')
      return { path: raw ? null : '/', query: new URLSearchParams(), anchor: raw || null };
    var hashAt = raw.indexOf('#');
    var anchor = hashAt > -1 ? raw.slice(hashAt + 1) : null;
    var rest = hashAt > -1 ? raw.slice(0, hashAt) : raw;
    var q = rest.indexOf('?');
    var path = (q > -1 ? rest.slice(0, q) : rest).replace(/\/+$/, '') || '/';
    return {
      path: path,
      query: new URLSearchParams(q > -1 ? rest.slice(q + 1) : ''),
      anchor: anchor,
    };
  }

  function updateNav(path) {
    Array.prototype.forEach.call(doc.querySelectorAll('nav[aria-label="Primary"] a'), function (a) {
      var target = (a.getAttribute('href') || '').replace(/^#/, '');
      var active =
        target === '/' ? path === '/' : path === target || path.indexOf(target + '/') === 0;
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      a.classList.toggle('text-ivory', active);
      a.classList.toggle('text-ivory/72', !active);
      var bar = a.querySelector('span[aria-hidden="true"]');
      if (bar) {
        bar.classList.toggle('scale-x-100', active);
        bar.classList.toggle('scale-x-0', !active);
      }
    });
  }

  function scrollToAnchor(id) {
    var target = id && (doc.getElementById(id) || main.querySelector('[id="' + id + '"]'));
    if (!target) return false;
    target.scrollIntoView({ block: 'start' });
    return true;
  }

  function render(first) {
    var route = parseHash();
    if (route.path === null) {
      // A plain in-page anchor such as #main.
      scrollToAnchor(route.anchor);
      return;
    }
    var tpl = templates[route.path] || templates['/__404'];
    currentPath = templates[route.path] ? route.path : '/__404';
    main.replaceChildren(tpl.content.cloneNode(true));
    doc.title = tpl.getAttribute('data-title') || doc.title;
    var desc = doc.querySelector('meta[name="description"]');
    if (desc && tpl.getAttribute('data-description'))
      desc.setAttribute('content', tpl.getAttribute('data-description'));
    updateNav(route.path);
    enhance(main, route);
    if (!scrollToAnchor(route.anchor)) window.scrollTo(0, 0);
    if (!first) {
      // Move focus to the new page's heading so screen readers announce it.
      var h1 = main.querySelector('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    }
    drawer.close(true);
  }

  // ---------------------------------------------------------------- header

  function onScroll() {
    header.setAttribute('data-elevated', window.scrollY > 16 || drawer.isOpen() ? 'true' : 'false');
    parallax();
  }

  // ---------------------------------------------------------------- menu sheet

  var drawer = (function () {
    var layer = null;
    var sheet = null;
    var scrim = null;
    var x = null;
    var width = 420;
    var open = false;
    var trigger = null;
    var gesture = null;
    var suppressClickUntil = 0; // only the click that ends a drag, never a later tap

    function build() {
      var navLinks = doc.querySelectorAll('nav[aria-label="Primary"] a');
      var list = el('ul', { class: 'mg-sheet-links' });
      Array.prototype.forEach.call(navLinks, function (a) {
        var link = el('a', {
          href: a.getAttribute('href'),
          text: a.firstChild ? a.firstChild.textContent : a.textContent,
        });
        list.appendChild(el('li', null, [link]));
      });
      var cta = doc.querySelector('.site-header a[href="#/work-with-myron"].bg-gold');
      var secondary = el('ul', { class: 'mg-sheet-secondary' });
      [
        ['Speaking', '#/speaking'],
        ['Insights', '#/insights'],
        ['Press', '#/press'],
        ['Member login', '#/login'],
        ['Search', '#/search'],
      ].forEach(function (pair) {
        secondary.appendChild(el('li', null, [el('a', { href: pair[1], text: pair[0] })]));
      });
      metadata.socialAccounts.forEach(function (s) {
        secondary.appendChild(
          el('li', null, [
            el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.handle }),
          ]),
        );
      });
      var close = iconButton('close', 'Close menu');
      close.addEventListener('click', function () {
        hide();
      });
      sheet = el(
        'div',
        {
          class: 'mg-sheet grain',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Site menu',
          id: 'mobile-menu',
        },
        [
          el('div', { class: 'mg-sheet-head' }, [
            el('span', { class: 'mg-sheet-title', text: 'Menu' }),
            close,
          ]),
          el('nav', { 'aria-label': 'Mobile' }, [
            list,
            el('a', {
              class: 'mg-sheet-cta',
              href: cta ? cta.getAttribute('href') : '#/work-with-myron',
              text: 'Start here',
            }),
            secondary,
          ]),
        ],
      );
      scrim = el('div', { class: 'mg-scrim', 'aria-hidden': 'true' });
      layer = el('div', { class: 'mg-layer', hidden: '' }, [scrim, sheet]);
      doc.body.appendChild(layer);

      x = new Spring(1e4, function (v) {
        var w = Math.max(width, 1);
        sheet.style.transform = 'translate3d(' + v + 'px,0,0)';
        if (!reduceMotion.matches) scrim.style.opacity = String(1 - clamp(v / w, 0, 1));
      });

      scrim.addEventListener('click', function () {
        hide();
      });
      sheet.addEventListener(
        'click',
        function (e) {
          if (e.timeStamp < suppressClickUntil) {
            suppressClickUntil = 0;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.target.closest('a')) hide(0, true);
        },
        true,
      );
      layer.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          hide();
        } else trapTab(e, sheet);
      });

      // Drag to dismiss: 1:1 after a 10px threshold, rubber-band past open,
      // decide from where the flick is going, hand velocity to the spring.
      sheet.addEventListener('pointerdown', function (e) {
        if (reduceMotion.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
        gesture = {
          id: e.pointerId,
          sx: e.clientX,
          sy: e.clientY,
          dragging: false,
          dead: false,
          ox: 0,
          op: 0,
          samples: [{ t: e.timeStamp, v: e.clientX }],
        };
      });
      sheet.addEventListener('pointermove', function (e) {
        var g = gesture;
        if (!g || g.dead || e.pointerId !== g.id) return;
        var dx = e.clientX - g.sx;
        var dy = e.clientY - g.sy;
        if (!g.dragging) {
          if (Math.abs(dy) > THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
            g.dead = true;
            return;
          }
          if (Math.abs(dx) < THRESHOLD) return;
          g.dragging = true;
          x.stop();
          g.ox = x.x;
          g.op = e.clientX;
          sheet.setPointerCapture(e.pointerId);
        }
        var raw = g.ox + (e.clientX - g.op);
        x.set(raw < 0 ? rubberband(raw, width) : raw);
        g.samples.push({ t: e.timeStamp, v: e.clientX });
        if (g.samples.length > 8) g.samples.shift();
      });
      function end(e) {
        var g = gesture;
        gesture = null;
        if (!g || !g.dragging || e.pointerId !== g.id) return;
        suppressClickUntil = e.timeStamp + 250;
        var v = velocityOf(g.samples);
        var commit = v >= -150 && x.x + project(v) > width * 0.5;
        if (commit) hide(v);
        else
          x.to(
            0,
            Object.assign({ velocity: v }, Math.abs(v) > FLICK ? SPRING_FLICK : SPRING_SHEET),
          );
      }
      sheet.addEventListener('pointerup', end);
      sheet.addEventListener('pointercancel', end);
    }

    function show(from) {
      if (!layer) build();
      trigger = from || null;
      open = true;
      layer.hidden = false;
      width = sheet.offsetWidth;
      if (x.x > width) x.set(width);
      lockPage(true);
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      Array.prototype.forEach.call(sheet.querySelectorAll('.mg-sheet-links a'), function (a) {
        var target = a.getAttribute('href').replace(/^#/, '');
        var active =
          target === '/'
            ? currentPath === '/'
            : currentPath === target || currentPath.indexOf(target + '/') === 0;
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      if (reduceMotion.matches) {
        x.set(0);
        scrim.style.opacity = '1';
      } else x.to(0, SPRING_SHEET);
      sheet.querySelector('.mg-icon-button').focus({ preventScroll: true });
      onScroll();
    }

    function hide(velocity, immediate) {
      if (!open) return;
      open = false;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      lockPage(false);
      var finish = function () {
        layer.hidden = true;
        if (trigger && !immediate) trigger.focus({ preventScroll: true });
      };
      if (immediate || reduceMotion.matches) {
        x.set(width);
        finish();
      } else x.to(width, Object.assign({}, SPRING_SHEET, { velocity: velocity || 0 }), finish);
      onScroll();
    }

    return {
      open: show,
      close: function (immediate) {
        hide(0, immediate);
      },
      isOpen: function () {
        return open;
      },
    };
  })();

  // ---------------------------------------------------------------- photo viewer

  function openViewer(items, index, fromRect, returnFocus) {
    var count = items.length;
    var width = window.innerWidth;
    var height = window.innerHeight;
    var current = index;
    var closing = false;

    var strip = el('ul', { class: 'mg-strip' });
    items.forEach(function (item, i) {
      var img = el('img', { alt: item.alt, draggable: 'false', src: assets[item.file] || '' });
      strip.appendChild(el('li', { 'aria-hidden': i === index ? 'false' : 'true' }, [img]));
    });
    var stage = el('div', { class: 'mg-stage' }, [strip]);
    var scrim = el('div', { class: 'mg-scrim', 'aria-hidden': 'true' });
    var counter = el('p', { class: 'mg-viewer-count', 'aria-live': 'polite' });
    var caption = el('p', { class: 'mg-viewer-caption' });
    var close = iconButton('close', 'Close photo viewer');
    var prev = iconButton('left', 'Previous photo');
    var next = iconButton('right', 'Next photo');
    var chrome = el('div', { class: 'mg-viewer-chrome' }, [
      el('div', { class: 'mg-viewer-top' }, [counter, close]),
      el('div', { class: 'mg-viewer-bottom' }, [
        caption,
        el('div', { class: 'mg-viewer-nav' }, [prev, next]),
      ]),
    ]);
    var layer = el(
      'div',
      {
        class: 'mg-layer mg-viewer',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Photo viewer',
      },
      [scrim, stage, chrome],
    );

    // Grow out of the thumbnail that was pressed, and shrink back into it.
    if (fromRect) {
      stage.style.transformOrigin =
        ((fromRect.left + fromRect.width / 2) / width) * 100 +
        '% ' +
        ((fromRect.top + fromRect.height / 2) / height) * 100 +
        '%';
    }

    var dismissY = 0;
    var presence = 0;
    function paint() {
      var drag = clamp(dismissY / (height * 0.6), 0, 1);
      var shade = presence * (1 - drag);
      scrim.style.opacity = String(shade);
      chrome.style.opacity = String(shade);
      var scale = (0.86 + 0.14 * presence) * (1 - clamp(dismissY / height, 0, 1) * 0.25);
      stage.style.opacity = String(presence);
      stage.style.transform = 'translate3d(0,' + dismissY + 'px,0) scale(' + scale + ')';
    }
    var track = new Spring(-index * width, function (v) {
      strip.style.transform = 'translate3d(' + v + 'px,0,0)';
    });
    var ySpring = new Spring(0, function (v) {
      dismissY = v;
      paint();
    });
    var pSpring = new Spring(
      0,
      function (v) {
        presence = v;
        paint();
      },
      0.002,
    );

    function label() {
      counter.textContent = current + 1 + ' / ' + count;
      caption.textContent = items[current].alt;
      prev.disabled = current === 0;
      next.disabled = current === count - 1;
      Array.prototype.forEach.call(strip.children, function (li, i) {
        li.setAttribute('aria-hidden', i === current ? 'false' : 'true');
      });
    }

    function goTo(i, velocity) {
      current = clamp(i, 0, count - 1);
      label();
      track.to(
        -current * width,
        Object.assign(
          { velocity: velocity || 0 },
          Math.abs(velocity || 0) > FLICK ? SPRING_FLICK : SPRING_SETTLE,
        ),
      );
    }

    function dismiss(velocity) {
      if (closing) return;
      closing = true;
      if (velocity)
        ySpring.to(height * 0.5, Object.assign({}, SPRING_SHEET, { velocity: velocity }));
      pSpring.to(0, SPRING_SHEET, function () {
        layer.remove();
        lockPage(false);
        doc.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        if (returnFocus) returnFocus.focus({ preventScroll: true });
      });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(count - 1);
      } else trapTab(e, layer);
    }

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      track.set(-current * width);
    }

    // Swipe sideways to page (at most one photo per flick, chosen from the
    // projected landing point); drag down to dismiss. X and Y are separate springs.
    var g = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      g = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        axis: null,
        ox: 0,
        oy: 0,
        start: current,
        xs: [{ t: e.timeStamp, v: e.clientX }],
        ys: [{ t: e.timeStamp, v: e.clientY }],
      };
    });
    stage.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id || closing) return;
      var dx = e.clientX - g.sx;
      var dy = e.clientY - g.sy;
      if (!g.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (g.axis === 'y' && dy < 0) {
          g = null;
          return;
        }
        track.stop();
        ySpring.stop();
        g.ox = track.x;
        g.oy = ySpring.x;
        g.sx = e.clientX;
        g.sy = e.clientY;
        stage.setPointerCapture(e.pointerId);
      }
      if (g.axis === 'x') {
        var min = -(count - 1) * width;
        var raw = g.ox + (e.clientX - g.sx);
        track.set(
          raw > 0 ? rubberband(raw, width) : raw < min ? min + rubberband(raw - min, width) : raw,
        );
        g.xs.push({ t: e.timeStamp, v: e.clientX });
        if (g.xs.length > 8) g.xs.shift();
      } else {
        var rawY = g.oy + (e.clientY - g.sy);
        ySpring.set(rawY < 0 ? rubberband(rawY, height) : rawY);
        g.ys.push({ t: e.timeStamp, v: e.clientY });
        if (g.ys.length > 8) g.ys.shift();
      }
    });
    function end(e) {
      var gesture = g;
      g = null;
      if (!gesture || !gesture.axis || e.pointerId !== gesture.id) return;
      if (gesture.axis === 'x') {
        var v = velocityOf(gesture.xs);
        var landing = Math.round(-(track.x + project(v)) / width);
        goTo(clamp(landing, gesture.start - 1, gesture.start + 1), v);
      } else {
        var vy = velocityOf(gesture.ys);
        if (vy >= -150 && ySpring.x + project(vy) > height * 0.22) dismiss(vy);
        else
          ySpring.to(
            0,
            Object.assign({ velocity: vy }, Math.abs(vy) > FLICK ? SPRING_FLICK : SPRING_SETTLE),
          );
      }
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    close.addEventListener('click', function () {
      dismiss();
    });
    prev.addEventListener('click', function () {
      goTo(current - 1);
    });
    next.addEventListener('click', function () {
      goTo(current + 1);
    });

    doc.body.appendChild(layer);
    lockPage(true);
    doc.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    label();
    close.focus({ preventScroll: true });
    pSpring.to(1, SPRING_SETTLE);
  }

  // ---------------------------------------------------------------- parallax

  var wideFine = window.matchMedia('(min-width: 768px) and (pointer: fine)');
  var parallaxQueued = false;
  function parallax() {
    if (parallaxQueued) return;
    parallaxQueued = true;
    requestAnimationFrame(function () {
      parallaxQueued = false;
      var on = wideFine.matches && !reduceMotion.matches;
      Array.prototype.forEach.call(main.querySelectorAll('[data-parallax]'), function (layer) {
        if (!on) {
          layer.style.transform = '';
          return;
        }
        var frame = layer.parentElement.getBoundingClientRect();
        var p = clamp(-frame.top / Math.max(frame.height, 1), 0, 1);
        var distance = Number(layer.getAttribute('data-parallax')) || 0;
        var from = Number(layer.getAttribute('data-parallax-scale')) || 1;
        layer.style.transform =
          'translate3d(0,' + p * distance + 'px,0) scale(' + (from + (1 - from) * p) + ')';
      });
    });
  }

  // ---------------------------------------------------------------- page enhancements

  var OFFLINE =
    'This is a downloaded copy of the site, so nothing was sent. On the live site this form delivers to the team, and only says “sent” once it has been.';
  var OFFLINE_BOOKING =
    'This is a downloaded copy of the site, so no seats were booked and no payment was taken. On the live site, paid seats go to Stripe’s secure checkout, and the site confirms a booking only once Stripe has confirmed the payment.';

  function enhanceForms(root) {
    Array.prototype.forEach.call(root.querySelectorAll('form[data-offline-form]'), function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var missing = [];
        Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (field) {
          var empty = field.type === 'checkbox' ? !field.checked : !String(field.value).trim();
          field.classList.toggle('mg-invalid', empty);
          if (empty) {
            field.setAttribute('aria-invalid', 'true');
            missing.push(field);
          } else field.removeAttribute('aria-invalid');
        });
        var consent = form.querySelector('input[name="consent"]');
        if (consent && !consent.checked) missing.push(consent);
        var existing = form.querySelector('.mg-notice');
        if (existing) existing.remove();
        if (missing.length) {
          var note = el('div', { class: 'mg-notice', role: 'alert', tabindex: '-1' }, [
            el('h3', { text: 'Some details need attention' }),
            el('p', {
              text: 'Fill in the highlighted fields and confirm the consent box. ' + OFFLINE,
            }),
          ]);
          form.insertBefore(note, form.firstChild);
          note.focus();
          return;
        }
        var booking = form.hasAttribute('data-booking-form');
        var unit = Number(form.getAttribute('data-unit-cents'));
        if (booking && unit > 0) {
          // Paid seats continue to the payment step, as on the preview site.
          var qty = form.querySelector('#quantity');
          var email = form.querySelector('input[name="email"]');
          startDemoPayment({
            kind: 'event',
            reference: demoReference(),
            lines: [
              {
                title: form.getAttribute('data-title') || 'Event seats',
                detail: form.getAttribute('data-detail') || undefined,
                quantity: clamp(
                  Math.round(Number(qty && qty.value)) || 1,
                  1,
                  Number(form.getAttribute('data-max')) || 1,
                ),
                unitCents: unit,
              },
            ],
            shipping: false,
            email: email ? email.value : undefined,
            back: {
              href: '/events/' + (form.getAttribute('data-event') || ''),
              label: 'Back to the event',
            },
          });
          return;
        }
        var done = el('div', { class: 'mg-notice', role: 'status', tabindex: '-1' }, [
          el('h3', {
            text: booking ? 'Preview only — nothing booked or charged' : 'Preview only — not sent',
          }),
          el('p', { text: booking ? OFFLINE_BOOKING : OFFLINE }),
        ]);
        form.replaceWith(done);
        done.focus();
      });
    });
  }

  function enhanceVideos(root) {
    Array.prototype.forEach.call(
      root.querySelectorAll('[data-video-facade] button'),
      function (button) {
        button.addEventListener('click', function () {
          var box = button.closest('[data-video-facade]');
          var id = box.getAttribute('data-youtube-id');
          if (id) {
            var frame = el('iframe', {
              class: 'absolute inset-0 h-full w-full',
              src:
                'https://www.youtube-nocookie.com/embed/' +
                encodeURIComponent(id) +
                '?autoplay=1&rel=0&cc_load_policy=1',
              title: button.textContent.replace(/^\s*Play video:\s*/, ''),
              allow: 'autoplay; encrypted-media; picture-in-picture',
              allowfullscreen: '',
            });
            button.replaceWith(frame);
            return;
          }
          if (box.querySelector('[role="status"]')) return;
          box.appendChild(
            el('div', {
              role: 'status',
              class:
                'material absolute inset-x-4 bottom-4 rounded-xl bg-ink/80 p-4 text-[0.9rem] text-ivory/90 backdrop-blur-md',
              text: 'This video will play here once the official upload is linked. Until then, find Myron’s latest teaching on his official channels.',
            }),
          );
        });
      },
    );
  }

  function enhanceGalleries(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-gallery]'), function (gallery) {
      var buttons = Array.prototype.slice.call(gallery.querySelectorAll('button'));
      var items = buttons.map(function (b) {
        var img = b.querySelector('img');
        return { file: img.getAttribute('data-sa'), alt: img.getAttribute('alt') || '' };
      });
      buttons.forEach(function (b, i) {
        b.addEventListener('click', function () {
          openViewer(items, i, b.getBoundingClientRect(), b);
        });
      });
    });
  }

  function chipState(button, active) {
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    ['bg-ivory', 'text-ink', 'ring-ivory'].forEach(function (c) {
      button.classList.toggle(c, active);
    });
    ['text-ivory/80', 'ring-ivory/15', 'hover:text-ivory', 'hover:ring-ivory/35'].forEach(
      function (c) {
        button.classList.toggle(c, !active);
      },
    );
  }

  function emptyNote(text) {
    return el(
      'div',
      {
        class: 'mt-10 rounded-[1.5rem] bg-charcoal/70 p-10 text-center ring-1 ring-ivory/10',
        'data-mg-empty': '',
      },
      [
        el('p', { class: 'font-display text-[1.75rem] font-semibold', text: text }),
        el('p', {
          class: 'mt-2 text-ivory/70',
          text: 'Try a different word, or widen the filters.',
        }),
      ],
    );
  }

  function enhanceLibrary(root) {
    var box = root.querySelector('[data-library-browser]');
    if (!box) return;
    var state = { topic: 'all', type: 'all', q: '' };
    var list = box.querySelector('ul:not([role])');
    var items = Array.prototype.slice.call(box.querySelectorAll('li[data-text]'));
    var live = box.querySelector('[aria-live]');
    function apply() {
      var terms = normalise(state.q).split(' ').filter(Boolean);
      var shown = 0;
      items.forEach(function (li) {
        var ok =
          (state.topic === 'all' || li.getAttribute('data-topic') === state.topic) &&
          (state.type === 'all' || li.getAttribute('data-type') === state.type) &&
          terms.every(function (t) {
            return li.getAttribute('data-text').indexOf(t) > -1;
          });
        li.hidden = !ok;
        if (ok) shown++;
      });
      var old = box.querySelector('[data-mg-empty]');
      if (old) old.remove();
      if (list) list.hidden = shown === 0;
      if (!shown) box.appendChild(emptyNote('Nothing matches that yet'));
      if (live) live.textContent = shown + (shown === 1 ? ' result' : ' results');
      Array.prototype.forEach.call(box.querySelectorAll('[data-filter-topic]'), function (b) {
        chipState(b, b.getAttribute('data-filter-topic') === state.topic);
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-filter-type]'), function (b) {
        chipState(b, b.getAttribute('data-filter-type') === state.type);
      });
    }
    box.addEventListener('click', function (e) {
      var topic = e.target.closest('[data-filter-topic]');
      var type = e.target.closest('[data-filter-type]');
      if (topic) state.topic = topic.getAttribute('data-filter-topic');
      if (type) state.type = type.getAttribute('data-filter-type');
      if (topic || type) apply();
    });
    var input = box.querySelector('input[type="search"]');
    if (input)
      input.addEventListener('input', function () {
        state.q = input.value;
        apply();
      });
  }

  function enhanceEvents(root) {
    var box = root.querySelector('[data-events-browser]');
    if (!box) return;
    var toggle = box.querySelector('[data-view-toggle]');
    if (toggle) toggle.hidden = true; // The month grid needs React; the list carries every event.
    var items = Array.prototype.slice.call(box.querySelectorAll('li[data-when]'));
    var list = items.length ? items[0].parentElement : null;
    var panel = box.querySelector('[role="tabpanel"]');
    var live = box.querySelector('[aria-live]');
    var format = box.querySelector('select[id="filter-format"]');
    var type = box.querySelector('select[id="filter-type"]');
    var month = box.querySelector('select[id="filter-month"]');
    var state = { tab: 'upcoming' };

    function rebuild(select, attr, labelAttr, any, reverse) {
      var seen = {};
      var opts = [];
      items.forEach(function (li) {
        if (li.getAttribute('data-when') !== state.tab) return;
        var v = li.getAttribute(attr);
        if (!seen[v]) {
          seen[v] = 1;
          opts.push([v, li.getAttribute(labelAttr)]);
        }
      });
      opts.sort(function (a, b) {
        return reverse ? (a[0] < b[0] ? 1 : -1) : a[0] < b[0] ? -1 : 1;
      });
      select.replaceChildren(el('option', { value: 'all', text: any }));
      opts.forEach(function (o) {
        select.appendChild(el('option', { value: o[0], text: o[1] }));
      });
    }

    function apply() {
      var shown = 0;
      items.forEach(function (li) {
        var ok =
          li.getAttribute('data-when') === state.tab &&
          (format.value === 'all' || li.getAttribute('data-format') === format.value) &&
          (type.value === 'all' || li.getAttribute('data-type') === type.value) &&
          (month.value === 'all' || li.getAttribute('data-month') === month.value);
        li.hidden = !ok;
        if (ok) shown++;
      });
      var old = box.querySelector('[data-mg-empty]');
      if (old) old.remove();
      if (list) list.hidden = shown === 0;
      if (!shown)
        panel.appendChild(
          emptyNote(state.tab === 'upcoming' ? 'No upcoming events match' : 'No past events match'),
        );
      if (live) live.textContent = shown + (shown === 1 ? ' event shown' : ' events shown');
    }

    Array.prototype.forEach.call(box.querySelectorAll('[data-tab]'), function (tab) {
      tab.addEventListener('click', function () {
        state.tab = tab.getAttribute('data-tab');
        Array.prototype.forEach.call(box.querySelectorAll('[data-tab]'), function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          ['bg-ivory', 'text-ink'].forEach(function (c) {
            t.classList.toggle(c, on);
          });
          ['text-ivory/75', 'hover:text-ivory'].forEach(function (c) {
            t.classList.toggle(c, !on);
          });
        });
        panel.setAttribute('aria-labelledby', tab.id);
        rebuild(type, 'data-type', 'data-type-label', 'Any type', false);
        rebuild(month, 'data-month', 'data-month-label', 'Any month', state.tab === 'past');
        apply();
      });
    });
    [format, type, month].forEach(function (s) {
      s.addEventListener('change', apply);
    });
  }

  function enhanceCopy(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-copy-text]'), function (b) {
      b.addEventListener('click', function () {
        var labelNode = b.querySelector('[aria-live]') || b;
        var original = labelNode.textContent;
        navigator.clipboard.writeText(b.getAttribute('data-copy-text')).then(function () {
          labelNode.textContent = 'Copied';
          setTimeout(function () {
            labelNode.textContent = original;
          }, 2000);
        });
      });
    });
  }

  function search(query) {
    var terms = normalise(query)
      .split(' ')
      .filter(function (t) {
        return t.length > 1;
      });
    if (!terms.length) return [];
    var phrase = normalise(query);
    return metadata.search
      .map(function (doc) {
        var title = normalise(doc.title);
        var words = title.split(' ');
        var keywords = normalise((doc.keywords || []).join(' '));
        var summary = normalise(doc.summary);
        var score = 0;
        for (var i = 0; i < terms.length; i++) {
          var t = terms[i];
          var s = 0;
          if (words.indexOf(t) > -1) s += 6;
          else if (
            words.some(function (w) {
              return w.indexOf(t) === 0;
            })
          )
            s += 4;
          else if (title.indexOf(t) > -1) s += 2;
          if (keywords.indexOf(t) > -1) s += 3;
          if (summary.indexOf(t) > -1) s += 1;
          if (!s) return null;
          score += s;
        }
        if (terms.length > 1 && title.indexOf(phrase) > -1) score += 8;
        return { doc: doc, score: score };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.score - a.score || a.doc.title.localeCompare(b.doc.title);
      })
      .map(function (h) {
        return h.doc;
      });
  }

  function enhanceSearch(root, route) {
    var form = root.querySelector('form[role="search"]');
    if (!form) return;
    var input = form.querySelector('input[name="q"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      location.hash = '#/search?q=' + encodeURIComponent(input.value.trim());
    });
    var q = (route.query.get('q') || '').trim();
    if (!q) return;
    input.value = q;
    var hits = search(q);
    var box = el('div', { class: 'mt-12' });
    box.appendChild(
      el('p', {
        class: 'text-ivory/70',
        role: 'status',
        text: hits.length
          ? hits.length + (hits.length === 1 ? ' result' : ' results') + ' for “' + q + '”'
          : 'No results for “' + q + '”.',
      }),
    );
    if (hits.length) {
      var list = el('ul', {
        class: 'mt-6 max-w-3xl divide-y divide-ivory/10 border-y border-ivory/10',
      });
      hits.forEach(function (h) {
        list.appendChild(
          el('li', null, [
            el('a', { href: '#' + h.href, class: 'group block py-5' }, [
              el('span', {
                class:
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase bg-ivory/[0.07] text-ivory/80 ring-1 ring-ivory/15',
                text: h.kind,
              }),
              el('span', {
                class: 'type-title mt-2 block group-hover:text-gold-bright',
                text: h.title,
              }),
              el('span', { class: 'type-small mt-1 block text-ivory/65', text: h.summary }),
            ]),
          ]),
        );
      });
      box.appendChild(list);
    }
    var suggestions = form.nextElementSibling;
    if (suggestions && !suggestions.querySelector('form')) suggestions.replaceWith(box);
    else form.after(box);
  }

  // Booking: the seat stepper and the live order total, as the site's form does.
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  function enhanceBooking(root) {
    Array.prototype.forEach.call(root.querySelectorAll('form[data-booking-form]'), function (form) {
      var input = form.querySelector('#quantity');
      if (!input) return;
      var max = Number(form.getAttribute('data-max')) || 1;
      var unitAttr = form.getAttribute('data-unit-cents');
      var unit = unitAttr === '' || unitAttr === null ? null : Number(unitAttr);
      var live = form.querySelector('[aria-live]');

      function render() {
        var qty = clamp(Math.round(Number(input.value)) || 1, 1, max);
        var total =
          unit === null ? 'To be confirmed' : unit === 0 ? 'Free' : usd.format((unit * qty) / 100);
        Array.prototype.forEach.call(form.querySelectorAll('[data-booking-qty]'), function (n) {
          n.textContent = String(qty);
        });
        Array.prototype.forEach.call(form.querySelectorAll('[data-booking-total]'), function (n) {
          n.textContent = total;
        });
        if (live) live.textContent = qty + (qty === 1 ? ' seat' : ' seats') + ', total ' + total;
        Array.prototype.forEach.call(form.querySelectorAll('[data-stepper]'), function (b) {
          var d = Number(b.getAttribute('data-stepper'));
          var stuck = (d < 0 && qty <= 1) || (d > 0 && qty >= max);
          if (stuck) b.setAttribute('aria-disabled', 'true');
          else b.removeAttribute('aria-disabled');
          b.style.opacity = stuck ? '0.35' : '';
        });
        return qty;
      }

      Array.prototype.forEach.call(form.querySelectorAll('[data-stepper]'), function (b) {
        b.addEventListener('click', function () {
          var qty = clamp(
            (Math.round(Number(input.value)) || 1) + Number(b.getAttribute('data-stepper')),
            1,
            max,
          );
          input.value = String(qty);
          render();
        });
      });
      input.addEventListener('input', render);
      input.addEventListener('blur', function () {
        input.value = String(render());
      });
      render();
    });
  }

  // ---------------------------------------------------------------- book cart
  // Same storage key and format as the site, so the cart behaves the same:
  // slugs and quantities only, prices from the catalog the page carries.

  var CART_KEY = 'mg-cart-v1';
  var cartMemory = [];

  function readCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data)
        ? data.filter(function (l) {
            return l && typeof l.slug === 'string' && typeof l.qty === 'number' && l.qty > 0;
          })
        : [];
    } catch {
      return cartMemory.slice();
    }
  }

  /** `pulse`: the badge pops, as on the site — for additions only. */
  function writeCart(lines, pulse) {
    cartMemory = lines.slice();
    try {
      if (lines.length) localStorage.setItem(CART_KEY, JSON.stringify(lines));
      else localStorage.removeItem(CART_KEY);
    } catch {
      // Storage blocked: the in-memory copy carries this session.
    }
    updateCartBadge(pulse);
  }

  var shopCatalog = null;
  function catalogFrom(root) {
    var node = (root || doc).querySelector('[data-cart-root][data-catalog]');
    if (node && !shopCatalog) {
      try {
        shopCatalog = JSON.parse(node.getAttribute('data-catalog'));
      } catch {
        shopCatalog = null;
      }
    }
    return shopCatalog;
  }

  /** Every template carries no catalog except /cart, so read it from there once. */
  function ensureCatalog() {
    if (shopCatalog) return shopCatalog;
    var tpl = doc.querySelector('template[data-route="/cart"]');
    if (tpl) catalogFrom(tpl.content);
    return shopCatalog || [];
  }

  function cartSummary() {
    var catalog = ensureCatalog();
    var lines = [];
    var count = 0;
    var subtotal = 0;
    var demo = false;
    readCart().forEach(function (l) {
      var item = catalog.filter(function (c) {
        return c.slug === l.slug;
      })[0];
      if (!item) return;
      var qty = clamp(Math.floor(l.qty), 1, item.max);
      lines.push({ slug: l.slug, qty: qty, item: item, cents: item.priceCents * qty });
      count += qty;
      subtotal += item.priceCents * qty;
      demo = demo || item.demo;
    });
    return { lines: lines, count: count, subtotal: subtotal, demo: demo };
  }

  function books(n) {
    return n + (n === 1 ? ' book' : ' books');
  }

  function updateCartBadge(pulse) {
    var count = cartSummary().count;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-cart-link]'), function (link) {
      link.setAttribute('aria-label', count ? 'Cart, ' + books(count) : 'Cart, empty');
      var badge = link.querySelector('[data-cart-count]');
      if (!badge) return;
      badge.textContent = String(count);
      badge.hidden = count === 0;
      if (pulse && count && !reduceMotion.matches && badge.animate) {
        badge.animate([{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }], {
          duration: 380,
          easing: 'cubic-bezier(0.22, 1.4, 0.36, 1)',
        });
      }
    });
  }

  function enhanceShop(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-add-to-cart]'), function (button) {
      button.addEventListener('click', function () {
        var slug = button.getAttribute('data-add-to-cart');
        var max = Number(button.getAttribute('data-max')) || 1;
        var lines = readCart();
        var line = lines.filter(function (l) {
          return l.slug === slug;
        })[0];
        var before = line ? line.qty : 0;
        var after = Math.min(before + 1, max);
        if (after !== before) {
          if (line) line.qty = after;
          else lines.push({ slug: slug, qty: after });
          writeCart(lines, true);
        }
        var status = button.parentElement.querySelector('[data-cart-added]');
        if (status) {
          status.textContent = '';
          status.appendChild(
            doc.createTextNode(
              after === before
                ? after + ' is the most copies for one order. '
                : 'Added. ' + after + ' in your cart. ',
            ),
          );
          status.appendChild(el('a', { href: '#/cart', class: 'mg-cart-link', text: 'View cart' }));
        }
      });
    });
    var cartRoot = root.querySelector('[data-cart-root]');
    if (cartRoot) {
      catalogFrom(root);
      renderCart(cartRoot, null);
    }
  }

  function renderCart(rootNode, undo, notice) {
    var s = cartSummary();
    rootNode.textContent = '';
    if (notice) rootNode.appendChild(notice);
    if (!s.lines.length) {
      var empty = el('div', { class: 'mg-cart-empty' });
      if (undo) {
        var undoBtn = el('button', { type: 'button', class: 'mg-cart-button', text: 'Undo' });
        undoBtn.addEventListener('click', function () {
          writeCart(undo);
          renderCart(rootNode, null);
        });
        empty.appendChild(
          el('p', { role: 'status', class: 'mg-cart-undo' }, [
            el('span', { text: 'Cart cleared.' }),
            undoBtn,
          ]),
        );
      }
      empty.appendChild(el('h2', { text: 'Your cart is empty' }));
      empty.appendChild(el('p', { text: 'Books you add appear here.' }));
      empty.appendChild(
        el('a', { href: '#/books', class: 'mg-cart-primary', text: 'Browse books' }),
      );
      rootNode.appendChild(empty);
      return;
    }

    var list = el('ul', { class: 'mg-cart-lines', 'aria-label': 'Books in your cart' });
    s.lines.forEach(function (line) {
      var item = line.item;
      var file = item.cover ? item.cover.split('/').pop() : null;
      var thumb = el(
        'div',
        { class: 'mg-cart-thumb' },
        file ? [el('img', { alt: '', 'data-sa': file })] : [],
      );
      var select = el('select', { 'aria-label': 'Quantity of ' + item.title });
      for (var n = 1; n <= item.max; n++) {
        var opt = el('option', { value: String(n), text: String(n) });
        if (n === line.qty) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', function () {
        writeCart(
          readCart().map(function (l) {
            return l.slug === line.slug ? { slug: l.slug, qty: Number(select.value) } : l;
          }),
        );
        renderCart(rootNode, null);
        var again = rootNode.querySelector('select[aria-label="Quantity of ' + item.title + '"]');
        if (again) again.focus();
      });
      var remove = el('button', {
        type: 'button',
        class: 'mg-cart-remove',
        html: 'Remove<span class="sr-only"> ' + item.title + '</span>',
      });
      remove.addEventListener('click', function () {
        writeCart(
          readCart().filter(function (l) {
            return l.slug !== line.slug;
          }),
        );
        renderCart(rootNode, null);
      });
      var chips = el('p', { class: 'mg-cart-meta' }, [
        el('span', { text: usd.format(item.priceCents / 100) + ' each' }),
      ]);
      if (item.demo) chips.appendChild(el('span', { class: 'mg-chip', text: 'Demo price' }));
      if (item.placeholder)
        chips.appendChild(
          el('span', { class: 'mg-chip mg-chip-muted', text: 'Placeholder cover' }),
        );
      list.appendChild(
        el('li', { class: 'mg-cart-line' }, [
          thumb,
          el('div', { class: 'mg-cart-body' }, [
            el('div', { class: 'mg-cart-head' }, [
              el('h3', {}, [el('a', { href: '#/books/' + line.slug, text: item.title })]),
              el('p', { class: 'mg-cart-price', text: usd.format(line.cents / 100) }),
            ]),
            chips,
            el('div', { class: 'mg-cart-controls' }, [
              el('label', {}, [doc.createTextNode('Quantity '), select]),
              remove,
            ]),
          ]),
        ]),
      );
    });

    var clear = el('button', { type: 'button', class: 'mg-cart-button', text: 'Clear cart' });
    clear.addEventListener('click', function () {
      var previous = readCart();
      writeCart([]);
      renderCart(rootNode, previous);
    });

    var checkout = el('button', { type: 'button', class: 'mg-cart-primary', text: 'Check out' });
    var summary = el('aside', { class: 'mg-cart-summary', 'aria-label': 'Order summary' }, [
      el('h2', { text: 'Summary' }),
      el('dl', {}, [
        el('div', {}, [
          el('dt', { text: 'Subtotal (' + books(s.count) + ')' }),
          el('dd', { class: 'mg-cart-total', text: usd.format(s.subtotal / 100) }),
        ]),
        el('div', {}, [el('dt', { text: 'Shipping' }), el('dd', { text: 'Not set up yet' })]),
      ]),
    ]);
    if (s.demo)
      summary.appendChild(
        el('p', {
          class: 'mg-cart-note',
          text: 'Demo prices: the real prices are still to be confirmed.',
        }),
      );
    summary.appendChild(checkout);
    var live = el('p', {
      class: 'sr-only',
      'aria-live': 'polite',
      text: books(s.count) + ', subtotal ' + usd.format(s.subtotal / 100),
    });
    summary.appendChild(live);
    checkout.addEventListener('click', function () {
      startDemoPayment({
        kind: 'books',
        reference: demoReference(),
        lines: s.lines.map(function (line) {
          return {
            title: line.item.title,
            detail: line.item.demo ? 'Demo price' : undefined,
            quantity: line.qty,
            unitCents: line.item.priceCents,
          };
        }),
        shipping: true,
        back: { href: '/books', label: 'Back to books' },
      });
    });

    rootNode.appendChild(
      el('div', { class: 'mg-cart' }, [
        el('div', {}, [
          list,
          el('div', { class: 'mg-cart-actions' }, [
            el('a', { href: '#/books', class: 'mg-cart-link', text: '← Keep shopping' }),
            clear,
          ]),
        ]),
        summary,
      ]),
    );
    fillImages(rootNode);
  }

  // ---------------------------------------------------------------- payment step
  // The preview's stand-in for Stripe's page, ported from lib/demo-payment.ts:
  // only Stripe's test card numbers are accepted, and nothing typed is stored
  // or sent anywhere.

  var ORDER_KEY = 'mg-demo-order-v1';
  var pendingOrder = null;
  var TEST_OUTCOMES = {
    4242424242424242: 'success',
    5555555555554444: 'success',
    378282246310005: 'success',
    4000000000000002: 'declined',
    4000000000009995: 'insufficient-funds',
  };
  var DECLINES = {
    declined: 'Your card was declined. Try another card. (Demo: this test card always declines.)',
    'insufficient-funds':
      'Your card has insufficient funds. Try another card. (Demo: this test card always fails this way.)',
  };
  var PAY_LABELS = {
    'demo-email': 'Email',
    'demo-name': 'Full name',
    'demo-address1': 'Address',
    'demo-city': 'City',
    'demo-state': 'State',
    'demo-zip': 'ZIP code',
    'demo-card': 'Card number',
    'demo-exp': 'Expiry date',
    'demo-cvc': 'Security code',
    'demo-cardname': 'Name on card',
  };

  function demoReference() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return 'MG-' + out.slice(0, 4) + '-' + out.slice(4);
  }

  function startDemoPayment(order) {
    pendingOrder = order;
    try {
      sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      // Storage blocked (some browsers on file://): the in-memory copy carries it.
    }
    location.hash = '#/checkout/demo';
  }

  function readOrder() {
    try {
      var raw = sessionStorage.getItem(ORDER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fall back to the in-memory copy.
    }
    return pendingOrder;
  }

  function onlyDigits(v) {
    return String(v).replace(/\D/g, '');
  }
  function brandOf(v) {
    var n = onlyDigits(v);
    if (/^4/.test(n)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    return 'unknown';
  }
  function formatCard(v) {
    var n = onlyDigits(v);
    if (brandOf(n) === 'amex') {
      n = n.slice(0, 15);
      return [n.slice(0, 4), n.slice(4, 10), n.slice(10)].filter(Boolean).join(' ');
    }
    return (n.slice(0, 16).match(/.{1,4}/g) || []).join(' ');
  }
  function formatExp(v) {
    var n = onlyDigits(v).slice(0, 4);
    if (n.length === 1 && Number(n) > 1) n = '0' + n;
    return n.length > 2 ? n.slice(0, 2) + ' / ' + n.slice(2) : n;
  }
  function luhnOk(v) {
    var n = onlyDigits(v);
    if (n.length < 12) return false;
    var sum = 0;
    for (var i = 0; i < n.length; i++) {
      var d = Number(n[n.length - 1 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    return sum % 10 === 0;
  }

  function checkField(id, value, form) {
    var v = String(value).trim();
    if (id === 'demo-email') {
      if (!v) return 'Enter your email address.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ? null
        : 'Enter an email address in the format name@example.com.';
    }
    if (id === 'demo-zip') return /^\d{5}(-\d{4})?$/.test(v) ? null : 'Enter a 5-digit ZIP code.';
    if (id === 'demo-state')
      return /^[A-Za-z]{2}$/.test(v) ? null : 'Enter the two-letter state, such as TX.';
    if (id === 'demo-card') {
      var n = onlyDigits(v);
      if (!n) return 'Enter the card number.';
      if (!luhnOk(n)) return 'Check the card number; it is not complete or has a typo.';
      if (!TEST_OUTCOMES[n])
        return 'This demo only accepts test card numbers, such as 4242 4242 4242 4242. Real cards are refused, and nothing typed here is sent anywhere.';
      return null;
    }
    if (id === 'demo-exp') {
      var e = onlyDigits(v);
      if (e.length !== 4) return 'Enter the expiry date as MM / YY.';
      var month = Number(e.slice(0, 2));
      var year = 2000 + Number(e.slice(2));
      if (month < 1 || month > 12) return 'Enter a month from 01 to 12.';
      var now = new Date();
      var thisMonth = now.getFullYear() * 12 + now.getMonth();
      var expiry = year * 12 + (month - 1);
      if (expiry < thisMonth) return 'This card has expired. Use a future date.';
      if (expiry > thisMonth + 240) return 'Check the expiry year.';
      return null;
    }
    if (id === 'demo-cvc') {
      var len = brandOf(form.querySelector('#demo-card').value) === 'amex' ? 4 : 3;
      return onlyDigits(v).length === len ? null : 'Enter the ' + len + '-digit security code.';
    }
    return v ? null : 'Enter the ' + PAY_LABELS[id].toLowerCase() + '.';
  }

  function setFieldError(form, id, message) {
    var input = form.querySelector('#' + id);
    if (!input) return;
    var old = form.querySelector('#' + id + '-error');
    if (old) old.remove();
    input.classList.toggle('mg-invalid', !!message);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id + '-error');
      var p = el('p', {
        id: id + '-error',
        class: 'mt-2 flex items-start gap-1.5 text-[0.875rem] text-[#f0b4a8]',
        text: message,
      });
      input.parentElement.after(p);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function enhanceDemoCheckout(root) {
    var form = root.querySelector('form[data-demo-checkout]');
    if (!form) return;
    var order = readOrder();
    if (!order || !order.lines || !order.lines.length) {
      form.replaceWith(
        el('div', { class: 'mg-cart-empty' }, [
          el('h2', { text: 'There is nothing to pay for yet' }),
          el('p', {
            text: 'Start from your cart or an event’s booking page, and checkout brings you here.',
          }),
          el('a', { href: '#/cart', class: 'mg-cart-primary', text: 'Go to your cart' }),
        ]),
      );
      return;
    }
    var total = order.lines.reduce(function (t, l) {
      return t + l.unitCents * l.quantity;
    }, 0);
    var money = function (cents) {
      return usd.format(cents / 100);
    };

    var list = form.querySelector('[data-demo-lines]');
    list.textContent = '';
    order.lines.forEach(function (l) {
      var name = el('span', { class: 'min-w-0' }, [
        doc.createTextNode(l.title + ' '),
        el('span', { class: 'text-ivory/60', text: '× ' + l.quantity }),
      ]);
      if (l.detail)
        name.appendChild(
          el('span', { class: 'block text-[0.8rem] text-ivory/55', text: l.detail }),
        );
      list.appendChild(
        el('li', { class: 'flex items-baseline justify-between gap-4 text-[0.95rem]' }, [
          name,
          el('span', { class: 'tabular-nums', text: money(l.unitCents * l.quantity) }),
        ]),
      );
    });
    form.querySelector('[data-demo-total]').textContent = money(total);
    var payLabel = form.querySelector('[data-demo-pay-label]');
    payLabel.textContent = 'Pay ' + money(total);
    form.querySelector('[data-demo-reference]').textContent =
      'Reference ' + order.reference + '. Demo only: nothing is charged.';
    var back = root.querySelector('[data-demo-back]');
    if (back && order.kind === 'event') {
      back.setAttribute('href', '#' + order.back.href);
      back.textContent = '← Back to booking';
    }
    if (!order.shipping) {
      var ship = form.querySelector('[data-demo-shipping]');
      if (ship) ship.remove();
      var row = form.querySelector('[data-demo-shipping-row]');
      if (row) row.remove();
    }
    if (order.email) form.querySelector('#demo-email').value = order.email;

    var card = form.querySelector('#demo-card');
    var brand = form.querySelector('[data-demo-brand]');
    var names = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' };
    function showBrand() {
      var b = brandOf(card.value);
      brand.textContent = names[b] || '';
    }
    card.addEventListener('input', function () {
      card.value = formatCard(card.value);
      showBrand();
    });
    var exp = form.querySelector('#demo-exp');
    exp.addEventListener('input', function () {
      exp.value = formatExp(exp.value);
    });
    var cvc = form.querySelector('#demo-cvc');
    cvc.addEventListener('input', function () {
      cvc.value = onlyDigits(cvc.value).slice(0, brandOf(card.value) === 'amex' ? 4 : 3);
    });
    Array.prototype.forEach.call(form.querySelectorAll('[data-demo-fill]'), function (b) {
      b.addEventListener('click', function () {
        card.value = formatCard(b.getAttribute('data-demo-fill'));
        showBrand();
        setFieldError(form, 'demo-card', null);
      });
    });

    var required = [
      'demo-email',
      'demo-name',
      'demo-address1',
      'demo-city',
      'demo-state',
      'demo-zip',
      'demo-card',
      'demo-exp',
      'demo-cvc',
      'demo-cardname',
    ].filter(function (id) {
      return form.querySelector('#' + id);
    });
    required.forEach(function (id) {
      var input = form.querySelector('#' + id);
      input.addEventListener('blur', function () {
        if (input.value) setFieldError(form, id, checkField(id, input.value, form));
      });
    });

    var errorsBox = form.querySelector('[data-demo-errors]');
    function showSummary(title, problems) {
      errorsBox.textContent = '';
      var box = el(
        'div',
        {
          role: 'alert',
          tabindex: '-1',
          class: 'rounded-2xl bg-[#3a1d18] p-5 ring-1 ring-[#e8a598]/40 outline-none',
        },
        [el('p', { class: 'flex items-center gap-2 font-semibold text-[#f0b4a8]', text: title })],
      );
      if (problems.length) {
        var ul = el('ul', { class: 'mt-3 list-disc space-y-1 pl-6 text-[0.9rem] text-[#f0b4a8]' });
        problems.forEach(function (pr) {
          ul.appendChild(
            el('li', {}, [
              el('a', {
                href: '#/checkout/demo#' + pr[0],
                class: 'underline',
                text: PAY_LABELS[pr[0]] + ': ' + pr[1],
              }),
            ]),
          );
        });
        box.appendChild(ul);
      }
      errorsBox.appendChild(box);
      box.focus();
    }

    var payButton = form.querySelector('[data-demo-pay]');
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var problems = [];
      required.forEach(function (id) {
        var message = checkField(id, form.querySelector('#' + id).value, form);
        setFieldError(form, id, message);
        if (message) problems.push([id, message]);
      });
      if (problems.length) {
        showSummary('Some details need attention before you pay.', problems);
        return;
      }
      errorsBox.textContent = '';
      busy = true;
      payButton.disabled = true;
      payLabel.textContent = 'Processing…';
      var outcome = TEST_OUTCOMES[onlyDigits(card.value)];
      setTimeout(function () {
        busy = false;
        payButton.disabled = false;
        payLabel.textContent = 'Pay ' + money(total);
        if (outcome !== 'success') {
          setFieldError(form, 'demo-card', DECLINES[outcome]);
          showSummary('Your payment did not go through.', [['demo-card', DECLINES[outcome]]]);
          return;
        }
        try {
          sessionStorage.removeItem(ORDER_KEY);
        } catch {
          // Nothing to tidy.
        }
        pendingOrder = null;
        if (order.kind === 'books') writeCart([], false);
        var value = function (id) {
          var input = form.querySelector('#' + id);
          return input ? input.value.trim() : '';
        };
        var deliver = order.shipping
          ? [
              value('demo-name'),
              value('demo-address1'),
              value('demo-address2'),
              value('demo-city') +
                ', ' +
                value('demo-state').toUpperCase() +
                ' ' +
                value('demo-zip'),
            ]
              .filter(Boolean)
              .join(', ')
          : null;
        var detail = function (label, text, wide) {
          return el('div', { class: 'min-w-0' + (wide ? ' sm:col-span-2' : '') }, [
            el('dt', { class: 'type-eyebrow text-ivory/55', text: label }),
            el('dd', { class: 'mt-1 break-words', text: text }),
          ]);
        };
        var dl = el(
          'dl',
          {
            class:
              'mt-10 grid gap-x-8 gap-y-5 rounded-2xl bg-ink/60 p-7 ring-1 ring-ivory/10 sm:grid-cols-2',
          },
          [
            detail('Reference', order.reference),
            detail('Paid (demo)', money(total)),
            detail(
              order.kind === 'books' ? 'Books' : 'Booking',
              order.lines
                .map(function (l) {
                  return l.title + ' × ' + l.quantity;
                })
                .join('; '),
              true,
            ),
          ],
        );
        if (deliver) dl.appendChild(detail('Deliver to', deliver, true));
        dl.appendChild(detail('Email', value('demo-email'), true));
        var done = el(
          'div',
          { role: 'status', tabindex: '-1', class: 'mx-auto max-w-2xl outline-none' },
          [
            el('span', {
              class: 'grid size-16 place-items-center rounded-full bg-gold text-ink',
              html: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
            }),
            el('h2', { class: 'type-display-md mt-6', text: 'Payment complete' }),
            el('p', {
              class: 'type-lede mt-4 text-ivory/80',
              text: 'This was a demo payment, so nothing was charged. On the live site, Stripe takes the payment and sends the receipt.',
            }),
            dl,
            el('div', { class: 'mt-8 flex flex-wrap gap-3' }, [
              el('a', {
                href: '#' + order.back.href,
                class: 'mg-cart-button',
                text: order.back.label,
              }),
            ]),
          ],
        );
        form.replaceWith(done);
        done.focus();
      }, 1200);
    });
  }

  function enhance(root, route) {
    fillImages(root);
    enhanceShop(root);
    enhanceDemoCheckout(root);
    enhanceBooking(root);
    enhanceForms(root);
    enhanceVideos(root);
    enhanceGalleries(root);
    enhanceLibrary(root);
    enhanceEvents(root);
    enhanceCopy(root);
    enhanceSearch(root, route);
    if (route.path === '/contact') {
      var topic = route.query.get('topic');
      var select = root.querySelector('select[name="category"]');
      if (topic && select && select.querySelector('option[value="' + topic + '"]'))
        select.value = topic;
    }
    parallax();
  }

  // ---------------------------------------------------------------- start

  fillImages(doc);
  var menuButton = doc.querySelector('button[aria-controls="mobile-menu"]');
  if (menuButton)
    menuButton.addEventListener('click', function () {
      drawer.open(menuButton);
    });
  var skip = doc.querySelector('a[href="#main"]');
  if (skip)
    skip.addEventListener('click', function (e) {
      e.preventDefault();
      main.focus();
    });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', parallax);
  window.addEventListener('hashchange', function () {
    render(false);
  });
  render(true);
  updateCartBadge(false);
  // Another tab changed the cart: keep the badge (and an open cart) current.
  window.addEventListener('storage', function (e) {
    if (e.key !== CART_KEY && e.key !== null) return;
    updateCartBadge(false);
    var open = main.querySelector('[data-cart-root]');
    if (open) renderCart(open, null);
  });
  onScroll();
})();
