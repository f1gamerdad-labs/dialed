/* First-run tour: five short, animated steps that explain how Dialed works. Shown once on first open (after the welcome video if there is one),
   and again any time from About. All wording is in STEPS below. The scenes are plain HTML and CSS animation (see styles.css, ".tour"). */
(function (root) {
  'use strict';

  // {hotkey} is replaced with the player's real capture hotkey.
  var STEPS = [
    { id: 'open', title: 'Open Dialed first, then your sim',
      text: 'Dialed needs Windows permission to measure your frame rate, so Windows asks when it opens. Open Dialed before you start your sim: that prompt can freeze a full-screen game.',
      tip: 'Set your game to Borderless Windowed. It looks the same, and it stays on screen when you click another monitor.',
      scene: function () {
        return '<div class="sc sc-open">' +
          '<div class="win win-dialed"><div class="bar"><b></b><b></b><b></b></div><div class="logo"></div><div class="lines"><i></i><i></i><i></i></div><div class="tick">&#10003;</div></div>' +
          '<div class="shield" title="Windows asks once">&#128737;</div>' +
          '<div class="then">then</div>' +
          '<div class="win win-game"><div class="bar"><b></b><b></b><b></b></div><div class="road"></div><span>YOUR SIM</span></div>' +
          '</div>';
      } },
    { id: 'pick', title: 'Pick your sim',
      text: 'Dialed works with iRacing and Le Mans Ultimate today, and finds your games for you. ACC, AMS2, AC EVO, RaceRoom, Project Motor Racing and BeamNG are coming soon. Each sim keeps its own settings table and its own history.',
      tip: 'Not for VR. For VR, NextLevelXR is the right tool.',
      scene: function () {
        var names = ['iRacing', 'LMU', 'AMS2', 'ACC', 'EVO', 'RaceRoom', 'PMR', 'BeamNG'];
        return '<div class="sc sc-pick"><div class="grid8">' + names.map(function (n, i) { return '<span style="--i:' + i + '"' + (i === 0 ? ' class="pick"' : i > 1 ? ' class="soon"' : '') + '>' + n + '</span>'; }).join('') + '</div></div>';
      } },
    { id: 'capture', title: 'Capture three runs',
      text: 'Start your game and press {hotkey} while you drive. You get a spoken or beeped countdown, then Dialed records 60 seconds. Do it three times in the same session, with a full grid on your heaviest track if you can.',
      tip: 'Close Chrome, OBS and Discord first: background programs are the most common cause of stutter.',
      scene: function (ctx) {
        var keys = (ctx.hotkey || 'Ctrl+Shift+F11').split('+').map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('');
        return '<div class="sc sc-cap"><div class="keys"><span>Press</span>' + keys + '</div>' +
          '<div class="ringc"><span class="n n3">3</span><span class="n n2">2</span><span class="n n1">1</span><span class="n go">GO</span><span class="recmark">REC</span></div>' +
          '<div class="rec"><span class="dot"></span><span>Recording 60 s</span></div><div class="progress"><i></i></div></div>';
      } },
    { id: 'list', title: 'Get a short priority list',
      text: 'Dialed works out whether your processor, graphics card or graphics memory is the limit, then lists the changes best first. Each one shows its gain, its visual cost, what you will see change, and how sure Dialed is. The top three are ticked for you.',
      tip: 'When your PC has spare room, Dialed also suggests turning a setting up.',
      scene: function () {
        function row(delay, name, chg, dots, badge) {
          return '<div class="r" style="animation-delay:' + delay + 's"><span class="ck"><u></u></span><b>' + name + '</b><span class="chg">' + chg +
            '</span><span class="dots">' + dots + '</span><span class="conf ' + badge[0] + '">' + badge[1] + '</span></div>';
        }
        return '<div class="sc sc-list"><div class="hd">Do first: big gain, little to see</div>' +
          row(0.3, 'Particles', 'High &rarr; Medium', '<i class="on"></i><i class="on"></i><i></i>', ['m', 'Medium']) +
          row(1.0, 'Foliage', 'Low &rarr; Off', '<i class="on"></i><i class="on"></i><i></i>', ['m', 'Medium']) +
          row(1.7, 'Shadows', 'Medium &rarr; Low', '<i class="on"></i><i class="on"></i><i class="on"></i>', ['l', 'Low']) +
          '<div class="see">You will see: shadows look softer under cars and around the cockpit.</div></div>';
      } },
    { id: 'apply', title: 'Apply safely, then check',
      text: 'One click backs up your settings file, closes the sim after a big warning, and writes the change. Start the game, capture again, and Dialed tells you what each change did and what to put back. You can restore any backup from the app.',
      tip: 'Change a few settings at a time. Smaller rounds are easier to learn from.',
      scene: function () {
        return '<div class="sc sc-apply">' +
          '<div class="btn">Apply 3 selected changes</div>' +
          '<div class="chip backup"><span>&#128193;</span><div>Dialed Backups<small>your old file, saved</small></div></div>' +
          '<div class="chip warn"><span>&#9888;</span><div>The sim will close<small>so the change sticks</small></div></div>' +
          '<div class="verdict"><small>1% low FPS</small><b>86 <em>&rarr;</em> 97</b><i>Better</i></div></div>';
      } }
  ];

  var api = { STEPS: STEPS, fill: function (s, ctx) { return String(s).replace(/\{hotkey\}/g, (ctx && ctx.hotkey) || 'Ctrl+Shift+F11'); } };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---------- the tour window ----------
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'dialed.tourSeen', step = 0, openNow = false;
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } } // no storage: never nag
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* shows again next time, which is harmless */ } }
  function hotkey() { return (window.TunerHost && window.TunerHost.hotkeyText) || 'Ctrl+Shift+F11'; }

  function render() {
    var s = STEPS[step], ctx = { hotkey: hotkey() }, last = step === STEPS.length - 1;
    $('tourStep').textContent = 'Quick tour: step ' + (step + 1) + ' of ' + STEPS.length;
    $('tourScene').innerHTML = s.scene(ctx);          // replacing the markup restarts the animation
    $('tourTitle').textContent = s.title;
    $('tourText').textContent = api.fill(s.text, ctx);
    $('tourTip').textContent = s.tip || ''; $('tourTip').hidden = !s.tip;
    $('tourDots').innerHTML = STEPS.map(function (_, i) { return '<i class="' + (i === step ? 'on' : i < step ? 'done' : '') + '"></i>'; }).join('');
    $('tourBack').hidden = step === 0;
    $('tourNext').textContent = last ? 'Start using Dialed' : 'Next';
    $('tourSkip').hidden = last;
  }
  function open(from) {
    if (openNow) return;
    step = from || 0; openNow = true; render();
    $('tour').hidden = false; $('tourNext').focus();
  }
  function close() { $('tour').hidden = true; openNow = false; markSeen(); }
  function next() { if (step >= STEPS.length - 1) { close(); return; } step++; render(); }
  function back() { if (step > 0) { step--; render(); } }

  $('tourNext').addEventListener('click', next);
  $('tourBack').addEventListener('click', back);
  $('tourSkip').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (!openNow) return;
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') back();
  });
  document.querySelectorAll('[data-tour]').forEach(function (el) { el.hidden = false; el.addEventListener('click', function () { open(0); }); });

  // First open: wait for the welcome video (if it is showing), then start. If the video is closed, the tour follows; if there is no video, it starts at once.
  function whenReady() {
    var intro = $('intro');
    if (intro && !intro.hidden) {
      var mo = new MutationObserver(function () { if (intro.hidden) { mo.disconnect(); setTimeout(whenReady, 400); } });
      mo.observe(intro, { attributes: true, attributeFilter: ['hidden'] });
      return;
    }
    if (!seen()) open(0);
  }
  setTimeout(whenReady, 1400); // let the page, the welcome check and the app's first message settle

  root.TunerTour = { open: open, close: close, steps: STEPS };
})(typeof self !== 'undefined' ? self : this);
