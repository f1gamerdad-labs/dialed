/* Badges: small rewards for the things that make a tune go well. Earned on this PC, shown on the History screen, with a small toast when one is won.
   The rules are in BADGES and award(); they take plain events from the rest of the page. */
(function (root) {
  'use strict';
  var KEY = 'dialed.badges';

  var BADGES = [
    { id: 'first-round', name: 'First round', text: 'Applied your first changes.' },
    { id: 'first-win', name: 'Gains made', text: 'A round that made your 1% lows better.' },
    { id: 'big-win', name: 'Big gain', text: 'Raised your 1% lows by 20% or more in one round.' },
    { id: 'comeback', name: 'Comeback', text: 'Turned a worse round into a better one.' },
    { id: 'smooth', name: 'Smooth operator', text: 'A capture with no stutters at all.' },
    { id: 'race-ready', name: 'Race ready', text: 'Ran the PC check with nothing left to fix.' },
    { id: 'three-runs', name: 'Three in a row', text: 'Captured three runs back to back.' },
    { id: 'profile', name: 'Set and saved', text: 'Saved your first settings profile.' },
    { id: 'share', name: 'Show-off', text: 'Made a share image of your result.' },
    { id: 'regular', name: 'Regular', text: 'Tuned on three different days.' }
  ];

  // ---- pure rules: (progress, event) -> { progress, earned: [ids] } ----
  function blank() { return { earned: {}, last: null, days: [] }; }
  function clean(p) { p = p && typeof p === 'object' ? p : {}; return { earned: p.earned && typeof p.earned === 'object' ? p.earned : {}, last: p.last || null, days: Array.isArray(p.days) ? p.days : [] }; }
  function award(prog, ev, data, now) {
    var p = clean(prog), got = [], day = (now || new Date()).toISOString().slice(0, 10); data = data || {};
    function give(id) { if (!p.earned[id]) { p.earned[id] = (now || new Date()).toISOString(); got.push(id); } }
    if (ev === 'round') {
      give('first-round');
      if (p.days.indexOf(day) < 0) p.days.push(day);
      if (p.days.length >= 3) give('regular');
    }
    if (ev === 'verdict') {
      if (data.verdict === 'better') { give('first-win'); if (data.gainPct >= 20) give('big-win'); if (p.last === 'worse') give('comeback'); }
      if (data.spikesPerMin === 0) give('smooth');
      if (data.verdict) p.last = data.verdict;
    }
    if (ev === 'pc' && data.ready) give('race-ready');
    if (ev === 'threeRuns') give('three-runs');
    if (ev === 'profile') give('profile');
    if (ev === 'share') give('share');
    return { progress: p, earned: got };
  }
  var api = { BADGES: BADGES, award: award, clean: clean, blank: blank };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- storage, toast and the History card ----
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load() { try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return blank(); } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* kept for this session only */ } }
  function toast(b) {
    var t = document.createElement('div'); t.className = 'badgetoast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span class="bt-star">&#9733;</span><div><small>Badge earned</small><b>' + esc(b.name) + '</b></div>';
    document.body.appendChild(t); setTimeout(function () { t.classList.add('out'); }, 3800); setTimeout(function () { t.remove(); }, 4400);
  }
  function render() {
    var el = $('badgeGrid'); if (!el) return;
    var p = load(), n = Object.keys(p.earned).length;
    $('badgeCount').textContent = n + ' of ' + BADGES.length;
    el.innerHTML = BADGES.map(function (b) {
      var on = !!p.earned[b.id];
      return '<div class="badge' + (on ? ' on' : '') + '"><span class="bstar">' + (on ? '&#9733;' : '&#9734;') + '</span><div><b>' + esc(b.name) + '</b><small>' + esc(b.text) + '</small></div></div>';
    }).join('');
  }
  function event(ev, data) {
    var r = award(load(), ev, data); save(r.progress);
    r.earned.forEach(function (id, i) { var b = BADGES.filter(function (x) { return x.id === id; })[0]; if (b) setTimeout(function () { toast(b); }, i * 1200); });
    render();
  }
  render();
  root.TunerBadges = { event: event, render: render };
})(typeof self !== 'undefined' ? self : this);
