    /* ---------- Enquiries ----------
       Three forms, no server. Each one checks what was typed, shows it back,
       and writes it into an email the visitor sends from their own mail app.
       So the page never claims a request was received: it reaches the team
       only when that email is sent. A draft is kept in this browser tab, so
       a reload or a validation error never loses what was typed. */
    (function () {
      'use strict';
      let CONFIG = JSON.parse(document.getElementById('site-config').textContent);
      let reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      let slice = function (list) { return Array.prototype.slice.call(list); };
      let MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      let store = {
        get: function (key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } },
        set: function (key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
        drop: function (key) { try { sessionStorage.removeItem(key); } catch { /* private mode */ } }
      };

      function pad(n) { return (n < 10 ? '0' : '') + n; }
      function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
      function niceDate(iso) {
        let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : iso;
      }
      function newRef(prefix) {
        let d = new Date(), tail = '';
        let letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let i = 0; i < 4; i++) tail += letters.charAt(Math.floor(Math.random() * letters.length));
        return prefix + '-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + tail;
      }
      // Where the visitor came from, when a campaign link says so.
      function source() {
        let found = [];
        location.search.replace(/[?&](utm_(?:source|medium|campaign))=([^&]*)/g, function (_, key, value) {
          try { found.push(key + '=' + decodeURIComponent(value.replace(/\+/g, ' '))); } catch { /* malformed */ }
        });
        return found.join(', ');
      }
      function mailto(subject, body) {
        return 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      }
      function footer(lines) {
        let here = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
        lines.push('', 'Written with the enquiry form on the Zanele Potelwa website' + (here ? ' (' + here + ')' : '') + '.');
        let from = source();
        if (from) lines.push('Source: ' + from);
        return lines.join('\r\n');
      }
      function copyText(text, done) {
        function fallback() {
          let area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
          document.body.appendChild(area);
          area.select();
          let ok = false;
          try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
          document.body.removeChild(area);
          done(ok);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
        } else fallback();
      }

      /* Inline validation: the message sits under the field it is about. */
      let errorCount = 0;
      function holder(el) { return el.closest('.chips') || el.closest('.check') || el; }
      function marked(el) { return el.closest('.chips') || el; }
      function setError(el, message) {
        let box = holder(el), target = marked(el);
        let p = box.nextElementSibling && box.nextElementSibling.classList.contains('field-error') ? box.nextElementSibling : null;
        if (!p) {
          p = document.createElement('p');
          p.className = 'field-error';
          p.id = 'field-error-' + (++errorCount);
          box.insertAdjacentElement('afterend', p);
        }
        p.textContent = message;
        p.hidden = false;
        target.setAttribute('aria-invalid', 'true');
        target.setAttribute('aria-describedby', p.id);
      }
      function clearError(el) {
        let box = holder(el), target = marked(el);
        let p = box.nextElementSibling;
        if (p && p.classList.contains('field-error')) p.hidden = true;
        target.removeAttribute('aria-invalid');
        target.removeAttribute('aria-describedby');
      }
      function problem(el) {
        let value = (el.value || '').trim();
        if (el.type === 'checkbox') return el.required && !el.checked ? 'Please tick this to continue.' : '';
        if (!value) {
          if (!el.required) return '';
          if (el.tagName === 'SELECT') return 'Choose an option.';
          if (el.type === 'date') return 'Choose a date.';
          return 'Please fill this in.';
        }
        if (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Enter an email address like name@example.com.';
        if (el.type === 'tel' && value.replace(/\D/g, '').length < 7) return 'Enter a phone number with its dialling code.';
        if (el.type === 'date' && el.hasAttribute('data-future') && value < isoDay(new Date())) return 'Choose a date that has not passed.';
        return '';
      }
      // Returns the first control that needs attention, or null.
      function validate(scope) {
        let first = null;
        slice(scope.querySelectorAll('[data-group][data-required]')).forEach(function (group) {
          let radios = slice(group.querySelectorAll('input[type="radio"]'));
          if (radios.some(function (r) { return r.checked; })) { clearError(radios[0]); return; }
          setError(radios[0], 'Choose one.');
          first = first || radios[0];
        });
        slice(scope.querySelectorAll('input[name], select[name], textarea[name]')).forEach(function (el) {
          if (el.type === 'radio' || el.closest('[hidden]')) return;
          let message = problem(el);
          if (message) { setError(el, message); first = first || el; }
          else clearError(el);
        });
        return first;
      }
      function focusFirst(scope, live) {
        let first = validate(scope);
        if (!first) return true;
        if (live) {
          let n = scope.querySelectorAll('[aria-invalid="true"]').length;
          live.textContent = n === 1 ? 'One field needs attention.' : n + ' fields need attention.';
        }
        first.focus({ preventScroll: true });
        let rect = holder(first).getBoundingClientRect();
        if (rect.top < 110 || rect.bottom > window.innerHeight - 80) {
          window.scrollTo({ top: window.pageYOffset + rect.top - 150, behavior: reduce.matches ? 'auto' : 'smooth' });
        }
        return false;
      }

      /* ---------- The stepped forms: booking and partnership brief ---------- */
      let FLOWS = {
        book: {
          prefix: 'ZPB',
          title: 'Booking request for Zanele Potelwa',
          subject: function (v) { return 'Booking request — ' + (v.event || 'event') + (v.date ? ' — ' + niceDate(v.date) : ''); },
          closing: 'I understand that sending this request does not reserve the date.'
        },
        brief: {
          prefix: 'ZPP',
          title: 'Partnership brief for Zanele Potelwa',
          subject: function (v) { return 'Partnership brief — ' + (v.company || 'brand'); },
          closing: ''
        }
      };

      function Flow(form) {
        let spec = FLOWS[form.getAttribute('data-flow')];
        let key = 'zp-draft-' + form.getAttribute('data-flow');
        let entry = slice(form.querySelectorAll('fieldset[data-step]'));
        let review = form.querySelector('[data-step="review"]');
        let done = form.querySelector('[data-step="done"]');
        let order = entry.concat([review]);
        let panels = order.concat([done]);
        let bar = form.querySelector('.progress');
        let count = form.querySelector('[data-count]');
        let live = form.querySelector('[data-live]');
        let notice = form.querySelector('[data-notice]');
        let saved = store.get(key) || {};
        let ref = saved.__ref || newRef(spec.prefix);
        let at = 0;
        let letter = '';

        order.forEach(function () { bar.appendChild(document.createElement('span')); });

        function controls() { return slice(form.querySelectorAll('fieldset[data-step] input[name], fieldset[data-step] select[name], fieldset[data-step] textarea[name]')); }
        function labelOf(el) {
          if (el.getAttribute('data-label')) return el.getAttribute('data-label');
          let group = el.closest('[data-group]');
          let node = group ? document.getElementById(group.getAttribute('aria-labelledby')) : form.querySelector('label[for="' + el.id + '"]');
          if (!node) return el.name;
          let clone = node.cloneNode(true);
          slice(clone.querySelectorAll('i')).forEach(function (i) { i.parentNode.removeChild(i); });
          return clone.textContent.trim();
        }
        // The raw values, for the draft and the subject line.
        function values() {
          let out = {};
          controls().forEach(function (el) {
            if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
            else if (el.type === 'checkbox') out[el.name] = el.checked;
            else out[el.name] = el.value.trim();
          });
          return out;
        }
        function save() {
          let v = values();
          v.__ref = ref;
          store.set(key, v);
        }
        function restore() {
          controls().forEach(function (el) {
            let v = saved[el.name];
            if (v == null) return;
            if (el.type === 'radio') el.checked = v === el.value;
            else if (el.type === 'checkbox') el.checked = v === true;
            else el.value = v;
          });
        }
        // What was entered, as the team will read it.
        function pairs() {
          let seen = {}, out = [];
          controls().forEach(function (el) {
            if (seen[el.name]) return;
            let value;
            if (el.type === 'radio') {
              let picked = form.querySelector('input[name="' + el.name + '"]:checked');
              value = picked ? picked.value : '';
            } else if (el.type === 'checkbox') {
              if (!el.checked) value = '';
              else value = el.hasAttribute('data-consent') ? 'Agreed (wording ' + CONFIG.consent + ', ' + new Date().toISOString().slice(0, 19) + 'Z)' : 'Yes';
            } else if (el.type === 'date') value = niceDate(el.value);
            else value = el.value.trim();
            seen[el.name] = true;
            if (value) out.push([labelOf(el), value]);
          });
          return out;
        }
        function compose() {
          let list = pairs();
          let lines = [spec.title, 'Reference: ' + ref, ''];
          list.forEach(function (pair) { lines.push(pair[0] + ': ' + pair[1]); });
          if (spec.closing) lines.push('', spec.closing);
          letter = footer(lines);
          let href = mailto(spec.subject(values()) + ' — ' + ref, letter);
          slice(form.querySelectorAll('[data-mail]')).forEach(function (a) { a.href = href; });
          return list;
        }
        function renderReview() {
          let list = compose();
          let dl = review.querySelector('[data-review]');
          dl.textContent = '';
          list.forEach(function (pair) {
            let dt = document.createElement('dt'), dd = document.createElement('dd');
            dt.textContent = pair[0];
            dd.textContent = pair[1].replace(/ \(wording .*\)$/, '');
            dl.appendChild(dt); dl.appendChild(dd);
          });
          slice(form.querySelectorAll('[data-ref], [data-done-ref]')).forEach(function (el) { el.textContent = ref; });
          if (notice) {
            // A date close to today is still worth asking about: say so plainly.
            let date = form.querySelector('[data-lead]');
            let days = date && date.value ? Math.round((new Date(date.value + 'T12:00') - new Date()) / 864e5) : null;
            notice.hidden = !(days != null && days < +date.getAttribute('data-lead'));
            if (!notice.hidden) notice.textContent = 'This date is less than two weeks away. Send the request anyway: the team will say quickly whether it is possible.';
          }
        }

        function show(i, move) {
          at = i;
          panels.forEach(function (panel, n) { panel.hidden = n !== i; });
          slice(bar.children).forEach(function (span, n) { span.classList.toggle('done', n <= i); });
          let name = panels[i].getAttribute('data-name');
          count.textContent = i < order.length ? 'Step ' + (i + 1) + ' of ' + order.length + ' · ' + name : name;
          if (!move) return;
          let box = form.closest('.booker');
          let top = box.getBoundingClientRect().top;
          if (top < 84 || top > window.innerHeight * 0.5) {
            window.scrollTo({ top: window.pageYOffset + top - 100, behavior: reduce.matches ? 'auto' : 'smooth' });
          }
          let title = panels[i].querySelector('.step-title');
          if (title) title.focus({ preventScroll: true });
        }

        function next() {
          if (at >= entry.length) return;
          if (!focusFirst(entry[at], live)) return;
          live.textContent = '';
          if (at + 1 === entry.length) renderReview();
          show(at + 1, true);
        }

        form.addEventListener('click', function (e) {
          let t = e.target.closest('button, a');
          if (!t || !form.contains(t)) return;
          if (t.hasAttribute('data-next')) next();
          else if (t.hasAttribute('data-back')) show(Math.max(0, Math.min(at, order.length) - 1), true);
          else if (t.hasAttribute('data-mail')) {
            // The link itself opens the mail app; the page then says what is left to do.
            window.setTimeout(function () { show(order.length, true); }, 350);
          } else if (t.hasAttribute('data-copy')) {
            let original = t.getAttribute('data-original') || t.textContent;
            t.setAttribute('data-original', original);
            copyText(letter, function (ok) {
              t.textContent = ok ? 'Copied' : 'Copy failed: select the text above';
              live.textContent = ok ? 'Copied to the clipboard.' : 'Could not copy.';
              window.setTimeout(function () { t.textContent = original; }, 2200);
            });
          } else if (t.hasAttribute('data-restart')) {
            store.drop(key);
            saved = {};
            form.reset();
            ref = newRef(spec.prefix);
            slice(form.querySelectorAll('[aria-invalid]')).forEach(clearError);
            show(0, true);
          }
        });
        form.addEventListener('submit', function (e) { e.preventDefault(); next(); });
        function touched(e) {
          let el = e.target;
          if (!el.name) return;
          if (marked(el).hasAttribute('aria-invalid') && !problem(el)) clearError(el);
          save();
        }
        form.addEventListener('input', touched);
        form.addEventListener('change', touched);

        restore();
        show(0, false);
      }
      slice(document.querySelectorAll('form[data-flow]')).forEach(function (form) { new Flow(form); });

      /* ---------- Community: each channel is its own, unticked choice ---------- */
      let join = document.getElementById('join');
      if (join) {
        let formPane = join.querySelector('[data-join-form]');
        let donePane = join.querySelector('[data-join-done]');
        let joinLive = join.querySelector('[data-live]');
        let channels = join.querySelector('[data-channels]');
        let byEmail = join.elements.byEmail, byWhatsApp = join.elements.byWhatsApp;
        let again = join.querySelector('[data-join-mail]');

        let reveal = function () {
          slice(join.querySelectorAll('[data-for]')).forEach(function (field) {
            let on = join.elements[field.getAttribute('data-for')].checked;
            field.hidden = !on;
            field.querySelector('input').required = on;
          });
        };
        let channelError = function (message) {
          let p = channels.nextElementSibling && channels.nextElementSibling.classList.contains('field-error') ? channels.nextElementSibling : null;
          if (!p) {
            p = document.createElement('p');
            p.className = 'field-error';
            p.id = 'join-channel-error';
            channels.insertAdjacentElement('afterend', p);
            channels.setAttribute('aria-describedby', p.id);
          }
          p.textContent = message;
          p.hidden = !message;
        };
        join.addEventListener('change', function (e) {
          if (e.target === byEmail || e.target === byWhatsApp) { reveal(); channelError(''); }
        });
        join.addEventListener('input', function (e) {
          if (e.target.name && e.target.hasAttribute('aria-invalid') && !problem(e.target)) clearError(e.target);
        });
        join.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!byEmail.checked && !byWhatsApp.checked) {
            channelError('Choose email, WhatsApp, or both.');
            joinLive.textContent = 'Choose email, WhatsApp, or both.';
            byEmail.focus();
            return;
          }
          if (!focusFirst(formPane, joinLive)) return;
          let name = join.elements.name.value.trim();
          let lines = ['Please add me to the Zanele Potelwa community list.', ''];
          if (name) lines.push('Name: ' + name);
          lines.push('Email updates: ' + (byEmail.checked ? 'Yes — ' + join.elements.email.value.trim() : 'No'));
          lines.push('WhatsApp updates: ' + (byWhatsApp.checked ? 'Yes — ' + join.elements.phone.value.trim() : 'No'));
          lines.push('', 'What I opted in to:');
          [byEmail, byWhatsApp].forEach(function (box) {
            if (box.checked) lines.push('- ' + box.parentNode.textContent.trim());
          });
          lines.push('Consent wording ' + CONFIG.consent + ', given ' + new Date().toISOString().slice(0, 19) + 'Z. I can opt out at any time.');
          let href = mailto('Join the community — Zanele Potelwa', footer(lines));
          again.href = href;
          window.location.href = href;
          formPane.hidden = true;
          donePane.hidden = false;
          donePane.querySelector('.step-title').focus({ preventScroll: true });
        });
        join.querySelector('[data-join-edit]').addEventListener('click', function () {
          donePane.hidden = true;
          formPane.hidden = false;
          byEmail.focus({ preventScroll: true });
        });
        reveal();
      }
    })();
