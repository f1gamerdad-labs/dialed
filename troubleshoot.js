/* "Something specific wrong?" guides, shown under the PC check. Pick a symptom and get a short, ordered list of what to check, in the order
   that usually finds the cause fastest. Advice only: nothing here changes anything on the PC. All wording is in GUIDES. */
(function (root) {
  'use strict';
  var GUIDES = [
    { id: 'stutter', title: 'It stutters or hitches while I drive',
      intro: 'Stutter is different from low frame rate: the average looks fine, but now and then a frame takes far too long. These are the usual causes, most common first.',
      steps: ['Close everything you do not need: browsers, Discord, streaming software, overlays and anything in the system tray (near the clock). Background programs are the most common cause.',
        'Run the PC check in this tab and fix anything it marks "Fix this", especially memory speed, power plan and a screen plugged into the motherboard.',
        'Take three captures, then open Results and look at "Your frame times". Stutters mostly in the first 15 seconds are shaders and textures loading and settle by themselves. Stutters all through the run point to something else.',
        'If the chart says most stutters start on the graphics card side and graphics memory is nearly full, lower texture and shadow settings.',
        'NVIDIA graphics cards: in the NVIDIA Control Panel, Manage 3D settings, set Shader Cache Size to Driver Default or higher. A small cache makes the game rebuild shaders over and over.',
        'Make sure the sim is installed on an SSD, not a hard disk.',
        'Check temperatures. A processor or graphics card that overheats slows itself down, and dusty coolers are a common reason.'] },
    { id: 'heavy', title: 'My frame rate drops in the rain, at night or on a full grid',
      intro: 'Those sessions load more on the processor and graphics card at once. That is exactly where Dialed should measure you.',
      steps: ['Capture in the heavy situation itself: a full grid at your busiest track, in the rain or at night. Dialed only sees what you capture.',
        'Reflections are a big cost. In iRacing, dynamic cubemaps can cost around 40% of your frame rate on some PCs, and on others almost nothing, so let Dialed measure it for you.',
        'Lower the number of cars drawn and the mirror settings, which load the processor more than the graphics card.',
        'Rain adds spray and wet-surface effects. Lowering particle and reflection settings usually helps most there.',
        'If Dialed says you are limited by the graphics card, lowering the resolution or render scale helps more than small visual settings.'] },
    { id: 'triples', title: 'My triple screens or extra monitors are slow',
      intro: 'Three screens means roughly three times the pixels to draw, and extra screens can be connected in ways that slow the main ones.',
      steps: ['Run the PC check. Your racing screens should all be connected to the graphics card, not to the motherboard. A spare screen on the motherboard is fine.',
        'Check each screen is at its highest refresh rate in Windows Display Settings, Advanced display, and that all three match.',
        'Test with only the centre screen to see how much the extra two cost. If the cost is large, you are limited by the graphics card, so lower resolution-heavy settings such as anti-aliasing and reflections.',
        'Use Dialed\'s Priority setting to choose smoothness, and tell Dialed how your screens sync in "About your setup".'] },
    { id: 'pacing', title: 'My frame rate looks fine but it feels uneven',
      intro: 'Uneven feel with a good average is usually frame pacing: the time between frames is not steady.',
      steps: ['Look at "Your frame times" in Results. A flat chart feels smooth. Tall spikes and bars that jump around feel uneven.',
        'Cap your frame rate a few frames below your refresh rate (for example 141 on a 144 Hz screen) if you use G-Sync or FreeSync. Without a cap the game can run past the range where the sync works.',
        'If you use V-sync, dips below your refresh rate can drop you to half of it. A frame cap or a lower target usually feels better than V-sync fighting the game.',
        'Tell Dialed how your screen syncs in "About your setup" so its advice fits.'] },
    { id: 'lag', title: 'My steering or inputs feel delayed',
      intro: 'A delay between your hands and the car is usually a queue of frames waiting to be shown.',
      steps: ['Turn V-sync off in the sim and use a frame cap instead. V-sync holds finished frames back.',
        'Cap your frame rate slightly under what your PC can hold. A PC running flat out at 100% graphics card load builds a queue of frames.',
        'NVIDIA graphics cards: try the Low Latency Mode setting in the NVIDIA Control Panel (On). Results vary by PC, so test it rather than assume.',
        'Wireless wheels, USB hubs and overlays can also add delay. Plug the wheel straight into the PC if you can.'] },
    { id: 'start', title: 'It only stutters at the start of a session',
      intro: 'A rough first lap and then smooth running is the game loading shaders and textures as it needs them.',
      steps: ['Drive a lap or two before you capture. Dialed\'s numbers should come from the settled part of the session.',
        'Make sure the NVIDIA Shader Cache Size is not set too small (NVIDIA Control Panel, Manage 3D settings).',
        'Put the sim on an SSD. Loading from a hard disk makes the first laps much worse.',
        'A lot of free memory helps too. Close big programs before you start.'] },
    { id: 'crash', title: 'The game freezes or crashes',
      intro: 'Crashes are rarely a graphics setting. They are usually the system under strain or unstable.',
      steps: ['Run the PC check. Memory running faster than it is stable at (an XMP or EXPO profile that does not suit your PC) is a known cause of random crashes. If it started after you turned XMP on, try a lower speed.',
        'Update your graphics driver, and if it started right after an update, try the previous one.',
        'Check temperatures. Overheating can freeze or crash a PC under load.',
        'Use Report a problem (the button on the left) so the log and your Windows details can be looked at.'] }
  ];

  var api = { GUIDES: GUIDES };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(id) {
    var g = GUIDES.filter(function (x) { return x.id === id; })[0];
    $('tsBody').innerHTML = g ? '<p style="margin:0 0 10px">' + esc(g.intro) + '</p><ol class="tssteps">' + g.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '';
  }
  if ($('tsPick')) {
    $('tsPick').innerHTML = '<option value="">Choose what is happening...</option>' + GUIDES.map(function (g) { return '<option value="' + g.id + '">' + esc(g.title) + '</option>'; }).join('');
    $('tsPick').addEventListener('change', function () { show($('tsPick').value); });
  }
  root.TunerHelp = { show: show };
})(typeof self !== 'undefined' ? self : this);
