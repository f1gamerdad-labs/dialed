/* "What's new" window: shown once after Dialed updates to a new version, never to someone opening it for the first time (they get the tour).
   Edit ITEMS when a release has something worth telling people about. The window opens when version.json's number differs from the one last seen. */
(function (root) {
  'use strict';
  var KEY = 'dialed.whatsNewSeen';
  // The release these notes describe. Change it (and ITEMS) only when there is something new to tell people; small fixes in between do not reopen the window.
  var RELEASE = '0.10.0';
  var TITLE = 'What\'s new in Dialed';
  // The big banner at the top: set to null for a release with no new sim. `sim` picks the logo (read from the player's own Steam folder, so it is skipped if missing).
  var HERO = null;
  var ITEMS = [
    ['Longer captures', 'Choose 60, 120 or 150 seconds under Capture length, so one capture can cover a whole lap at a long track such as Spa and reach the most demanding parts. If a later round was captured at a very different length, Dialed tells you the comparison may not be fair.'],
    ['A start screen', 'Dialed now opens by asking which sim you want to tune. Tick "Skip this screen next time" to go straight to your last choice, or use Choose what to test in the sidebar at any time.']
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
    var hero = $('wnHero');
    if (hero) {
      hero.hidden = !HERO;
      if (HERO) {
        $('wnHeroT').textContent = HERO.title; $('wnHeroS').textContent = HERO.sub;
        var logo = root.TunerLogos && root.TunerLogos[HERO.sim], img = $('wnHeroLogo');
        if (logo) { img.src = logo; img.hidden = false; } else img.hidden = true;
      }
    }
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
