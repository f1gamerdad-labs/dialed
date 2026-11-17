/* Welcome video (plays on first open) and the Ideas / suggestions link. */
(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {}, intro = cfg.intro || {};
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'iracing-tuner.introSeen';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* shows again next time, which is harmless */ } }

  // ---------- links open in the user's normal browser, never inside the app ----------
  function openExternal(url) {
    if (!/^https:\/\//i.test(url)) return;
    var wv = window.chrome && window.chrome.webview;
    if (wv) wv.postMessage({ type: 'openUrl', url: url });
    else window.open(url, '_blank', 'noopener');
  }

  // ---------- welcome video ----------
  function player(kind, source) {
    if (kind === 'file') return '<video src="' + esc(source) + '" autoplay controls playsinline></video>';
    return '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(source) +
      '?autoplay=1&rel=0&modestbranding=1&cc_load_policy=1" title="Welcome video" ' +
      'allow="autoplay; encrypted-media; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }

  function open(opts) {
    opts = opts || intro;
    if (!opts.source) return;
    $('introTitle').textContent = opts.title || 'Welcome';
    $('introBody').innerHTML = player(opts.kind, opts.source);
    $('intro').hidden = false;
    $('introStart').focus();
    markSeen(); // shown once on its own; the About page and Setup page can replay it
  }
  function close() {
    $('introBody').innerHTML = ''; // removing the player also stops the sound
    $('intro').hidden = true;
  }

  $('introClose').addEventListener('click', close);
  $('introStart').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('intro').hidden) close(); });
  $('intro').addEventListener('click', function (e) { if (e.target === $('intro')) close(); });

  // ---------- buttons that depend on the config ----------
  var hasIdeas = !!/^https:\/\//i.test(cfg.suggestionsUrl || '');
  document.querySelectorAll('[data-suggest]').forEach(function (el) { el.hidden = !hasIdeas; el.addEventListener('click', function () { openExternal(cfg.suggestionsUrl); }); });

  $('introIdeas').hidden = !hasIdeas; // only point at the Ideas button when there is one

  // A bundled video only counts if the file is really there; otherwise the welcome simply stays off.
  function videoExists() {
    if (!intro.source) return Promise.resolve(false);
    if (intro.kind !== 'file') return Promise.resolve(true);
    return fetch(intro.source, { method: 'HEAD' }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  document.querySelectorAll('[data-intro]').forEach(function (el) { el.addEventListener('click', function () { open(); }); });
  videoExists().then(function (ok) {
    document.querySelectorAll('[data-intro]').forEach(function (el) { el.hidden = !ok; });
    // First open: play it once, after the page has settled.
    if (ok && !seen()) setTimeout(function () { open(); }, 600);
  });

  window.TunerIntro = { open: open, close: close, openExternal: openExternal };
})();
