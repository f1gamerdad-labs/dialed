/* Time to re-test? Results go stale when the PC changes under them. A few seconds after Dialed opens it reads the same hardware facts as the PC check
   (nothing is sent anywhere), keeps a small fingerprint of the graphics card(s), driver date, processor and memory, and if the fingerprint differs from the
   one it last saw, offers a fresh baseline. First ever launch just stores the fingerprint. Pure comparison in compare(), tested in test\retest.js. */
(function (root) {
  'use strict';

  function makeSig(f) {
    f = f || {};
    var ram = (f.ram || []).reduce(function (a, m) { return a + (+m.capGB || 0); }, 0);
    return {
      gpus: (f.gpus || []).map(function (g) { return { name: String(g.name || ''), date: g.date || '' }; }).filter(function (g) { return g.name; }),
      cpu: f.cpu && f.cpu.name ? String(f.cpu.name).replace(/\s+/g, ' ').trim() : '',
      ramGB: Math.round(ram)
    };
  }
  // what changed between the fingerprint seen before (old) and now (cur), as short plain sentences
  function compare(old, cur) {
    if (!old || !cur) return { changed: false, items: [], driver: false, hardware: false };
    var items = [], driver = false, hardware = false;
    cur.gpus.forEach(function (g) {
      var was = old.gpus.filter(function (o) { return o.name === g.name; })[0];
      if (!was) { items.push('A different graphics card is installed (' + g.name + ').'); hardware = true; }
      else if (was.date && g.date && was.date !== g.date) { items.push('The ' + g.name + ' driver changed (dated ' + was.date + ' before, ' + g.date + ' now).'); driver = true; }
    });
    if (old.cpu && cur.cpu && old.cpu !== cur.cpu) { items.push('The processor is different (' + cur.cpu + ').'); hardware = true; }
    if (old.ramGB && cur.ramGB && old.ramGB !== cur.ramGB) { items.push('The amount of memory changed (' + old.ramGB + ' GB before, ' + cur.ramGB + ' GB now).'); hardware = true; }
    return { changed: items.length > 0, items: items, driver: driver, hardware: hardware };
  }

  var api = { makeSig: makeSig, compare: compare };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  var KEY = 'dialed.hwSig', $ = function (id) { return document.getElementById(id); }, cur = null;
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* just not remembered */ } }
  function hasHistory() { try { return !!(root.TunerApp && root.TunerApp.Store && root.TunerApp.Store.load().length); } catch (e) { return false; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function show(r) {
    var b = $('retestBar'); if (!b) return;
    $('retestWhy').innerHTML = r.items.map(esc).join(' ');
    $('retestAdvice').textContent = r.driver && !r.hardware
      ? 'A new driver can change how the sim performs, so earlier results may no longer match. Take a fresh baseline before trusting old comparisons.'
      : 'Earlier results were measured on different hardware, so they may no longer apply. Take a fresh baseline before trusting old comparisons.';
    b.hidden = false;
  }
  function ack() { if (cur) put(cur); var b = $('retestBar'); if (b) b.hidden = true; }

  function check() {
    var H = root.TunerHost;
    if (!H || typeof H.pcCheck !== 'function') return;
    if (H.running && Object.keys(H.running).some(function (k) { return H.running[k]; })) { setTimeout(check, 60000); return; }   // never while a sim is running
    H.pcCheck().then(function (res) {
      if (!res || !res.ok || !res.facts) return;
      cur = makeSig(res.facts);
      var old = get();
      if (!old || !cur.gpus.length) { put(cur); return; }
      var r = compare(old, cur);
      if (r.changed && hasHistory()) show(r); else put(cur);
    }).catch(function () { /* quietly nothing */ });
  }
  if ($('retestBar')) {
    $('retestFresh').addEventListener('click', function () { ack(); var t = document.querySelector('button[data-view=setup]'); if (t) t.click(); });
    $('retestOk').addEventListener('click', ack);
    setTimeout(check, 8000);
  }
  root.TunerRetest = { check: check };
})(typeof self !== 'undefined' ? self : this);
