/* Draws the "Your frame times" chart on the Results screen from core.timeline(). Plain SVG, so it needs nothing extra. */
(function (root) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var caps = [], vramPressure = false;

  function chart(tl) {
    var W = 760, H = 232, L = 44, R = 12, T = 26, B = 28, pw = W - L - R, ph = H - T - B;
    var top = Math.max(tl.spikeAtMs * 1.4, tl.points.reduce(function (m, p) { return Math.max(m, p.max); }, 0) * 1.05, 20);
    function x(t) { return L + (tl.seconds ? t / tl.seconds : 0) * pw; }
    function y(ms) { return T + ph - Math.min(1, ms / top) * ph; }
    var barW = Math.max(1.5, pw / tl.points.length - 0.6), g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { var v = top * f; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="tlgrid"/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" class="tltxt" text-anchor="end">' + Math.round(v) + '</text>'; });
    var step = tl.seconds > 45 ? 15 : 10; for (var s = 0; s <= tl.seconds; s += step) g += '<text x="' + x(s).toFixed(1) + '" y="' + (H - 8) + '" class="tltxt" text-anchor="middle">' + s + ' s</text>';
    var bars = tl.points.map(function (p) { var hh = Math.max(1, T + ph - y(p.max)); return '<rect x="' + (x(p.t) - barW / 2).toFixed(1) + '" y="' + y(p.max).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + hh.toFixed(1) + '" class="tlbar' + (p.max > tl.spikeAtMs ? ' hot' : '') + '"/>'; }).join('');
    var line = '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(tl.spikeAtMs).toFixed(1) + '" y2="' + y(tl.spikeAtMs).toFixed(1) + '" class="tlspike"/><text x="' + (W - R) + '" y="' + (y(tl.spikeAtMs) - 4).toFixed(1) + '" class="tltxt" text-anchor="end">stutter line</text>';
    var dots = tl.spikes.slice(0, 200).map(function (s2) { return '<circle cx="' + x(s2.t).toFixed(1) + '" cy="' + y(s2.ms).toFixed(1) + '" r="4" class="tldot ' + s2.side + '"/>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" class="tlsvg"><text x="4" y="12" class="tltxt">milliseconds per frame</text>' + g + bars + line + dots + '</svg>';
  }

  function show(i) {
    var cap = caps[i]; if (!cap || !root.TunerCore) return;
    var tl = root.TunerCore.timeline(cap);
    $('tlChart').innerHTML = tl.points.length ? chart(tl) : '<p class="hint">This capture has no frame data.</p>';
    $('tlNotes').innerHTML = root.TunerCore.stutterNotes(tl, vramPressure).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
  }
  function render(c, pressure) {
    caps = c || []; vramPressure = !!pressure;
    $('timelineCard').hidden = !caps.length;
    $('tlPick').innerHTML = caps.map(function (cap, i) { return '<option value="' + i + '">' + esc(cap.name || ('Capture ' + (i + 1))) + '</option>'; }).join('');
    $('tlPick').hidden = caps.length < 2; var lab = document.querySelector('label[for=tlPick]'); if (lab) lab.hidden = caps.length < 2;
    if (caps.length) show(0);
  }
  if ($('tlPick')) $('tlPick').addEventListener('change', function () { show(parseInt($('tlPick').value, 10) || 0); });
  root.TunerTimeline = { render: render };
})(typeof self !== 'undefined' ? self : this);
