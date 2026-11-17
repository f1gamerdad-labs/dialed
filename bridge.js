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
  function setCapturing(on) { capturing = on; $('capBtn').textContent = on ? 'Cancel capture' : 'Start capture'; }
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
  app.onSim(function (s) { send({ type: 'setSim', sim: s.id }); $('iniPanel').hidden = true; loadSim(); listBackups(); });

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
  var upd = { version: null, shownFor: null };
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
      upd.version = m.version;
      var later = ''; try { later = sessionStorage.getItem('dialed.updateLater') || ''; } catch (e) { /* no storage */ }
      updStatus('Version ' + m.version + ' is available.', 'good');
      if (!(m.silent && later === m.version)) bar('ok', 'Version ' + m.version + ' is ready', 'Changes the page and settings tables. Your history and captures are kept.', m.notes, true);
    } else if (m.state === 'none') {
      if (!m.silent) updStatus('You are on the latest version (' + m.version + ').', 'good');
    } else if (m.state === 'downloading') {
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

  // ---------- messages from the app ----------
  wv.addEventListener('message', function (e) {
    var m = e.data;
    switch (m.type) {
      case 'hello':
        $('hotkeyBox').value = m.hotkey.text;
        window.TunerHost.hotkeyText = m.hotkey.text;
        $('sCap').textContent = 'Hotkey ' + m.hotkey.text;
        showBusy(m.busy);
        renderUpdates(m);
        listBackups();
        if (m.hotkeyError) status(m.hotkeyError, 'bad');
        // which sims are installed, their logos, and which are open
        var logos = {}, found = {};
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

  function capturePhase(m) {
    if (m.phase === 'countdown') {
      setCapturing(true);
      window.TunerHost.phase = 'countdown';
      window.TunerUI.setState('wait', 'Starting in ' + m.secondsLeft + ' s', 'Get back in the car');
      status('Get ready. Recording starts in ' + m.secondsLeft + ' s. Press the hotkey again to cancel.' +
        (m.busy && m.busy.length ? ' Still running: ' + m.busy.join(', ') + '.' : ''), 'warn');
    }
    else if (m.phase === 'recording') {
      setCapturing(true);
      window.TunerHost.phase = 'recording';
      window.TunerUI.setState('rec', 'Recording', m.secondsLeft + ' s left. Keep driving.');
      status('Recording: ' + m.secondsLeft + ' s left. Keep driving.', 'bad');
    }
    else if (m.phase === 'cancelled') { setCapturing(false); endPhase(); status('Capture cancelled.'); }
    else if (m.phase === 'error') { setCapturing(false); endPhase(); status(m.message, 'bad'); }
    else if (m.phase === 'done') {
      setCapturing(false); endPhase();
      try {
        var cap = core.parseCapture(m.text, m.name);
        cap.vramSize = m.vramTotalBytes > 0 ? m.vramTotalBytes : NaN;
        cap.vramUsedMax = m.vramUsedBytes > 0 ? m.vramUsedBytes : NaN;
        app.addParsedCapture(cap);
        status('Captured ' + cap.ft.length + ' frames. Capture again for a better average, or press Analyse.' +
          (m.busy && m.busy.length ? ' Note: ' + m.busy.join(', ') + ' was running, which may have skewed this capture.' : ''), m.busy && m.busy.length ? 'warn' : 'good');
      } catch (err) { status(err.message, 'bad'); }
    }
  }

  // Keep "is the sim open?" and "which programs are running?" current while the app sits open.
  setInterval(function () { if (!capturing) send({ type: 'busyCheck' }); }, 4000);

  send({ type: 'hello' });
})();
