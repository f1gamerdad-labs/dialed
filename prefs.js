/* Player preferences: how they sync their screen, whether they stream, and which settings Dialed must leave alone.
   Stored on this PC only (browser storage). Dialed reads them through TunerPrefs.forSim(simId) when it analyses. */
(function (root) {
  'use strict';
  var KEY = 'dialed.prefs';

  // ---- pure helpers (also used by the tests) ----
  function blank() { return { sync: 'unknown', streaming: false, never: {}, noUp: {} }; }   // never / noUp: { simId: { settingKey: true } }
  function clean(p) {
    var o = blank(); p = p || {};
    if (['unknown', 'vrr', 'vsync', 'off'].indexOf(p.sync) >= 0) o.sync = p.sync;
    o.streaming = !!p.streaming;
    ['never', 'noUp'].forEach(function (k) {
      var src = p[k] && typeof p[k] === 'object' ? p[k] : {};
      Object.keys(src).forEach(function (sim) {
        var keys = src[sim] && typeof src[sim] === 'object' ? src[sim] : {}, kept = {};
        Object.keys(keys).forEach(function (s) { if (keys[s]) kept[s] = true; });
        if (Object.keys(kept).length) o[k][sim] = kept;
      });
    });
    return o;
  }
  // what the engine gets for one sim
  function forSim(p, simId, screenHz) {
    p = clean(p);
    return { sync: p.sync, streaming: p.streaming, never: p.never[simId] || {}, noUp: p.noUp[simId] || {}, screenHz: screenHz > 0 ? screenHz : undefined };
  }
  function toggle(p, kind, simId, key, on) {
    p = clean(p); p[kind][simId] = p[kind][simId] || {};
    if (on) p[kind][simId][key] = true; else delete p[kind][simId][key];
    return clean(p);
  }
  var api = { clean: clean, forSim: forSim, toggle: toggle, blank: blank };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- storage ----
  var $ = function (id) { return document.getElementById(id); };
  function load() { try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return blank(); } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* kept for this session only */ } }
  var prefs = load();
  function app() { return window.TunerApp; }
  function simNow() { return app().state.sim; }
  function screenHz() { return window.TunerHost && window.TunerHost.screenHz; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- the card on the setup screen ----
  function refresh() {
    if (!$('prefsCard')) return;
    $('prefSync').value = prefs.sync; $('prefStream').checked = prefs.streaming;
    var hz = screenHz();
    $('prefHz').textContent = hz ? Math.round(hz) + ' Hz (read from Windows)' : 'Read by the Windows app';
    var sim = simNow(), n = Object.keys(prefs.never[sim.id] || {}).length, u = Object.keys(prefs.noUp[sim.id] || {}).length;
    $('prefProtectNote').textContent = n || u ? [n ? n + ' never changed' : '', u ? u + ' never turned up' : ''].filter(Boolean).join(', ') + ' in ' + (sim.short || sim.name) : '';
    $('target').placeholder = hz ? 'auto (' + Math.round(hz) + ')' : 'auto';
  }
  function change() { prefs = clean({ sync: $('prefSync').value, streaming: $('prefStream').checked, never: prefs.never, noUp: prefs.noUp }); save(prefs); refresh(); }

  // ---- the protect dialog ----
  function renderList() {
    var sim = simNow(), q = ($('protectFilter').value || '').toLowerCase(), never = prefs.never[sim.id] || {}, noUp = prefs.noUp[sim.id] || {};
    var rows = sim.table.settings.filter(function (s) { return !q || s.name.toLowerCase().indexOf(q) >= 0; }).map(function (s) {
      var canUp = !s.noRaise;
      return '<div class="prow"><span class="pname">' + esc(s.name) + '</span>' +
        '<label class="pchk"><input type="checkbox" data-kind="never" data-key="' + esc(s.key) + '"' + (never[s.key] ? ' checked' : '') + '> Never change</label>' +
        (canUp ? '<label class="pchk"><input type="checkbox" data-kind="noUp" data-key="' + esc(s.key) + '"' + (noUp[s.key] || never[s.key] ? ' checked' : '') + (never[s.key] ? ' disabled' : '') + '> Never turn up</label>' : '<span class="pchk pnote">Dialed never turns this up</span>') + '</div>';
    });
    $('protectList').innerHTML = rows.length ? rows.join('') : '<p class="hint">No settings match.</p>';
  }
  function openDialog() { $('protectSim').textContent = simNow().name; $('protectFilter').value = ''; renderList(); $('protect').hidden = false; $('protectFilter').focus(); }
  function closeDialog() { $('protect').hidden = true; refresh(); }

  if ($('prefsCard')) {
    $('prefSync').addEventListener('change', change); $('prefStream').addEventListener('change', change);
    $('prefProtect').addEventListener('click', openDialog); $('protectClose').addEventListener('click', closeDialog);
    $('protectFilter').addEventListener('input', renderList);
    $('protectList').addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-kind'); if (!k) return;
      prefs = toggle(prefs, k, simNow().id, e.target.getAttribute('data-key'), e.target.checked); save(prefs); renderList();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('protect').hidden) closeDialog(); });
    if (window.TunerApp && window.TunerApp.onSim) window.TunerApp.onSim(refresh);
    refresh();
  }

  root.TunerPrefs = { forSim: function (simId) { return forSim(prefs, simId, screenHz()); }, refresh: refresh, get: function () { return prefs; } };
})(typeof self !== 'undefined' ? self : this);
