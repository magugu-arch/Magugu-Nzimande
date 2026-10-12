/* ---------------------------------------------------------------------------
 * The menu button: a pull-down menu in the manner of iOS.
 *
 * - It opens on press, not release, and grows out of the button that made
 *   it (its transform-origin is the button), then shrinks back into it.
 * - Press, drag to an item and lift to choose it in one gesture; or tap to
 *   open and tap an item. Each item the finger crosses gets a selection tick.
 * - One spring drives it both ways, from wherever it is, so opening and
 *   closing can interrupt each other. Reduce Motion cross-fades instead.
 * - It is a layer like a sheet: Back and Escape close it, the page beneath is
 *   inert, and focus returns to the button.
 * ------------------------------------------------------------------------- */

ICONS.more = '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12h.01M12 12h.01M15.8 12h.01" stroke-width="2.4"/>';
ICONS.sun = '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>';
ICONS.moon = '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>';

function menuButton(onMedia) {
  return (
    '<button class="icon-btn' +
    (onMedia ? ' on-media' : '') +
    '" data-menu-trigger aria-haspopup="menu" aria-expanded="false" aria-controls="mx-menu" aria-label="Menu">' +
    icon('more') +
    '</button>'
  );
}

/** What the menu offers, grouped the way iOS groups menu sections. */
function menuSections() {
  var m = market();
  var rsvps = Object.keys(state.rsvps || {}).length;
  return [
    [
      { key: 'events', title: 'Events calendar', icon: 'calendar' },
      { key: 'my-events', title: 'My events', sub: rsvps ? rsvps + (rsvps === 1 ? ' RSVP' : ' RSVPs') : '', icon: 'sparkle' },
      { key: 'orders', title: 'Orders and tracking', icon: 'truck' },
      { key: 'stylist', title: 'Book a stylist', icon: 'message' },
    ],
    [
      { key: 'market', title: 'Market and currency', sub: m.label + ' · ' + m.currencyCode, icon: 'globe' },
      { key: 'notifications', title: 'Notifications', icon: 'bell' },
    ],
    [
      { key: 'file', title: 'Images and file details', icon: 'grid' },
      { key: 'about', title: 'What is real here', icon: 'info' },
      { key: 'reset', title: 'Reset demo', icon: 'refresh', destructive: true },
    ],
  ];
}

var MENU_ACTIONS = {
  events: function () {
    openEvents();
  },
  'my-events': function () {
    openMyEvents();
  },
  orders: function () {
    openOrders();
  },
  stylist: function () {
    openAppointment();
  },
  market: function () {
    openMarket();
  },
  notifications: function () {
    openNotifications();
  },
  file: function () {
    openFileDetails();
  },
  about: function () {
    openAbout();
  },
  reset: function () {
    ACTIONS['reset-demo']();
  },
};

var THEMES = [
  ['system', 'System', 'contrast'],
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
];

function menuHTML() {
  return (
    '<div class="menu-palette" role="group" aria-label="Appearance">' +
    THEMES.map(function (t) {
      return (
        '<button class="menu-swatch" role="menuitemradio" tabindex="-1" data-menu-theme="' +
        t[0] +
        '" aria-checked="' +
        (state.theme === t[0]) +
        '">' +
        icon(t[2]) +
        '<span>' +
        t[1] +
        '</span></button>'
      );
    }).join('') +
    '</div>' +
    menuSections()
      .map(function (section) {
        return (
          '<div class="menu-section" role="group">' +
          section
            .map(function (it) {
              return (
                '<button class="menu-item' +
                (it.destructive ? ' destructive' : '') +
                '" role="menuitem" tabindex="-1" data-menu-item="' +
                it.key +
                '"><span class="menu-label"><span>' +
                esc(it.title) +
                '</span>' +
                (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') +
                '</span>' +
                icon(it.icon) +
                '</button>'
              );
            })
            .join('') +
          '</div>'
        );
      })
      .join('')
  );
}

var openMenuState = null;

function openMenu(trigger, how) {
  if (openMenuState) return openMenuState;
  var deviceRect = device.getBoundingClientRect();
  var r = trigger.getBoundingClientRect();
  var layerEl = document.createElement('div');
  layerEl.className = 'menu-layer';
  layerEl.innerHTML = '<div class="menu-scrim"></div><div class="menu" id="mx-menu" role="menu" aria-label="Menu">' + menuHTML() + '</div>';
  layerRoot.appendChild(layerEl);
  var scrim = $('.menu-scrim', layerEl);
  var menu = $('.menu', layerEl);

  // Hang the menu from the button, inside the screen's edges, and let it
  // scroll if a small screen cannot hold it all.
  var W = device.clientWidth;
  var H = device.clientHeight;
  var width = Math.min(260, W - 16);
  var top = r.bottom - deviceRect.top + 6;
  var left = Math.max(8, Math.min(r.left - deviceRect.left, W - width - 8));
  if (r.left - deviceRect.left > W / 2) left = Math.max(8, Math.min(r.right - deviceRect.left - width, W - width - 8));
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  menu.style.width = width + 'px';
  menu.style.maxHeight = H - top - stripHeight() - 12 + 'px';
  var originX = r.left - deviceRect.left + r.width / 2 - left;
  var originY = r.top - deviceRect.top + r.height / 2 - top;
  menu.style.transformOrigin = originX + 'px ' + originY + 'px';

  function apply(p) {
    var s = 0.25 + 0.75 * p;
    menu.style.transform = 'scale(' + s.toFixed(4) + ')';
    menu.style.opacity = Math.min(1, p * 1.8).toFixed(3);
    scrim.style.opacity = p.toFixed(3);
  }
  var spring = new Spring(0, apply, 0.002);

  function remove() {
    layerEl.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (openMenuState === api) openMenuState = null;
    if (document.contains(trigger)) trigger.focus({ preventScroll: true });
  }

  var layer = {
    type: 'menu',
    el: layerEl,
    dismiss: function () {
      layerEl.classList.add('closing');
      if (openMenuState === api) openMenuState = null;
      if (reducedMotion.matches) {
        fadeOut(layerEl, remove);
        return;
      }
      spring.to(0, { config: SPRING.snappy, onRest: remove });
    },
  };

  var items = function () {
    return $$('[role^="menuitem"]', menu);
  };
  function highlight(el) {
    items().forEach(function (it) {
      it.classList.toggle('is-highlighted', it === el);
    });
  }
  function choose(el) {
    if (!el) return;
    if (el.hasAttribute('data-menu-theme')) {
      // Appearance changes in place, so the menu stays to show the result.
      state.theme = el.getAttribute('data-menu-theme');
      persist();
      applyTheme();
      renderTab('account');
      $$('[data-menu-theme]', menu).forEach(function (b) {
        b.setAttribute('aria-checked', String(b === el));
      });
      haptic('tap');
      return;
    }
    var run = MENU_ACTIONS[el.getAttribute('data-menu-item')];
    haptic('tap');
    closeLayers(1, run);
  }

  menu.addEventListener('click', function (e) {
    choose(e.target.closest('[role^="menuitem"]'));
  });
  scrim.addEventListener('pointerdown', function (e) {
    // A press outside closes the menu at once and is not passed through.
    e.preventDefault();
    if (!layerEl.classList.contains('closing')) requestClose(layer);
  });
  menu.addEventListener('keydown', function (e) {
    var list = items();
    var i = list.indexOf(document.activeElement);
    var to = null;
    if (e.key === 'ArrowDown') to = list[(i + 1) % list.length];
    else if (e.key === 'ArrowUp') to = list[(i - 1 + list.length) % list.length];
    else if (e.key === 'Home') to = list[0];
    else if (e.key === 'End') to = list[list.length - 1];
    else if (e.key === 'Tab') {
      e.preventDefault();
      requestClose(layer);
      return;
    }
    if (to) {
      e.preventDefault();
      to.focus();
    }
  });

  // Press-and-drag: the press that opened the menu can travel to an item
  // and lift to choose it. A press that does not travel is a tap.
  if (how && how.pointerId != null) {
    var moved = false;
    var last = null;
    var onMove = function (e) {
      if (e.pointerId !== how.pointerId) return;
      if (!moved && Math.hypot(e.clientX - how.x, e.clientY - how.y) < 10) return;
      moved = true;
      var under = document.elementFromPoint(e.clientX, e.clientY);
      var item = under && under.closest ? under.closest('.menu [role^="menuitem"]') : null;
      if (item !== last) {
        last = item;
        highlight(item);
        if (item) haptic('tap');
      }
    };
    var onUp = function (e) {
      if (e.pointerId !== how.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      highlight(null);
      if (moved && last && e.type === 'pointerup') choose(last);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  var api = { el: layerEl, layer: layer, menu: menu };
  openMenuState = api;
  trigger.setAttribute('aria-expanded', 'true');
  addLayer(layer);
  haptic('tap');
  if (reducedMotion.matches) {
    apply(1);
    fadeIn(layerEl);
  } else {
    apply(0);
    spring.to(1, { config: SPRING.settle });
  }
  if (how && how.keyboard) {
    items()[0].focus({ preventScroll: true });
  } else {
    menu.setAttribute('tabindex', '-1');
    menu.focus({ preventScroll: true });
  }
  return api;
}

// Opens on the press itself; keyboard and assistive tech arrive as a click.
document.addEventListener('pointerdown', function (e) {
  var t = e.target.closest ? e.target.closest('[data-menu-trigger]') : null;
  if (!t || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (openMenuState) return;
  openMenu(t, { pointerId: e.pointerId, x: e.clientX, y: e.clientY });
});
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('[data-menu-trigger]') : null;
  if (!t || e.detail !== 0 || openMenuState) return;
  openMenu(t, { keyboard: true });
});
