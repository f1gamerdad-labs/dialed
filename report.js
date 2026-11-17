/* Page errors go to the app's log, and the "Report a problem" window. Only active inside the Windows app. */
(function () {
  'use strict';
  var wv = window.chrome && window.chrome.webview;
  if (!wv) return;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- page errors -> the app's rolling log (at most 40 per run, so a loop cannot flood it) ----------
  var logged = 0;
  function log(line) { if (logged++ < 40) { try { wv.postMessage({ type: 'log', line: String(line) }); } catch (e) { /* nothing to do */ } } }
  window.addEventListener('error', function (e) { log('error: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'); });
  window.addEventListener('unhandledrejection', function (e) { log('rejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)); });

  // ---------- the report window ----------
  var busy = false;
  function setStatus(t, cls) { $('reportStatus').textContent = t; $('reportStatus').className = 'status ' + (cls || ''); }
  function open() {
    setStatus('', ''); $('reportSend').disabled = false; busy = false; $('reportSend').textContent = 'Send report';
    $('report').hidden = false; $('reportMsg').focus();
  }
  function close() { if (!busy) $('report').hidden = true; }

  function pageState() {
    var out = { sim: null, files: [], captures: [], note: '' };
    try {
      var a = window.TunerApp, s = a && a.state;
      if (s) {
        out.sim = s.sim && s.sim.id;
        out.files = Object.keys(s.files || {});
        out.captures = (s.caps || []).map(function (c) { return c && (c.name || c.file || '') ; });
        try { out.result = s.result ? JSON.parse(JSON.stringify(s.result)) : null; } catch (e) { out.result = 'not serialisable'; }
        try { out.rows = (s.rows || []).slice(0, 30).map(function (r) { return { name: r.name || r.id, to: r.to || r.value, tier: r.tier, confidence: r.confidence }; }); } catch (e) { /* skip */ }
      }
      try { out.history = JSON.parse(localStorage.getItem('iracing-tuner.history.v1') || 'null'); } catch (e) { out.history = 'unreadable'; }
    } catch (e) { out.note = 'could not read page state: ' + e.message; }
    return JSON.stringify(out, null, 1);
  }

  function summary(state) {
    var lines = [];
    try {
      var o = JSON.parse(state);
      lines.push('Sim: ' + o.sim + '; captures loaded: ' + o.captures.length + '; files: ' + o.files.join(', '));
      var h = o.history && o.history.rounds ? o.history.rounds : (Array.isArray(o.history) ? o.history : []);
      lines.push('History rounds: ' + (h.length || 0));
      if (o.rows && o.rows.length) lines.push('Recommendations shown: ' + o.rows.map(function (r) { return r.name + ' -> ' + r.to; }).join('; '));
      var res = JSON.stringify(o.result || {});
      lines.push('Result: ' + (res.length > 3000 ? res.slice(0, 3000) + '...' : res));
    } catch (e) { lines.push('(no page summary: ' + e.message + ')'); }
    return lines.join('\n');
  }

  function send() {
    var msg = $('reportMsg').value.trim();
    if (msg.length < 5) { setStatus('Please write a short note about what went wrong.', 'warn'); $('reportMsg').focus(); return; }
    busy = true; $('reportSend').disabled = true; $('reportSend').textContent = 'Sending...';
    setStatus('Building your report...', '');
    var st = pageState();
    wv.postMessage({ type: 'report', message: msg, contact: $('reportContact').value.trim(), data: $('reportData').checked,
      settings: $('reportSettings').checked, state: st, summary: summary(st) });
  }

  wv.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.type !== 'reportDone') return;
    busy = false; $('reportSend').disabled = false; $('reportSend').textContent = 'Send again';
    if (!m.ok) { setStatus('The report could not be built: ' + (m.error || 'unknown error') + '. Please tell F1GamerDad.', 'bad'); return; }
    setStatus((m.sent ? 'Sent. Thank you. ' : 'Your message could not be sent (are you offline?). ') +
      'The full report is saved as ' + m.path + (m.folderOpened ? ' and its folder is open. ' : '. ') +
      (m.sent ? 'Send that zip too if F1GamerDad asks for it.' : 'Please send that zip file to F1GamerDad instead.'), m.sent ? 'good' : 'warn');
  });

  document.querySelectorAll('[data-report]').forEach(function (el) { el.hidden = false; el.addEventListener('click', open); });
  $('reportClose').addEventListener('click', close);
  $('reportSend').addEventListener('click', send);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('report').hidden) close(); });
  window.TunerReport = { open: open };
})();
