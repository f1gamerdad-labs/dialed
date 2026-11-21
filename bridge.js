/* Connects the page to the Windows app. In a normal browser this file does nothing. */
(function () {
  'use strict';
  var wv = window.chrome && window.chrome.webview;
  if (!wv) return;

  var $ = function (id) { return document.getElementById(id); };
  var app = window.TunerApp, core = window.TunerCore;
  var pending = {}, nextId = 1, capturing = false, simInfo = {};

  function send(o) { wv.postMessage(o); }
  function status(text, cls) { var s = $('capStatus'); s.textContent = text; s.className = 'status ' + (cls || ''); }
  function setCapturing(on) { capturing = on; document.body.classList.toggle('capturing', !!on); $('capBtn').textContent = on ? 'Cancel capture' : 'Start capture'; }
  function sim() { return app.state.sim; }

  window.TunerHost = {
    // Writes the changed files of one sim (the app keeps backups and undoes a half-finished write).
    // closeSim: close the sim first, because it rewrites its settings on exit. Resolves {ok, message, backup}.
    writeFiles: function (simId, files, closeSim) {
      return new Promise(function (resolve) {
        var id = nextId++;
        pending[id] = resolve;
        send({ type: 'writeFiles', id: id, sim: simId, files: files, closeSim: !!closeSim });
      });
    },
    // Reads facts about this PC for the PC check screen. Resolves { ok, facts } or { ok:false, message }.
    pcCheck: function () {
      return new Promise(function (resolve) {
        var id = nextId++;
        pending[id] = resolve;
        send({ type: 'pcCheck', id: id });
        setTimeout(function () { if (pending[id]) { delete pending[id]; resolve({ ok: false, message: 'it took too long to answer' }); } }, 30000);
      });
    },
    running: {},   // simId -> is that sim open right now?
    phase: null
  };

  function setRunning(map) {
    if (!map) return;
    var was = !!window.TunerHost.running[sim().id];
    window.TunerHost.running = map;
    if (was !== !!map[sim().id]) app.updateApply(); // the Apply button says "Close <sim> and apply..." while the sim is open
  }

  $('appPanel').hidden = false;
  $('iniPanel').hidden = true; // the app finds the files itself; the drop box comes back only if it cannot

  function showBusy(list) {
    window.TunerBusy = list || [];   // the capture reliability check reads this
    $('busyNow').textContent = list && list.length
      ? 'Still running right now: ' + list.join(', ') + '.'
      : 'Nothing obvious is running, but check the system tray too.';
  }

  // ---------- reading the current sim's files ----------
  function loadSim() {
    var s = sim();
    $('iniSelectField').hidden = s.id !== 'iracing';           // only iRacing has several files to choose from
    $('tidyCard').hidden = s.id !== 'iracing';                  // tidy-up is about iRacing's own folder
    $('capSimName').textContent = s.name;
    if (s.id === 'iracing') { if ($('iniSelect').value) send({ type: 'readIni', name: $('iniSelect').value }); }
    else send({ type: 'readSim', sim: s.id });
  }
  $('iniSelect').addEventListener('change', loadSim);
  window.addEventListener('focus', function () { // picks up in-game changes and newly opened programs
    if (!capturing) { loadSim(); send({ type: 'busyCheck' }); }
  });
  function showLaunch() { var s = sim(); $('launchRow').hidden = !(s.steamAppId && !s.comingSoon); }
  app.onSim(function (s) { send({ type: 'setSim', sim: s.id }); $('iniPanel').hidden = true; loadSim(); listBackups(); showLaunch(); });
  showLaunch();
  $('launchSim').addEventListener('click', function () {
    if (window.TunerHost.running[sim().id]) { status(sim().name + ' is already running.', 'warn'); return; }
    send({ type: 'launchSim', sim: sim().id }); status('Asking Steam to start ' + sim().name + '...', '');
  });

  $('capBtn').addEventListener('click', function () { send({ type: 'startCapture' }); });
  $('openCaps').addEventListener('click', function () { send({ type: 'openFolder', which: 'captures' }); });
  $('openBackups').addEventListener('click', function () { send({ type: 'openFolder', which: 'backups', sim: sim().id }); });

  // ---------- backups, restore, tidy ----------
  $('backupsCard').hidden = false;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function when(iso) { var d = new Date(iso); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function backupMsg(text, cls) { $('backupMsg').textContent = text; $('backupMsg').className = 'status ' + (cls || ''); }
  function listBackups() { send({ type: 'listBackups' }); }
  var backupItems = [];
  function simName(id) { return (window.TunerSims.SIMS[id] || { short: id }).short; }

  // The backup is made just before a round is applied, so match it to the nearest round of the same sim within a few minutes.
  function roundFor(b) {
    var hist = app.Store.load(), best = null, bestGap = 3 * 60 * 1000, t = new Date(b.at).getTime();
    hist.forEach(function (r) {
      if ((r.sim || 'iracing') !== b.sim) return;
      var gap = Math.abs(new Date(r.at).getTime() - t); if (gap < bestGap) { best = r; bestGap = gap; }
    });
    return best;
  }

  function renderBackups(items) {
    backupItems = items;
    syncOriginal();
    $('backupsEmpty').hidden = items.length > 0;
    $('backups').innerHTML = items.length ? '<tr><th>Saved</th><th>Sim</th><th>File</th><th>From</th><th class="n">Size</th><th></th></tr>' + items.map(function (b, i) {
      var r = roundFor(b);
      var from = /before restore/.test(b.file) ? 'Before a restore'
        : r ? 'Before round ' + app.roundNo(app.Store.load(), r) + ': ' + esc(r.applied.map(function (c) { return c.name; }).join(', ')) : 'Before a change';
      return '<tr><td>' + esc(when(b.at)) + '</td><td>' + esc(simName(b.sim)) + '</td><td>' + esc(b.target) + '</td><td>' + from + '</td><td class="n">' + b.kb + ' KB</td>' +
        '<td><button class="ghost" data-i="' + i + '">Restore</button></td></tr>';
    }).join('') : '';
  }

  $('backups').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-i]'); if (!btn) return;
    var b = backupItems[+btn.dataset.i], s = window.TunerSims.SIMS[b.sim], close = !!window.TunerHost.running[b.sim];
    function go() {
      backupMsg(close ? 'Closing ' + s.name + '...' : 'Restoring...');
      send({ type: 'restoreBackup', sim: b.sim, file: b.file, closeSim: close });
    }
    if (close && window.TunerWarn) {
      window.TunerWarn.confirm({
        title: s.name + ' will close',
        lead: 'Restoring ' + b.target + ' closes ' + s.name + ' right now. If you are in a session, you will leave it.',
        steps: [s.name + ' is asked to close, the same as choosing Exit.', 'Your current settings file is backed up first.',
          'The backup from ' + when(b.at) + ' is put back.', 'Start ' + s.name + ' again to use the restored settings.'],
        okLabel: 'Close ' + s.short + ' and restore', cancelLabel: 'No, keep ' + s.short + ' open'
      }).then(function (ok) { if (ok) go(); });
    } else if (confirm('Restore ' + b.target + ' from ' + when(b.at) + '?\n\nYour current file is backed up first.')) go();
  });

  // ---- "Restore my original settings": the oldest backup of each file, for the sim on screen. Dialed saves a backup before its first ever change,
  // so the oldest one is how the file was before Dialed touched it. Several files (some sims) are restored one after another.
  var originalQueue = [], originalRunning = false;
  function originalsFor(id) {
    var by = {};
    backupItems.forEach(function (b) {
      if (b.sim !== id || /before restore/.test(b.file)) return;
      if (!by[b.target] || new Date(b.at) < new Date(by[b.target].at)) by[b.target] = b;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  function syncOriginal() {
    var list = originalsFor(sim().id), card = $('restoreCard');
    card.hidden = !list.length;
    if (!list.length) return;
    var first = list.reduce(function (a, b) { return new Date(b.at) < new Date(a.at) ? b : a; });
    $('restoreOrigHint').textContent = 'Puts ' + (list.length > 1 ? 'your ' + list.length + ' settings files' : sim().short + '\'s graphics file') + ' back exactly as ' + (list.length > 1 ? 'they were' : 'it was') +
      ' before Dialed first changed anything (saved ' + when(first.at) + '). Your current settings are backed up first, so this can be undone too.';
  }
  function nextOriginal() {
    var b = originalQueue.shift(); if (!b) return;
    send({ type: 'restoreBackup', sim: b.sim, file: b.file, closeSim: !!window.TunerHost.running[b.sim] });
  }
  $('restoreOrig').addEventListener('click', function () {
    var s = sim(), list = originalsFor(s.id); if (!list.length) return;
    var close = !!window.TunerHost.running[s.id];
    function go() { originalRunning = true; originalQueue = list.slice(); $('restoreOrigMsg').textContent = close ? 'Closing ' + s.name + '...' : 'Restoring...'; $('restoreOrigMsg').className = 'status'; nextOriginal(); }
    if (close && window.TunerWarn) {
      window.TunerWarn.confirm({
        title: s.name + ' will close',
        lead: 'Restoring your original settings closes ' + s.name + ' right now. If you are in a session, you will leave it.',
        steps: [s.name + ' is asked to close, the same as choosing Exit.', 'Your current settings are backed up first.', 'Your settings from before Dialed are put back.', 'Start ' + s.name + ' again to use them.'],
        okLabel: 'Close ' + s.short + ' and restore', cancelLabel: 'No, keep ' + s.short + ' open'
      }).then(function (ok) { if (ok) go(); });
    } else if (confirm('Put your original ' + s.name + ' settings back?\n\nYour current settings are backed up first, so you can undo this.')) go();
  });

  $('tidyScan').addEventListener('click', function () { $('tidyMsg').textContent = ''; send({ type: 'scanTidy' }); });
  $('tidyMove').addEventListener('click', function () {
    var files = Array.prototype.map.call($('tidyList').querySelectorAll('input:checked'), function (el) { return el.dataset.f; });
    if (!files.length) return;
    send({ type: 'moveTidy', files: files });
  });

  function renderTidy(items, dir) {
    $('tidyResult').hidden = items.length === 0;
    if (!items.length) { $('tidyMsg').textContent = 'No loose backup files found. Your iRacing folder is already tidy.'; $('tidyMsg').className = 'status good'; return; }
    $('tidyMsg').textContent = 'Found ' + items.length + '. They will move into ' + dir + ' (a subfolder called "Moved from iRacing folder"). Untick any you want to leave where they are.';
    $('tidyMsg').className = 'status';
    $('tidyList').innerHTML = '<tr><th></th><th>File</th><th>Modified</th><th class="n">Size</th></tr>' + items.map(function (f) {
      return '<tr><td class="ck"><input type="checkbox" checked data-f="' + esc(f.file) + '" aria-label="Move ' + esc(f.file) + '"></td><td>' + esc(f.file) + '</td><td>' + esc(when(f.modified)) + '</td><td class="n">' + f.kb + ' KB</td></tr>';
    }).join('');
  }

  // ---------- updates ----------
  var upd = { version: null, shownFor: null, notes: [] };
  // After "Later" the banner goes away, but a small pill in the sidebar stays until the update is installed, so it cannot be forgotten.
  $('verPill').addEventListener('click', function () {
    if (!upd.version) return;
    bar('ok', 'Version ' + upd.version + ' is ready', 'Changes the page and settings tables. Your history and captures are kept.', upd.notes, true);
    $('main').scrollTop = 0;
  });
  function updStatus(text, cls) { $('updateStatus').textContent = text; $('updateStatus').className = 'status ' + (cls || ''); }
  function bar(kind, title, sub, notes, showButtons) {
    $('updateBar').className = 'update ' + kind; $('updateTitle').textContent = title; $('updateSub').textContent = sub || '';
    $('updateNotes').innerHTML = (notes || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    $('updateNow').hidden = !showButtons; $('updateLater').hidden = !showButtons; $('updateNow').disabled = false;
    $('updateBar').hidden = false;
  }
  function renderUpdates(h) {
    $('updatesCard').hidden = false;
    $('versionLine').textContent = 'Dialed v' + h.appVersion.content + ' (program v' + h.appVersion.host + ')';
    var verEl = document.querySelector('.rail .ver'); if (verEl) verEl.textContent = 'v' + h.appVersion.content;
    $('autoUpdate').checked = !!h.updates.auto;
    $('checkUpdate').hidden = !h.updates.configured; $('autoUpdate').parentElement.hidden = !h.updates.configured;
    $('revertUpdate').hidden = !h.updates.canRevert;
    if (!h.updates.configured) updStatus('Updates are not switched on for this copy yet.');
    var was = null; try { was = localStorage.getItem('dialed.justUpdated'); localStorage.removeItem('dialed.justUpdated'); } catch (e) { /* no storage */ }
    if (was) bar('ok', 'Updated to version ' + h.appVersion.content, 'Your history and settings are untouched. You can go back from About if anything looks wrong.', [], false);
  }
  $('updateNow').addEventListener('click', function () {
    try { localStorage.setItem('dialed.justUpdated', '1'); } catch (e) { /* no storage */ }
    $('updateNow').disabled = true; send({ type: 'applyUpdate' });
  });
  $('updateLater').addEventListener('click', function () { $('updateBar').hidden = true; try { sessionStorage.setItem('dialed.updateLater', upd.version || ''); } catch (e) { /* no storage */ } });
  $('checkUpdate').addEventListener('click', function () { updStatus('Checking...'); send({ type: 'checkUpdate' }); });
  $('revertUpdate').addEventListener('click', function () {
    if (confirm('Go back to the previous version? Your history and settings are kept. The page reloads.')) { try { localStorage.removeItem('dialed.justUpdated'); } catch (e) { /* no storage */ } send({ type: 'revertUpdate' }); }
  });
  $('autoUpdate').addEventListener('change', function () { send({ type: 'setUpdateCheck', enabled: $('autoUpdate').checked }); });
  function onUpdate(m) {
    if (m.state === 'available') {
      upd.version = m.version; upd.notes = m.notes || []; $('verPill').hidden = false;
      var later = ''; try { later = sessionStorage.getItem('dialed.updateLater') || ''; } catch (e) { /* no storage */ }
      updStatus('Version ' + m.version + ' is available.', 'good');
      if (!(m.silent && later === m.version)) bar('ok', 'Version ' + m.version + ' is ready', 'Changes the page and settings tables. Your history and captures are kept.', m.notes, true);
    } else if (m.state === 'none') {
      if (!m.silent) updStatus('You are on the latest version (' + m.version + ').', 'good');
    } else if (m.state === 'downloading') {
      $('verPill').hidden = true;
      bar('ok', 'Updating to version ' + m.version + '...', 'Downloading and checking it. The page reloads when it is done.', [], false);
    } else if (m.state === 'error') {
      updStatus(m.message, 'bad'); $('updateNow').disabled = false;
      try { localStorage.removeItem('dialed.justUpdated'); } catch (e) { /* no storage */ } // a failed update must not look like a finished one on the next start
      if (!$('updateBar').hidden) bar('bad', 'The update was not installed', m.message, [], false);
    }
  }

  // ---------- hotkey picker ----------
  function keyName(e) {
    var k = e.key;
    if (/^F\d{1,2}$/.test(k)) return k;
    if (/^[a-z]$/i.test(k)) return k.toUpperCase();
    if (/^\d$/.test(k)) return 'D' + k;
    return { ' ': 'Space', PageUp: 'PageUp', PageDown: 'PageDown', Home: 'Home', End: 'End', Insert: 'Insert', Delete: 'Delete' }[k] || null;
  }
  $('hotkeyBox').addEventListener('keydown', function (e) {
    e.preventDefault();
    var key = keyName(e);
    if (!key) return; // a modifier on its own, or a key we cannot register
    send({ type: 'setHotkey', ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, key: key });
  });

  $('shortcutBtn').hidden = false;                                                        // only the Windows app can make shortcuts
  $('shortcutBtn').addEventListener('click', function () { $('shortcutMsg').textContent = 'Adding...'; send({ type: 'createShortcuts' }); });
  ['trayMode', 'trayHide', 'trayNotify'].forEach(function (id) {
    $(id).addEventListener('change', function () { send({ type: 'setTray', mode: $('trayMode').checked, hideOnCapture: $('trayHide').checked, notify: $('trayNotify').checked }); });
  });
  $('cueSelect').addEventListener('change', function () { send({ type: 'setCueVoice', voice: $('cueSelect').value === 'voice' }); });

  // ---------- messages from the app ----------
  wv.addEventListener('message', function (e) {
    var m = e.data;
    switch (m.type) {
      case 'hello':
        $('hotkeyBox').value = m.hotkey.text;
        $('cueField').hidden = !m.voiceClips;               // the voice/beeps choice only makes sense when the recorded clips are installed
        $('cueSelect').value = m.cueVoice === false ? 'beeps' : 'voice';
        $('adminBar').hidden = m.elevated !== false;          // only when the program says it is NOT elevated (an older program says nothing)
        $('ioExport').hidden = !m.tray;                       // exporting needs the 0.4 program; importing works anywhere
        if (m.tray) { $('trayMode').checked = !!m.tray.mode; $('trayHide').checked = !!m.tray.hideOnCapture; $('trayNotify').checked = !!m.tray.notify; $('trayCard').hidden = false; }   // an older program has no tray, so the card stays hidden
        window.TunerHost.hotkeyText = m.hotkey.text;
        window.TunerHost.contentVersion = m.appVersion && m.appVersion.content;
        window.TunerHost.screenHz = m.screenHz || 0;          // the refresh rate of the main screen, used as the default target
        if (window.TunerPrefs) window.TunerPrefs.refresh();
        $('sCap').textContent = 'Hotkey ' + m.hotkey.text;
        showBusy(m.busy);
        renderUpdates(m);
        listBackups();
        if (m.hotkeyError) status(m.hotkeyError, 'bad');
        // which sims are installed, their logos, and which are open
        var logos = {}, found = {};
        // tester switch (--enable-sims=...): the program says which "coming soon" sims to switch on for this run
        (m.enabledSims || []).forEach(function (id) { var t = window.TunerSims.SIMS[id]; if (t) { t.comingSoon = false; delete t.reason; } });
        m.sims.forEach(function (s) { simInfo[s.id] = s; if (s.logo) logos[s.id] = s.logo; found[s.id] = { found: s.found, installed: s.installed }; });
        app.setLogos(logos); app.setSimStatus(found);
        setRunning(m.running);
        send({ type: 'setSim', sim: sim().id }); // the page's saved choice wins; the hotkey then captures that sim
        // iRacing: the user picks among its renderer files
        $('iniSelect').innerHTML = m.ini.map(function (f) {
          return '<option value="' + f.name + '">' + f.name + ' (' + new Date(f.modified).toLocaleDateString() + ')</option>';
        }).join('');
        if (m.lastIni && m.ini.some(function (f) { return f.name === m.lastIni; })) $('iniSelect').value = m.lastIni;
        if (sim().id === 'iracing' && !m.ini.length) {
          $('iniPanel').hidden = false;
          status('Could not find iRacing graphics files in ' + m.iniDir + '. Drop your rendererDX11Monitor.ini below instead.', 'warn');
        }
        loadSim();
        break;
      case 'ini': // iRacing's chosen file
        if (sim().id === 'iracing') app.setFileText('main', m.name, m.text);
        break;
      case 'simFiles': { // every other sim: the app read its files from fixed places
        if (m.sim !== sim().id) break;
        var gone = m.files.filter(function (f) { return f.missing; });
        m.files.forEach(function (f) { if (!f.missing) app.setFileText(f.fileId, f.name, f.text); });
        $('iniPanel').hidden = gone.length === 0;
        if (gone.length) status('Could not find ' + gone.map(function (f) { return f.name; }).join(' and ') + ' for ' + sim().name +
          '. Start the game once so it creates its settings, or drop the file(s) below.', 'warn');
        break;
      }
      case 'exportSaved':
        if (window.TunerSettingsIO) window.TunerSettingsIO.saved(m);
        break;
      case 'formPosted':
        if (window.TunerCommunity) window.TunerCommunity.posted(m);
        break;
      case 'shortcuts':
        $('shortcutMsg').textContent = m.ok ? 'Added to ' + [m.startMenu ? 'the Start menu' : '', m.desktop ? 'your desktop' : ''].filter(Boolean).join(' and ') + '.' : 'Could not add the shortcuts' + (m.message ? ': ' + m.message : '') + '.';
        $('shortcutMsg').className = 'status ' + (m.ok ? 'good' : 'bad');
        break;
      case 'imageSaved':
        if (window.TunerShare) window.TunerShare.saved(m);
        break;
      case 'pcCheck':
        if (pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
        break;
      case 'iniWritten':
        if (pending[m.id]) { pending[m.id]({ ok: m.ok, message: m.message, backup: m.backup }); delete pending[m.id]; }
        if (m.ok) { loadSim(); listBackups(); }
        break;
      case 'hotkey':
        if (m.ok) { window.TunerHost.hotkeyText = m.hotkey.text; $('hotkeyBox').value = m.hotkey.text; $('sCap').textContent = 'Hotkey ' + m.hotkey.text; status('Hotkey set to ' + m.hotkey.text + '.', 'good'); }
        else status(m.error, 'bad');
        break;
      case 'busy':
        showBusy(m.busy);
        setRunning(m.running);
        break;
      case 'update':
        onUpdate(m);
        break;
      case 'simLaunched':
        status(m.ok ? 'Steam is starting ' + sim().name + '. Set up your test session, then capture.' : 'Could not start it through Steam. Start the game from Steam yourself (Dialed is already open, so that is fine).', m.ok ? 'good' : 'warn');
        break;
      case 'folderOpened':
        if (!m.ok) status('Could not open the folder from here. You can find it at ' + (m.path || 'the app data folder') + '.', 'warn');
        break;
      case 'iniProgress':
        $('applyMsg').textContent = m.text;
        break;
      case 'backups':
        renderBackups(m.items);
        break;
      case 'backupProgress':
        backupMsg(m.text);
        break;
      case 'restored':
        backupMsg(m.ok ? 'Restored. The tool is now reading your restored file.' : m.message, m.ok ? 'good' : 'bad');
        if (originalQueue.length && m.ok) nextOriginal();
        else if (originalRunning) {
          $('restoreOrigMsg').textContent = m.ok ? 'Done. Your original settings are back. Start the sim again to use them.' : (m.message || 'Could not restore.');
          $('restoreOrigMsg').className = 'status ' + (m.ok ? 'good' : 'bad'); originalQueue = []; originalRunning = false;
        }
        loadSim(); listBackups();
        break;
      case 'tidy':
        renderTidy(m.items, m.dir);
        break;
      case 'tidyDone':
        $('tidyResult').hidden = true;
        $('tidyMsg').textContent = 'Moved ' + m.moved + ' file' + (m.moved === 1 ? '' : 's') + ' into ' + m.dest + '.' + (m.failed ? ' ' + m.failed + ' could not be moved.' : '');
        $('tidyMsg').className = 'status ' + (m.failed ? 'warn' : 'good');
        break;
      case 'capture':
        capturePhase(m);
        break;
      case 'error':
        app.showError(m.message);
        break;
    }
  });

  function endPhase() { window.TunerHost.phase = null; window.TunerUI.update(); }

  // "Three, one after another": the first countdown starts the chain, and each finished run starts the next after a short breather.
  var runsPlan = 1, chain = null;
  try { runsPlan = parseInt(localStorage.getItem('dialed.runs') || '1', 10) === 3 ? 3 : 1; } catch (e) { /* default */ }
  $('runsSelect').value = String(runsPlan);
  $('runsSelect').addEventListener('change', function () {
    runsPlan = $('runsSelect').value === '3' ? 3 : 1;
    try { localStorage.setItem('dialed.runs', String(runsPlan)); } catch (e) { /* not remembered */ }
  });
  function runNote() { return chain ? ' (run ' + chain.done + ' of ' + chain.total + ')' : ''; }

  function capturePhase(m) {
    if (m.phase === 'countdown') {
      if (!chain && runsPlan > 1) chain = { total: runsPlan, done: 1 };            // the first countdown of a new chain
      setCapturing(true);
      window.TunerHost.phase = 'countdown';
      window.TunerUI.setState('wait', 'Starting in ' + m.secondsLeft + ' s', 'Get back in the car');
      status('Get ready' + runNote() + '. Recording starts in ' + m.secondsLeft + ' s. Press the hotkey again to cancel.' +
        (m.busy && m.busy.length ? ' Still running: ' + m.busy.join(', ') + '.' : ''), 'warn');
    }
    else if (m.phase === 'recording') {
      setCapturing(true);
      window.TunerHost.phase = 'recording';
      window.TunerUI.setState('rec', 'Recording', m.secondsLeft + ' s left. Keep driving.');
      status('Recording' + runNote() + ': ' + m.secondsLeft + ' s left. Keep driving.', 'bad');
    }
    else if (m.phase === 'sim') { if (m.sim && sim().id !== m.sim) app.setSim(m.sim); } // the hotkey was pressed in a different game than the one selected: follow it
    else if (m.phase === 'cancelled') { chain = null; setCapturing(false); endPhase(); status('Capture cancelled.'); }
    else if (m.phase === 'error') { chain = null; setCapturing(false); endPhase(); status(m.message, 'bad'); }
    else if (m.phase === 'done') {
      setCapturing(false); endPhase();
      var more = false;
      try {
        var cap = core.parseCapture(m.text, m.name);
        cap.vramSize = m.vramTotalBytes > 0 ? m.vramTotalBytes : NaN;
        cap.vramUsedMax = m.vramUsedBytes > 0 ? m.vramUsedBytes : NaN;
        app.addParsedCapture(cap);
        more = !!chain && chain.done < chain.total;
        if (more) status('Run ' + chain.done + ' of ' + chain.total + ' saved (' + cap.ft.length + ' frames). The next run starts in a moment: keep driving.', 'good');
        else status((chain ? 'All ' + chain.total + ' runs saved. ' : 'Captured ' + cap.ft.length + ' frames. Capture again for a better average, or ') + 'press Analyse.' +
          (m.busy && m.busy.length ? ' Note: ' + m.busy.join(', ') + ' was running, which may have skewed this capture.' : ''), m.busy && m.busy.length ? 'warn' : 'good');
      } catch (err) { chain = null; status(err.message, 'bad'); }
      if (more) { chain.done++; setTimeout(function () { if (chain && !capturing) send({ type: 'startCapture' }); }, 3000); }
      else { if (chain && chain.total >= 3 && window.TunerBadges) window.TunerBadges.event('threeRuns'); chain = null; }
    }
  }

  // Keep "is the sim open?" and "which programs are running?" current while the app sits open.
  setInterval(function () { if (!capturing) send({ type: 'busyCheck' }); }, 4000);

  send({ type: 'hello' });
})();
