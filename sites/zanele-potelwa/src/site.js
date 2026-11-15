    (function () {
      'use strict';
      let root = document.documentElement;
      let reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      let slice = function (list) { return Array.prototype.slice.call(list); };
      // iOS Safari only applies :active styles once a touch listener exists.
      document.addEventListener('touchstart', function () {}, { passive: true });

      /* ---------- Header material, hero drift ---------- */
      let header = document.querySelector('.site-header');
      let hero = document.querySelector('.hero');
      let wide = window.matchMedia('(min-width: 761px) and (orientation: landscape)');
      let ticking = false;
      function onScroll() {
        ticking = false;
        header.classList.toggle('is-scrolled', window.pageYOffset > 8);
        if (!hero || reduce.matches || !wide.matches) return;
        let rect = hero.getBoundingClientRect();
        if (rect.bottom > 0) hero.style.setProperty('--hero-shift', Math.max(-28, Math.min(28, -rect.top * 0.105)).toFixed(1) + 'px');
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
      }, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();

      /* ---------- Menu ----------
         A native <details>, so it opens with scripts off. With them on it
         also holds focus inside, closes on Escape and hands focus back. */
      const menu = document.querySelector('.menu');
      if (menu) {
        const summary = menu.querySelector('summary');
        let leaving = 0;
        const hold = function (on) {
          header.classList.toggle('menu-open', on);
          root.classList.toggle('viewer-open', on);
        };
        menu.addEventListener('toggle', function () { hold(menu.open); });
        // The panel leaves by the path it arrived on, and the page beneath is
        // free to scroll the moment it starts to go. Caught on the way out,
        // it simply stays.
        const leave = function () {
          if (!menu.open || leaving) return;
          root.classList.remove('viewer-open');
          if (reduce.matches) { menu.open = false; return; }
          menu.classList.add('is-leaving');
          leaving = window.setTimeout(function () {
            leaving = 0;
            menu.classList.remove('is-leaving');
            menu.open = false;
          }, 230);
        };
        const stay = function () {
          window.clearTimeout(leaving);
          leaving = 0;
          menu.classList.remove('is-leaving');
          hold(true);
        };
        summary.addEventListener('click', function (e) {
          if (leaving) { e.preventDefault(); stay(); }
          else if (menu.open) { e.preventDefault(); leave(); }
        });
        slice(menu.querySelectorAll('a')).forEach(function (a) {
          a.addEventListener('click', leave);
        });
        document.addEventListener('keydown', function (e) {
          if (!menu.open) return;
          if (e.key === 'Escape') { leave(); summary.focus(); return; }
          if (e.key !== 'Tab') return;
          const stops = [summary].concat(slice(menu.querySelectorAll('a')));
          const at = stops.indexOf(document.activeElement);
          if (e.shiftKey && at <= 0) { e.preventDefault(); stops[stops.length - 1].focus(); }
          else if (!e.shiftKey && (at === stops.length - 1 || at < 0)) { e.preventDefault(); stops[0].focus(); }
        });
      }

      let watch = 'IntersectionObserver' in window;

      /* ---------- Entrances ---------- */
      if (watch && !reduce.matches) {
        const io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
          });
        }, { rootMargin: '0px 0px -30px 0px', threshold: 0.12 });
        slice(document.querySelectorAll('[data-reveal]')).forEach(function (el) { io.observe(el); });
        root.classList.add('reveal');
      }

      /* ---------- Where am I? ----------
         The navigation marks whichever section is under the middle of the screen. */
      let links = slice(document.querySelectorAll('.nav a[href^="#"]'));
      if (watch && links.length) {
        let current = '';
        let spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) current = entry.target.id;
            else if (current === entry.target.id) current = '';
          });
          links.forEach(function (a) {
            if (a.getAttribute('href') === '#' + current) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        }, { rootMargin: '-45% 0px -54% 0px' });
        slice(document.querySelectorAll('main > section[id]')).forEach(function (s) { spy.observe(s); });
      }

      /* ---------- The dock ----------
         On a phone the two journeys stay within the thumb's reach: the dock
         arrives once the hero has gone and steps aside wherever a form, or
         the footer, already has the visitor's attention. */
      let dock = document.querySelector('.dock');
      if (dock && hero && watch) {
        let past = false;
        let held = [];
        let sync = function () { dock.classList.toggle('is-on', past && !held.length); };
        new IntersectionObserver(function (entries) {
          past = !entries[entries.length - 1].isIntersecting;
          sync();
        }).observe(hero);
        let zones = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            let i = held.indexOf(entry.target);
            if (entry.isIntersecting && i < 0) held.push(entry.target);
            if (!entry.isIntersecting && i >= 0) held.splice(i, 1);
          });
          sync();
        }, { rootMargin: '0px 0px -12% 0px' });
        ['#brief', '#booker', '#community', '.site-footer'].forEach(function (sel) {
          let el = document.querySelector(sel);
          if (el) zones.observe(el);
        });
      }

      /* ---------- Share ----------
         Only once the page has an address worth sharing: a file opened from
         a chat has none. */
      let share = document.querySelector('[data-share]');
      if (share && /^https?:$/.test(location.protocol)) {
        let address = location.origin + location.pathname;
        let wa = share.querySelector('[data-share-whatsapp]');
        wa.href = 'https://wa.me/?text=' + encodeURIComponent(document.title + ' ' + address);
        if (navigator.share) {
          wa.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.share({ title: document.title, url: address }).catch(function () {});
          });
          wa.firstChild.textContent = 'Share this page ';
        }
        share.hidden = false;
      }

      /* ---------- Measurement hook ----------
         No tracker ships with the page. Every conversion step is named, and
         reported to a tag manager's dataLayer if one is ever installed. */
      document.addEventListener('click', function (e) {
        let el = e.target.closest ? e.target.closest('[data-track]') : null;
        if (!el) return;
        let name = el.getAttribute('data-track');
        if (window.dataLayer && window.dataLayer.push) window.dataLayer.push({ event: 'zp_' + name });
        try { document.dispatchEvent(new CustomEvent('zp:track', { detail: { name: name } })); } catch { /* old browser */ }
      });
    })();
