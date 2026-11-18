/* Share my result (optional). After a round, a player can send an anonymous summary of what they changed and what it did, so Dialed can one day
   say "PCs like yours gained about 12% from this". Nothing is sent without the player seeing the exact content and pressing Send.
   It goes to a Google Form set in APP_CONFIG.resultsUrl and APP_CONFIG.resultsField. With no URL configured, the button never appears.
   Never included: names, file paths, capture file names, email, IP-based details of any kind (the form does not collect them). */
(function (root) {
  'use strict';

  // ---- the payload (pure, tested) ----
  function buildPayload(d) {
    var hw = d.hardware || {};
    function n(v, digits) { return isFinite(v) ? Math.round(v * Math.pow(10, digits || 0)) / Math.pow(10, digits || 0) : null; }
    var out = {
      v: 1, app: d.appVersion || null, sim: d.simId, mode: d.mode || null, verdict: d.verdict,
      before: { low1: n(d.before.low1), avg: n(d.before.avgFps), stuttersPerMin: n(d.before.spikesPerMin, 1) },
      after: { low1: n(d.after.low1), avg: n(d.after.avgFps), stuttersPerMin: n(d.after.spikesPerMin, 1) },
      changes: (d.applied || []).slice(0, 12).map(function (c) { return { setting: String(c.key), from: String(c.fromLabel), to: String(c.toLabel) }; })
    };
    if (hw.cpu || hw.gpu || hw.ram || hw.screens) out.hardware = { cpu: hw.cpu || null, gpu: hw.gpu || null, ram: hw.ram || null, screens: hw.screens || null, refreshHz: hw.refreshHz || null };
    return out;
  }
  // plain-language lines for the preview window
  function describe(p) {
    var lines = ['Sim: ' + p.sim + (p.mode ? ' (' + p.mode + ')' : ''), 'Result: ' + p.verdict,
      '1% low FPS: ' + p.before.low1 + ' to ' + p.after.low1, 'Average FPS: ' + p.before.avg + ' to ' + p.after.avg, 'Stutters per minute: ' + p.before.stuttersPerMin + ' to ' + p.after.stuttersPerMin];
    p.changes.forEach(function (c) { lines.push('Changed ' + c.setting + ': ' + c.from + ' to ' + c.to); });
    if (p.hardware) lines.push('Your PC: ' + [p.hardware.cpu, p.hardware.gpu, p.hardware.ram, p.hardware.screens ? p.hardware.screens + ' screen(s)' : null].filter(Boolean).join(', '));
    else lines.push('Your PC: not included (run the PC check first to include it)');
    return lines;
  }
  // only a Google Forms response address is ever posted to
  function validUrl(u) { return /^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/formResponse$/.test(String(u || '')); }
  var api = { buildPayload: buildPayload, describe: describe, validUrl: validUrl };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- window ----
  var $ = function (id) { return document.getElementById(id); }, pending = null;
  function cfg() { return root.APP_CONFIG || {}; }
  function enabled() { return validUrl(cfg().resultsUrl) && /^entry\.\d+$/.test(cfg().resultsField || ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function open(d) {
    pending = buildPayload(d);
    $('commList').innerHTML = describe(pending).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
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
    if (!$('commStatus')) return;
    $('commStatus').textContent = m.ok ? 'Sent. Thank you, this helps everyone get better advice.' : 'Could not send. Check your connection and try again.';
    $('commSend').disabled = !!m.ok;
  }
  if ($('community')) {
    $('commClose').addEventListener('click', close); $('commClose2').addEventListener('click', close); $('commSend').addEventListener('click', send);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('community').hidden) close(); });
  }
  root.TunerCommunity = { enabled: enabled, open: open, posted: posted };
})(typeof self !== 'undefined' ? self : this);
