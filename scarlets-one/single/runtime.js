/*
 * Runs in the page before the app bundle. Plain ES5: it has to work in any
 * browser that can run the app, and it is not compiled.
 *
 * 1. Address adapter. A page opened from a phone's storage (file:// or
 *    content://) may not change its path, only its fragment. Expo Router is
 *    compiled to read `__SO_NAV__` instead of `window.location`, so `/match`
 *    is kept as `#/match`. The browser's real history is still used, so the
 *    phone's Back button moves through the app.
 * 2. Embedded media. The page carries each photo once, as a CSS rule. Here
 *    they become object URLs the app can use as image sources.
 * 3. Once the app has drawn, the still preview is removed (single/boot.js
 *    brings it back instead if the app never starts).
 * 4. Published as an Artifact, the page follows that viewer's rules for
 *    history, links and theme.
 */
(function () {
  'use strict';
  var doc = document;
  var html = doc.documentElement;
  var ORIGIN = 'https://scarlets-one.invalid';

  /* ---------------------------------------------------------------- address */

  var realHistory = window.history;
  var memory = null;

  function currentUrl() {
    var raw = memory ? memory.entries[memory.index].url : (window.location.hash || '').slice(1);
    return raw.charAt(0) === '/' ? raw : '/';
  }

  function parts() {
    var url = currentUrl();
    var q = url.indexOf('?');
    return { pathname: q < 0 ? url : url.slice(0, q), search: q < 0 ? '' : url.slice(q) };
  }

  function clean(url) {
    var path = String(url == null ? '/' : url);
    var origin = path.indexOf(ORIGIN) === 0 ? ORIGIN.length : 0;
    path = path.slice(origin).split('#')[0];
    return path.charAt(0) === '/' ? path : '/' + path;
  }

  function switchToMemory() {
    if (memory) return;
    var state = null;
    try {
      state = realHistory.state;
    } catch (error) {
      state = null;
    }
    memory = { entries: [{ state: state, url: currentUrl() }], index: 0 };
  }

  function write(method, state, url) {
    var path = clean(url);
    if (!memory) {
      try {
        realHistory[method](state, '', '#' + path);
        return;
      } catch (error) {
        switchToMemory();
      }
    }
    if (method === 'pushState') {
      memory.entries = memory.entries.slice(0, memory.index + 1);
      memory.entries.push({ state: state, url: path });
      memory.index = memory.entries.length - 1;
    } else {
      memory.entries[memory.index] = { state: state, url: path };
    }
  }

  function go(delta) {
    if (!memory) {
      realHistory.go(delta);
      return;
    }
    var next = Math.max(0, Math.min(memory.entries.length - 1, memory.index + (delta || 0)));
    if (next === memory.index) return;
    memory.index = next;
    setTimeout(function () {
      var event;
      try {
        event = new PopStateEvent('popstate', { state: memory.entries[memory.index].state });
      } catch (error) {
        event = doc.createEvent('Event');
        event.initEvent('popstate', false, false);
      }
      window.dispatchEvent(event);
    }, 0);
  }

  var location = {
    get pathname() {
      return parts().pathname;
    },
    get search() {
      return parts().search;
    },
    get hash() {
      return '';
    },
    get href() {
      return ORIGIN + currentUrl();
    },
    get origin() {
      return ORIGIN;
    },
    get protocol() {
      return 'https:';
    },
    get host() {
      return ORIGIN.slice(8);
    },
    get hostname() {
      return ORIGIN.slice(8);
    },
    get port() {
      return '';
    },
    assign: function (url) {
      write('pushState', null, url);
      go(0);
    },
    replace: function (url) {
      write('replaceState', null, url);
    },
    reload: function () {
      window.location.reload();
    },
    toString: function () {
      return ORIGIN + currentUrl();
    },
  };

  var history = {
    get state() {
      if (memory) return memory.entries[memory.index].state;
      try {
        return realHistory.state;
      } catch (error) {
        return null;
      }
    },
    get length() {
      return memory ? memory.entries.length : realHistory.length;
    },
    pushState: function (state, title, url) {
      write('pushState', state, url);
    },
    replaceState: function (state, title, url) {
      write('replaceState', state, url);
    },
    go: go,
    back: function () {
      go(-1);
    },
    forward: function () {
      go(1);
    },
  };

  window.__SO_NAV__ = { location: location, history: history };

  /* --------------------------------------------------------------- artifact */

  // Published as a claude.ai Artifact, the page runs inside a viewer with its
  // own rules. Three of them change how the app has to behave.
  if (window.__SO_TARGET__ === 'artifact') {
    // 1. The viewer owns the address bar and the Back button, and passes only
    //    a plain #name to the page. Keep the app's history in the page.
    switchToMemory();

    // 2. window.open returns null for most viewers; a link opens in a new tab.
    //    The app opens official pages with window.open, so fall back to
    //    following a real link.
    var nativeOpen = window.open;
    window.open = function (url, name, features) {
      var opened = null;
      try {
        opened = nativeOpen.call(window, url, name || '_blank', features);
      } catch (error) {
        opened = null;
      }
      if (opened || !/^https?:/i.test(String(url))) return opened;
      var link = doc.createElement('a');
      link.href = String(url);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      doc.body.appendChild(link);
      link.click();
      doc.body.removeChild(link);
      return null;
    };

    // 3. The viewer's light or dark choice arrives as data-theme on the root
    //    element, not as the system setting the app listens to. Answer the
    //    app's one colour-scheme question from both.
    var nativeMatchMedia = window.matchMedia;
    if (typeof nativeMatchMedia === 'function') {
      var DARK = '(prefers-color-scheme: dark)';
      var system = nativeMatchMedia.call(window, DARK);
      var listeners = [];
      var isDark = function () {
        var chosen = html.getAttribute('data-theme');
        if (chosen === 'dark') return true;
        if (chosen === 'light') return false;
        return system.matches;
      };
      var last = isDark();
      var notify = function () {
        var now = isDark();
        if (now === last) return;
        last = now;
        var current = listeners.slice();
        for (var i = 0; i < current.length; i += 1) current[i]({ matches: now, media: DARK });
      };
      var add = function (listener) {
        if (typeof listener === 'function' && listeners.indexOf(listener) < 0) {
          listeners.push(listener);
        }
      };
      var remove = function (listener) {
        var at = listeners.indexOf(listener);
        if (at >= 0) listeners.splice(at, 1);
      };
      var bridged = {
        media: DARK,
        onchange: null,
        get matches() {
          return isDark();
        },
        addListener: add,
        removeListener: remove,
        addEventListener: function (type, listener) {
          if (type === 'change') add(listener);
        },
        removeEventListener: function (type, listener) {
          if (type === 'change') remove(listener);
        },
        dispatchEvent: function () {
          return true;
        },
      };
      if (system.addEventListener) system.addEventListener('change', notify);
      else if (system.addListener) system.addListener(notify);
      if (typeof MutationObserver === 'function') {
        new MutationObserver(notify).observe(html, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
      }
      window.matchMedia = function (query) {
        return String(query).replace(/\s+/g, ' ').trim() === DARK
          ? bridged
          : nativeMatchMedia.call(window, query);
      };
    }
  }

  /* ------------------------------------------------------------------ media */

  function unwrap(value) {
    var match = /url\((["']?)(.*?)\1\)/.exec(value || '');
    return match ? match[2].replace(/\\(.)/g, '$1') : '';
  }

  function objectUrl(dataUri) {
    try {
      var comma = dataUri.indexOf(',');
      var type = dataUri.slice(5, dataUri.indexOf(';'));
      var binary = atob(dataUri.slice(comma + 1));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: type }));
    } catch (error) {
      return dataUri;
    }
  }

  function rulesOf(id) {
    var element = doc.getElementById(id);
    try {
      return element && element.sheet ? element.sheet.cssRules : [];
    } catch (error) {
      return [];
    }
  }

  var media = {};
  var mediaIds = {};
  var usesObjectUrls = true;
  var mediaRules = rulesOf('so-media');
  for (var m = 0; m < mediaRules.length; m += 1) {
    var rule = mediaRules[m];
    var name = /^\.so-m-([a-z0-9-]+)$/.exec(rule.selectorText || '');
    var data = name ? unwrap(rule.style.backgroundImage) : '';
    if (data) {
      var url = objectUrl(data);
      if (url === data) usesObjectUrls = false;
      media[name[1]] = url;
      mediaIds[url] = name[1];
    }
  }
  window.__SO_MEDIA__ = media;
  window.__SO_MEDIA_IDS__ = mediaIds;

  var fonts = {};
  var fontRules = rulesOf('so-fonts');
  for (var f = 0; f < fontRules.length; f += 1) {
    var face = fontRules[f];
    if (!face.style) continue;
    var family = (face.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim();
    var source = unwrap(face.style.getPropertyValue('src'));
    if (family && source) fonts[family.toLowerCase()] = source;
  }
  window.__SO_FONTS__ = fonts;

  /* ------------------------------------------------------------------ ready */

  // single/boot.js set up the fallback. Once the app has drawn something, the
  // still preview and the embedded copies it needs are dropped to free memory.
  var boot = window.__SO_BOOT__ || { started: false, failed: false };
  var root = doc.getElementById('root');

  function ready() {
    if (boot.started) return;
    boot.started = true;
    // The fallback may have given up on a slow start. The app did arrive: show it.
    if (boot.failed && boot.showApp) boot.showApp();
    if (boot.setClass) boot.setClass('so-ready', true);
    setTimeout(function () {
      var ids = ['so-static', 'so-static-css', 'so-splash'];
      // Object URLs hold their own copy. Without them the photos are still
      // read from the stylesheet text, so it has to stay.
      if (usesObjectUrls) ids.push('so-media');
      for (var i = 0; i < ids.length; i += 1) {
        var element = doc.getElementById(ids[i]);
        if (element && element.parentNode) element.parentNode.removeChild(element);
      }
    }, 600);
  }

  if (root && typeof MutationObserver === 'function') {
    var observer = new MutationObserver(function () {
      if (root.firstChild) {
        observer.disconnect();
        ready();
      }
    });
    observer.observe(root, { childList: true });
  } else {
    ready();
  }
})();
