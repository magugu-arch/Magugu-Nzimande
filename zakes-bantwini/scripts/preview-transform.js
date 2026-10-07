/* eslint-disable @typescript-eslint/no-unused-expressions -- an expression by design: build-preview.ts calls it */
// Evaluated inside a captured page by build-preview.ts as `(<this>)(args)`.
// Strips the Next.js runtime, embeds images by id, prefixes ids per page and
// rewrites links to the preview's #p-<page> fragments.
(function transform(args) {
  var key = args.key;
  var known = args.known;
  function prefix(id) {
    return key + '--' + id;
  }
  function pageKey(p) {
    return p === '/' ? 'home' : p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase();
  }
  var body = document.body.cloneNode(true);
  body.querySelectorAll('script, style, next-route-announcer, nextjs-portal, link[rel="preload"], template').forEach(function (n) {
    n.remove();
  });

  // Reveals replay in the preview: clear what the capture's scroll-through revealed.
  body.querySelectorAll('.is-revealed').forEach(function (el) {
    el.classList.remove('is-revealed');
  });

  var head = body.querySelector('header');
  if (head && args.topClass !== args.solidClass) {
    head.setAttribute('class', args.topClass);
    head.setAttribute('data-zb-top', args.topClass);
    head.setAttribute('data-zb-solid', args.solidClass);
  }

  body.querySelectorAll('picture source').forEach(function (s) {
    s.remove();
  });
  body.querySelectorAll('img').forEach(function (img) {
    var m = /\/media\/(IMG_\d+)-/.exec(img.getAttribute('src') || '');
    if (!m) return;
    img.setAttribute('data-zb', m[1]);
    ['src', 'srcset', 'sizes', 'loading', 'fetchpriority'].forEach(function (a) {
      img.removeAttribute(a);
    });
  });

  body.querySelectorAll('[id]').forEach(function (el) {
    el.setAttribute('id', prefix(el.id));
  });
  ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'headers', 'list', 'form'].forEach(function (attr) {
    body.querySelectorAll('[' + attr + ']').forEach(function (el) {
      var ids = (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean).map(prefix);
      el.setAttribute(attr, ids.join(' '));
    });
  });

  body.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      if (href.length > 1) a.setAttribute('href', '#' + prefix(href.slice(1)));
      return;
    }
    if (href.charAt(0) !== '/' || href.indexOf('//') === 0) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      return;
    }
    var parts = href.split('#');
    var clean = parts[0].split('?')[0].replace(/\/$/, '') || '/';
    var k = pageKey(clean);
    if (known.indexOf(clean) !== -1) a.setAttribute('href', parts[1] ? '#' + k + '--' + parts[1] : '#p-' + k);
    else if (clean.indexOf('/admin') === 0) a.setAttribute('href', '#p-walkthrough');
    else a.setAttribute('href', '#p-live-only');
    a.removeAttribute('target');
  });

  body.querySelectorAll('form').forEach(function (f) {
    f.setAttribute('action', '#');
    f.setAttribute('data-zb-form', '');
  });
  body.querySelectorAll('[autofocus]').forEach(function (el) {
    el.removeAttribute('autofocus');
  });

  return {
    html: body.innerHTML,
    htmlClass: document.documentElement.className.replace(/\bjs\b/, '').trim(),
    styles: Array.prototype.map.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      return l.href;
    }),
    inline: Array.prototype.map.call(document.querySelectorAll('head style'), function (s) {
      return s.textContent || '';
    }),
  };
})
