/* "What's new" window: shown once after Dialed updates to a new version, never to someone opening it for the first time (they get the tour).
   Edit ITEMS when a release has something worth telling people about. The window opens when version.json's number differs from the one last seen. */
(function (root) {
  'use strict';
  var KEY = 'dialed.whatsNewSeen';
  // The release these notes describe. Change it (and ITEMS) only when there is something new to tell people; small fixes in between do not reopen the window.
  var RELEASE = '0.6.0';
  var TITLE = 'What\'s new in Dialed';
  // The big banner at the top: set to null for a release with no new sim. `sim` picks the logo (read from the player's own Steam folder, so it is skipped if missing).
  var HERO = { sim: 'ac', title: 'Assetto Corsa is now in Dialed', sub: 'The original, with Content Manager and Custom Shaders Patch support. Capture a race, see what is holding your PC back, and change the right graphics settings, with a backup before every change. Free, always.' };
  var ITEMS = [
    ['Assetto Corsa', 'The original Assetto Corsa is now supported. Dialed changes its video settings (anti-aliasing, shadows, reflections, mirrors, post-processing and more), with a backup before every change. Restart the game after applying, because it only reads its settings when it starts.'],
    ['Custom Shaders Patch', 'If you use CSP, Dialed also adjusts its performance settings: pixel density, level-of-detail distances, lighting, shadows, Extra FX, particles, mirrors, rain, grass and more. It only touches features you have switched on, and only writes into CSP\'s own small override files.'],
    ['Works with Content Manager', 'Content Manager keeps its own copy of AC\'s settings and would write the old ones back, so Dialed closes it with the game when you apply, and says so first.'],
    ['Fairer verdicts', 'A round is only called better or worse when the change is bigger than the difference between your own captures, and Dialed stops you analysing captures under the wrong sim.'],
    ['Automobilista 2 and the in-game hotkey', 'Automobilista 2 is supported, and the capture hotkey now works inside games that hide normal hotkeys from other programs.']
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
