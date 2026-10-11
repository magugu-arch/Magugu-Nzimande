/* ---------------------------------------------------------------------------
 * Layers: pushed screens, sheets, the photo viewer and toasts — and how they
 * stay in step with the browser's own Back (Android's back gesture included).
 * ------------------------------------------------------------------------- */

var device = $('#device');
var appEl = $('#app');
var layerRoot = $('#layers');
var toastRoot = $('#toasts');
var layers = [];
var historyOK = true;
var afterHistory = null;

try {
  history.replaceState({ mx: 0 }, '');
} catch (e) {
  historyOK = false;
}

function stripHeight() {
  var strip = $('.demo-strip');
  return strip ? strip.offsetHeight : 0;
}

function topLayer() {
  return layers[layers.length - 1] || null;
}

/** Everything below the top layer is inert: no focus, no taps, no reading. */
function updateInert() {
  var groups = [$$('.tab-screen').concat([$('.tabbar')])];
  layers.forEach(function (l) {
    groups.push([l.el]);
  });
  groups.forEach(function (group, i) {
    var isTop = i === groups.length - 1;
    group.forEach(function (el) {
      if (!el) return;
      if (isTop) {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      } else {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
      }
    });
  });
}

function addLayer(layer) {
  layers.push(layer);
  updateInert();
  if (!historyOK) return;
  try {
    history.pushState({ mx: layers.length }, '');
    layer.inHistory = true;
  } catch (e) {
    historyOK = false;
  }
}

/** Close from a button: go through history so Back and the button agree. */
function requestClose(layer) {
  layer = layer || topLayer();
  if (!layer) return;
  if (layer === topLayer() && layer.inHistory && historyOK) {
    history.back();
    return;
  }
  var i = layers.indexOf(layer);
  if (i !== -1) layers.splice(i, 1);
  updateInert();
  layer.dismiss();
}

/** A gesture already animated this layer away; just forget it. */
function layerGone(layer) {
  var i = layers.indexOf(layer);
  if (i === -1) return;
  var wasTop = i === layers.length - 1;
  layers.splice(i, 1);
  updateInert();
  if (wasTop && layer.inHistory && historyOK) history.back();
}

/** Close the top `count` layers, then run `next` once history has settled. */
function closeLayers(count, next) {
  count = Math.min(count, layers.length);
  if (!count) {
    if (next) next();
    return;
  }
  var allInHistory = layers.slice(-count).every(function (l) {
    return l.inHistory;
  });
  if (historyOK && allInHistory) {
    afterHistory = next || null;
    history.go(-count);
    return;
  }
  for (var i = 0; i < count; i++) {
    var l = layers.pop();
    l.dismiss();
  }
  updateInert();
  if (next) next();
}

window.addEventListener('popstate', function (e) {
  var depth = e.state && typeof e.state.mx === 'number' ? e.state.mx : 0;
  while (layers.length > depth) {
    var l = layers.pop();
    l.dismiss();
  }
  updateInert();
  if (afterHistory) {
    var next = afterHistory;
    afterHistory = null;
    setTimeout(next, 0);
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && layers.length) {
    var top = topLayer();
    if (top.modal) return;
    e.preventDefault();
    requestClose(top);
  }
  if (e.key === 'Tab' && layers.length && topLayer().type === 'sheet') trapFocus(e, topLayer().el);
});

function trapFocus(e, root) {
  var focusables = $$('button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])', root).filter(
    function (el) {
      return el.offsetParent !== null;
    },
  );
  if (!focusables.length) return;
  var first = focusables[0];
  var last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Reduced motion swaps slides and springs for a short cross-fade. */
function fadeIn(el, done) {
  el.style.opacity = '0';
  el.style.transition = 'opacity 180ms ease-out';
  requestAnimationFrame(function () {
    el.style.opacity = '1';
    setTimeout(function () {
      el.style.transition = '';
      if (done) done();
    }, 200);
  });
}
function fadeOut(el, done) {
  el.style.transition = 'opacity 160ms ease-in';
  el.style.opacity = '0';
  setTimeout(done, 170);
}

/* ------------------------------------------------------------ navbars */

function navbarHTML(o) {
  return (
    '<header class="navbar' +
    (o.overMedia ? ' over-media' : '') +
    '"><div class="navbar-bg"></div><div class="navbar-inner">' +
    '<div class="navbar-start">' +
    (o.start || '') +
    '</div>' +
    (o.center ||
      (o.titleHidden === false
        ? '<div class="navbar-title" role="heading" aria-level="1">'
        : '<div class="navbar-title" aria-hidden="true">') +
        esc(o.title || '') +
        '</div>') +
    '<div class="navbar-end">' +
    (o.end || '') +
    '</div></div></header>'
  );
}

function bagButton(onMedia) {
  var n = bagCount();
  return (
    '<button class="icon-btn' +
    (onMedia ? ' on-media' : '') +
    '" data-action="open-bag" aria-label="Bag, ' +
    n +
    (n === 1 ? ' item' : ' items') +
    '">' +
    icon('bag') +
    '<span class="badge" data-bag-badge' +
    (n ? '' : ' hidden') +
    '>' +
    n +
    '</span></button>'
  );
}

/**
 * Scroll-linked chrome, updated on every frame the page moves:
 * large titles hand over to the inline title, the bar's material appears
 * only once content passes under it, and media headers parallax.
 */
function bindScrollEffects(screen, kind) {
  var scroller = $('.scroller', screen);
  var navbar = $('.navbar', screen);
  var hero = kind === 'media' ? $('[data-parallax]', screen) : null;
  var queued = false;
  function update() {
    queued = false;
    var y = scroller.scrollTop;
    if (kind === 'large') {
      var lt = $('.large-title', screen);
      var h = lt ? lt.offsetHeight : 60;
      navbar.style.setProperty('--title', clamp((y - h * 0.45) / (h * 0.4), 0, 1).toFixed(3));
      navbar.style.setProperty('--edge', clamp(y / 14, 0, 1).toFixed(3));
      if (lt && y < 0) lt.style.transform = 'scale(' + (1 + Math.min(-y, 80) / 700) + ')';
      else if (lt) lt.style.transform = '';
    } else if (hero) {
      var heroH = hero.offsetHeight;
      var navH = navbar.offsetHeight;
      var edge = clamp((y - (heroH - navH - 30)) / 30, 0, 1);
      navbar.style.setProperty('--edge', edge.toFixed(3));
      navbar.style.setProperty('--title', edge.toFixed(3));
      navbar.classList.toggle('over-media', edge < 0.5);
      var img = hero.querySelector('img') || hero;
      if (!reducedMotion.matches) {
        img.style.transform =
          y < 0 ? 'scale(' + (1 + -y / heroH) + ')' : 'translate3d(0,' + Math.min(y, heroH) * 0.28 + 'px,0)';
      }
    }
  }
  scroller.addEventListener(
    'scroll',
    function () {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
  return update;
}

/* ------------------------------------------------------ pushed screens */

/**
 * Push a screen from the right; it leaves the way it came. The screen below
 * slides a third of the way back and dims, and the whole transition is one
 * spring on a 0→1 progress value, so a swipe from the left edge can take
 * hold of it at any instant — including halfway through arriving.
 */
function pushScreen(o) {
  var below = layers.filter(function (l) {
    return l.type === 'screen';
  });
  below = below.length ? below[below.length - 1].el : $('.tab-screen:not([hidden])');
  var belowIsTab = below.classList.contains('tab-screen');
  var tabbar = $('.tabbar');

  var el = document.createElement('section');
  el.className = 'screen pushed' + (o.cls ? ' ' + o.cls : '');
  el.setAttribute('aria-label', o.title);
  el.innerHTML =
    navbarHTML({
      title: o.title,
      overMedia: o.media,
      titleHidden: !!o.media,
      start:
        '<button class="icon-btn' +
        (o.media ? ' on-media' : '') +
        '" data-action="back" aria-label="Back">' +
        icon('back') +
        '</button>',
      end: o.end || '',
    }) +
    '<div class="scroller' +
    (o.media ? ' under-header' : '') +
    '"></div>' +
    (o.actionBar ? '<div class="action-bar">' + o.actionBar + '</div>' : '') +
    '<div class="dim"></div><div class="edge-grab" aria-hidden="true"></div>';
  appEl.appendChild(el);
  o.render(el);
  sweepImages(el);
  var refreshChrome = bindScrollEffects(el, o.media ? 'media' : 'plain');
  if (!o.media) {
    var nb = $('.navbar', el);
    nb.style.setProperty('--title', '1');
    var sc = $('.scroller', el);
    sc.addEventListener(
      'scroll',
      function () {
        nb.style.setProperty('--edge', clamp(sc.scrollTop / 14, 0, 1).toFixed(3));
      },
      { passive: true },
    );
  }

  var W = device.clientWidth;
  var belowDim = $('.dim', below);
  var leaving = false;

  function apply(p) {
    var w = device.clientWidth;
    el.style.transform = 'translate3d(' + (1 - p) * w + 'px,0,0)';
    var shift = 'translate3d(' + -0.3 * w * p + 'px,0,0)';
    below.style.transform = p ? shift : '';
    if (belowIsTab) tabbar.style.transform = p ? shift : '';
    if (belowDim) belowDim.style.opacity = (0.1 * p).toFixed(3);
  }
  var progress = new Spring(0, apply, 0.001);

  function cleanup() {
    el.remove();
    below.style.transform = '';
    if (belowIsTab) tabbar.style.transform = '';
    if (belowDim) belowDim.style.opacity = '0';
    if (o.onHide) o.onHide();
  }

  var layer = {
    type: 'screen',
    el: el,
    refreshChrome: refreshChrome,
    dismiss: function () {
      leaving = true;
      if (reducedMotion.matches) {
        fadeOut(el, cleanup);
        return;
      }
      progress.to(0, { onRest: cleanup });
    },
  };

  // Back from the left edge: 1:1 with the finger, then velocity decides.
  var edge = $('.edge-grab', el);
  var startP = 1;
  draggable(edge, {
    axis: 'x',
    direction: 1,
    begin: function () {
      if (leaving) return;
      progress.stop();
      startP = progress.value;
      W = device.clientWidth;
    },
    move: function (dx) {
      if (leaving) return;
      var p = startP - dx / W;
      if (p > 1) p = 1 + rubberband(p - 1, 1, 0.3);
      progress.set(Math.max(0, p));
    },
    end: function (dx, dy, v, e, cancelled) {
      if (leaving) return;
      var projected = progress.value - project(v.x) / W;
      if (!cancelled && projected < 0.5) {
        leaving = true;
        layerGone(layer);
        progress.to(0, { velocity: -v.x / W, onRest: cleanup });
      } else {
        progress.to(1, { velocity: -v.x / W });
      }
    },
    tap: function (origin) {
      // The edge strip sits over content; pass a plain tap through to it.
      edge.style.pointerEvents = 'none';
      var under = document.elementFromPoint(origin.x, origin.y);
      edge.style.pointerEvents = '';
      var target = under && under.closest ? under.closest('button, a, [data-action]') : null;
      if (target) target.click();
    },
  });

  addLayer(layer);
  if (reducedMotion.matches) {
    apply(1);
    below.style.transform = '';
    if (belowIsTab) tabbar.style.transform = '';
    fadeIn(el);
  } else {
    apply(0);
    progress.to(1);
  }
  var focusTarget = $('.navbar [data-action="back"]', el);
  if (focusTarget) focusTarget.focus({ preventScroll: true });
  return layer;
}

/* -------------------------------------------------------------- sheets */

/**
 * A bottom sheet. It rises from the bottom and leaves the same way; it can be
 * dragged by its grabber, its header, or its content once that content is
 * scrolled to the top. Release velocity is projected forward to choose
 * between staying open and dismissing, and handed to the spring that
 * finishes the motion. The layer beneath scales back as it rises.
 */
function openSheet(o) {
  var opener = document.activeElement;
  var layerEl = document.createElement('div');
  layerEl.className = 'sheet-layer';
  var titleId = 'sheet-title-' + Math.random().toString(36).slice(2, 8);
  layerEl.innerHTML =
    '<div class="sheet-scrim"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="' +
    titleId +
    '">' +
    '<div class="sheet-grab" aria-hidden="true"></div>' +
    '<div class="sheet-head"><h2 id="' +
    titleId +
    '" tabindex="-1">' +
    esc(o.title) +
    '</h2>' +
    (o.modal
      ? ''
      : '<button class="icon-btn sheet-close" data-action="close-sheet" aria-label="Close">' + icon('close') + '</button>') +
    '</div><div class="sheet-body"></div>' +
    (o.foot !== undefined ? '<div class="sheet-foot"></div>' : '') +
    '</div>';
  layerRoot.appendChild(layerEl);

  var scrim = $('.sheet-scrim', layerEl);
  var sheet = $('.sheet', layerEl);
  var body = $('.sheet-body', layerEl);
  var foot = $('.sheet-foot', layerEl);

  var lowerSheet = null;
  for (var i = layers.length - 1; i >= 0; i--) {
    if (layers[i].type === 'sheet') {
      lowerSheet = $('.sheet', layers[i].el);
      break;
    }
  }
  var backdrop = lowerSheet || appEl;

  var H, top, closedY, openY;
  /*
   * The sheet is exactly as tall as it needs to be — its content, or the
   * screen less a margin for "large" — and sits on the bottom edge, so its
   * footer is always on screen. Open is y = 0; closed is its own height.
   */
  function measure() {
    H = device.clientHeight;
    var maxH = H - stripHeight() - 10;
    var sheetH = maxH;
    if (o.detent !== 'large') {
      // Measure the body at its natural height, not the height flex gives it.
      body.style.flex = '0 0 auto';
      var used = 0;
      Array.prototype.forEach.call(sheet.children, function (child) {
        if (!child.hidden) used += child.offsetHeight;
      });
      body.style.flex = '';
      sheetH = Math.min(maxH, used);
    }
    top = H - sheetH;
    sheet.style.top = top + 'px';
    sheet.style.height = sheetH + 'px';
    closedY = sheetH;
    openY = 0;
  }

  function apply(y) {
    sheet.style.transform = 'translate3d(0,' + y + 'px,0)';
    var p = clamp((closedY - y) / Math.max(1, closedY - openY), 0, 1);
    scrim.style.opacity = p.toFixed(3);
    if (reducedMotion.matches) return;
    if (backdrop === appEl) {
      appEl.style.transform = p ? 'translate3d(0,' + 10 * p + 'px,0) scale(' + (1 - 0.06 * p) + ')' : '';
      appEl.style.borderRadius = p ? 18 * p + 'px' : '';
    } else {
      backdrop.style.transform = 'translate3d(0,' + (lowerSheet._y || 0) + 'px,0) scale(' + (1 - 0.05 * p) + ')';
    }
  }
  sheet._y = 0;
  var spring = new Spring(0, function (y) {
    sheet._y = y;
    apply(y);
  }, 0.1);

  function render() {
    if (typeof o.body === 'function') o.body(body, api);
    else body.innerHTML = o.body;
    if (foot) {
      if (typeof o.foot === 'function') o.foot(foot, api);
      else foot.innerHTML = o.foot;
    }
    sweepImages(layerEl);
  }

  function remove() {
    layerEl.remove();
    if (backdrop === appEl) {
      appEl.style.transform = '';
      appEl.style.borderRadius = '';
    } else {
      backdrop.style.transform = 'translate3d(0,' + (lowerSheet._y || 0) + 'px,0)';
    }
    if (o.onClose) o.onClose();
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  var layer = {
    type: 'sheet',
    el: layerEl,
    modal: !!o.modal,
    dismiss: function (velocity) {
      if (reducedMotion.matches) {
        fadeOut(layerEl, remove);
        return;
      }
      spring.to(closedY, { velocity: velocity || 0, onRest: remove });
    },
  };

  var api = {
    el: layerEl,
    body: body,
    foot: foot,
    layer: layer,
    rerender: function () {
      render();
      api.refit();
    },
    refit: function () {
      // Keep the sheet's top edge where it is on screen, then spring it to
      // the new height — it grows or settles instead of jumping.
      var visualTop = top + spring.value;
      measure();
      spring.value = visualTop - top;
      apply(spring.value);
      spring.to(openY);
    },
    close: function () {
      requestClose(layer);
    },
    setModal: function (m) {
      layer.modal = m;
      o.modal = m;
    },
  };

  render();
  measure();
  spring.set(closedY);

  // Dragging. Content drags the sheet only from its top, and only downward.
  var startY = 0;
  var drag = draggable(sheet, {
    axis: 'y',
    canStart: function (e) {
      return !e.target.closest('input, textarea, select, .rail, .chips, .segmented, .dates');
    },
    shouldClaim: function (dx, dy, start) {
      if (body.contains(start.target)) return body.scrollTop <= 0 && dy > 0;
      return true;
    },
    begin: function () {
      spring.stop();
      startY = spring.value;
    },
    move: function (dx, dy) {
      var y = startY + dy;
      if (y < openY) y = openY + rubberband(y - openY, H, 0.4);
      spring.set(y);
    },
    end: function (dx, dy, v, e, cancelled) {
      var projected = spring.value + project(v.y);
      var halfway = openY + (closedY - openY) * 0.5;
      if (!cancelled && !layer.modal && projected > halfway) {
        layerGone(layer);
        spring.to(closedY, { velocity: v.y, onRest: remove });
      } else {
        spring.to(openY, { velocity: v.y, config: Math.abs(v.y) > 300 ? SPRING.thrown : SPRING.settle });
      }
    },
  });
  // Pointer Events cannot stop the browser from scrolling, so at the top of
  // the content a downward touch is kept from becoming an overscroll — that
  // is what lets the same finger drag the sheet instead.
  var touchStart = null;
  body.addEventListener(
    'touchstart',
    function (e) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true },
  );
  body.addEventListener(
    'touchmove',
    function (e) {
      if (!touchStart) return;
      var dx = e.touches[0].clientX - touchStart.x;
      var dy = e.touches[0].clientY - touchStart.y;
      var pullingDown = dy > 0 && Math.abs(dy) > Math.abs(dx);
      if (drag.isDragging() || (body.scrollTop <= 0 && pullingDown && !e.target.closest('input, textarea'))) {
        if (e.cancelable) e.preventDefault();
      }
    },
    { passive: false },
  );

  scrim.addEventListener('click', function () {
    if (!layer.modal) requestClose(layer);
  });

  addLayer(layer);
  if (reducedMotion.matches) {
    spring.set(openY);
    fadeIn(layerEl);
  } else {
    spring.to(openY);
  }
  var h2 = $('h2', layerEl);
  (o.initialFocus ? $(o.initialFocus, layerEl) || h2 : h2).focus({ preventScroll: true });
  return api;
}

/* -------------------------------------------------------------- toasts */

var currentToast = null;

/**
 * A short confirmation that rises above the tab bar and leaves downward.
 * Swipe it down to dismiss early; it carries an action when there is a
 * sensible next step (View bag, Undo).
 */
function toast(message, opts) {
  opts = opts || {};
  if (currentToast) currentToast.hide(true);
  var t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML =
    icon(opts.icon || 'check') +
    '<span>' +
    esc(message) +
    '</span>' +
    (opts.action ? '<button type="button">' + esc(opts.action.label) + '</button>' : '');
  // Sit just above whatever chrome is at the bottom right now.
  var top = topLayer();
  var bottom = 'calc(var(--tabbar-h) + var(--safe-bottom) + 0.75rem)';
  if (top && top.type === 'screen' && $('.action-bar', top.el)) bottom = 'calc(var(--safe-bottom) + 5.5rem)';
  else if (top) bottom = 'calc(var(--safe-bottom) + 1rem)';
  toastRoot.style.paddingBottom = bottom;
  toastRoot.appendChild(t);

  var y = new Spring(90, function (v) {
    t.style.transform = 'translate3d(0,' + v + 'px,0)';
    t.style.opacity = clamp(1 - v / 90, 0, 1).toFixed(3);
  }, 0.3);
  var timer = null;
  var handle = {
    hide: function (fast, velocity) {
      clearTimeout(timer);
      if (currentToast === handle) currentToast = null;
      if (fast) {
        t.remove();
        return;
      }
      y.to(110, {
        velocity: velocity || 0,
        onRest: function () {
          t.remove();
        },
      });
    },
  };
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      handle.hide();
    }, opts.duration || 3600);
  }
  if (opts.action) {
    $('button', t).addEventListener('click', function () {
      handle.hide();
      opts.action.run();
    });
  }
  draggable(t, {
    axis: 'y',
    begin: function () {
      clearTimeout(timer);
      y.stop();
    },
    move: function (dx, dy) {
      y.set(dy < 0 ? rubberband(dy, 80, 0.3) : dy);
    },
    end: function (dx, dy, v) {
      if (y.value + project(v.y) > 40) handle.hide(false, v.y);
      else {
        y.to(0, { velocity: v.y });
        schedule();
      }
    },
  });
  y.to(0, { config: SPRING.settle });
  schedule();
  currentToast = handle;
  if (opts.haptic) haptic(opts.haptic);
  return handle;
}

/* -------------------------------------------------------------- viewer */

/**
 * Full-screen photo viewer. Pinch or double-tap to zoom, pan with momentum
 * and rubber-banded edges, and drag down to put it away — the backdrop
 * fades with the drag so you can see where you are returning to. X, Y and
 * scale are three independent springs, so a diagonal flick stays in sync.
 */
function openViewer(assetId) {
  var el = document.createElement('div');
  el.className = 'viewer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Image viewer');
  el.innerHTML =
    '<img src="' +
    ASSET_URL[assetId] +
    '" alt="' +
    esc(assetAlt(assetId)) +
    '" draggable="false">' +
    '<button class="icon-btn viewer-close" data-action="close-viewer" aria-label="Close image">' +
    icon('close') +
    '</button><p class="viewer-hint">Pinch or double-tap to zoom · drag down to close · concept image</p>';
  layerRoot.appendChild(el);
  var img = $('img', el);
  var W = device.clientWidth;
  var H = device.clientHeight;
  var bw = W;
  var bh = H;

  function fit() {
    W = device.clientWidth;
    H = device.clientHeight;
    var ratio = (img.naturalWidth || 4) / (img.naturalHeight || 5);
    bw = Math.min(W, H * ratio);
    bh = bw / ratio;
    img.style.width = bw + 'px';
    img.style.height = bh + 'px';
    img.style.margin = -bh / 2 + 'px 0 0 ' + -bw / 2 + 'px';
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
  }
  var view = { x: 0, y: 0, s: 1 };
  function paint() {
    img.style.transform = 'translate3d(' + view.x + 'px,' + view.y + 'px,0) scale(' + view.s + ')';
    var fade = view.s <= 1.01 ? clamp(1 - Math.abs(view.y) / (H * 0.6), 0.15, 1) : 1;
    el.style.backgroundColor = 'rgba(0,0,0,' + fade.toFixed(3) + ')';
  }
  var sx = new Spring(0, function (v) {
    view.x = v;
    paint();
  }, 0.2);
  var sy = new Spring(0, function (v) {
    view.y = v;
    paint();
  }, 0.2);
  var ss = new Spring(1, function (v) {
    view.s = v;
    paint();
  }, 0.002);

  function bounds(s) {
    return { x: Math.max(0, (bw * s - W) / 2), y: Math.max(0, (bh * s - H) / 2) };
  }
  function settle(vx, vy) {
    var s = clamp(view.s, 1, 4);
    var b = bounds(s);
    var tx = clamp(view.x + project(vx || 0, 0.998), -b.x, b.x);
    var ty = clamp(view.y + project(vy || 0, 0.998), -b.y, b.y);
    ss.to(s);
    sx.to(tx, { velocity: vx || 0 });
    sy.to(ty, { velocity: vy || 0 });
  }

  var pointers = {};
  var gesture = null;
  var tracker = new VelocityTracker();
  var lastTap = 0;

  function points() {
    return Object.keys(pointers).map(function (k) {
      return pointers[k];
    });
  }
  function beginGesture() {
    var pts = points();
    [sx, sy, ss].forEach(function (s) {
      s.stop();
    });
    if (pts.length >= 2) {
      var a = pts[0];
      var b = pts[1];
      gesture = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: { x: view.x, y: view.y, s: view.s },
      };
    } else if (pts.length === 1) {
      gesture = { kind: 'pan', start: { x: pts[0].x, y: pts[0].y }, view: { x: view.x, y: view.y, s: view.s }, moved: false };
    }
  }
  function centerOffset(p) {
    var r = el.getBoundingClientRect();
    return { x: p.x - r.left - W / 2, y: p.y - r.top - H / 2 };
  }

  el.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.viewer-close')) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    tracker = new VelocityTracker();
    tracker.add(e.clientX, e.clientY, e.timeStamp);
    beginGesture();
  });
  el.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId] || !gesture) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var pts = points();
    if (gesture.kind === 'pinch' && pts.length >= 2) {
      var a = pts[0];
      var b = pts[1];
      var dist = Math.hypot(a.x - b.x, a.y - b.y);
      var raw = gesture.view.s * (dist / gesture.dist);
      var s = raw > 4 ? 4 + rubberband(raw - 4, 4, 0.3) : raw < 1 ? 1 - rubberband(1 - raw, 1, 0.3) : raw;
      var m0 = centerOffset(gesture.mid);
      var m1 = centerOffset({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      view.s = s;
      view.x = m1.x - (m0.x - gesture.view.x) * (s / gesture.view.s);
      view.y = m1.y - (m0.y - gesture.view.y) * (s / gesture.view.s);
      sx.value = view.x;
      sy.value = view.y;
      ss.value = view.s;
      paint();
    } else if (gesture.kind === 'pan') {
      var dx = e.clientX - gesture.start.x;
      var dy = e.clientY - gesture.start.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 8) return;
      gesture.moved = true;
      tracker.add(e.clientX, e.clientY, e.timeStamp);
      var bnd = bounds(view.s);
      var nx = gesture.view.x + dx;
      var ny = gesture.view.y + dy;
      if (view.s <= 1.01) {
        nx = gesture.view.x + rubberband(dx, W, 0.2);
      } else {
        if (Math.abs(nx) > bnd.x) nx = Math.sign(nx) * (bnd.x + rubberband(Math.abs(nx) - bnd.x, W));
        if (Math.abs(ny) > bnd.y) ny = Math.sign(ny) * (bnd.y + rubberband(Math.abs(ny) - bnd.y, H));
      }
      view.x = nx;
      view.y = ny;
      sx.value = nx;
      sy.value = ny;
      paint();
    }
  });
  function lift(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    var g = gesture;
    if (points().length) {
      beginGesture();
      return;
    }
    gesture = null;
    if (!g) return;
    var v = tracker.velocity(e.timeStamp);
    if (g.kind === 'pan' && !g.moved && e.type === 'pointerup') {
      var now = e.timeStamp;
      if (now - lastTap < 300) {
        // Double-tap: zoom toward the tapped point, or back out.
        lastTap = 0;
        if (view.s > 1.05) {
          ss.to(1);
          sx.to(0);
          sy.to(0);
        } else {
          var c = centerOffset({ x: e.clientX, y: e.clientY });
          var target = 2.5;
          var b2 = bounds(target);
          ss.to(target);
          sx.to(clamp(-c.x * (target - 1), -b2.x, b2.x));
          sy.to(clamp(-c.y * (target - 1), -b2.y, b2.y));
        }
      } else {
        lastTap = now;
      }
      return;
    }
    if (view.s <= 1.01 && g.kind === 'pan') {
      var projected = view.y + project(v.y);
      if (Math.abs(projected) > H * 0.22) {
        layerGone(layer);
        sy.to(Math.sign(projected) * H, { velocity: v.y, onRest: removeViewer });
        return;
      }
      sx.to(0, { velocity: v.x });
      sy.to(0, { velocity: v.y });
      ss.to(1);
      return;
    }
    settle(v.x, v.y);
  }
  el.addEventListener('pointerup', lift);
  el.addEventListener('pointercancel', lift);

  function removeViewer() {
    el.remove();
  }
  var layer = {
    type: 'viewer',
    el: el,
    dismiss: function () {
      if (reducedMotion.matches) {
        fadeOut(el, removeViewer);
        return;
      }
      ss.to(0.92);
      fadeOut(el, removeViewer);
    },
  };
  if (img.complete) fit();
  else img.addEventListener('load', fit);
  fit();
  paint();
  addLayer(layer);
  if (reducedMotion.matches) fadeIn(el);
  else {
    ss.set(0.9);
    el.style.opacity = '0';
    el.style.transition = 'opacity 160ms ease-out';
    requestAnimationFrame(function () {
      el.style.opacity = '1';
      ss.to(1);
    });
  }
  $('.viewer-close', el).focus({ preventScroll: true });
}
