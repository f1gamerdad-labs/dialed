/* Export and import of Dialed's history and preferences, for moving to a new PC or keeping a copy. Everything Dialed remembers about you in the page
   (rounds, profiles, preferences, badges, choices) lives in the browser storage with keys starting "dialed." or "iracing-tuner.". Export writes those to one
   JSON file (the app saves it to Documents\Dialed\Exports); import checks the file carefully and puts them back. Hardware fingerprints are left out on purpose,
   so a new PC gets a fresh baseline prompt. Pure functions are tested in test\settings-io.js. Captures and the sims' own settings files are not part of it. */
(function (root) {
  'use strict';

  var APP = 'dialed-settings', VERSION = 1, MAX_KEYS = 300, MAX_CHARS = 3000000;
  var OK_KEY = /^(dialed|iracing-tuner)\.[A-Za-z0-9_.\-]{1,80}$/;
  var SKIP = { 'dialed.hwSig': 1, 'dialed.autoShared': 1, 'dialed.updateLater': 1, 'dialed.justUpdated': 1 };   // belong to this PC or this moment, not to the person

  function keys(storage) { var out = [], i; for (i = 0; i < storage.length; i++) out.push(storage.key(i)); return out; }
  function wanted(k) { return OK_KEY.test(k) && !SKIP[k]; }

  function buildExport(storage, now) {
    var data = {}; keys(storage).forEach(function (k) { if (wanted(k)) { var v = storage.getItem(k); if (typeof v === 'string') data[k] = v; } });
    return { app: APP, version: VERSION, exported: (now || new Date()).toISOString(), count: Object.keys(data).length, data: data };
  }

  function parseImport(text) {
    var j; try { j = JSON.parse(text); } catch (e) { return { ok: false, message: 'That is not a Dialed export file (it could not be read).' }; }
    if (!j || typeof j !== 'object' || j.app !== APP) return { ok: false, message: 'That is not a Dialed export file.' };
    if (typeof j.version !== 'number' || j.version > VERSION) return { ok: false, message: 'That file was made by a newer version of Dialed. Update Dialed and try again.' };
    if (!j.data || typeof j.data !== 'object' || Array.isArray(j.data)) return { ok: false, message: 'That export file has no data in it.' };
    var ks = Object.keys(j.data), total = 0, clean = {}, skipped = 0;
    if (ks.length > MAX_KEYS) return { ok: false, message: 'That export file has too many entries to be a Dialed export.' };
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], v = j.data[k];
      if (!wanted(k) || typeof v !== 'string') { skipped++; continue; }
      total += v.length; if (total > MAX_CHARS) return { ok: false, message: 'That export file is too large to be a Dialed export.' };
      clean[k] = v;
    }
    if (!Object.keys(clean).length) return { ok: false, message: 'That export file has nothing Dialed can use.' };
    return { ok: true, data: clean, count: Object.keys(clean).length, skipped: skipped, exported: j.exported || null };
  }

  function applyImport(storage, data) { Object.keys(data).forEach(function (k) { storage.setItem(k, data[k]); }); return Object.keys(data).length; }

  var api = { buildExport: buildExport, parseImport: parseImport, applyImport: applyImport, wanted: wanted };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- About page buttons ----
  var $ = function (id) { return document.getElementById(id); };
  function msg(text, cls) { var m = $('ioMsg'); if (!m) return; m.textContent = text; m.className = 'status ' + (cls || ''); }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  if ($('ioCard')) {
    $('ioExport').addEventListener('click', function () {
      var wv = root.chrome && root.chrome.webview;
      if (!wv) { msg('Export works in the Windows app.', 'bad'); return; }
      var ex = buildExport(root.localStorage);
      msg('Saving...');
      wv.postMessage({ type: 'saveExport', name: 'Dialed-settings-' + stamp(), text: JSON.stringify(ex) });
    });
    $('ioImport').addEventListener('click', function () { $('ioFile').click(); });
    $('ioFile').addEventListener('change', function () {
      var f = $('ioFile').files[0]; $('ioFile').value = ''; if (!f) return;
      if (f.size > MAX_CHARS * 2) { msg('That file is too large to be a Dialed export.', 'bad'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var r = parseImport(String(rd.result));
        if (!r.ok) { msg(r.message, 'bad'); return; }
        if (!confirm('Import ' + r.count + ' saved items' + (r.exported ? ' from ' + new Date(r.exported).toLocaleDateString() : '') + '?\n\nThis replaces your current history, profiles and preferences in Dialed. Your captures and your games\' settings files are not touched. Dialed reloads afterwards.')) return;
        applyImport(root.localStorage, r.data); msg('Imported. Reloading...', 'good'); setTimeout(function () { root.location.reload(); }, 600);
      };
      rd.onerror = function () { msg('Could not read that file.', 'bad'); };
      rd.readAsText(f);
    });
  }
  root.TunerSettingsIO = { saved: function (m) { msg(m.ok ? 'Saved to ' + m.path : (m.message || 'Could not save the file.'), m.ok ? 'good' : 'bad'); } };
})(typeof self !== 'undefined' ? self : this);
