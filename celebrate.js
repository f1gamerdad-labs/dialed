/* Result pop-ups: a celebration (confetti and Sean's fist pump) when a round made things better, and a friendly "let's get it back" message when it made
   things worse. Shown once per round. "Don't show animations in future" turns both off; they can be turned back on from About.
   Put your own pictures in assets/: celebrate-win.png (fist pump) and celebrate-setback.png (optional). Missing pictures fall back to the Dialed logo. */
(function (root) {
  'use strict';

  var WIN = { title: 'Nice one! That worked!', text: 'Your change made the sim run better. You put in the work and it paid off.', btn: 'Brilliant' };
  var LOSS = { title: "Oh no, that's not what we want.", text: "Let's see how we can get your performance back!", btn: "Let's fix it" };
  var COLORS = ['#ff2e93', '#ff8a2a', '#ffd23f', '#9b4dff', '#34e0a1', '#4db8ff', '#ffffff'];

  // Pure decision, shared with the tests: should this round's verdict get a pop-up, and which one?
  function kindFor(verdict) { return verdict === 'better' ? 'win' : verdict === 'worse' ? 'loss' : null; }
  var api = { kindFor: kindFor, WIN: WIN, LOSS: LOSS };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  var OFF = 'dialed.noCelebrate', DONE = 'dialed.celebrated';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* just not remembered */ } }
  function enabled() { return get(OFF) !== '1'; }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function seenKeys() { try { return JSON.parse(get(DONE) || '[]'); } catch (e) { return []; } }

  var raf = 0, box = null;
  function confetti(cv, ms) {
    var ctx = cv.getContext('2d'), w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, t0 = performance.now(), P = [];
    for (var i = 0; i < 160; i++) {
      var side = i % 2 ? 1 : -1;
      P.push({ x: w / 2 + side * (w * 0.05), y: h * 0.62, vx: side * (2 + Math.random() * 7) * (w / 900 + 0.5), vy: -(8 + Math.random() * 12), g: 0.28 + Math.random() * 0.15,
        s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLORS[i % COLORS.length], round: i % 5 === 0 });
    }
    (function frame(now) {
      var life = now - t0; ctx.clearRect(0, 0, w, h);
      P.forEach(function (p) {
        p.vy += p.g; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (ms - life) / 700)); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.3); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (life < ms) raf = requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })(t0);
  }

  function close() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (box) { box.remove(); box = null; }
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') close(); }

  function show(kind, info) {
    close();
    var c = kind === 'win' ? WIN : LOSS, img = kind === 'win' ? 'assets/celebrate-win.png' : 'assets/celebrate-setback.png';
    box = document.createElement('div');
    box.className = 'overlay cele ' + kind; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'celeTitle');
    var stat = info && info.line ? '<p class="celestat">' + info.line + '</p>' : '';
    box.innerHTML = '<canvas class="celecv" aria-hidden="true"></canvas><div class="celebox"><div class="celepic"><img alt="" src="' + img + '"></div>' +
      '<h2 id="celeTitle">' + c.title + '</h2>' + stat + '<p>' + c.text + '</p>' +
      '<div class="celeact"><button id="celeOk">' + c.btn + '</button><button class="ghost" id="celeOff">Don\'t show animations in future</button></div></div>';
    document.body.appendChild(box);
    var im = box.querySelector('img');
    im.addEventListener('error', function () { im.onerror = null; im.src = 'assets/f1gd-logo.png'; im.className = 'logo'; }, { once: true });
    box.querySelector('#celeOk').addEventListener('click', close);
    box.querySelector('#celeOff').addEventListener('click', function () { set(OFF, '1'); close(); sync(); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', onKey);
    box.querySelector('#celeOk').focus();
    if (kind === 'win' && !reduced()) confetti(box.querySelector('.celecv'), 4200);
  }

  // Called by the page after it has worked out how last round went. key identifies the round so it only celebrates once.
  function round(key, verdict, info) {
    var kind = kindFor(verdict);
    if (!kind || !enabled()) return;
    var seen = seenKeys(); if (seen.indexOf(key) >= 0) return;
    seen.push(key); set(DONE, JSON.stringify(seen.slice(-50)));
    show(kind, info);
  }

  // About page: a button to switch the pop-ups back on (or off).
  var tog = null;
  function sync() { if (tog) tog.textContent = enabled() ? 'Turn off result animations' : 'Turn on result animations'; }
  tog = document.querySelector('[data-cele]'); // this script sits at the end of the page, so the button already exists
  if (tog) { tog.hidden = false; sync(); tog.addEventListener('click', function () { set(OFF, enabled() ? '1' : '0'); sync(); }); }

  root.TunerCelebrate = { round: round, show: show, enabled: enabled };
})(typeof self !== 'undefined' ? self : this);
