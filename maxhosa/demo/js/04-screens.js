/* ---------------------------------------------------------------------------
 * Screens: the five tabs, product detail, stories, bag and checkout.
 * ------------------------------------------------------------------------- */

var OFFICIAL_SITE = 'https://maxhosa.africa/';
var PLACEHOLDER_COPY =
  'Editorial placeholder — awaiting brand-approved copy. Collection stories, motif meanings and cultural context are published only from text MAXHOSA AFRICA has approved.';

var TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'shop', label: 'Shop', icon: 'grid' },
  { id: 'discover', label: 'Discover', icon: 'compass' },
  { id: 'saved', label: 'Saved', icon: 'heart' },
  { id: 'account', label: 'Account', icon: 'person' },
];

/* ---------------------------------------------------------------- bag */

function bagCount() {
  return state.bag.reduce(function (n, l) {
    return n + l.quantity;
  }, 0);
}

function bagLines() {
  return state.bag
    .filter(function (l) {
      return PRODUCTS[l.productId];
    })
    .map(function (l) {
      var p = PRODUCTS[l.productId];
      var unit = priceOf(p);
      return {
        line: l,
        product: p,
        unit: unit,
        total: fromMinor(toMinor(unit) * l.quantity),
        stock: stockOf(p, l.size),
      };
    });
}

function bagSubtotal() {
  return fromMinor(
    bagLines().reduce(function (sum, x) {
      return sum + toMinor(x.total);
    }, 0),
  );
}

/** Every bag badge on the page counts up together, with one small spring. */
function updateBagBadges(bump) {
  var n = bagCount();
  $$('[data-bag-badge]').forEach(function (b) {
    b.textContent = n;
    b.hidden = !n;
    var btn = b.parentNode;
    btn.setAttribute('aria-label', 'Bag, ' + n + (n === 1 ? ' item' : ' items'));
    if (bump && n && !reducedMotion.matches) {
      var s = new Spring(1.35, function (v) {
        b.style.transform = 'scale(' + v + ')';
      }, 0.002);
      s.to(1, { velocity: -2, config: SPRING.snappy });
    }
  });
}

function isSaved(pid) {
  return state.saved.indexOf(pid) !== -1;
}

function saveButton(p, onMedia) {
  var on = isSaved(p.id);
  return (
    '<button class="icon-btn save-btn' +
    (onMedia ? ' on-media' : '') +
    '" data-action="toggle-save" data-id="' +
    p.id +
    '" data-save="' +
    p.id +
    '" aria-pressed="' +
    on +
    '" aria-label="Save ' +
    esc(p.name) +
    '">' +
    icon(on ? 'heartFill' : 'heart') +
    '</button>'
  );
}

function syncSaveButtons(pid) {
  var on = isSaved(pid);
  $$('[data-save="' + pid + '"]').forEach(function (b) {
    b.setAttribute('aria-pressed', on);
    b.innerHTML = icon(on ? 'heartFill' : 'heart');
  });
}

/* ------------------------------------------------------------ products */

function productCard(p, opts) {
  opts = opts || {};
  var price = fmtMoney(priceOf(p));
  var avail = availabilitySummary(p);
  return (
    '<article class="pcard">' +
    '<button class="card-link" data-action="open-product" data-id="' +
    p.id +
    '" aria-label="' +
    esc(p.name + ', ' + price + ', ' + avail.label + ', sample product') +
    '">' +
    media(p.media[0], { decorative: true, eager: opts.eager }) +
    '<div class="pcard-body"><div class="pcard-name">' +
    esc(p.name) +
    '</div><div class="pcard-price">' +
    esc(price) +
    '</div>' +
    availabilityTag(p) +
    '</div></button>' +
    saveButton(p) +
    '</article>'
  );
}

function newestFirst(list) {
  return list.slice().sort(function (a, b) {
    return a.released < b.released ? 1 : -1;
  });
}

/* ----------------------------------------------------------- tab shell */

function buildShell() {
  var html = TABS.map(function (t) {
    return (
      '<section class="screen tab-screen" id="tab-' +
      t.id +
      '" aria-label="' +
      t.label +
      '"' +
      (t.id === state.tab ? '' : ' hidden') +
      '></section>'
    );
  }).join('');
  html +=
    '<nav class="tabbar" aria-label="Primary"><ul>' +
    TABS.map(function (t) {
      return (
        '<li><button class="tab" data-action="tab" data-tab="' +
        t.id +
        '"' +
        (t.id === state.tab ? ' aria-current="page"' : '') +
        '>' +
        icon(t.icon) +
        '<span>' +
        t.label +
        '</span><i class="tab-dot" aria-hidden="true"></i></button></li>'
      );
    }).join('') +
    '</ul></nav>';
  appEl.innerHTML = html;
  TABS.forEach(function (t) {
    renderTab(t.id);
  });
}

var tabChrome = {};

function renderTab(id) {
  var screen = $('#tab-' + id);
  var keep = $('.scroller', screen) ? $('.scroller', screen).scrollTop : 0;
  var r = TAB_RENDERERS[id]();
  screen.innerHTML =
    navbarHTML(r.navbar) +
    '<div class="scroller' +
    (r.underHeader ? ' under-header' : '') +
    '">' +
    r.body +
    '</div><div class="dim"></div>';
  var scroller = $('.scroller', screen);
  scroller.scrollTop = keep;
  tabChrome[id] = bindScrollEffects(screen, r.underHeader ? 'media' : 'large');
  if (r.after) r.after(screen);
  sweepImages(screen);
}

function switchTab(id) {
  if (id === state.tab) {
    // Tapping the current tab returns to the top, as on iOS.
    var sc = $('#tab-' + id + ' .scroller');
    if (sc) sc.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    return;
  }
  state.tab = id;
  $$('.tab-screen').forEach(function (s) {
    s.hidden = s.id !== 'tab-' + id;
  });
  $$('.tab').forEach(function (b) {
    if (b.getAttribute('data-tab') === id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (id === 'saved' || id === 'account') renderTab(id);
  if (tabChrome[id]) tabChrome[id]();
}

function largeTitle(title, sub) {
  return '<div class="large-title"><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
}

var TAB_RENDERERS = {
  home: function () {
    var newest = newestFirst(DATA.products).slice(0, 6);
    var availableNow = DATA.products.filter(function (p) {
      return p.sizes.some(function (s) {
        return s.stock === 'available';
      });
    });
    return {
      underHeader: true,
      navbar: {
        overMedia: true,
        title: '',
        start:
          '<button class="icon-btn on-media" data-action="search" aria-label="Search the shop">' + icon('search') + '</button>',
        end: bagButton(true),
        center: '<span class="wordmark" title="Wordmark placeholder — supply the approved MAXHOSA AFRICA logo">MAXHOSA AFRICA</span>',
      },
      body:
        '<div class="hero" data-parallax>' +
        '<img src="' +
        ASSET_URL['mx-asset-10'] +
        '" alt="' +
        esc(assetAlt('mx-asset-10')) +
        '" draggable="false">' +
        '<div class="hero-copy"><span class="eyebrow">Sample campaign · concept imagery</span>' +
        '<h1>A considered way to discover, wear and experience MAXHOSA AFRICA.</h1>' +
        '<div class="hero-actions"><button class="btn btn-light" data-action="open-story" data-id="s1">Explore the collection</button>' +
        '<button class="btn btn-glass" data-action="shop-new">Shop new arrivals</button></div></div></div>' +
        liveOrderCard() +
        '<section class="section" aria-labelledby="h-cats"><div class="section-head"><h2 id="h-cats">Shop by category</h2></div>' +
        '<div class="rail cats">' +
        DATA.categories
          .map(function (c) {
            return (
              '<button class="cat-card card-link" data-action="shop-category" data-id="' +
              c.id +
              '">' +
              '<img src="' +
              ASSET_URL[c.asset] +
              '" alt="" loading="lazy" draggable="false"><span>' +
              esc(c.label) +
              '</span></button>'
            );
          })
          .join('') +
        '</div></section>' +
        '<section class="section" aria-labelledby="h-new"><div class="section-head"><h2 id="h-new">New arrivals</h2>' +
        '<button class="link-btn" data-action="shop-new">See all</button></div>' +
        '<div class="rail">' +
        newest
          .map(function (p) {
            return productCard(p);
          })
          .join('') +
        '</div></section>' +
        '<section class="section" aria-labelledby="h-story"><div class="section-head"><h2 id="h-story">From the journal</h2></div>' +
        '<div style="padding:0 var(--gutter)">' +
        storyCard(DATA.stories[1]) +
        '</div></section>' +
        '<section class="section" aria-labelledby="h-appt"><div class="section-head"><h2 id="h-appt">Private styling</h2></div>' +
        '<div class="group"><button class="row" data-action="open-appointment">' +
        '<span class="row-icon">' +
        icon('calendar') +
        '</span><span class="row-main"><span class="row-title">Request a styling appointment</span>' +
        '<span class="row-sub" style="display:block">Studio visit, personal or virtual styling — sample availability in this demo.</span></span>' +
        '<span class="row-end">' +
        icon('chevronRight') +
        '</span></button></div></section>' +
        '<section class="section" aria-labelledby="h-avail"><div class="section-head"><h2 id="h-avail">Available now</h2>' +
        '<button class="link-btn" data-action="shop-available">See all</button></div>' +
        '<div class="rail">' +
        availableNow
          .slice(0, 6)
          .map(function (p) {
            return productCard(p);
          })
          .join('') +
        '</div></section>' +
        homeFooter(),
    };
  },

  shop: function () {
    return {
      navbar: { title: 'Shop', end: bagButton(false) },
      body:
        largeTitle('Shop', 'Sample catalogue · prices in ' + esc(market().currencyCode)) +
        '<div class="search-wrap"><label class="search" for="shop-q">' +
        icon('search') +
        '<span class="visually-hidden">Search the shop</span>' +
        '<input id="shop-q" type="search" inputmode="search" autocomplete="off" enterkeyhint="search" placeholder="Search name, code, colour" value="' +
        esc(state.shop.q) +
        '"><button class="clear" data-action="clear-search" aria-label="Clear search"' +
        (state.shop.q ? '' : ' hidden') +
        '>' +
        icon('close') +
        '</button></label></div>' +
        '<div class="chips" role="radiogroup" aria-label="Category">' +
        [{ id: 'all', label: 'All' }]
          .concat(DATA.categories)
          .map(function (c) {
            return (
              '<button class="chip" role="radio" data-action="shop-cat" data-id="' +
              c.id +
              '" aria-checked="' +
              (state.shop.cat === c.id) +
              '">' +
              esc(c.label) +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="result-bar"><span id="shop-count" aria-live="polite"></span>' +
        '<button class="chip" data-action="open-filters" id="shop-filter-btn">' +
        icon('sliders') +
        '<span>Filter &amp; sort</span></button></div>' +
        '<div id="shop-results"></div>',
      after: function (screen) {
        var input = $('#shop-q', screen);
        input.addEventListener('input', function () {
          state.shop.q = input.value;
          if (!state.shop.q && state.shop.sort === 'relevance') state.shop.sort = 'new';
          $('[data-action="clear-search"]', screen).hidden = !input.value;
          updateShop();
        });
        updateShop();
      },
    };
  },

  discover: function () {
    return {
      navbar: { title: 'Discover', end: bagButton(false) },
      body:
        largeTitle('Discover', 'Stories, lookbooks and private styling') +
        '<div style="padding:0 var(--gutter)">' +
        DATA.stories.map(storyCard).join('') +
        '</div>' +
        '<section class="section" aria-labelledby="h-events" style="padding-top:0.5rem"><div class="section-head"><h2 id="h-events">Events</h2></div>' +
        '<div class="group"><div class="empty" style="padding:2rem 1rem">' +
        '<span class="empty-icon">' +
        icon('calendar') +
        '</span><h3>No events in this demo</h3>' +
        '<p>Event listings, RSVPs and capacity come from MAXHOSA AFRICA’s event system once it is connected.</p></div></div></section>' +
        '<section class="section" aria-labelledby="h-styling"><div class="section-head"><h2 id="h-styling">Styling</h2></div>' +
        '<div class="group"><button class="row" data-action="open-appointment"><span class="row-icon">' +
        icon('sparkle') +
        '</span><span class="row-main"><span class="row-title">Book time with a stylist</span>' +
        '<span class="row-sub" style="display:block">Send an enquiry — client care confirms the time.</span></span><span class="row-end">' +
        icon('chevronRight') +
        '</span></button></div></section>',
    };
  },

  saved: function () {
    var saved = state.saved
      .map(function (id) {
        return PRODUCTS[id];
      })
      .filter(Boolean);
    var restock = state.restock.filter(function (r) {
      return PRODUCTS[r.productId];
    });
    var body = largeTitle('Saved', saved.length ? saved.length + (saved.length === 1 ? ' piece' : ' pieces') + ' on this device' : '');
    if (!saved.length) {
      body += emptyState(
        'heart',
        'Nothing saved yet',
        'Tap the heart on any piece to keep it here. In this demo, saved pieces stay on this device.',
        '<button class="btn btn-primary" data-action="tab" data-tab="shop">Browse the shop</button>',
      );
    } else {
      body += '<div class="grid">' + saved.map(function (p) {
        return productCard(p);
      }).join('') + '</div>';
    }
    if (restock.length) {
      body +=
        '<div class="group-title">Restock requests</div><div class="group">' +
        restock
          .map(function (r) {
            var p = PRODUCTS[r.productId];
            return (
              '<div class="row"><span class="row-icon">' +
              icon('bell') +
              '</span><span class="row-main"><span class="row-title">' +
              esc(p.name) +
              ' · ' +
              esc(r.size) +
              '</span><span class="row-sub" style="display:block">Demo — no alert will be sent.</span></span>' +
              '<button class="link-btn" data-action="remove-restock" data-id="' +
              p.id +
              '" data-size="' +
              esc(r.size) +
              '">Remove</button></div>'
            );
          })
          .join('') +
        '</div>';
    }
    body +=
      '<div class="group-title">Alerts</div><div class="group"><button class="row" data-action="open-notifications"><span class="row-icon">' +
      icon('bell') +
      '</span><span class="row-main"><span class="row-title">Restock and collection alerts</span><span class="row-sub" style="display:block">Choose what you hear about. Off until you switch them on.</span></span><span class="row-end">' +
      icon('chevronRight') +
      '</span></button></div>';
    return { navbar: { title: 'Saved', end: bagButton(false) }, body: body };
  },

  account: function () {
    var m = market();
    var orders = state.orders || [];
    return {
      navbar: { title: 'Account', end: bagButton(false) },
      body:
        largeTitle('Account') +
        '<div class="group"><div class="row no-icon" style="align-items:flex-start;flex-direction:column;gap:0.5rem;padding:1rem">' +
        '<span class="row-title">Browsing as a guest</span>' +
        '<span class="row-sub">Accounts use MAXHOSA AFRICA’s customer-account provider, which isn’t connected in this demo. Guest checkout stays available.</span>' +
        '<button class="btn btn-secondary" data-action="signin-demo" style="margin-top:0.25rem">Sign in</button></div></div>' +
        '<div class="group-title">Orders and bookings</div><div class="group">' +
        accountRow('box', 'Orders', orders.length + (orders.length === 1 ? ' sample order' : ' sample orders'), 'open-orders') +
        accountRow(
          'calendar',
          'Styling appointments',
          state.appointments.length ? state.appointments.length + ' enquiry sent (demo)' : 'Request a time with a stylist',
          'open-appointment',
        ) +
        '</div>' +
        '<div class="group-title">Shopping</div><div class="group">' +
        accountRow('globe', 'Market and currency', m.label + ' · ' + m.currencyCode, 'open-market') +
        accountRow('ruler', 'Sizes and preferences', state.profileSizes.length ? state.profileSizes.join(', ') : 'Optional', 'open-sizes') +
        accountRow('bell', 'Notifications', notifSummary(), 'open-notifications') +
        '</div>' +
        '<div class="group-title">Help</div><div class="group">' +
        accountRow('help', 'Help and client care', 'FAQs and contact options', 'open-help') +
        accountRow('store', 'Stores', 'Verified locations load from MAXHOSA', 'open-stores') +
        accountRow('external', 'Policies and FAQs', 'On maxhosa.africa · needs internet', 'external') +
        '</div>' +
        '<div class="group-title">Privacy</div><div class="group">' +
        accountRow('shield', 'Privacy and your data', 'Download or delete — via the account provider', 'open-privacy') +
        '</div>' +
        '<div class="group-title">Appearance</div><div class="group"><div class="row no-icon"><span class="row-main"><span class="row-title">Theme</span></span>' +
        '<div class="segmented" role="radiogroup" aria-label="Theme" style="min-width:12rem">' +
        ['system', 'light', 'dark']
          .map(function (t) {
            return (
              '<button role="radio" data-action="theme" data-id="' +
              t +
              '" aria-checked="' +
              (state.theme === t) +
              '">' +
              t.charAt(0).toUpperCase() +
              t.slice(1) +
              '</button>'
            );
          })
          .join('') +
        '</div></div></div>' +
        '<div class="group-title">This demo</div><div class="group">' +
        accountRow('info', 'What is real in this demo', 'Sample data, simulated services', 'open-about') +
        accountRow('refresh', 'Reset demo', 'Clears bag, saved pieces and sample orders', 'reset-demo') +
        '</div>' +
        '<p class="note" style="padding:1.25rem var(--gutter) 0">Storage: ' +
        (store.persistent ? 'saved on this device' : 'memory only — this browser blocks storage for local files') +
        '.</p>',
    };
  },
};

function accountRow(iconName, title, sub, action) {
  return (
    '<button class="row" data-action="' +
    action +
    '"><span class="row-icon">' +
    icon(iconName) +
    '</span><span class="row-main"><span class="row-title">' +
    esc(title) +
    '</span><span class="row-sub" style="display:block">' +
    esc(sub) +
    '</span></span><span class="row-end">' +
    icon(action === 'external' ? 'external' : 'chevronRight') +
    '</span></button>'
  );
}

function notifSummary() {
  var on = ['transactional', 'restock', 'marketing'].filter(function (k) {
    return state.notif[k];
  }).length;
  return on ? on + ' of 3 on' : 'All off';
}

function emptyState(iconName, title, text, action) {
  return (
    '<div class="empty"><span class="empty-icon">' +
    icon(iconName) +
    '</span><h3>' +
    esc(title) +
    '</h3><p>' +
    esc(text) +
    '</p>' +
    (action || '') +
    '</div>'
  );
}

function homeFooter() {
  return (
    '<footer class="section" style="padding:2.5rem var(--gutter) 0">' +
    '<div class="placeholder-copy"><strong>About this demo.</strong> ' +
    esc(DEMO_LINE) +
    '. Images are concept assets, not approved product photography. Prices, sizes and stock are invented to show how the real catalogue will read.</div>' +
    '<p class="note" style="margin-top:1rem"><button class="link-btn" data-action="external">Current policies on maxhosa.africa ' +
    icon('external') +
    '</button></p></footer>'
  );
}

function storyCard(s) {
  return (
    '<button class="story-card" data-action="open-story" data-id="' +
    s.id +
    '">' +
    media(s.hero, { decorative: true }) +
    '<div class="story-meta"><span class="eyebrow">' +
    esc(s.kind) +
    ' · placeholder copy</span><h3>' +
    esc(s.title) +
    '</h3></div></button>'
  );
}

/* ------------------------------------------------------------- shop */

var PRICE_BANDS = {
  ZA: [
    { id: 'low', label: 'Under R1 000', min: 0, max: 100000 },
    { id: 'mid', label: 'R1 000 – R4 000', min: 100000, max: 400000 },
    { id: 'high', label: 'Over R4 000', min: 400000, max: Infinity },
  ],
  GB: [
    { id: 'low', label: 'Under £50', min: 0, max: 5000 },
    { id: 'mid', label: '£50 – £200', min: 5000, max: 20000 },
    { id: 'high', label: 'Over £200', min: 20000, max: Infinity },
  ],
  US: [
    { id: 'low', label: 'Under $60', min: 0, max: 6000 },
    { id: 'mid', label: '$60 – $240', min: 6000, max: 24000 },
    { id: 'high', label: 'Over $240', min: 24000, max: Infinity },
  ],
};

var SORTS = [
  { id: 'new', label: 'New arrivals' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'relevance', label: 'Best match' },
];

function searchScore(p, q) {
  var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  var fields = [p.name, p.code, CATEGORIES[p.category].label, p.colours.join(' ')].join(' ').toLowerCase();
  var score = 0;
  for (var i = 0; i < terms.length; i++) {
    if (fields.indexOf(terms[i]) === -1) return 0;
    score += p.name.toLowerCase().indexOf(terms[i]) !== -1 ? 3 : 1;
  }
  return score;
}

function filteredProducts(f) {
  f = f || state.shop;
  var band = (PRICE_BANDS[market().id] || []).filter(function (b) {
    return b.id === f.band;
  })[0];
  var list = DATA.products
    .map(function (p) {
      return { p: p, score: searchScore(p, f.q) };
    })
    .filter(function (x) {
      var p = x.p;
      if (!x.score) return false;
      if (f.cat !== 'all' && p.category !== f.cat) return false;
      if (f.sizes.length) {
        var fits = p.sizes.some(function (s) {
          return f.sizes.indexOf(s.label) !== -1 && s.stock !== 'unavailable';
        });
        if (!fits) return false;
      }
      if (f.colours.length) {
        var hit = p.colours.some(function (c) {
          return f.colours.indexOf(c) !== -1;
        });
        if (!hit) return false;
      }
      if (f.availability === 'available' && !p.sizes.some(function (s) {
        return s.stock === 'available';
      })) return false;
      if (f.availability === 'preorder' && !p.sizes.some(function (s) {
        return s.stock === 'preorder';
      })) return false;
      if (band) {
        var minor = toMinor(priceOf(p));
        if (minor < band.min || minor >= band.max) return false;
      }
      return true;
    });
  list.sort(function (a, b) {
    if (f.sort === 'price-asc') return toMinor(priceOf(a.p)) - toMinor(priceOf(b.p));
    if (f.sort === 'price-desc') return toMinor(priceOf(b.p)) - toMinor(priceOf(a.p));
    if (f.sort === 'relevance' && f.q) return b.score - a.score;
    return a.p.released < b.p.released ? 1 : -1;
  });
  return list.map(function (x) {
    return x.p;
  });
}

function activeFilterCount() {
  var f = state.shop;
  return f.sizes.length + f.colours.length + (f.availability !== 'any' ? 1 : 0) + (f.band !== 'any' ? 1 : 0);
}

function updateShop() {
  var screen = $('#tab-shop');
  if (!screen) return;
  var list = filteredProducts();
  var results = $('#shop-results', screen);
  var n = activeFilterCount();
  $('#shop-count', screen).textContent =
    list.length + (list.length === 1 ? ' piece' : ' pieces') + ' · ' + SORTS.filter(function (s) {
      return s.id === state.shop.sort;
    })[0].label;
  $('#shop-filter-btn span', screen).textContent = n ? 'Filter & sort · ' + n : 'Filter & sort';
  $$('[data-action="shop-cat"]', screen).forEach(function (c) {
    c.setAttribute('aria-checked', c.getAttribute('data-id') === state.shop.cat);
  });
  if (!list.length) {
    results.innerHTML = emptyState(
      'search',
      'No pieces match',
      state.shop.q ? 'Nothing matches “' + state.shop.q + '” with these filters. Try fewer words or clear the filters.' : 'Nothing matches these filters.',
      '<button class="btn btn-secondary" data-action="clear-filters">Clear search and filters</button>',
    );
  } else {
    results.innerHTML =
      '<div class="grid">' +
      list
        .map(function (p, i) {
          return productCard(p, { eager: i < 4 });
        })
        .join('') +
      '</div>';
  }
  sweepImages(results);
}

function openFilters() {
  var draft = JSON.parse(JSON.stringify(state.shop));
  var sizes = [];
  DATA.products.forEach(function (p) {
    p.sizes.forEach(function (s) {
      if (sizes.indexOf(s.label) === -1) sizes.push(s.label);
    });
  });
  var bands = PRICE_BANDS[market().id] || [];

  function group(title, html) {
    return '<div class="field"><span class="label">' + title + '</span><div class="chips" style="flex-wrap:wrap;padding:0;overflow:visible">' + html + '</div></div>';
  }
  function chip(kind, id, label, on, radio) {
    return (
      '<button class="chip" ' +
      (radio ? 'role="radio" aria-checked="' : 'aria-pressed="') +
      on +
      '" data-f="' +
      kind +
      '" data-v="' +
      esc(id) +
      '">' +
      label +
      '</button>'
    );
  }

  var sheet = openSheet({
    title: 'Filter and sort',
    detent: 'large',
    body: function (body) {
      body.innerHTML =
        group(
          'Sort',
          SORTS.map(function (s) {
            var disabled = s.id === 'relevance' && !draft.q;
            return disabled ? '' : chip('sort', s.id, s.label, draft.sort === s.id, true);
          }).join(''),
        ) +
        group(
          'Size available',
          sizes
            .map(function (s) {
              return chip('sizes', s, esc(s), draft.sizes.indexOf(s) !== -1);
            })
            .join(''),
        ) +
        group(
          'Colour',
          DATA.colours
            .map(function (c) {
              return chip('colours', c, esc(c), draft.colours.indexOf(c) !== -1);
            })
            .join(''),
        ) +
        group(
          'Availability',
          [
            ['any', 'Any'],
            ['available', 'Available now'],
            ['preorder', 'Pre-order'],
          ]
            .map(function (a) {
              return chip('availability', a[0], a[1], draft.availability === a[0], true);
            })
            .join(''),
        ) +
        group(
          'Price · ' + esc(market().currencyCode),
          [{ id: 'any', label: 'Any' }]
            .concat(bands)
            .map(function (b) {
              return chip('band', b.id, esc(b.label), draft.band === b.id, true);
            })
            .join(''),
        ) +
        '<p class="note">Facets reflect the sample catalogue. In production each one appears only when the commerce platform supplies that data.</p>';
    },
    foot: function (foot) {
      var n = filteredProducts(draft).length;
      foot.innerHTML =
        '<div style="display:flex;gap:0.625rem"><button class="btn btn-secondary" data-f-clear>Clear</button>' +
        '<button class="btn btn-primary" style="flex:1" data-f-apply>' +
        (n ? 'Show ' + n + (n === 1 ? ' piece' : ' pieces') : 'No pieces match') +
        '</button></div>';
    },
  });

  sheet.el.addEventListener('click', function (e) {
    var c = e.target.closest('[data-f]');
    if (c) {
      var kind = c.getAttribute('data-f');
      var v = c.getAttribute('data-v');
      if (kind === 'sizes' || kind === 'colours') {
        var arr = draft[kind];
        var i = arr.indexOf(v);
        if (i === -1) arr.push(v);
        else arr.splice(i, 1);
      } else {
        draft[kind] = v;
      }
      var keep = sheet.body.scrollTop;
      sheet.rerender();
      sheet.body.scrollTop = keep;
      return;
    }
    if (e.target.closest('[data-f-clear]')) {
      var q = draft.q;
      var cat = draft.cat;
      draft = defaultShop();
      draft.q = q;
      draft.cat = cat;
      sheet.rerender();
      return;
    }
    if (e.target.closest('[data-f-apply]')) {
      state.shop = draft;
      updateShop();
      sheet.close();
    }
  });
}

/* ------------------------------------------------------------- product */

function openProduct(pid) {
  var p = PRODUCTS[pid];
  if (!p) return;
  var sel = { size: null };
  var layer = pushScreen({
    title: p.name,
    media: true,
    end:
      saveButton(p, true) +
      '<button class="icon-btn on-media" data-action="share" data-id="' +
      p.id +
      '" aria-label="Share">' +
      icon('share') +
      '</button>',
    actionBar:
      '<button class="btn btn-primary" data-action="add-to-bag" data-id="' +
      p.id +
      '"><span class="btn-label">Add to bag · ' +
      esc(fmtMoney(priceOf(p))) +
      '</span></button>',
    render: function (el) {
      var sc = $('.scroller', el);
      var guide = p.sizeGuide ? DATA.sizeGuides[p.sizeGuide] : null;
      sc.innerHTML =
        '<div class="gallery" data-parallax>' +
        '<div class="gallery-track" tabindex="0" aria-label="Product images" role="group">' +
        p.media
          .map(function (id, i) {
            return (
              '<div class="gallery-slide"><button data-action="zoom" data-id="' +
              id +
              '" aria-label="Image ' +
              (i + 1) +
              ' of ' +
              p.media.length +
              ': ' +
              esc(assetAlt(id)) +
              ' Opens zoom.">' +
              '<img src="' +
              ASSET_URL[id] +
              '" alt="" draggable="false"' +
              (i ? ' loading="lazy"' : '') +
              '></button></div>'
            );
          })
          .join('') +
        '</div>' +
        (p.media.length > 1
          ? '<div class="gallery-dots" aria-hidden="true">' +
            p.media
              .map(function (id, i) {
                return '<i' + (i ? '' : ' class="on"') + '></i>';
              })
              .join('') +
            '</div>'
          : '') +
        '</div>' +
        '<div class="pdp-body">' +
        '<div style="display:flex;gap:0.375rem;flex-wrap:wrap"><span class="tag sample">Sample product</span><span class="tag sample">Concept image</span></div>' +
        '<h1>' +
        esc(p.name) +
        '</h1>' +
        '<div class="price-line"><strong data-price>' +
        esc(fmtMoney(priceOf(p))) +
        '</strong><span class="meta">Sample price · ' +
        esc(market().label) +
        '</span></div>' +
        '<div class="meta" style="margin-top:0.25rem">Style code ' +
        esc(p.code) +
        ' · ' +
        esc(CATEGORIES[p.category].label) +
        '</div>' +
        '<div class="size-head"><h2 id="size-label-' +
        p.id +
        '">Size</h2>' +
        (guide
          ? '<button class="link-btn" data-action="size-guide" data-id="' + p.id + '">' + icon('ruler') + ' Size guide</button>'
          : '') +
        '</div>' +
        '<div class="sizes" role="radiogroup" aria-labelledby="size-label-' +
        p.id +
        '" aria-describedby="size-status-' +
        p.id +
        '">' +
        p.sizes
          .map(function (s) {
            var mine = state.profileSizes.indexOf(s.label) !== -1;
            var stockWord = s.stock === 'available' ? 'available' : s.stock === 'preorder' ? 'pre-order' : 'unavailable';
            return (
              '<button class="chip' +
              (s.stock === 'unavailable' ? ' is-unavailable' : '') +
              '" role="radio" aria-checked="false" data-size="' +
              esc(s.label) +
              '" aria-label="' +
              esc(s.label + ', ' + stockWord + (mine ? ', your saved size' : '')) +
              '">' +
              (s.stock === 'preorder' ? icon('clock') : '') +
              esc(s.label) +
              (mine ? ' <i class="mine" aria-hidden="true"></i>' : '') +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        (p.sizes.some(function (s) {
          return s.stock !== 'available';
        })
          ? '<div class="size-legend" aria-hidden="true">' +
            (p.sizes.some(function (s) {
              return s.stock === 'preorder';
            })
              ? '<span>' + icon('clock') + 'Pre-order</span>'
              : '') +
            (p.sizes.some(function (s) {
              return s.stock === 'unavailable';
            })
              ? '<span><s>XL</s> Unavailable</span>'
              : '') +
            '</div>'
          : '') +
        '<div class="size-status" id="size-status-' +
        p.id +
        '" aria-live="polite">Choose a size to see its availability. Nothing is pre-selected.</div>' +
        '<div class="callout">' +
        icon('truck') +
        '<div><p><strong>Delivery and returns</strong></p><p>Delivery options, costs, duties and taxes for ' +
        esc(market().label) +
        ' are worked out by checkout for your address. This demo does not quote them.</p>' +
        '<p><button class="link-btn" data-action="external">Current delivery and returns policies ' +
        icon('external') +
        '</button></p></div></div>' +
        '<div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap">' +
        '<button class="btn btn-secondary" data-action="ask-stylist" data-id="' +
        p.id +
        '">' +
        icon('message') +
        'Ask a stylist</button></div>' +
        '<div class="accordion">' +
        accordionItem('Details', '<p>Sample data: ' + esc(p.colours.join(', ')) + ' colourway. Fabric, composition and origin are shown here only when MAXHOSA’s product data confirms them.</p>') +
        accordionItem('Care', '<p>Care instructions come from the product record. None are shown for sample products.</p>') +
        accordionItem('The story', '<p class="placeholder-copy">' + esc(PLACEHOLDER_COPY) + '</p>') +
        '</div>' +
        (p.pairsWith && p.pairsWith.length
          ? '<section class="section" style="padding-top:1.75rem"><div class="section-head" style="padding:0 0 0.75rem"><h2>Complete the look</h2><span class="tag sample">Curated pairing · sample</span></div>' +
            '<div class="rail" style="margin:0 calc(-1 * var(--gutter))">' +
            p.pairsWith
              .map(function (id) {
                return PRODUCTS[id] ? productCard(PRODUCTS[id]) : '';
              })
              .join('') +
            '</div></section>'
          : '') +
        '</div>';

      // Gallery pager dots follow the scroll position continuously.
      var track = $('.gallery-track', el);
      var dots = $$('.gallery-dots i', el);
      track.addEventListener(
        'scroll',
        function () {
          var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
          dots.forEach(function (d, k) {
            d.classList.toggle('on', k === i);
          });
        },
        { passive: true },
      );

      el.addEventListener('click', function (e) {
        var chip = e.target.closest('.sizes .chip');
        if (chip) chooseSize(el, p, sel, chip.getAttribute('data-size'));
      });
      el._sel = sel;
    },
  });
  return layer;
}

function chooseSize(el, p, sel, size) {
  sel.size = size;
  var stock = stockOf(p, size);
  $$('.sizes .chip', el).forEach(function (c) {
    c.setAttribute('aria-checked', c.getAttribute('data-size') === size);
  });
  $('.sizes', el).classList.remove('needs-choice');
  var status = $('.size-status', el);
  status.classList.remove('error');
  if (stock === 'available') {
    status.innerHTML = icon('check') + '<span>' + esc(size) + ' is available (sample stock).</span>';
  } else if (stock === 'preorder') {
    status.innerHTML =
      icon('clock') +
      '<span>' +
      esc(size) +
      ' is pre-order. Sample lead time ' +
      esc(p.preorderLeadTime || 'to be confirmed') +
      ' — the real lead time comes from MAXHOSA before you pay.</span>';
  } else {
    status.innerHTML =
      icon('minus') + '<span>' + esc(size) + ' is unavailable. You can ask to hear if it returns (demo — nothing is sent).</span>';
  }
  var label = $('.action-bar .btn-label', el);
  var requested = state.restock.some(function (r) {
    return r.productId === p.id && r.size === size;
  });
  label.textContent =
    stock === 'unavailable'
      ? requested
        ? 'Restock requested'
        : 'Tell me if it returns'
      : (stock === 'preorder' ? 'Pre-order · ' : 'Add to bag · ') + fmtMoney(priceOf(p));
}

function addToBag(pid, el) {
  var p = PRODUCTS[pid];
  var sel = el._sel;
  var btn = $('.action-bar .btn', el);
  if (!sel.size) {
    var sizes = $('.sizes', el);
    var status = $('.size-status', el);
    sizes.classList.add('needs-choice');
    status.classList.add('error');
    status.innerHTML = icon('alert') + '<span>Choose a size to add this to your bag.</span>';
    haptic('error');
    sizes.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    shake(sizes);
    return;
  }
  var stock = stockOf(p, sel.size);
  if (stock === 'unavailable') {
    var exists = state.restock.some(function (r) {
      return r.productId === pid && r.size === sel.size;
    });
    if (!exists) state.restock.push({ productId: pid, size: sel.size });
    persist();
    chooseSize(el, p, sel, sel.size);
    toast('Restock request saved on this device. Demo — no alert will be sent.', { icon: 'bell', haptic: 'tap' });
    return;
  }
  var line = state.bag.filter(function (l) {
    return l.productId === pid && l.size === sel.size;
  })[0];
  if (line) line.quantity = Math.min(5, line.quantity + 1);
  else state.bag.push({ productId: pid, size: sel.size, quantity: 1 });
  persist();
  updateBagBadges(true);
  // Causality: the label, the badge and the haptic all change on this frame.
  var label = $('.btn-label', btn);
  var before = label.textContent;
  btn.classList.add('is-busy');
  label.innerHTML = icon('check') + ' Added to bag';
  haptic('success');
  setTimeout(function () {
    btn.classList.remove('is-busy');
    label.textContent = before;
  }, 1400);
  toast(p.name + ' · ' + sel.size + ' added', {
    icon: 'bag',
    action: { label: 'View bag', run: openBag },
  });
}

/** A short horizontal shake: the familiar "not yet" from iOS password fields. */
function shake(el) {
  if (reducedMotion.matches) return;
  var s = new Spring(0, function (v) {
    el.style.transform = v ? 'translate3d(' + v + 'px,0,0)' : '';
  }, 0.3);
  s.value = 0;
  s.to(0, { velocity: 900, config: { damping: 0.25, response: 0.16 } });
}

function accordionItem(title, inner) {
  var id = 'acc-' + Math.random().toString(36).slice(2, 8);
  return (
    '<div class="acc-item"><button class="acc-btn" aria-expanded="false" aria-controls="' +
    id +
    '" data-action="accordion">' +
    esc(title) +
    icon('chevronDown') +
    '</button><div class="acc-panel" id="' +
    id +
    '" role="region"><div class="acc-panel-inner">' +
    inner +
    '</div></div></div>'
  );
}

function toggleAccordion(btn) {
  var panel = document.getElementById(btn.getAttribute('aria-controls'));
  var open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', open);
  var inner = panel.firstElementChild;
  var from = panel.offsetHeight;
  var to = open ? inner.offsetHeight : 0;
  if (!panel._spring) {
    panel._spring = new Spring(from, function (v) {
      panel.style.height = v + 'px';
    }, 0.3);
  }
  panel._spring.value = from;
  panel._spring.to(to, {
    onRest: function () {
      panel.style.height = open ? 'auto' : '0px';
    },
  });
}

function openSizeGuide(pid) {
  var p = PRODUCTS[pid];
  var guide = DATA.sizeGuides[p.sizeGuide];
  var unit = 'cm';
  openSheet({
    title: 'Size guide',
    body: function (body, api) {
      function value(v) {
        return unit === 'cm' ? v : (Math.round((Number(v) / 2.54) * 2) / 2).toFixed(1);
      }
      body.innerHTML =
        '<p class="note" style="margin-top:0">' +
        esc(guide.title) +
        ' · sample measurements in ' +
        unit +
        '</p>' +
        '<div class="segmented" role="radiogroup" aria-label="Units" style="margin:0.75rem 0 1rem">' +
        ['cm', 'in']
          .map(function (u) {
            return '<button role="radio" data-unit="' + u + '" aria-checked="' + (unit === u) + '">' + (u === 'cm' ? 'Centimetres' : 'Inches') + '</button>';
          })
          .join('') +
        '</div>' +
        '<table class="size-table"><thead><tr>' +
        guide.columns
          .map(function (c) {
            return '<th scope="col">' + esc(c) + '</th>';
          })
          .join('') +
        '</tr></thead><tbody>' +
        guide.rows
          .map(function (r) {
            return (
              '<tr>' +
              r
                .map(function (v, i) {
                  return i ? '<td>' + value(v) + '</td>' : '<th scope="row">' + esc(v) + '</th>';
                })
                .join('') +
              '</tr>'
            );
          })
          .join('') +
        '</tbody></table>' +
        '<div class="callout">' +
        icon('info') +
        '<div><p>These are sample numbers for the demo. MAXHOSA’s approved fit guidance and how-to-measure notes replace them.</p><p>No guide can guarantee fit — if you are between sizes, ask a stylist.</p></div></div>';
      $$('[data-unit]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          unit = b.getAttribute('data-unit');
          api.rerender();
        });
      });
    },
  });
}

function shareProduct(pid) {
  var p = PRODUCTS[pid];
  var text = p.name + ' — MAXHOSA AFRICA concept demo (sample product)';
  if (navigator.share) {
    navigator.share({ title: p.name, text: text }).catch(function () {
      /* dismissed */
    });
  } else {
    toast('Sharing uses your phone’s share sheet in the app. This offline demo has no public link to share.', { icon: 'share' });
  }
}

/* --------------------------------------------------------------- stories */

function openStory(sid) {
  var s = DATA.stories.filter(function (x) {
    return x.id === sid;
  })[0];
  pushScreen({
    title: s.title,
    media: true,
    end: bagButton(true),
    render: function (el) {
      $('.scroller', el).innerHTML =
        '<div class="story-hero" data-parallax><img src="' +
        ASSET_URL[s.hero] +
        '" alt="' +
        esc(assetAlt(s.hero)) +
        '" draggable="false"></div>' +
        '<article class="prose"><span class="eyebrow">' +
        esc(s.kind) +
        ' · concept imagery</span><h1>' +
        esc(s.title) +
        '</h1><p class="placeholder-copy">' +
        esc(PLACEHOLDER_COPY) +
        '</p></article>' +
        '<div class="story-images">' +
        s.media
          .map(function (id) {
            return (
              '<button class="card-link" data-action="zoom" data-id="' +
              id +
              '" aria-label="' +
              esc(assetAlt(id)) +
              ' Opens zoom.">' +
              media(id, { decorative: true }) +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<section class="section"><div class="section-head"><h2>Shop the story</h2></div><div class="rail">' +
        s.products
          .map(function (id) {
            return productCard(PRODUCTS[id]);
          })
          .join('') +
        '</div></section>';
    },
  });
}

/* ------------------------------------------------------------------ bag */

function openBag() {
  var sheet = openSheet({
    title: 'Bag',
    detent: 'large',
    body: function (body) {
      var lines = bagLines();
      if (!lines.length) {
        body.innerHTML = emptyState(
          'bag',
          'Your bag is empty',
          'Pieces you add will wait here. Nothing in this demo is a real order.',
          '<button class="btn btn-primary" data-action="bag-browse">Shop new arrivals</button>',
        );
        return;
      }
      body.innerHTML =
        '<div class="callout" style="margin-top:0">' +
        icon('info') +
        '<div><p><strong>Demo — no real order or payment.</strong></p><p>Prices are sample prices for ' +
        esc(market().label) +
        '. Checkout re-checks price and stock before anything is charged.</p></div></div>' +
        lines
          .map(function (x) {
            var key = x.product.id + '|' + x.line.size;
            return (
              '<div class="line" data-line="' +
              esc(key) +
              '">' +
              '<button class="card-link" data-action="bag-open-product" data-id="' +
              x.product.id +
              '" aria-label="Open ' +
              esc(x.product.name) +
              '">' +
              media(x.product.media[0], { decorative: true, eager: true }) +
              '</button><div><div class="line-name">' +
              esc(x.product.name) +
              '</div><div class="line-meta">Size ' +
              esc(x.line.size) +
              ' · ' +
              esc(x.product.code) +
              '</div><div class="line-meta">' +
              esc(fmtMoney(x.unit)) +
              ' each</div>' +
              (x.stock === 'preorder'
                ? '<span class="tag warn" style="margin-top:0.375rem">' + icon('clock') + 'Pre-order · sample lead time ' + esc(x.product.preorderLeadTime || 'to be confirmed') + '</span>'
                : '') +
              (x.stock === 'unavailable'
                ? '<span class="tag bad" style="margin-top:0.375rem">' + icon('alert') + 'No longer available — remove to continue</span>'
                : '') +
              '<div class="line-foot"><div class="stepper" role="group" aria-label="Quantity">' +
              '<button data-action="qty" data-key="' +
              esc(key) +
              '" data-d="-1" aria-label="Decrease quantity of ' +
              esc(x.product.name) +
              '">' +
              icon('minus') +
              '</button><output aria-live="polite">' +
              x.line.quantity +
              '</output><button data-action="qty" data-key="' +
              esc(key) +
              '" data-d="1" aria-label="Increase quantity of ' +
              esc(x.product.name) +
              '"' +
              (x.line.quantity >= 5 ? ' aria-disabled="true"' : '') +
              '>' +
              icon('plus') +
              '</button></div><strong style="font-variant-numeric:tabular-nums">' +
              esc(fmtMoney(x.total)) +
              '</strong></div>' +
              '<button class="link-btn" data-action="remove-line" data-key="' +
              esc(key) +
              '">Remove</button></div></div>'
            );
          })
          .join('') +
        '<dl class="totals"><div><dt>Subtotal (sample)</dt><dd>' +
        esc(fmtMoney(bagSubtotal())) +
        '</dd></div><div><dt>Delivery</dt><dd>Calculated at checkout</dd></div>' +
        '<div><dt>Duties and taxes</dt><dd>Depend on your market — shown by checkout</dd></div>' +
        '<div class="grand"><dt>Total</dt><dd>Calculated at checkout</dd></div></dl>';
    },
    foot: function (foot) {
      var lines = bagLines();
      var blocked = lines.some(function (x) {
        return x.stock === 'unavailable';
      });
      foot.innerHTML = lines.length
        ? '<button class="btn btn-primary btn-block" data-action="checkout"' +
          (blocked ? ' aria-disabled="true"' : '') +
          '>' +
          icon('shield') +
          'Continue to checkout (demo)</button>'
        : '';
      foot.hidden = !lines.length;
    },
  });
  bagSheetApi = sheet;
  sheet.el.addEventListener('click', function (e) {
    var q = e.target.closest('[data-action="qty"]');
    if (q) {
      if (q.getAttribute('aria-disabled') === 'true') return;
      changeQty(q.getAttribute('data-key'), Number(q.getAttribute('data-d')));
      return;
    }
    var r = e.target.closest('[data-action="remove-line"]');
    if (r) removeLine(r.getAttribute('data-key'));
  });
  return sheet;
}
var bagSheetApi = null;

function findLine(key) {
  var parts = key.split('|');
  return state.bag.filter(function (l) {
    return l.productId === parts[0] && l.size === parts[1];
  })[0];
}

function changeQty(key, d) {
  var line = findLine(key);
  if (!line) return;
  if (line.quantity + d < 1) {
    removeLine(key);
    return;
  }
  line.quantity = Math.min(5, line.quantity + d);
  persist();
  updateBagBadges(false);
  refreshBag();
}

function removeLine(key) {
  var line = findLine(key);
  if (!line) return;
  var index = state.bag.indexOf(line);
  var row = bagSheetApi ? $('[data-line="' + key.replace(/"/g, '\\"') + '"]', bagSheetApi.el) : null;
  function commit() {
    state.bag.splice(state.bag.indexOf(line), 1);
    persist();
    updateBagBadges(false);
    refreshBag();
    // Forgiveness over confirmation: remove at once, offer Undo.
    toast(PRODUCTS[line.productId].name + ' removed', {
      icon: 'trash',
      action: {
        label: 'Undo',
        run: function () {
          state.bag.splice(Math.min(index, state.bag.length), 0, line);
          persist();
          updateBagBadges(true);
          refreshBag();
        },
      },
    });
  }
  if (!row || reducedMotion.matches) {
    commit();
    return;
  }
  var h = row.offsetHeight;
  row.style.overflow = 'hidden';
  var s = new Spring(h, function (v) {
    row.style.height = v + 'px';
    row.style.opacity = (v / h).toFixed(3);
  }, 0.5);
  s.to(0, { config: SPRING.snappy, onRest: commit });
}

function refreshBag() {
  if (bagSheetApi && document.contains(bagSheetApi.el)) {
    var keep = bagSheetApi.body.scrollTop;
    bagSheetApi.rerender();
    bagSheetApi.body.scrollTop = keep;
  }
}

/* -------------------------------------------------------------- checkout */

var checkoutAttempt = null;

/**
 * The handoff to the approved checkout, simulated. Each outcome the real
 * integration must handle has its own state: confirmed, pending,
 * failed and cancelled. One attempt key per checkout means a second tap, a
 * retry or a "check again" can never create a second order.
 */
function openCheckout() {
  var outcome = 'confirmed';
  var phase = 'review';
  checkoutAttempt = 'attempt-' + Date.now();
  var placedOrder = null;
  var sheet = openSheet({
    title: 'Checkout',
    body: function (body) {
      if (phase === 'review') {
        body.innerHTML =
          '<div class="callout" style="margin-top:0">' +
          icon('shield') +
          '<div><p><strong>Demo — no real order or payment.</strong></p><p>In the app, MAXHOSA AFRICA’s approved checkout takes over here. Card details are never typed into this app.</p></div></div>' +
          '<dl class="totals"><div><dt>' +
          bagCount() +
          (bagCount() === 1 ? ' piece' : ' pieces') +
          ' (sample)</dt><dd>' +
          esc(fmtMoney(bagSubtotal())) +
          '</dd></div><div><dt>Delivery, duties, taxes</dt><dd>From checkout</dd></div></dl>' +
          '<div class="field" style="margin-top:1.25rem"><span class="label">Presenter: simulate the checkout result</span>' +
          '<div class="segmented" role="radiogroup" aria-label="Simulated result">' +
          [
            ['confirmed', 'Confirmed'],
            ['pending', 'Pending'],
            ['failed', 'Failed'],
            ['cancelled', 'Cancelled'],
          ]
            .map(function (o) {
              return '<button role="radio" data-outcome="' + o[0] + '" aria-checked="' + (outcome === o[0]) + '">' + o[1] + '</button>';
            })
            .join('') +
          '</div></div>';
      } else if (phase === 'working') {
        body.innerHTML =
          '<ol class="progress-steps" style="list-style:none;padding:0" aria-live="polite">' +
          ['Re-checking prices (simulated)', 'Re-checking stock (simulated)', 'Handing over to checkout (simulated)']
            .map(function (t, i) {
              return '<li data-step="' + i + '"><span class="spinner" aria-hidden="true"></span>' + t + '</li>';
            })
            .join('') +
          '</ol>';
      } else {
        body.innerHTML = outcomeHTML(outcome, placedOrder);
      }
    },
    foot: function (foot) {
      if (phase === 'review') {
        foot.innerHTML = '<button class="btn btn-primary btn-block" data-co="go">Continue to checkout (demo)</button>';
      } else if (phase === 'working') {
        foot.innerHTML = '<button class="btn btn-primary btn-block is-busy" aria-disabled="true"><span class="spinner" style="border-top-color:currentColor" aria-hidden="true"></span>Working…</button>';
      } else if (outcome === 'confirmed') {
        foot.innerHTML = '<button class="btn btn-primary btn-block" data-co="track">' + icon('truck') + 'Track this order</button>';
      } else if (outcome === 'pending') {
        foot.innerHTML =
          '<div style="display:flex;gap:0.625rem"><button class="btn btn-secondary" data-co="close">Close</button><button class="btn btn-primary" style="flex:1" data-co="recheck">Check again</button></div>';
      } else if (outcome === 'failed') {
        foot.innerHTML =
          '<div style="display:flex;gap:0.625rem"><button class="btn btn-secondary" data-co="close">Close</button><button class="btn btn-primary" style="flex:1" data-co="retry">Try again</button></div>';
      } else {
        foot.innerHTML = '<button class="btn btn-primary btn-block" data-co="close">Back to bag</button>';
      }
    },
  });

  function run() {
    phase = 'working';
    sheet.setModal(true);
    sheet.rerender();
    var steps = $$('[data-step]', sheet.body);
    var i = 0;
    var timer = setInterval(function () {
      if (i < steps.length) {
        steps[i].classList.add('done');
        steps[i].querySelector('.spinner').outerHTML = icon('check');
        i++;
        return;
      }
      clearInterval(timer);
      finish(outcome);
    }, 420);
  }

  function finish(result) {
    outcome = result;
    if (result === 'confirmed' && !placedOrder) {
      placedOrder = placeDemoOrder(checkoutAttempt);
      haptic('success');
    } else if (result === 'failed') {
      haptic('error');
    }
    phase = 'done';
    sheet.setModal(false);
    sheet.rerender();
  }

  sheet.el.addEventListener('click', function (e) {
    var o = e.target.closest('[data-outcome]');
    if (o) {
      outcome = o.getAttribute('data-outcome');
      sheet.rerender();
      return;
    }
    var a = e.target.closest('[data-co]');
    if (!a) return;
    var what = a.getAttribute('data-co');
    if (what === 'go') run();
    else if (what === 'recheck') finish('confirmed');
    else if (what === 'retry') {
      phase = 'review';
      outcome = 'confirmed';
      sheet.rerender();
    } else if (what === 'close') sheet.close();
    else if (what === 'track') {
      var id = placedOrder.id;
      closeLayers(layers.length, function () {
        openTracker(id);
      });
    }
  });
}

function outcomeHTML(outcome, order) {
  var map = {
    confirmed: ['ok', 'check', 'Order placed (demo)', 'Sample order ' + (order ? order.id : '') + ' exists only on this device. Nothing was charged and nothing will be delivered.'],
    pending: [
      'warn',
      'clock',
      'Waiting for payment confirmation',
      'Checkout hasn’t confirmed the payment yet. Your order updates by itself once it does — trying again will not create a second order.',
    ],
    failed: ['bad', 'alert', 'Payment didn’t go through', 'Nothing was charged and your bag is just as you left it. You can try again or use another method in checkout.'],
    cancelled: ['warn', 'back', 'Checkout cancelled', 'No order was placed. Your bag is unchanged.'],
  };
  var m = map[outcome];
  return (
    '<div class="outcome" role="status"><span class="outcome-icon ' +
    m[0] +
    '">' +
    icon(m[1]) +
    '</span><h3>' +
    esc(m[2]) +
    '</h3><p>' +
    esc(m[3]) +
    '</p></div>'
  );
}

/* ----------------------------------------------------------------- orders */

var STAGES = [
  { id: 'order_confirmed', label: 'Order confirmed', source: 'merchant', desc: 'MAXHOSA AFRICA has your order.' },
  { id: 'preparing', label: 'Preparing', source: 'merchant', desc: 'Your pieces are being picked and quality-checked.' },
  { id: 'packed', label: 'Packed', source: 'merchant', desc: 'Packed and labelled. Waiting for the courier to collect — the carrier does not have it yet.' },
  { id: 'handed_to_carrier', label: 'With the courier', source: 'carrier', desc: 'The courier has collected your parcel.' },
  { id: 'in_transit', label: 'In transit', source: 'carrier', desc: 'Scanned at a sample sorting hub.' },
  { id: 'out_for_delivery', label: 'Out for delivery', source: 'carrier', desc: 'On the delivery route today.' },
  { id: 'delivered', label: 'Delivered', source: 'carrier', desc: 'Delivered and signed for at reception (simulated).' },
];

function nextOrderId() {
  var n = (state.orders || []).length + 1;
  return 'DEMO-ORDER-' + String(n).padStart(4, '0');
}

function makeOrder(id, lines, createdAt, stage) {
  var events = [];
  for (var i = 0; i <= stage; i++) {
    events.push({ stage: STAGES[i].id, at: new Date(createdAt.getTime() + i * 47 * 60000).toISOString() });
  }
  return {
    id: id,
    createdAt: createdAt.toISOString(),
    market: state.market,
    lines: lines,
    carrier: DATA.sampleOrder.carrier,
    trackingReference: stage >= 3 ? DATA.sampleOrder.trackingReference : null,
    serviceLevel: DATA.sampleOrder.serviceLevel,
    tracking: { mode: 'parcel', stage: stage, events: events, exception: null, stale: false, unknown: false, prefs: null },
  };
}

function seedOrders() {
  if (state.orders) return;
  var created = new Date(Date.now() - 2.5 * 3600000);
  state.orders = [makeOrder(DATA.sampleOrder.id, DATA.sampleOrder.lines.slice(), created, 2)];
  persist();
}

function placeDemoOrder(attemptKey) {
  var existing = (state.orders || []).filter(function (o) {
    return o.attemptKey === attemptKey;
  })[0];
  if (existing) return existing;
  var lines = state.bag.map(function (l) {
    return { productId: l.productId, size: l.size, quantity: l.quantity };
  });
  var order = makeOrder(nextOrderId(), lines, new Date(), 0);
  order.attemptKey = attemptKey;
  state.orders.unshift(order);
  state.bag = [];
  persist();
  updateBagBadges(false);
  refreshBag();
  renderTab('home');
  return order;
}

function orderById(id) {
  return (state.orders || []).filter(function (o) {
    return o.id === id;
  })[0];
}

function openOrders() {
  pushScreen({
    title: 'Orders',
    render: function (el) {
      var orders = state.orders || [];
      $('.scroller', el).innerHTML = orders.length
        ? '<div class="group-title">Sample orders on this device</div><div class="group">' +
          orders
            .map(function (o) {
              var st = STAGES[o.tracking.stage];
              var first = PRODUCTS[o.lines[0].productId];
              return (
                '<button class="row" data-action="open-tracker" data-id="' +
                o.id +
                '"><span style="width:3rem;flex:none">' +
                media(first.media[0], { decorative: true, eager: true }) +
                '</span><span class="row-main"><span class="row-title">' +
                esc(o.id) +
                '</span><span class="row-sub" style="display:block">' +
                esc(o.tracking.exception ? exceptionCopy(o).title : st.label) +
                ' · ' +
                o.lines.length +
                (o.lines.length === 1 ? ' item' : ' items') +
                '</span></span><span class="row-end">' +
                icon('chevronRight') +
                '</span></button>'
              );
            })
            .join('') +
          '</div>'
        : emptyState('box', 'No orders yet', 'Orders you place in this demo appear here. None are real.', '');
    },
  });
}

/** The compact, glanceable order card on Home — the web stand-in for a Live Activity. */
function liveOrderCard() {
  var o = (state.orders || []).filter(function (x) {
    return x.tracking.stage < 6;
  })[0];
  if (!o) return '';
  var copy = statusCopy(o);
  return (
    '<div style="padding:1.25rem var(--gutter) 0"><button class="live-card card-link" data-action="open-tracker" data-id="' +
    o.id +
    '"><span class="eyebrow">' +
    esc(o.id) +
    ' · simulated</span><span class="live-title">' +
    esc(copy.title) +
    '</span><span class="live-sub">' +
    esc(copy.eta) +
    '</span>' +
    stageBar(o, true) +
    '</button></div>'
  );
}
