/* Start screen: asks what you want to tune (which sim, and monitor or VR) when Dialed opens, then sets the page up for it.
   The VR choice only appears for a sim that supports it and only while VR is switched on (tester switch --enable-vr). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K_SKIP = 'dialed.start.skip', K_SIM = 'dialed.start.sim', K_VR = 'dialed.start.vr';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* the choice is just not remembered */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var sims = window.TunerSims, app = window.TunerApp;
  var pick = { sim: get(K_SIM) || app.state.sim.id, vr: get(K_VR) === '1' };
  window.TunerStart = { sim: pick.sim, vr: false };    // what the page is set up for; the host reads it when it lists the iRacing files

  function liveSims() { return sims.ORDER.filter(function (id) { return !sims.SIMS[id].comingSoon; }); }
  function vrAllowed(id) { var s = sims.SIMS[id]; return !!(s && s.vrTable && s.vrEnabled); }

  function render() {
    if (!sims.SIMS[pick.sim] || sims.SIMS[pick.sim].comingSoon) pick.sim = liveSims()[0];
    var logos = window.TunerLogos || {};
    $('startSims').innerHTML = liveSims().map(function (id) {
      var s = sims.SIMS[id], on = id === pick.sim;
      return '<button class="simbtn' + (on ? ' on' : '') + '" data-sim="' + id + '" aria-pressed="' + on + '">' +
        (logos[id] ? '<img src="' + esc(logos[id]) + '" alt="">' : '') + '<span class="nm">' + esc(s.short) + '</span></button>';
    }).join('');
    var vr = vrAllowed(pick.sim);
    $('startWhereField').hidden = !vr;
    if (!vr) pick.vr = false;
    $('startWhere').innerHTML = [['0', 'Monitor'], ['1', 'VR headset']].map(function (o) {
      return '<label><input type="radio" name="startWhere" value="' + o[0] + '"' + ((pick.vr ? '1' : '0') === o[0] ? ' checked' : '') + '>' + o[1] + '</label>';
    }).join('');
    $('startGo').textContent = 'Start with ' + sims.SIMS[pick.sim].short + (vr && pick.vr ? ' in VR' : '');
    updateChip();
  }

  function updateChip() {
    var cur = window.TunerStart, s = sims.SIMS[cur.sim] || app.state.sim;
    $('startOpen').textContent = 'Testing ' + s.short + (cur.vr ? ' in VR' : '') + ' (change)';
  }

  function apply() {
    window.TunerStart = { sim: pick.sim, vr: pick.vr && vrAllowed(pick.sim) };
    set(K_SIM, pick.sim); set(K_VR, window.TunerStart.vr ? '1' : '0');
    set(K_SKIP, $('startSkip').checked ? '1' : '0');
    app.setSim(pick.sim);
    if (window.TunerHost && window.TunerHost.pickIni) window.TunerHost.pickIni();
    $('start').hidden = true;
    updateChip();
  }
  function open() { $('startSkip').checked = get(K_SKIP) === '1'; render(); $('start').hidden = false; $('startGo').focus(); }

  $('startSims').addEventListener('click', function (e) { var b = e.target.closest('button[data-sim]'); if (b) { pick.sim = b.dataset.sim; render(); } });
  $('startWhere').addEventListener('change', function (e) { if (e.target && e.target.name === 'startWhere') { pick.vr = e.target.value === '1'; render(); } });
  $('startGo').addEventListener('click', apply);
  $('startOpen').addEventListener('click', open);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('start').hidden) apply(); });
  document.addEventListener('tuner:hello', function () { if (!$('start').hidden) render(); else updateChip(); });   // VR availability and sim logos arrive once the program has said hello

  if (get(K_SKIP) === '1') {                                   // the player asked not to see it: reuse their last choice
    $('startSkip').checked = true;
    if (sims.SIMS[pick.sim] && !sims.SIMS[pick.sim].comingSoon) { window.TunerStart = { sim: pick.sim, vr: pick.vr }; app.setSim(pick.sim); }
    updateChip();
  } else {
    // wait for the welcome video, if it is showing, so the two never sit on top of each other
    var showWhenReady = function () { if ($('intro') && !$('intro').hidden) return setTimeout(showWhenReady, 400); open(); };
    setTimeout(showWhenReady, 150);
  }
})();
