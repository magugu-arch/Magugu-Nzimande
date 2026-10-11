/* ---------------------------------------------------------------------------
 * Motion: springs, velocity, momentum projection, rubber-banding, dragging.
 *
 * The principles are Apple's from "Designing Fluid Interfaces" (WWDC 2018):
 * motion starts from the value on screen, inherits the finger's velocity,
 * projects momentum forward, and can be grabbed and reversed at any instant.
 * Springs are described the way Apple describes them — damping ratio and
 * response — rather than mass/stiffness/damping.
 * ------------------------------------------------------------------------- */

var SPRING = {
  /** Default for anything that moved without being thrown: no overshoot. */
  settle: { damping: 1, response: 0.38 },
  /** Sheets and drawers that a finger has just released. */
  thrown: { damping: 0.86, response: 0.32 },
  /** Small UI flourishes (a badge counting up). */
  snappy: { damping: 1, response: 0.26 },
};

var activeSprings = [];
var lastFrame = 0;

function tick(now) {
  var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 1 / 30) : 1 / 60;
  lastFrame = now;
  for (var i = activeSprings.length - 1; i >= 0; i--) {
    var s = activeSprings[i];
    if (s._step(dt)) activeSprings.splice(i, 1);
  }
  if (activeSprings.length) requestAnimationFrame(tick);
  else lastFrame = 0;
}

/**
 * A critically- or under-damped spring on one number.
 *
 * `to()` re-targets from the current value *and* current velocity, so a
 * spring that is interrupted mid-flight carries its momentum into the new
 * motion instead of hitting a wall.
 */
function Spring(value, onUpdate, precision) {
  this.value = value;
  this.velocity = 0;
  this.target = value;
  this.damping = 1;
  this.response = 0.38;
  this.precision = precision || 0.05;
  this.onUpdate = onUpdate;
  this.onRest = null;
  this.running = false;
}

Spring.prototype.to = function (target, opts) {
  opts = opts || {};
  this.target = target;
  if (opts.velocity != null) this.velocity = opts.velocity;
  var cfg = opts.config || SPRING.settle;
  this.damping = cfg.damping;
  this.response = cfg.response;
  this.onRest = opts.onRest || null;
  if (reducedMotion.matches || opts.immediate) {
    this.stop();
    this.value = target;
    this.velocity = 0;
    this.onUpdate(target, this);
    var done = this.onRest;
    this.onRest = null;
    if (done) done();
    return this;
  }
  if (!this.running) {
    this.running = true;
    activeSprings.push(this);
    if (activeSprings.length === 1) requestAnimationFrame(tick);
  }
  return this;
};

/** Jump without animating — used while a finger is dragging the value. */
Spring.prototype.set = function (value) {
  this.stop();
  this.value = value;
  this.velocity = 0;
  this.onUpdate(value, this);
};

Spring.prototype.stop = function () {
  if (!this.running) return;
  this.running = false;
  var i = activeSprings.indexOf(this);
  if (i !== -1) activeSprings.splice(i, 1);
};

Spring.prototype._step = function (dt) {
  // Stiffness and damping from Apple's designer-facing parameters, unit mass.
  var omega = (2 * Math.PI) / this.response;
  var k = omega * omega;
  var c = 2 * this.damping * omega;
  var steps = Math.max(1, Math.ceil(dt / (1 / 480)));
  var h = dt / steps;
  for (var i = 0; i < steps; i++) {
    var a = -k * (this.value - this.target) - c * this.velocity;
    this.velocity += a * h;
    this.value += this.velocity * h;
  }
  var resting =
    Math.abs(this.value - this.target) < this.precision && Math.abs(this.velocity) < this.precision * 20;
  if (resting) {
    this.value = this.target;
    this.velocity = 0;
    this.running = false;
  }
  this.onUpdate(this.value, this);
  if (resting && this.onRest) {
    var done = this.onRest;
    this.onRest = null;
    done();
  }
  return resting;
};

/**
 * Where a release at this velocity would come to rest — Apple's projection
 * from the sample code, the same exponential decay a scroll view uses.
 */
function project(velocity, rate) {
  var d = rate || 0.995;
  return ((velocity / 1000) * d) / (1 - d);
}

/** Progressive resistance past a boundary: things slow down before they stop. */
function rubberband(overshoot, dimension, constant) {
  var c = constant || 0.55;
  var sign = overshoot < 0 ? -1 : 1;
  var x = Math.abs(overshoot);
  return (sign * (x * dimension * c)) / (dimension + c * x);
}

/** Recent pointer history, so release velocity reflects the last ~80 ms. */
function VelocityTracker() {
  this.samples = [];
}
VelocityTracker.prototype.add = function (x, y, t) {
  this.samples.push({ x: x, y: y, t: t });
  while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
};
VelocityTracker.prototype.velocity = function (now) {
  var s = this.samples;
  if (s.length < 2) return { x: 0, y: 0 };
  var last = s[s.length - 1];
  // A finger that stopped before lifting has no momentum to hand off.
  if (now - last.t > 60) return { x: 0, y: 0 };
  var first = s[0];
  for (var i = 0; i < s.length; i++) {
    if (last.t - s[i].t <= 80) {
      first = s[i];
      break;
    }
  }
  var dt = (last.t - first.t) / 1000;
  if (dt <= 0) return { x: 0, y: 0 };
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
};

/**
 * A drag recogniser on Pointer Events.
 *
 * Nothing is claimed until the pointer has moved past a small hysteresis in
 * the allowed direction; then the pointer is captured so tracking continues
 * outside the element, and every move is handed to `move` 1:1.
 */
function draggable(el, opts) {
  var SLOP = 8;
  var start = null;
  var tracker = null;
  var claimed = false;

  function down(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (opts.canStart && !opts.canStart(e)) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, target: e.target };
    tracker = new VelocityTracker();
    tracker.add(e.clientX, e.clientY, e.timeStamp || performance.now());
    claimed = false;
  }
  function moveHandler(e) {
    if (!start || e.pointerId !== start.id) return;
    var dx = e.clientX - start.x;
    var dy = e.clientY - start.y;
    tracker.add(e.clientX, e.clientY, e.timeStamp || performance.now());
    if (!claimed) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      var horizontal = Math.abs(dx) > Math.abs(dy);
      var ok =
        opts.axis === 'x'
          ? horizontal && (!opts.direction || dx * opts.direction > 0)
          : opts.axis === 'y'
            ? !horizontal && (!opts.direction || dy * opts.direction > 0)
            : true;
      if (opts.shouldClaim) ok = ok && opts.shouldClaim(dx, dy, start);
      if (!ok) {
        start = null;
        listen(false);
        return;
      }
      claimed = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      if (opts.begin) opts.begin(start, e);
    }
    e.preventDefault();
    opts.move(dx, dy, e);
  }
  function up(e) {
    if (!start || e.pointerId !== start.id) return;
    var wasClaimed = claimed;
    var v = tracker.velocity(e.timeStamp || performance.now());
    var dx = e.clientX - start.x;
    var dy = e.clientY - start.y;
    var origin = start;
    start = null;
    claimed = false;
    listen(false);
    if (wasClaimed) opts.end(dx, dy, v, e);
    else if (opts.tap && e.type === 'pointerup') opts.tap(origin, e);
  }
  function cancel(e) {
    if (!start || e.pointerId !== start.id) return;
    var wasClaimed = claimed;
    start = null;
    claimed = false;
    listen(false);
    if (wasClaimed) opts.end(0, 0, { x: 0, y: 0 }, e, true);
  }
  // Touch pointers are implicitly captured by their target; a mouse is not,
  // so follow the pointer at the window until the gesture is claimed.
  function listen(on) {
    var method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('pointermove', moveHandler, { passive: false });
    window[method]('pointerup', up);
    window[method]('pointercancel', cancel);
  }
  el.addEventListener('pointerdown', function (e) {
    down(e);
    if (start) listen(true);
  });
  return {
    isDragging: function () {
      return claimed;
    },
  };
}

/*
 * Press feedback on pointer-down. :active alone is unreliable on iOS until a
 * touch listener exists, and it does not survive a finger sliding away and
 * back; this class follows the finger with ~10px of slop.
 */
(function () {
  var pressed = null;
  var origin = null;
  var SEL = '.pressable, .icon-btn, .tab, .chip, .btn, .card-link, .choice, .date, .story-card';
  document.addEventListener(
    'pointerdown',
    function (e) {
      var el = e.target.closest ? e.target.closest(SEL) : null;
      if (!el || el.getAttribute('aria-disabled') === 'true') return;
      pressed = el;
      origin = { x: e.clientX, y: e.clientY };
      el.classList.add('is-pressed');
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    function (e) {
      if (!pressed) return;
      var far = Math.abs(e.clientX - origin.x) > 10 || Math.abs(e.clientY - origin.y) > 10;
      pressed.classList.toggle('is-pressed', !far);
    },
    { passive: true },
  );
  ['pointerup', 'pointercancel'].forEach(function (type) {
    document.addEventListener(
      type,
      function () {
        if (pressed) pressed.classList.remove('is-pressed');
        pressed = null;
      },
      { passive: true },
    );
  });
})();
