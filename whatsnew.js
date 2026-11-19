/* "What's new" window: shown once after Dialed updates to a new version, never to someone opening it for the first time (they get the tour).
   Edit ITEMS when a release has something worth telling people about. The window opens when version.json's number differs from the one last seen. */
(function (root) {
  'use strict';
  var KEY = 'dialed.whatsNewSeen';
  // The release these notes describe. Change it (and ITEMS) only when there is something new to tell people; small fixes in between do not reopen the window.
  var RELEASE = '0.4.0';
  var TITLE = 'What\'s new in Dialed';
  var ITEMS = [
    ['Light theme and colour options', 'Switch between dark and light, or match Windows. About also has colour-blind friendly colours and high contrast buttons.'],
    ['System tray', 'Optional: keep Dialed running in the tray, tuck it away when a capture starts, and get a notification when it finishes. Closing the window still closes Dialed unless you choose otherwise.'],
    ['Restore my original settings', 'One button on the Setup page puts your game settings back exactly as they were before Dialed first changed anything.'],
    ['Can you trust these captures?', 'Results now warns about short or noisy captures, a rough first 15 seconds, busy programs and runs that slow down, which can mean heat.'],
    ['Fresh baseline reminder', 'If your graphics driver or hardware changes, Dialed suggests a new baseline so old results do not mislead you.'],
    ['Move to a new PC', 'Export your history, profiles and preferences to a file and import them on another PC, from About.'],
    ['Smoother everyday use', 'Only one Dialed runs at a time, the window remembers where you left it, and an Update available tag stays in the sidebar until you update.']
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
    $('whatsnew').hidden = false; $('wnOk').focus({ preventScroll: true }); $('wnList').parentNode.scrollTop = 0;
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
    version = RELEASE; setTimeout(function () { attempt(0); }, 3200);
    var link = document.querySelector('[data-whatsnew]'); if (link) { link.hidden = false; link.addEventListener('click', function () { if (version) open(); }); }
  }
  root.TunerWhatsNew = { open: open };
})(typeof self !== 'undefined' ? self : this);
