/* "What's new" window: shown once after Dialed updates to a new version, never to someone opening it for the first time (they get the tour).
   Edit ITEMS when a release has something worth telling people about. The window opens when version.json's number differs from the one last seen. */
(function (root) {
  'use strict';
  var KEY = 'dialed.whatsNewSeen';
  // The release these notes describe. Change it (and ITEMS) only when there is something new to tell people; small fixes in between do not reopen the window.
  var RELEASE = '0.9.0';
  var TITLE = 'What\'s new in Dialed';
  // The big banner at the top: set to null for a release with no new sim. `sim` picks the logo (read from the player's own Steam folder, so it is skipped if missing).
  var HERO = { sim: 'acc', title: 'ACC and AC EVO are now in Dialed', sub: 'Assetto Corsa Competizione and Assetto Corsa EVO, with every setting checked in the game itself. Capture a race, see what is holding your PC back, and change the right graphics settings, with a backup before every change. Free, always.' };
  var ITEMS = [
    ['Assetto Corsa Competizione', 'Resolution scale, shadows, view distance, effects, foliage, textures, mirrors, fog, bloom, car and foliage detail, opponents visible and more. Dialed writes everywhere ACC reads from, so the changes are there the next time you start the game, with nothing to re-select in the menu. Upscaling (DLSS and FSR) is left to you.'],
    ['Assetto Corsa EVO', 'Supersampling, anti-aliasing, textures, level of detail, lighting, reflections, shadows, particles, grass, clouds, depth of field, motion blur and mirrors: 23 settings in all. Upscaling, resolution and frame limits are left to you.'],
    ['Reads what the game really runs', 'For ACC, Dialed now reads the settings the game starts with, not a stored copy, and says plainly when a change is not in effect.'],
    ['Le Mans Ultimate', 'The "not yet tested" line is gone from its setup page.'],
    ['Updates install themselves', 'Dialed installs new versions by itself when it opens and no capture or game is running. You can switch that off in About.']
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
