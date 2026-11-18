/* "What's new" window: shown once after Dialed updates to a new version, never to someone opening it for the first time (they get the tour).
   Edit ITEMS when a release has something worth telling people about. The window opens when version.json's number differs from the one last seen. */
(function (root) {
  'use strict';
  var KEY = 'dialed.whatsNewSeen';
  var TITLE = 'What\'s new in Dialed';
  var ITEMS = [
    ['Share my result', 'After a round you can now send an anonymous before/after result. You see exactly what it contains first, and nothing is sent unless you press Send.'],
    ['A proper installer', 'New downloads come as Dialed-Setup.exe, which adds Dialed to your Start menu and to Installed apps.'],
    ['PC check', 'Finds things outside the sim that cost frame rate: memory not at its rated speed, the wrong power plan, a screen below its top refresh rate, and more. It tells you what to fix.'],
    ['Frame times', 'Results now draws your capture over time and marks every stutter, with a plain-language reading of what is causing it.'],
    ['About your setup', 'Tell Dialed how your screen syncs, whether you stream, and which settings it must never touch.'],
    ['Saved profiles', 'Save your settings as "Daytona" or "Rain" and put them back with one click.'],
    ['Three runs in a row', 'Capture three runs back to back with one press.'],
    ['Share image and badges', 'Make a before/after image of your result, and earn badges as you tune.']
  ];

  // pure: should the window open?
  function shouldShow(seenVersion, current, tourSeen) {
    if (!current) return false;
    if (!tourSeen) return false;                 // a first-time user sees the tour, not a list of changes they never knew about
    return seenVersion !== current;
  }
  var api = { shouldShow: shouldShow, ITEMS: ITEMS };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* shown again next time, which is harmless */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var version = null, newUser = get('dialed.tourSeen') !== '1';   // decided at load: someone who is about to see the tour must never get this window straight after it
  function open() {
    $('wnTitle').textContent = TITLE + (version ? ' (version ' + version + ')' : '');
    $('wnList').innerHTML = ITEMS.map(function (i) { return '<li><b>' + esc(i[0]) + '</b><span>' + esc(i[1]) + '</span></li>'; }).join('');
    $('whatsnew').hidden = false; $('wnOk').focus();
  }
  function close() { $('whatsnew').hidden = true; if (version) set(KEY, version); }
  function ready() { return (!$('tour') || $('tour').hidden) && (!$('intro') || $('intro').hidden); }
  function attempt(tries) {
    if (newUser) { if (version && !get(KEY)) set(KEY, version); return; }
    if (!ready() && tries < 20) { setTimeout(function () { attempt(tries + 1); }, 1500); return; }
    if (ready() && shouldShow(get(KEY), version, true)) open();
  }
  if ($('whatsnew')) {
    $('wnOk').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('whatsnew').hidden) close(); });
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) { version = v && v.version; setTimeout(function () { attempt(0); }, 3200); }).catch(function () { /* no version, no window */ });
    var link = document.querySelector('[data-whatsnew]'); if (link) { link.hidden = false; link.addEventListener('click', function () { if (version) open(); }); }
  }
  root.TunerWhatsNew = { open: open };
})(typeof self !== 'undefined' ? self : this);
