/* The big centred warning shown before anything closes iRacing. Resolves true only if the user clicks the red button. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var resolver = null;

  function finish(answer) {
    $('warn').hidden = true;
    if (resolver) { var r = resolver; resolver = null; r(answer); }
  }

  // opts: { title, lead, steps: [text], okLabel, cancelLabel }
  function confirmWarn(opts) {
    return new Promise(function (resolve) {
      if (resolver) finish(false); // never leave an earlier question hanging
      resolver = resolve;
      $('warnTitle').textContent = opts.title;
      $('warnLead').textContent = opts.lead;
      $('warnSteps').innerHTML = '';
      (opts.steps || []).forEach(function (s) { var li = document.createElement('li'); li.textContent = s; $('warnSteps').appendChild(li); });
      $('warnOk').textContent = opts.okLabel;
      $('warnCancel').textContent = opts.cancelLabel || 'Cancel';
      $('warn').hidden = false;
      $('warnCancel').focus(); // the safe answer is the default: Enter or Space keeps iRacing open
    });
  }

  $('warnOk').addEventListener('click', function () { finish(true); });
  $('warnCancel').addEventListener('click', function () { finish(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('warn').hidden) finish(false); });
  // Clicking the dark background does nothing: the user has to choose one of the two buttons.

  window.TunerWarn = { confirm: confirmWarn };

  // ---------- "round saved" splash with the animated tick ----------
  var doneResolve = null;
  function finishDone() {
    $('done').hidden = true;
    $('done').classList.remove('play');
    if (doneResolve) { var r = doneResolve; doneResolve = null; r(); }
  }
  // opts: { title, sub, lead, items: [text], steps: [text], goLabel }. Resolves when the user moves on.
  function showDone(opts) {
    return new Promise(function (resolve) {
      doneResolve = resolve;
      $('doneTitle').textContent = opts.title;
      $('doneSub').textContent = opts.sub || '';
      $('doneLead').textContent = opts.lead || '';
      $('doneList').innerHTML = ''; $('doneNext').innerHTML = '';
      (opts.items || []).forEach(function (t) { var li = document.createElement('li'); li.textContent = t; $('doneList').appendChild(li); });
      (opts.steps || []).forEach(function (t) { var li = document.createElement('li'); li.textContent = t; $('doneNext').appendChild(li); });
      $('doneGo').textContent = opts.goLabel || 'Continue';
      $('done').hidden = false;
      void $('done').offsetWidth;          // restart the animation every time
      $('done').classList.add('play');
      $('doneGo').focus();
    });
  }
  $('doneGo').addEventListener('click', finishDone);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('done').hidden) finishDone(); });
  window.TunerDone = { show: showDone };
})();
