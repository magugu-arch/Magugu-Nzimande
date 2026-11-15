    /* ---------- Viewer ----------
       Every value on screen is a spring, so any motion can be grabbed and
       redirected mid-flight: a spring always continues from where it is, at
       the speed it is going. Damping 1 settles without overshoot; a little
       bounce is reserved for releases that carried momentum. */
    (function () {
      'use strict';
      let root = document.documentElement;
      let reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      let frames = Array.prototype.slice.call(document.querySelectorAll('img[data-zoom]'));
      let viewer = document.getElementById('viewer');
      if (!frames.length || !viewer || !window.requestAnimationFrame) return;

      let scrim = viewer.querySelector('.viewer-scrim');
      let track = viewer.querySelector('.viewer-track');
      let imgs = viewer.querySelectorAll('.viewer-img');
      let cur = imgs[0], adj = imgs[1];
      let ui = viewer.querySelectorAll('.viewer-ui');
      let cap = viewer.querySelector('.viewer-cap');
      let count = viewer.querySelector('.viewer-count');
      let closeBtn = viewer.querySelector('.viewer-close');
      let steps = viewer.querySelectorAll('[data-step-photo]');
      let outside = [document.querySelector('.site-header'), document.getElementById('main'), document.querySelector('.site-footer'), document.querySelector('.dock')];
      let GAP = 24;

      function Spring(x, eps) { this.x = x; this.v = 0; this.to = x; this.k = 0; this.c = 0; this.on = false; this.eps = eps; }
      Spring.prototype.go = function (to, opt) {
        opt = opt || {};
        let w = 2 * Math.PI / (opt.response || 0.4);
        this.k = w * w;
        this.c = 2 * (opt.damping == null ? 1 : opt.damping) * w;
        this.to = to;
        if (opt.velocity != null) this.v = opt.velocity;
        this.on = true;
        kick();
      };
      Spring.prototype.set = function (x) { this.x = this.to = x; this.v = 0; this.on = false; };
      Spring.prototype.grab = function () { this.on = false; };

      let tx = new Spring(0, 0.5);   // track position, px
      let ty = new Spring(0, 0.5);   // current photo, vertical px
      let sc = new Spring(1, 0.001); // current photo, scale
      let cl = new Spring(0, 0.001); // 1 = clipped to its thumbnail
      let op = new Spring(0, 0.002); // scrim and controls
      let fd = new Spring(1, 0.002); // current photo opacity
      let springs = [tx, ty, sc, cl, op, fd];

      let index = 0, adjDir = 0, pending = 0, isOpen = false, closing = false;
      let clip = [0, 0, 0, 0], radius = 0, returnTo = null, hiddenThumb = null;
      let raf = 0, last = 0;

      function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
      function frame(now) {
        // A frame's timestamp can predate the kick that scheduled it.
        let dt = Math.max(0, Math.min((now - last) / 1000, 1 / 30));
        last = now;
        let n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, moving = false;
        springs.forEach(function (s) {
          if (!s.on) return;
          for (let i = 0; i < n; i++) {
            s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h;
            s.x += s.v * h;
          }
          if (Math.abs(s.x - s.to) < s.eps && Math.abs(s.v) < s.eps * 20) { s.x = s.to; s.v = 0; s.on = false; }
          else moving = true;
        });
        render();
        if (moving) raf = requestAnimationFrame(frame);
        else { raf = 0; settle(); }
      }

      function pageW() { return viewer.clientWidth + GAP; }
      function srcOf(img) { return img.currentSrc || img.src; }
      function natural(img) {
        return img.naturalWidth ? [img.naturalWidth, img.naturalHeight]
          : [+img.getAttribute('width') || 4, +img.getAttribute('height') || 5];
      }
      // Where a photograph rests: as large as fits between the controls.
      function rest(img) {
        let vw = viewer.clientWidth, vh = viewer.clientHeight, d = natural(img);
        let side = vw < 700 ? 0 : 32, top = 64, bottom = 104;
        let s = Math.min((vw - side * 2) / d[0], (vh - top - bottom) / d[1]);
        let w = d[0] * s, h = d[1] * s;
        return { x: (vw - w) / 2, y: top + (vh - top - bottom - h) / 2, w: w, h: h };
      }
      function place(el, img) {
        let r = rest(img);
        el.style.left = r.x + 'px'; el.style.top = r.y + 'px';
        el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
        return r;
      }
      function fraction(v) {
        if (/%$/.test(v)) return parseFloat(v) / 100;
        let named = { left: 0, top: 0, right: 1, bottom: 1 };
        return named[v] != null ? named[v] : 0.5;
      }
      // The transform and clip that make the resting photo sit exactly over
      // its (cropped, object-fit: cover) thumbnail on the page.
      function geometry(img) {
        let r = img.getBoundingClientRect();
        let vw = viewer.clientWidth, vh = viewer.clientHeight;
        if (r.width < 2 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return null;
        let d = natural(img), F = rest(img), cs = getComputedStyle(img);
        let pos = (cs.objectPosition || '50% 50%').split(' ');
        let px = fraction(pos[0]), py = fraction(pos[1] || '50%');
        let k = Math.max(r.width / d[0], r.height / d[1]), f = F.w / d[0];
        let L = f * (-(r.width - d[0] * k) * px / k), T = f * (-(r.height - d[1] * k) * py / k);
        let W = f * r.width / k, H = f * r.height / k, S = k / f;
        let box = img.closest('figure') || img;
        return {
          x: r.left + r.width / 2 - (F.x + F.w / 2) - S * (L + W / 2 - F.w / 2),
          y: r.top + r.height / 2 - (F.y + F.h / 2) - S * (T + H / 2 - F.h / 2),
          s: S,
          clip: [T, F.w - L - W, F.h - T - H, L],
          r: parseFloat(getComputedStyle(box).borderTopLeftRadius) || 0
        };
      }

      function render() {
        track.style.transform = 'translate3d(' + tx.x + 'px,0,0)';
        cur.style.transform = 'translate3d(0,' + ty.x + 'px,0) scale(' + sc.x + ')';
        cur.style.opacity = Math.max(0, Math.min(1, fd.x));
        let c = Math.max(0, Math.min(1, cl.x));
        let path = c > 0.001
          ? 'inset(' + clip[0] * c + 'px ' + clip[1] * c + 'px ' + clip[2] * c + 'px ' + clip[3] * c + 'px round ' + radius * c / Math.max(sc.x, 0.05) + 'px)'
          : '';
        cur.style.webkitClipPath = path; cur.style.clipPath = path;
        let o = Math.max(0, Math.min(1, op.x));
        scrim.style.opacity = o;
        for (let i = 0; i < ui.length; i++) ui[i].style.opacity = o;
        if (adjDir) adj.style.transform = 'translate3d(' + adjDir * pageW() + 'px,0,0)';
      }

      function hideThumb(img) {
        if (hiddenThumb) hiddenThumb.style.visibility = '';
        hiddenThumb = img;
        if (img) img.style.visibility = 'hidden';
      }
      function neighbour(dir) { let j = index + dir; return j >= 0 && j < frames.length ? j : -1; }
      // The second element always holds the photograph one page to the side
      // the user is heading, so a swipe reveals it already in place.
      function showAdj(dir) {
        if (adjDir === dir) return;
        adjDir = dir;
        let j = dir ? neighbour(dir) : -1;
        adj.style.visibility = j < 0 ? 'hidden' : '';
        if (j >= 0) { adj.src = srcOf(frames[j]); place(adj, frames[j]); }
      }
      function label() {
        let f = frames[index];
        cap.textContent = f.alt;
        count.textContent = (index + 1) + ' / ' + frames.length;
        cur.alt = f.alt;
        steps[0].disabled = index === 0;
        steps[1].disabled = index === frames.length - 1;
      }

      // Hand the neighbour the middle of the stage: swap which element is
      // "current" and shift the track by one page in the same frame, so
      // nothing visibly moves and the spring keeps its velocity. The old
      // photograph stays put as the neighbour on the side it left by.
      function commit(dir) {
        if (neighbour(dir) < 0) return;
        index += dir;
        let t = cur; cur = adj; adj = t;
        cur.removeAttribute('aria-hidden'); adj.setAttribute('aria-hidden', 'true');
        adj.style.webkitClipPath = adj.style.clipPath = ''; adj.style.opacity = '';
        adjDir = -dir;
        tx.x += dir * pageW(); tx.to += dir * pageW();
        if (pending === dir) pending = 0;
        hideThumb(frames[index]);
        label();
        render();
      }
      function step(dir, velocity) {
        if (!isOpen || closing) return;
        if (pending) commit(pending);
        if (neighbour(dir) < 0) { tx.go(0, { velocity: velocity || 0, damping: 0.85, response: 0.35 }); return; }
        showAdj(dir);
        if (reduce.matches) { commit(dir); fd.set(0); fd.go(1, { response: 0.25 }); render(); return; }
        pending = dir;
        tx.go(-dir * pageW(), { velocity: velocity || 0, response: 0.38 });
      }
      function settle() {
        if (closing) { finish(); return; }
        if (pending && Math.abs(tx.x + pending * pageW()) < 1) commit(pending);
      }

      function open(i, fromPage) {
        index = i; isOpen = true; closing = false; pending = 0; adjDir = 0;
        returnTo = document.activeElement;
        viewer.hidden = false;
        viewer.classList.remove('ui-hidden');
        root.classList.add('viewer-open');
        outside.forEach(function (el) { if (el) el.setAttribute('aria-hidden', 'true'); });
        cur.src = srcOf(frames[i]);
        adj.style.visibility = 'hidden';
        place(cur, frames[i]);
        label();
        let g = fromPage && !reduce.matches ? geometry(frames[i]) : null;
        if (g) {
          clip = g.clip; radius = g.r;
          tx.set(g.x); ty.set(g.y); sc.set(g.s); cl.set(1); fd.set(1);
        } else {
          tx.set(0); ty.set(0); sc.set(reduce.matches ? 1 : 0.94); cl.set(0); fd.set(0);
        }
        hideThumb(g ? frames[i] : null);
        op.set(0);
        render();
        let o = { response: 0.42 };
        tx.go(0, o); ty.go(0, o); sc.go(1, o); cl.go(0, o);
        op.go(1, { response: 0.32 }); fd.go(1, { response: 0.3 });
        closeBtn.focus({ preventScroll: true });
      }
      function close(vy) {
        if (!isOpen || closing) return;
        if (pending) commit(pending);
        closing = true;
        adj.style.visibility = 'hidden'; adjDir = 0;
        let g = reduce.matches ? null : geometry(frames[index]);
        let o = { response: 0.38 };
        if (g) {
          clip = g.clip; radius = g.r;
          tx.go(g.x, o); ty.go(g.y, { response: 0.38, velocity: vy || 0 }); sc.go(g.s, o); cl.go(1, o);
          op.go(0, { response: 0.32 });
        } else {
          // The thumbnail is off-screen: there is nowhere to return to, so dissolve in place.
          hideThumb(null);
          op.go(0, { response: 0.3 }); fd.go(0, { response: 0.26 });
          if (!reduce.matches) sc.go(0.94, o);
        }
      }
      function finish() {
        closing = false; isOpen = false;
        viewer.hidden = true;
        root.classList.remove('viewer-open');
        outside.forEach(function (el) { if (el) el.removeAttribute('aria-hidden'); });
        hideThumb(null);
        cur.style.webkitClipPath = cur.style.clipPath = '';
        if (returnTo && returnTo.focus) returnTo.focus({ preventScroll: true });
      }

      /* Gestures: 1:1 tracking, then velocity decides. */
      function project(v, rate) { rate = rate || 0.998; return (v / 1000) * rate / (1 - rate); }
      function rubber(x, dim) { return (x * dim * 0.55) / (dim + 0.55 * Math.abs(x)); }
      let drag = null;
      viewer.addEventListener('pointerdown', function (e) {
        if (!isOpen || e.button > 0 || e.target.closest('button') || drag) return;
        // Caught mid-flight — on the way out, or between pages — it belongs to
        // the finger again, from exactly where it is on screen.
        closing = false;
        pending = 0;
        springs.forEach(function (s) { s.grab(); });
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, bx: tx.x, by: ty.x, axis: null, hist: [[e.timeStamp, e.clientX, e.clientY]], onImg: e.target === cur };
        try { viewer.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      });
      viewer.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        let dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        drag.hist.push([e.timeStamp, e.clientX, e.clientY]);
        if (drag.hist.length > 8) drag.hist.shift();
        if (!drag.axis) {
          if (Math.sqrt(dx * dx + dy * dy) < 10) return;
          drag.axis = Math.abs(dx) > Math.abs(dy) && Math.abs(drag.by) < 1 ? 'x' : 'y';
        }
        if (drag.axis === 'x') {
          let x = drag.bx + dx, dir = x < 0 ? 1 : -1;
          showAdj(dir);
          tx.x = neighbour(dir) < 0 ? rubber(x, viewer.clientWidth) : x;
        } else {
          ty.x = drag.by + dy;
          let p = Math.min(Math.abs(ty.x) / (viewer.clientHeight * 0.5), 1);
          sc.x = 1 - 0.2 * p;
          op.x = 1 - 0.9 * p;
        }
        render();
      });
      function velocity(h, t) {
        let a = h[h.length - 1], b = a;
        if (t - a[0] > 60) return [0, 0]; // the finger stopped before it lifted
        for (let i = h.length - 2; i >= 0; i--) { b = h[i]; if (a[0] - b[0] > 80) break; }
        let dt = (a[0] - b[0]) / 1000;
        return dt > 0 ? [(a[1] - b[1]) / dt, (a[2] - b[2]) / dt] : [0, 0];
      }
      // Settle on the page nearest to where the motion was heading, not
      // where the finger happened to let go. On a wide screen half a page is
      // further than a flick ever projects, so intent is capped at 240px.
      function snapX(v) {
        let px = tx.x + project(v), half = Math.min(pageW() / 2, 240);
        if (px <= -half && neighbour(1) >= 0) step(1, v);
        else if (px >= half && neighbour(-1) >= 0) step(-1, v);
        else tx.go(0, { velocity: v, damping: 0.85, response: 0.35 });
      }
      function restore(vy) {
        let back = { damping: 0.85, response: 0.35 };
        ty.go(0, { velocity: vy, damping: 0.8, response: 0.35 });
        sc.go(1, back); cl.go(0, back); op.go(1, back); fd.go(1, back);
      }
      function release(e) {
        if (!drag || e.pointerId !== drag.id) return;
        let d = drag; drag = null;
        let v = velocity(d.hist, e.timeStamp);
        if (!d.axis) {
          // A tap: on the photograph it hides the controls, elsewhere it closes.
          if (e.type === 'pointerup' && !d.onImg) return close(0);
          if (e.type === 'pointerup') viewer.classList.toggle('ui-hidden');
          restore(0); snapX(0);
          return;
        }
        if (d.axis === 'x') { restore(0); snapX(v[0]); return; }
        let py = ty.x + project(v[1]);
        if (Math.abs(py) > viewer.clientHeight * 0.22) close(v[1]);
        else { restore(v[1]); snapX(0); }
      }
      viewer.addEventListener('pointerup', release);
      viewer.addEventListener('pointercancel', release);

      closeBtn.addEventListener('click', function () { close(0); });
      Array.prototype.forEach.call(steps, function (b) {
        b.addEventListener('click', function () { step(+b.getAttribute('data-step-photo'), 0); });
      });
      viewer.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); close(0); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); step(1, 0); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1, 0); }
        else if (e.key === 'Tab') {
          let f = [closeBtn, steps[0], steps[1]].filter(function (b) { return !b.disabled; });
          let at = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(at + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      });
      window.addEventListener('resize', function () {
        if (!isOpen) return;
        if (pending) commit(pending);
        place(cur, frames[index]);
        if (adjDir && neighbour(adjDir) >= 0) place(adj, frames[neighbour(adjDir)]);
        render();
      });

      frames.forEach(function (img, i) {
        if (img.closest('.hero')) return; // the hero opens through "Open the photographs"
        let box = img.closest('figure');
        if (!box) return;
        let b = document.createElement('button');
        b.type = 'button';
        b.className = 'zoom';
        b.setAttribute('aria-label', 'View larger: ' + img.alt);
        b.addEventListener('click', function () { open(i, true); });
        box.appendChild(b);
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-open-viewer]'), function (b) {
        b.addEventListener('click', function () { open(0, false); });
      });
    })();
