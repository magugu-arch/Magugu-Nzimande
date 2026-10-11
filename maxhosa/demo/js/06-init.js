/* ---------------------------------------------------------------------------
 * Wiring: one delegated click handler, theme, the desktop presenter panel,
 * and start-up.
 * ------------------------------------------------------------------------- */

function screenOf(el) {
  return el.closest('.screen');
}

var ACTIONS = {
  tab: function (el) {
    switchTab(el.getAttribute('data-tab'));
  },
  back: function () {
    requestClose();
  },
  'close-sheet': function () {
    requestClose();
  },
  'close-viewer': function () {
    requestClose();
  },
  search: function () {
    switchTab('shop');
    var input = $('#shop-q');
    if (input) input.focus();
  },
  'open-bag': function () {
    openBag();
  },
  'bag-browse': function () {
    closeLayers(layers.length, function () {
      state.shop = defaultShop();
      switchTab('shop');
      renderTab('shop');
    });
  },
  'bag-open-product': function (el) {
    var id = el.getAttribute('data-id');
    closeLayers(layers.length, function () {
      openProduct(id);
    });
  },
  checkout: function (el) {
    if (el.getAttribute('aria-disabled') === 'true') {
      toast('Remove pieces that are no longer available to continue.', { icon: 'alert', haptic: 'error' });
      return;
    }
    openCheckout();
  },
  'open-product': function (el) {
    openProduct(el.getAttribute('data-id'));
  },
  'open-story': function (el) {
    openStory(el.getAttribute('data-id'));
  },
  'open-tracker': function (el) {
    openTracker(el.getAttribute('data-id'));
  },
  'open-orders': function () {
    openOrders();
  },
  'open-events': function () {
    openEvents();
  },
  'open-event': function (el) {
    openEvent(el.getAttribute('data-id'));
  },
  'open-my-events': function () {
    openMyEvents();
  },
  'open-appointment': function () {
    openAppointment();
  },
  'ask-stylist': function (el) {
    openAppointment({ productId: el.getAttribute('data-id') });
  },
  'open-notifications': function () {
    openNotifications();
  },
  'open-market': openMarket,
  'open-sizes': openSizes,
  'open-help': function () {
    openHelp();
  },
  'open-stores': openStores,
  'open-privacy': openPrivacy,
  'open-about': openAbout,
  'shop-new': function () {
    state.shop = defaultShop();
    switchTab('shop');
    renderTab('shop');
  },
  'shop-available': function () {
    state.shop = defaultShop();
    state.shop.availability = 'available';
    switchTab('shop');
    renderTab('shop');
  },
  'shop-category': function (el) {
    state.shop = defaultShop();
    state.shop.cat = el.getAttribute('data-id');
    switchTab('shop');
    renderTab('shop');
  },
  'shop-cat': function (el) {
    state.shop.cat = el.getAttribute('data-id');
    updateShop();
  },
  'clear-search': function () {
    state.shop.q = '';
    if (state.shop.sort === 'relevance') state.shop.sort = 'new';
    var input = $('#shop-q');
    input.value = '';
    input.focus();
    $('[data-action="clear-search"]').hidden = true;
    updateShop();
  },
  'clear-filters': function () {
    state.shop = defaultShop();
    renderTab('shop');
  },
  'open-filters': openFilters,
  'toggle-save': function (el) {
    var pid = el.getAttribute('data-id');
    var i = state.saved.indexOf(pid);
    if (i === -1) state.saved.unshift(pid);
    else state.saved.splice(i, 1);
    persist();
    syncSaveButtons(pid);
    haptic('tap');
    if (state.tab === 'saved' && !layers.length) renderTab('saved');
    toast(i === -1 ? 'Saved to this device' : 'Removed from Saved', {
      icon: i === -1 ? 'heartFill' : 'heart',
      action:
        i === -1
          ? null
          : {
              label: 'Undo',
              run: function () {
                state.saved.splice(i, 0, pid);
                persist();
                syncSaveButtons(pid);
                if (state.tab === 'saved' && !layers.length) renderTab('saved');
              },
            },
    });
  },
  'remove-restock': function (el) {
    var pid = el.getAttribute('data-id');
    var size = el.getAttribute('data-size');
    state.restock = state.restock.filter(function (r) {
      return !(r.productId === pid && r.size === size);
    });
    persist();
    renderTab('saved');
  },
  'add-to-bag': function (el) {
    addToBag(el.getAttribute('data-id'), screenOf(el));
  },
  'size-guide': function (el) {
    openSizeGuide(el.getAttribute('data-id'));
  },
  share: function (el) {
    shareProduct(el.getAttribute('data-id'));
  },
  zoom: function (el) {
    openViewer(el.getAttribute('data-id'));
  },
  accordion: function (el) {
    toggleAccordion(el);
  },
  external: function () {
    // Optional outbound link: the demo never depends on it.
    if (navigator.onLine === false) {
      toast('External link requires internet. The demo itself keeps working offline.', { icon: 'external' });
      return;
    }
    toast('External link requires internet — opening maxhosa.africa in a new tab.', { icon: 'external' });
    window.open(OFFICIAL_SITE, '_blank', 'noopener');
  },
  'signin-demo': function () {
    toast('Sign-in uses MAXHOSA’s account provider, which isn’t connected in this demo.', { icon: 'person' });
  },
  'demo-only': function (el) {
    toast(el.getAttribute('data-msg') || 'Demo only.', { icon: 'info' });
  },
  theme: function (el) {
    state.theme = el.getAttribute('data-id');
    persist();
    applyTheme();
    renderTab('account');
  },
  'reset-demo': function () {
    var snapshot = JSON.stringify({
      bag: state.bag,
      saved: state.saved,
      restock: state.restock,
      orders: state.orders,
      appointments: state.appointments,
      rsvps: state.rsvps,
      reminders: state.reminders,
    });
    state.bag = [];
    state.saved = [];
    state.restock = [];
    state.orders = null;
    state.appointments = [];
    state.rsvps = {};
    state.reminders = {};
    seedOrders();
    persist();
    persistEvents();
    refreshAll();
    toast('Demo reset', {
      icon: 'refresh',
      action: {
        label: 'Undo',
        run: function () {
          var s = JSON.parse(snapshot);
          Object.keys(s).forEach(function (k) {
            state[k] = s[k];
          });
          persist();
          persistEvents();
          refreshAll();
        },
      },
    });
  },
};

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var fn = ACTIONS[el.getAttribute('data-action')];
  if (!fn) return;
  if (el.getAttribute('aria-disabled') === 'true' && el.getAttribute('data-action') !== 'checkout') return;
  e.preventDefault();
  fn(el, e);
});

function applyTheme() {
  var root = document.documentElement;
  if (state.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
  var meta = $('meta[name="theme-color"]');
  var dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (meta) meta.setAttribute('content', dark ? '#100e0b' : '#f6f1e8');
}

/* The desktop presenter panel: shortcuts for a room watching on a screen. */
function wirePresenterPanel() {
  var panel = $('.presenter-panel');
  if (!panel) return;
  panel.addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]');
    if (!b) return;
    var what = b.getAttribute('data-p');
    var order = (state.orders || [])[0];
    if (what === 'tracker' && order) {
      closeLayers(layers.length, function () {
        openTracker(order.id);
      });
    } else if (what === 'advance' && order) {
      var top = topLayer();
      if (top && top.el.classList.contains('tracker') && top.el._render) {
        trackerAction(order, 'advance', null, top.el);
      } else {
        closeLayers(layers.length, function () {
          var layer = openTracker(order.id);
          trackerAction(order, 'advance', null, layer.el);
        });
      }
    } else if (what === 'appointment') {
      closeLayers(layers.length, function () {
        openAppointment();
      });
    } else if (what === 'events') {
      closeLayers(layers.length, function () {
        openEvents();
      });
    } else if (what === 'product') {
      closeLayers(layers.length, function () {
        openProduct('p03');
      });
    } else if (what === 'reset') {
      ACTIONS['reset-demo']();
    }
  });
}

/* ------------------------------------------------------------------ start */

/** Layout reads the demo label's real height, so a wrapped label never overlaps. */
function syncBannerHeight() {
  var span = $('.demo-strip span');
  if (span) document.documentElement.style.setProperty('--banner-h', span.offsetHeight + 'px');
}

(function start() {
  syncBannerHeight();
  window.addEventListener('resize', syncBannerHeight);
  // Browsers without overflow: clip can still scroll a hidden box into view.
  [device, appEl, layerRoot].forEach(function (el) {
    el.addEventListener('scroll', function () {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  });
  applyTheme();
  seedOrders();
  buildShell();
  updateBagBadges(false);
  updateInert();
  wirePresenterPanel();
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }
  document.documentElement.classList.add('ready');
  window.MX_READY = true;
})();
