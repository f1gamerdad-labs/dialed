/* Can you trust these captures? Looks at the captures themselves and says, in plain words, what could make the numbers misleading:
   too short, a rough first 15 seconds, a run that slows down as it goes (heat), runs that disagree with each other, or busy background programs.
   Advice only: it never blocks anything. Pure functions, tested in test\reliability.js. */
(function (root) {
  'use strict';

  function sorted(a) { return a.filter(isFinite).sort(function (x, y) { return x - y; }); }
  function median(a) { var s = sorted(a); if (!s.length) return NaN; var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function pct(s, p) { if (!s.length) return NaN; var i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
  function seconds(cap) { return cap.ft.reduce(function (x, y) { return x + y; }, 0) / 1000; }

  // Typical (median) frame time in the first and last third of the capture, by time. Median so a few stutters do not move it.
  function thirds(cap) {
    var total = seconds(cap) * 1000, a = [], c = [], t = 0, i;
    for (i = 0; i < cap.ft.length; i++) { if (t < total / 3) a.push(cap.ft[i]); else if (t >= total * 2 / 3) c.push(cap.ft[i]); t += cap.ft[i]; }
    return { first: median(a), last: median(c) };
  }
  function fpsOf(cap) { return 1000 / median(cap.ft); }
  function low1(cap) { return 1000 / pct(sorted(cap.ft), 0.99); }

  function nameList(list) { list = list || []; return list.length <= 2 ? list.join(' and ') : list.slice(0, 2).join(', ') + ' and ' + (list.length - 2) + ' more'; }

  // caps: captures in the order they were taken. ctx: { busy: ['Chrome', ...] } (optional)
  function assess(caps, ctx) {
    caps = caps || []; ctx = ctx || {};
    var items = [], n = caps.length;
    if (!n) return { level: 'none', items: [], headline: '' };
    function add(level, text) { items.push({ level: level, text: text }); }
    var label = function (i) { return n > 1 ? 'Capture ' + (i + 1) + ' ' : 'This capture '; };

    caps.forEach(function (c, i) {
      var sec = seconds(c);
      if (sec < 40) add('warn', label(i) + 'is only ' + Math.round(sec) + ' seconds. Aim for 60, so a few unlucky moments do not decide the result.');
      // a rough start: most of the stutters in the first 15 seconds
      var med = median(c.ft), at = Math.max(med * 2, med + 4), t = 0, early = 0, all = 0;
      c.ft.forEach(function (f) { if (f > at) { all++; if (t <= 15000) early++; } t += f; });
      if (all >= 3 && early / all >= 0.6) add('warn', label(i) + 'has most of its stutters in the first 15 seconds. That is usually the game loading shaders and textures, not your settings. Drive a lap or two first, then capture.');
      // slowing down during the run
      if (sec >= 30) {
        var th = thirds(c), slower = th.last / th.first - 1;
        if (slower > 0.08) add('warn', label(i) + 'got about ' + Math.round(slower * 100) + '% slower between the start and the end. If it does this on every run it can be heat: a processor or graphics card that gets hot slows itself down. It can also just be a heavier part of the track, so compare the same stretch each time.');
      }
    });

    // runs that get slower one after another
    if (n >= 3) {
      var f = caps.map(fpsOf), falling = true, k;
      for (k = 1; k < f.length; k++) if (!(f[k] < f[k - 1])) falling = false;
      var drop = 1 - f[f.length - 1] / f[0];
      if (falling && drop > 0.06) add('warn', 'Each capture was slower than the one before (down about ' + Math.round(drop * 100) + '% over the runs). That pattern points to heat building up or a power limit, not to chance. Check your cooling and fan curves, give the PC a few minutes to cool, and leave a gap between rounds.');
    }

    // runs that disagree
    if (n >= 2) {
      var lows = caps.map(low1), spread = (Math.max.apply(null, lows) - Math.min.apply(null, lows)) / (lows.reduce(function (x, y) { return x + y; }, 0) / lows.length);
      if (spread > 0.15) add('warn', 'Your captures disagree by about ' + Math.round(spread * 100) + '% on 1% lows. That is too noisy to trust small differences. Use the exact same session, track, car and field each time, and close background programs.');
    }

    if (ctx.busy && ctx.busy.length) add('warn', nameList(ctx.busy) + ' ' + (ctx.busy.length === 1 ? 'was' : 'were') + ' running. Background programs cost frame rate and add stutters that are not the sim\'s. Close them and capture again for the cleanest numbers.');
    if (n === 1) add('info', 'One capture is a rough guide. Two or three captures of the same session give firmer advice.');

    var warns = items.filter(function (x) { return x.level === 'warn'; }).length;
    return { level: warns ? 'check' : 'good', warns: warns, items: items,
      headline: warns ? (warns === 1 ? 'One thing could make these numbers misleading' : warns + ' things could make these numbers misleading') : 'These captures look reliable' };
  }

  var api = { assess: assess, thirds: thirds };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render(caps, ctx) {
    var box = $('reliabCard'); if (!box) return;
    var r = assess(caps, ctx);
    if (r.level === 'none') { box.hidden = true; return; }
    $('reliabHead').textContent = r.headline;
    $('reliabHead').className = r.level === 'good' ? 'good' : 'warn';
    $('reliabList').innerHTML = r.items.map(function (x) { return '<li' + (x.level === 'warn' ? ' class="warnli"' : '') + '>' + esc(x.text) + '</li>'; }).join('');
    box.hidden = false;
  }
  root.TunerReliability = { render: render, assess: assess };
})(typeof self !== 'undefined' ? self : this);
