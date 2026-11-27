/* "What's new" window: shown once after Dialed updates to a new version, never to someone opening it for the first time (they get the tour).
   Edit ITEMS when a release has something worth telling people about. The window opens when version.json's number differs from the one last seen. */
(function (root) {
  'use strict';
  var KEY = 'dialed.whatsNewSeen';
  // The release these notes describe. Change it (and ITEMS) only when there is something new to tell people; small fixes in between do not reopen the window.
  var RELEASE = '0.11.0';
  var TITLE = 'What\'s new in Dialed';
  // The big banner at the top: set to null for a release with no new sim. `sim` picks the logo (read from the player's own Steam folder, so it is skipped if missing).
  var HERO = { sim: 'acrally', title: 'Assetto Corsa Rally and Project Motor Racing are now in Dialed', sub: 'Dialed now reads, suggests and applies graphics settings for both. They are new here, so please check your changes in game and share your results. Free, always.' };
  var ITEMS = [
    ['Thank you, Edin', 'A donation from Edin, a member of the community, helped get Assetto Corsa Rally into Dialed. Massive thank you!'],
    ['Assetto Corsa Rally', 'All 15 graphic quality settings, one careful step at a time. Applying a change switches the graphics preset to Custom, just as changing it in the game does.'],
    ['Project Motor Racing', 'The settings on the Advanced Graphics page, with the same names as the menu. Applying a change selects the Custom hardware profile.'],
    ['What stays yours', 'Upscaling, anti-aliasing, resolution, V-sync, frame generation and frame limits are never changed in either game.']
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
