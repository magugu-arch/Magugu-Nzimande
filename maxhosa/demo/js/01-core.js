/* ---------------------------------------------------------------------------
 * Core: data, state, persistence, formatting and icons.
 *
 * Everything here is synthetic. MX_DATA is the shared sample catalogue
 * (data/sample-catalogue.json) plus the 24 verified images, folded into the
 * page by scripts/build-offline-demo.mjs.
 * ------------------------------------------------------------------------- */

var DATA = window.MX_DATA;
var DEMO_LINE = 'Concept demo — sample products, sample courier, no real purchase/delivery';

var $ = function (sel, root) {
  return (root || document).querySelector(sel);
};
var $$ = function (sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

var reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/** Vibration where the platform offers it (Android Chrome); silent elsewhere. */
function haptic(kind) {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(kind === 'error' ? [12, 60, 12] : kind === 'success' ? [10, 40, 18] : 8);
  } catch (e) {
    /* ignore */
  }
}

/* ---------------------------------------------------------------- images */

/*
 * Data URIs are decoded once into blob URLs so the DOM carries short strings
 * instead of 40 KB of base64 per <img>. If Blob or URL are unavailable the
 * data URI is used as-is — either way nothing touches the network.
 */
var ASSET_URL = {};
(function () {
  Object.keys(DATA.assets).forEach(function (id) {
    var uri = DATA.assets[id].uri;
    ASSET_URL[id] = uri;
    try {
      var comma = uri.indexOf(',');
      var mime = uri.slice(5, uri.indexOf(';'));
      var bin = atob(uri.slice(comma + 1));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      ASSET_URL[id] = URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch (e) {
      /* keep the data URI */
    }
  });
})();

function assetAlt(id) {
  return DATA.assets[id] ? DATA.assets[id].alt : '';
}

/**
 * An image in a tinted frame. The frame shows until the bitmap has decoded,
 * then the image fades in; if it fails, the frame says so in words.
 */
function media(id, opts) {
  opts = opts || {};
  var alt = opts.decorative ? '' : opts.alt || assetAlt(id);
  return (
    '<div class="media ' +
    (opts.cls || '') +
    '" data-fallback="Image unavailable">' +
    '<img src="' +
    ASSET_URL[id] +
    '" alt="' +
    esc(alt) +
    '" decoding="async"' +
    (opts.eager ? '' : ' loading="lazy"') +
    (opts.position ? ' style="object-position:' + opts.position + '"' : '') +
    ' draggable="false"></div>'
  );
}

document.addEventListener(
  'load',
  function (e) {
    if (e.target.tagName === 'IMG') e.target.classList.add('is-loaded');
  },
  true,
);
document.addEventListener(
  'error',
  function (e) {
    if (e.target.tagName === 'IMG' && e.target.parentNode) e.target.parentNode.classList.add('failed');
  },
  true,
);
function sweepImages(root) {
  $$('img', root).forEach(function (img) {
    if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
  });
}

/* ----------------------------------------------------------------- storage */

/*
 * file:// and content:// pages may refuse storage outright, so every access is
 * guarded and the app runs from memory when it has to.
 */
var store = (function () {
  var memory = {};
  var ok = false;
  try {
    var k = '__mx_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    ok = true;
  } catch (e) {
    ok = false;
  }
  return {
    persistent: ok,
    get: function (key, fallback) {
      try {
        var raw = ok ? window.localStorage.getItem('mx.' + key) : memory[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      var raw = JSON.stringify(value);
      memory[key] = raw;
      if (!ok) return;
      try {
        window.localStorage.setItem('mx.' + key, raw);
      } catch (e) {
        /* quota or policy — memory copy still holds */
      }
    },
    clear: function () {
      memory = {};
      if (!ok) return;
      try {
        Object.keys(window.localStorage)
          .filter(function (k) {
            return k.indexOf('mx.') === 0;
          })
          .forEach(function (k) {
            window.localStorage.removeItem(k);
          });
      } catch (e) {
        /* ignore */
      }
    },
  };
})();

/* ------------------------------------------------------------------- money */

/*
 * Money is { amount: "5400.00", currencyCode: "ZAR" } and is summed in minor
 * units as integers. Floats only appear at the last step, inside Intl.
 */
function toMinor(amount) {
  var parts = String(amount).split('.');
  var whole = parseInt(parts[0], 10) || 0;
  var frac = ((parts[1] || '') + '00').slice(0, 2);
  return whole * 100 + (whole < 0 ? -1 : 1) * parseInt(frac, 10);
}
function fromMinor(minor) {
  var sign = minor < 0 ? '-' : '';
  var abs = Math.abs(minor);
  return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}

function market() {
  return (
    DATA.markets.filter(function (m) {
      return m.id === state.market;
    })[0] || DATA.markets[0]
  );
}

function fmtMoney(amount, m) {
  m = m || market();
  try {
    return new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.currencyCode }).format(Number(amount));
  } catch (e) {
    return m.currencyCode + ' ' + amount;
  }
}

function priceOf(product) {
  return product.price[market().id];
}

/* ---------------------------------------------------------------- dates */

function fmtTime(iso) {
  try {
    return new Intl.DateTimeFormat(market().locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch (e) {
    return iso.slice(11, 16);
  }
}
function fmtDay(iso) {
  try {
    return new Intl.DateTimeFormat(market().locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
      new Date(iso),
    );
  } catch (e) {
    return iso.slice(0, 10);
  }
}
function fmtDayTime(iso) {
  return fmtDay(iso) + ', ' + fmtTime(iso);
}
function isToday(iso) {
  var d = new Date(iso);
  var n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/* ------------------------------------------------------------------ state */

var PRODUCTS = {};
DATA.products.forEach(function (p) {
  PRODUCTS[p.id] = p;
});
var CATEGORIES = {};
DATA.categories.forEach(function (c) {
  CATEGORIES[c.id] = c;
});

function defaultShop() {
  return { q: '', cat: 'all', sizes: [], colours: [], availability: 'any', band: 'any', sort: 'new' };
}

var state = {
  market: store.get('market', 'ZA'),
  bag: store.get('bag', []),
  saved: store.get('saved', []),
  restock: store.get('restock', []),
  orders: store.get('orders', null),
  appointments: store.get('appointments', []),
  notif: store.get('notif', { transactional: false, restock: false, marketing: false }),
  profileSizes: store.get('profileSizes', []),
  theme: store.get('theme', 'system'),
  shop: defaultShop(),
  tab: 'home',
};

function persist() {
  store.set('market', state.market);
  store.set('bag', state.bag);
  store.set('saved', state.saved);
  store.set('restock', state.restock);
  store.set('orders', state.orders);
  store.set('appointments', state.appointments);
  store.set('notif', state.notif);
  store.set('profileSizes', state.profileSizes);
  store.set('theme', state.theme);
}

function stockOf(product, size) {
  for (var i = 0; i < product.sizes.length; i++) if (product.sizes[i].label === size) return product.sizes[i].stock;
  return 'unavailable';
}

/** One summary line for a product, built only from its own sample data. */
function availabilitySummary(product) {
  var stocks = product.sizes.map(function (s) {
    return s.stock;
  });
  var any = function (k) {
    return stocks.indexOf(k) !== -1;
  };
  if (any('available') && !any('unavailable') && !any('preorder')) return { tone: 'ok', label: 'Available' };
  if (any('available')) return { tone: 'ok', label: 'Available in some sizes' };
  if (any('preorder')) return { tone: 'warn', label: 'Pre-order' };
  return { tone: 'bad', label: 'Unavailable' };
}

function availabilityTag(product) {
  var a = availabilitySummary(product);
  return '<span class="tag ' + a.tone + '">' + icon(a.tone === 'bad' ? 'minus' : a.tone === 'warn' ? 'clock' : 'check') + esc(a.label) + '</span>';
}

/* ------------------------------------------------------------------ icons */

/*
 * One stroke weight, one corner style, drawn on a 24-unit grid so they sit
 * with the system font the way SF Symbols do.
 */
var ICONS = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.3 4.2 4.2 0 0 1 19.5 10C19.5 15.6 12 20 12 20Z"/>',
  heartFill:
    '<path fill="currentColor" d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.3 4.2 4.2 0 0 1 19.5 10C19.5 15.6 12 20 12 20Z"/>',
  person: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8"/>',
  bag: '<path d="M5.5 8h13l-1 12h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  share: '<path d="M12 3.5v11"/><path d="m8 7 4-3.5L16 7"/><path d="M7 10.5H5.5v9.5h13v-9.5H17"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  truck: '<path d="M3 6.5h11v10H3z"/><path d="M14 10h4l3 3v3.5h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  box: '<path d="m12 3 8 4v10l-8 4-8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5Z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7"/><circle cx="12" cy="16.8" r=".4" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".4" fill="currentColor"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".4" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  message: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5H4.5z"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  video: '<rect x="3.5" y="6.5" width="12" height="11" rx="2"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
  store: '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5"/><path d="M5.5 12v8h13v-8"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="m9 12 2.2 2.2L15 10.4"/>',
  external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17 13.5v6H4.5V7H10"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  sparkle: '<path d="M12 3.5c.6 4.5 2.2 6.4 6.5 7.5-4.3 1.1-5.9 3-6.5 8.5-.6-5.5-2.2-7.4-6.5-8.5 4.3-1.1 5.9-3 6.5-7.5Z"/>',
  contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  refresh: '<path d="M19.5 8.5A8 8 0 0 0 5 9M4.5 15.5A8 8 0 0 0 19 15"/><path d="M19.5 4v4.5H15M4.5 20v-4.5H9"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3c0 1.1-.9 2-2 2A16.5 16.5 0 0 1 4.5 5.5c0-1.1.9-2 2-2Z"/>',
  house: '<path d="M4.5 11 12 4.5l7.5 6.5V20h-15z"/><path d="M10 20v-5h4v5"/>',
};

function icon(name, label) {
  var body = ICONS[name] || '';
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' +
    (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true" focusable="false"') +
    '>' +
    body +
    '</svg>'
  );
}
