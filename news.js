/* Update-email sign-up and tip-jar links. The sign-up itself lives on the website, so the app never handles anyone's email address. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG || {};
  var ASKED = 'dialed.newsAsked';
  function ok(u) { return /^https:\/\//i.test(u || ''); }
  function openExternal(url) {
    if (!ok(url)) return;
    var wv = window.chrome && window.chrome.webview;
    if (wv) wv.postMessage({ type: 'openUrl', url: url }); else window.open(url, '_blank', 'noopener');
  }
  function get() { try { return localStorage.getItem(ASKED); } catch (e) { return '1'; } }   // no storage: never nag
  function set() { try { localStorage.setItem(ASKED, '1'); } catch (e) { /* ignore */ } }

  document.querySelectorAll('[data-news]').forEach(function (el) { el.hidden = !ok(cfg.updatesUrl); el.addEventListener('click', function () { openExternal(cfg.updatesUrl); }); });
  document.querySelectorAll('[data-tip]').forEach(function (el) { el.hidden = !ok(cfg.tipUrl); el.addEventListener('click', function () { openExternal(cfg.tipUrl); }); });

  // Offered once, after the first round has been saved and the user has moved on from the "round saved" screen.
  function offer() {
    if (!ok(cfg.updatesUrl) || get()) return;
    set();                                   // counts as asked the moment it is shown
    $('newsNote').hidden = false;
  }
  $('newsYes').addEventListener('click', function () { $('newsNote').hidden = true; openExternal(cfg.updatesUrl); });
  $('newsNo').addEventListener('click', function () { $('newsNote').hidden = true; });

  var done = window.TunerDone;
  if (done && done.show) {
    var orig = done.show;
    done.show = function () { return orig.apply(done, arguments).then(function (r) { setTimeout(offer, 600); return r; }); };
  }
})();
