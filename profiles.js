/* Saved profiles: name a set of graphics settings ("Daytona full field", "Rain", "Triples") and put it back with one click.
   A profile stores the current value of every setting Dialed knows about, for one sim and one driving/replay mode. Loading one writes
   only what differs, through the same backed-up write Dialed uses for its own changes. Stored on this PC (browser storage). */
(function (root) {
  'use strict';
  var KEY = 'dialed.profiles';

  // ---- pure helpers (tested) ----
  function secOf(s, section) { return s.section || section; }
  function snapshot(ini, settings, section) {
    var values = {};
    settings.forEach(function (s) { var o = (ini && ini[secOf(s, section)]) || {}; if (o[s.key] !== undefined) values[secOf(s, section) + '|' + s.key] = String(o[s.key]); });
    return values;
  }
  function same(a, b) { var x = parseFloat(a), y = parseFloat(b); return isFinite(x) && isFinite(y) ? x === y : String(a) === String(b); }
  // what has to change to turn the current file into the profile
  function diff(ini, settings, section, profile) {
    var out = [];
    settings.forEach(function (s) {
      var sec = secOf(s, section), id = sec + '|' + s.key, o = (ini && ini[sec]) || {};
      if (profile.values[id] === undefined || o[s.key] === undefined || same(o[s.key], profile.values[id])) return;
      out.push({ key: s.key, name: s.name, section: sec, from: parseFloat(o[s.key]), to: parseFloat(profile.values[id]), fromLabel: String(o[s.key]), toLabel: String(profile.values[id]), dir: 'profile' });
    });
    return out;
  }
  function add(all, simId, mode, name, values) {
    all = all && typeof all === 'object' ? all : {};
    var list = (all[simId] = (all[simId] || []).filter(function (p) { return !(p.name === name && p.mode === mode); }));
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, mode: mode, saved: new Date().toISOString(), values: values });
    return all;
  }
  function remove(all, simId, id) { all = all || {}; all[simId] = (all[simId] || []).filter(function (p) { return p.id !== id; }); return all; }
  var api = { snapshot: snapshot, diff: diff, add: add, remove: remove, same: same };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- screen ----
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function save(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* kept for this session only */ } }
  function app() { return root.TunerApp; }
  function msg(t, cls) { $('profMsg').textContent = t; $('profMsg').className = 'status ' + (cls || ''); }

  function render() {
    var A = app(); if (!A || !$('profCard')) return;
    var st = A.state, sim = st.sim, mode = A.currentMode ? A.currentMode().id : 'driving', list = (load()[sim.id] || []).filter(function (p) { return p.mode === mode; });
    $('profSave').disabled = !st.ini;
    $('profHint').textContent = st.ini ? '' : 'Load your game file first (Setup, above), then you can save it as a profile.';
    $('profList').innerHTML = list.length ? list.map(function (p) {
      return '<div class="profrow"><div><b>' + esc(p.name) + '</b><small>Saved ' + new Date(p.saved).toLocaleDateString() + '</small></div>' +
        '<button data-load="' + esc(p.id) + '"' + (st.ini ? '' : ' disabled') + '>Load</button><button class="ghost" data-del="' + esc(p.id) + '">Delete</button></div>';
    }).join('') : '<p class="hint" style="margin:0">No profiles yet for ' + esc(sim.name) + '.</p>';
  }

  function doSave() {
    var A = app(), st = A.state, name = ($('profName').value || '').trim().slice(0, 40);
    if (!st.ini) return;
    if (!name) { msg('Give the profile a name first.', 'warn'); return; }
    var mode = A.currentMode ? A.currentMode().id : 'driving', section = A.currentSection();
    var values = snapshot(st.ini, st.sim.table.settings, section);
    if (!Object.keys(values).length) { msg('No settings were found in the file you loaded.', 'bad'); return; }
    save(add(load(), st.sim.id, mode, name, values)); $('profName').value = '';
    if (root.TunerBadges) root.TunerBadges.event('profile');
    msg('Saved "' + name + '" (' + Object.keys(values).length + ' settings).', 'good'); render();
  }

  function doLoad(id) {
    var A = app(), st = A.state, sim = st.sim, mode = A.currentMode ? A.currentMode().id : 'driving';
    var p = (load()[sim.id] || []).filter(function (x) { return x.id === id; })[0]; if (!p || !st.ini) return;
    var changes = diff(st.ini, sim.table.settings, A.currentSection(), p);
    if (!changes.length) { msg('"' + p.name + '" already matches your settings. Nothing to change.', 'good'); return; }
    var closeSim = A.simRunning(), n = changes.length, name = sim.name;
    function go() {
      var texts = {}; sim.files.forEach(function (f) { if (st.files[f.id]) texts[f.id] = st.files[f.id].text; });
      var changed = root.TunerSims.applyChanges(sim, texts, changes);
      var payload = Object.keys(changed).map(function (fid) { return { fileId: fid, name: st.files[fid].name, text: changed[fid] }; });
      msg(closeSim ? 'Closing ' + name + '...' : 'Loading...', '');
      A.deliver(payload, closeSim).then(function (out) {
        if (!out.ok) { msg(out.message || 'Could not write the settings.', 'bad'); return; }
        A.clearCaptures();
        msg('Loaded "' + p.name + '": ' + n + ' setting' + (n > 1 ? 's' : '') + ' changed' + (out.backup ? '. Your old settings are backed up.' : '.') + ' Start ' + name + ', then capture again if you want to measure it.', 'good');
      });
    }
    if (closeSim && root.TunerWarn) {
      root.TunerWarn.confirm({ title: name + ' will close', lead: 'Loading "' + p.name + '" closes ' + name + ' right now. If you are in a session, you will leave it.',
        steps: [name + ' is asked to close, the same as choosing Exit.', 'Your current settings files are backed up first.', n + ' setting' + (n > 1 ? 's are' : ' is') + ' changed to match the profile.', 'Start ' + name + ' again.'],
        okLabel: 'Close ' + sim.short + ' and load it', cancelLabel: 'No, keep ' + sim.short + ' open' }).then(function (ok) { if (ok) go(); });
    } else go();
  }

  if ($('profCard')) {
    $('profSave').addEventListener('click', doSave);
    $('profName').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSave(); });
    $('profList').addEventListener('click', function (e) {
      var l = e.target.getAttribute('data-load'), d = e.target.getAttribute('data-del');
      if (l) doLoad(l); else if (d) { save(remove(load(), app().state.sim.id, d)); render(); }
    });
    document.addEventListener('change', function (e) { if (e.target && e.target.name === 'mode') render(); });
    if (root.TunerApp && root.TunerApp.onSim) root.TunerApp.onSim(render);
    setInterval(render, 2500);   // the game file is loaded after this screen appears, so keep the buttons current
    render();
  }
  root.TunerProfiles = { render: render };
})(typeof self !== 'undefined' ? self : this);
