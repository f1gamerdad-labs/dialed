/* Navigation and sidebar status for the Sim Racing Graphics Optimiser. Pure presentation: no analysis happens here. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ['setup', 'results', 'history', 'about'];
  var GOAL_NOTE = {
    smooth: 'Smoothness: hold your target frame rate almost all the time, even if that costs some looks.',
    balanced: 'Balanced: a steady frame rate, keeping what looks good.',
    eyecandy: 'Eye candy: the best visuals that still drive well.'
  };

  function show(name) {
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    document.querySelectorAll('.rail button[data-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.view === name); });
    document.querySelectorAll('.side [data-for]').forEach(function (el) { el.hidden = el.dataset.for !== name; });
    $('main').scrollTop = 0;
    update();
  }

  function mark(id, done) { var a = $(id); if (a) a.classList.toggle('done', !!done); }

  function update() {
    var app = window.TunerApp; if (!app) return;
    var s = app.state, n = s.caps.length;
    var goal = document.querySelector('input[name=goal]:checked'), mode = document.querySelector('input[name=mode]:checked');
    var goalLabel = { smooth: 'Smoothness', balanced: 'Balanced', eyecandy: 'Eye candy' }[goal.value];
    $('goalHint').textContent = GOAL_NOTE[goal.value];

    $('sCaps').textContent = n ? n + ' capture' + (n > 1 ? 's' : '') + ' ready' : 'None yet';
    $('sIni').textContent = s.iniName || 'Not loaded';
    // only say driving/replay where the sim actually has the two separate
    $('sGoal').textContent = app.state.sim.modes.length > 1 ? goalLabel + ', ' + (mode && mode.value === 'replay' ? 'replay' : 'driving') : goalLabel;
    mark('stepCaptures', n > 0); mark('stepIni', !!s.iniName); mark('stepGoal', true);
    mark('stepCapture', n > 0);
    $('stepCapture').hidden = $('appPanel').hidden;

    var hasResult = !$('results').hidden;
    $('stepLast').hidden = $('lastRound').hidden;
    $('stepNotes').hidden = $('notesPanel').hidden;
    $('resultsEmpty').hidden = hasResult;
    $('historyEmpty').hidden = !$('historyPanel').hidden;

    // Sidebar status chip: capture state when the Windows app is driving, otherwise readiness.
    if (!window.TunerHost || !window.TunerHost.phase) {
      var ready = n > 0 && !!s.iniName;
      setState(ready ? 'ready' : '', ready ? 'Ready to analyse' : 'Getting set up', ready ? n + ' capture' + (n > 1 ? 's' : '') + ', file loaded' : 'Add captures and your ' + s.sim.name + (s.sim.files.length > 1 ? ' files' : ' file'));
    }
  }

  function setState(kind, title, sub) {
    $('sideDot').className = 'dot ' + kind;
    $('sideState').textContent = title;
    $('sideSub').textContent = sub || '';
  }

  document.querySelectorAll('.rail button[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.view); });
  });
  document.querySelectorAll('.side a[data-go]').forEach(function (a) {
    a.addEventListener('click', function () {
      var t = $(a.dataset.go);
      if (t && !t.hidden) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  // delegated, because the mode switch is rebuilt whenever the sim changes
  document.addEventListener('change', function (e) { if (e.target && (e.target.name === 'goal' || e.target.name === 'mode')) update(); });

  window.TunerUI = { show: show, update: update, setState: setState };
  update();
})();
