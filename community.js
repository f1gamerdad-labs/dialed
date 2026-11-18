/* Share my result (optional). After a round, a player can send an anonymous summary of what they changed and what it did, so Dialed can one day
   say "PCs like yours gained about 12% from this". Nothing is sent without the player seeing the exact content and pressing Send.
   It goes to a Google Form set in APP_CONFIG.resultsUrl and APP_CONFIG.resultsField. With no URL configured, the button never appears.
   Never included by Dialed: names, file paths, capture file names or email. Only what the preview shows is sent. */
(function (root) {
  'use strict';

  // ---- the payload (pure, tested) ----
  function buildPayload(d) {
    var hw = d.hardware || {};
    function n(v, digits) { return isFinite(v) ? Math.round(v * Math.pow(10, digits || 0)) / Math.pow(10, digits || 0) : null; }
    var kept = d.kept || {};
    var out = {
      v: 2, app: d.appVersion || null, sim: d.simId, mode: d.mode || null, verdict: d.verdict,
      limiter: d.limiter || null, runs: d.runs || null,
      before: { low1: n(d.before.low1), avg: n(d.before.avgFps), stuttersPerMin: n(d.before.spikesPerMin, 1) },
      after: { low1: n(d.after.low1), avg: n(d.after.avgFps), stuttersPerMin: n(d.after.spikesPerMin, 1) },
      changes: (d.applied || []).slice(0, 12).map(function (c) {
        return { setting: String(c.key), from: String(c.fromLabel), to: String(c.toLabel), confidence: c.confidence || null, kept: kept[c.key] ? kept[c.key] === 'applied' : null };
      })
    };
    if (hw.cpu || hw.gpu || hw.ram || hw.screens) out.hardware = { cpu: hw.cpu || null, gpu: hw.gpu || null, ram: hw.ram || null, screens: hw.screens || null, refreshHz: hw.refreshHz || null };
    return out;
  }
  // plain-language lines for the preview window
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  // ctx (optional): { simName, names: { settingKey: 'Readable name' } }, so the preview reads like a person wrote it
  function describe(p, ctx) {
    ctx = ctx || {}; var names = ctx.names || {};
    var lines = ['Sim: ' + (ctx.simName || p.sim) + (p.mode ? ' (' + cap(p.mode) + ')' : ''), 'Result: ' + cap(p.verdict),
      '1% low FPS: ' + p.before.low1 + ' to ' + p.after.low1, 'Average FPS: ' + p.before.avg + ' to ' + p.after.avg, 'Stutters per minute: ' + p.before.stuttersPerMin + ' to ' + p.after.stuttersPerMin];
    if (p.limiter) lines.push('What limited your PC: ' + ({ gpu: 'graphics card', cpu: 'processor', cap: 'frame cap' }[p.limiter] || 'unknown'));
    p.changes.forEach(function (c) { lines.push('Changed ' + (names[c.setting] || c.setting) + ': ' + c.from + ' to ' + c.to + (c.confidence ? ' (' + c.confidence + ' confidence)' : '') + (c.kept === false ? ', not kept' : '')); });
    if (p.hardware) lines.push('Your PC: ' + [p.hardware.cpu, p.hardware.gpu, p.hardware.ram, p.hardware.screens ? p.hardware.screens + ' screen(s)' : null].filter(Boolean).join(', '));
    else lines.push('Your PC: not included (run the PC check first to include it)');
    return lines;
  }
  // only a Google Forms response address is ever posted to
  function validUrl(u) { return /^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/formResponse$/.test(String(u || '')); }
  var api = { buildPayload: buildPayload, describe: describe, validUrl: validUrl };
  // (automatic sending lives below with the window code, because it needs the page)
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- window ----
  var $ = function (id) { return document.getElementById(id); }, pending = null;
  function cfg() { return root.APP_CONFIG || {}; }
  function enabled() { return validUrl(cfg().resultsUrl) && /^entry\.\d+$/.test(cfg().resultsField || ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Automatic sharing: off until the player turns it on, then one quiet send per finished round (never twice for the same round)
  var AUTO = 'dialed.autoShare', SENT = 'dialed.autoShared', silent = false;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* just not remembered */ } }
  function autoOn() { return get(AUTO) === '1'; }
  function setAuto(on) { set(AUTO, on ? '1' : '0'); syncAuto(); }
  function sentKeys() { try { return JSON.parse(get(SENT) || '[]'); } catch (e) { return []; } }
  function auto(d) {
    var wv = root.chrome && root.chrome.webview, key = d.roundKey;
    if (!wv || !enabled() || !autoOn() || !key || sentKeys().indexOf(key) >= 0) return;
    var seen = sentKeys(); seen.push(key); set(SENT, JSON.stringify(seen.slice(-100)));   // marked first: a failed send is not retried in a loop
    var fields = {}; fields[cfg().resultsField] = JSON.stringify(buildPayload(d));
    silent = true; wv.postMessage({ type: 'postForm', url: cfg().resultsUrl, fields: fields });
  }
  var tog = null;
  function syncAuto() {
    if (tog) tog.textContent = autoOn() ? 'Stop sharing results automatically' : 'Share results automatically (anonymous)';
    if ($('commAuto')) $('commAuto').checked = autoOn();
  }
  function open(d) {
    pending = buildPayload(d);
    var names = {}; (d.applied || []).forEach(function (c) { if (c.key && c.name) names[c.key] = c.name; });
    $('commList').innerHTML = describe(pending, { simName: d.simName, names: names }).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    $('commStatus').textContent = ''; $('commSend').disabled = false; $('community').hidden = false;
  }
  function close() { $('community').hidden = true; }
  function send() {
    var wv = root.chrome && root.chrome.webview;
    if (!wv) { $('commStatus').textContent = 'Sharing works in the Windows app.'; return; }
    $('commSend').disabled = true; $('commStatus').textContent = 'Sending...';
    var fields = {}; fields[cfg().resultsField] = JSON.stringify(pending);
    wv.postMessage({ type: 'postForm', url: cfg().resultsUrl, fields: fields });
  }
  function posted(m) {
    if (silent) { silent = false; return; }
    if (!$('commStatus')) return;
    $('commStatus').textContent = m.ok ? 'Sent. Thank you, this helps everyone get better advice.' : 'Could not send. Check your connection and try again.';
    $('commSend').disabled = !!m.ok;
  }
  if ($('community')) {
    $('commClose').addEventListener('click', close); $('commClose2').addEventListener('click', close); $('commSend').addEventListener('click', send);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('community').hidden) close(); });
  }
  if ($('commAuto')) $('commAuto').addEventListener('change', function () { setAuto($('commAuto').checked); });
  tog = document.querySelector('[data-autoshare]');
  if (tog && enabled()) { tog.hidden = false; tog.addEventListener('click', function () { setAuto(!autoOn()); }); }
  syncAuto();
  root.TunerCommunity = { enabled: enabled, open: open, posted: posted, autoOn: autoOn, auto: auto, setAuto: setAuto };
})(typeof self !== 'undefined' ? self : this);
