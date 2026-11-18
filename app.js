/* Sim Racing Graphics Optimiser - page behaviour. Works for any sim profile in sims.js. */
(function () {
  'use strict';
  var core = window.TunerCore, sims = window.TunerSims;
  var SIMKEY = 'iracing-tuner.sim';
  var state = { sim: sims.SIMS.iracing, files: {}, caps: [], iniText: null, iniName: null, ini: null, result: null, rows: [], assess: null, showAll: false };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- the current sim ----------
  function currentMode() {
    var el = document.querySelector('input[name=mode]:checked'), id = el ? el.value : state.sim.modes[0].id;
    return state.sim.modes.filter(function (m) { return m.id === id; })[0] || state.sim.modes[0];
  }
  function currentSection() { return currentMode().section; }
  function sectionOf(round) { return round.section || (sims.SIMS[round.sim || 'iracing'] || state.sim).modes[0].section; }
  function vrMessage() { return 'This tool is not for VR. For VR, I\'d suggest using NextLevelXR, which is made for it. Choose ' + state.sim.files[0].name + ' instead.'; }
  function isVrFile(name) { return state.sim.isVrFile(name); }

  // ---------- history storage (swappable: the Windows app can supply its own) ----------
  var KEY = 'iracing-tuner.history.v1', mem = null;
  var Store = window.TunerStore || {
    load: function () {
      try { var t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch (e) { /* fall through */ }
      return mem || [];
    },
    save: function (h) { mem = h; try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) { /* kept in memory */ } }
  };
  // The open round (applied, not yet measured) for this sim and mode, if any.
  function pendingIndex(h, simId, section) {
    for (var i = h.length - 1; i >= 0; i--) {
      if ((h[i].sim || 'iracing') === simId && sectionOf(h[i]) === section) return h[i].result ? -1 : i;
    }
    return -1;
  }
  // Round numbers count within each sim, so the first LMU round is "round 1" even after iRacing rounds.
  function roundNo(hist, round) {
    var simId = round.sim || 'iracing', n = 0;
    for (var i = 0; i < hist.length; i++) {
      if ((hist[i].sim || 'iracing') === simId) n++;
      if (hist[i] === round || (hist[i].at === round.at && hist[i].id === round.id)) return n;
    }
    return n;
  }
  function historyFor(simId, section) {
    return Store.load().filter(function (h) { return (h.sim || 'iracing') === simId && sectionOf(h) === section; });
  }

  function showError(msg) { $('error').textContent = msg || ''; $('error').hidden = !msg; }

  // ---------- game files: one or several per sim ----------
  function haveAllFiles() { return state.sim.files.every(function (f) { return state.files[f.id]; }); }
  function rebuildIni() {
    var texts = {};
    state.sim.files.forEach(function (f) { if (state.files[f.id]) texts[f.id] = state.files[f.id].text; });
    state.ini = haveAllFiles() ? sims.parseAll(state.sim, texts) : null;
    var loaded = state.sim.files.filter(function (f) { return state.files[f.id]; });
    state.iniName = loaded.map(function (f) { return state.files[f.id].name; }).join(', ') || null;
    state.iniText = loaded.length ? state.files[loaded[0].id].text : null;
  }

  // Reads and checks one file's text. Returns true when it was accepted.
  function setFileText(fileId, name, text) {
    var f = state.sim.files.filter(function (x) { return x.id === fileId; })[0];
    if (!f) { showError('"' + name + '" is not one of the files this tool reads for ' + state.sim.name + '.'); return false; }
    try {
      var parsed = f.parse(text);
      if (!parsed[f.sections[0]]) throw new Error('missing section');
    } catch (e) {
      showError('"' + name + '" does not look like the right ' + state.sim.name + ' file. ' + f.hint);
      return false;
    }
    state.files[fileId] = { name: name, text: text };
    rebuildIni();
    refresh();
    return true;
  }
  function setFile(file) {
    showError('');
    if (isVrFile(file.name)) { showError(vrMessage()); return Promise.resolve(false); }
    var f = sims.fileFor(state.sim, file.name);
    if (!f) {
      showError('"' + file.name + '" is not one of the files this tool reads for ' + state.sim.name + '. It needs: ' +
        state.sim.files.map(function (x) { return x.name; }).join(' and ') + '.');
      return Promise.resolve(false);
    }
    return file.text().then(function (t) { return setFileText(f.id, file.name, t); });
  }
  function setFiles(files) { // one after another, so error messages stay in order
    var chain = Promise.resolve();
    Array.prototype.forEach.call(files, function (f) { chain = chain.then(function () { return setFile(f); }); });
    return chain;
  }
  function setIni(file) { return setFile(file); } // older name, still used by the app bridge

  // ---------- captures ----------
  function addParsedCapture(c) {
    state.caps = state.caps.filter(function (x) { return x.name !== c.name; });
    state.caps.push(c);
    refresh();
  }
  function addCaptures(files) {
    showError('');
    return Promise.all(Array.prototype.map.call(files, function (f) {
      return f.text().then(function (t) { return core.parseCapture(t, f.name); });
    })).then(function (caps) { caps.forEach(addParsedCapture); })
      .catch(function (e) { showError(e.message); });
  }
  function clearCaptures() { state.caps = []; refresh(); }
  // A bad capture (a spin, a restart, a pit stop) can be dropped so it does not skew the advice.
  $('capFiles').addEventListener('click', function (e) {
    var b = e.target.closest('button.x'); if (!b) return;
    state.caps.splice(+b.dataset.i, 1);
    refresh();
  });

  // ---------- what the page says changes with the sim ----------
  var LOGOS = window.TunerLogos = window.TunerLogos || { iracing: 'assets/sims/iracing.png' };
  var STATUS = {}; // simId -> { found: bool } once the Windows app has looked

  function renderPicker() {
    // Sims that are switched on sit under the app name; the ones still to come are listed below the steps.
    function tile(id) {
      var s = sims.SIMS[id], on = s === state.sim, st = STATUS[id] || {};
      var soon = !!s.comingSoon, notInstalled = !soon && st.installed === false, missing = !soon && !notInstalled && st.found === false;
      var tip = s.name + (soon ? ' - coming soon. ' + s.reason : notInstalled ? ' (not installed on this PC)' : missing ? ' (settings file not found on this PC)' : '');
      var logo = LOGOS[id] ? '<img src="' + esc(LOGOS[id]) + '" alt="">' : '';
      return '<button class="simbtn' + (on ? ' on' : '') + (missing || notInstalled ? ' missing' : '') + (soon ? ' soon' : '') + '" data-sim="' + id +
        '" aria-pressed="' + on + '"' + (soon ? ' disabled aria-disabled="true"' : '') + ' title="' + esc(tip) + '">' + logo +
        '<span class="nm">' + esc(s.short) + '</span>' + (soon ? '<span class="tagsoon">Coming soon</span>' : notInstalled ? '<span class="tagsoon">Not installed</span>' : '') + '</button>';
    }
    var live = sims.ORDER.filter(function (id) { return !sims.SIMS[id].comingSoon; }), soon = sims.ORDER.filter(function (id) { return sims.SIMS[id].comingSoon; });
    $('simPicker').innerHTML = live.map(tile).join('');
    $('simSoon').innerHTML = soon.map(tile).join('');
    $('soonBlock').hidden = soon.length === 0;
  }
  $('simPicker').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sim]'); if (b) setSim(b.dataset.sim);
  });

  function renderSimUI() {
    var sim = state.sim, one = sim.files.length === 1;
    renderPicker();
    $('version').textContent = 'Settings table: ' + sim.table.testedAgainst + '.';
    $('iniEyebrow').textContent = one ? 'Your ' + sim.name + ' file' : 'Your ' + sim.name + ' files';
    $('iniDropText').innerHTML = 'Drop ' + sim.files.map(function (f) { return '<b>' + esc(f.name) + '</b>'; }).join(' and ') + ' here, or click to choose';
    $('iniHint').innerHTML = sim.files.map(function (f) { return esc(f.label) + ': ' + esc(f.hint); }).join('<br>') + ' VR files are not supported.';
    $('iniInput').multiple = !one;
    $('sIniTitle').textContent = one ? 'Game file' : 'Game files';
    // the mode switch (Driving / Replay) comes from the sim
    var keep = document.querySelector('input[name=mode]:checked'), keepId = keep ? keep.value : null;
    var ids = sim.modes.map(function (m) { return m.id; });
    var pick = ids.indexOf(keepId) >= 0 ? keepId : ids[0];
    $('modeSeg').innerHTML = sim.modes.map(function (m) {
      return '<label><input type="radio" name="mode" value="' + m.id + '"' + (m.id === pick ? ' checked' : '') + '>' + esc(m.label) + '</label>';
    }).join('');
    $('modeField').hidden = sim.modes.length < 2;
    $('simNote').innerHTML = sim.note || ''; $('simNote').hidden = !sim.note; // what "driving" and "replay" mean in this sim
    // heavy test sessions for this sim (scenario text is trusted, written in sims.js)
    var scen = sim.scenarios || [];
    $('scenList').innerHTML = scen.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    $('testCard').hidden = scen.length === 0;
    $('launchSim').textContent = 'Launch ' + (sim.short || sim.name);
    var many = sim.files.length > 1, fileWord = many ? 'files' : 'file';
    $('applyHint').innerHTML = 'In the Windows app this saves the change straight into ' + esc(sim.name) + '\'s own settings ' + fileWord +
      ' and first backs up the old ' + fileWord + ' into a folder called <code>Dialed Backups</code> next to ' + (many ? 'them' : 'it') +
      ', so nothing is left loose among the sim\'s own files. In the browser it downloads the changed ' + fileWord + ' to swap in while ' + esc(sim.name) +
      ' is closed. Either way, the round is remembered so the next capture can be compared.';
    $('modeHint').textContent = currentMode().hint;
    if (window.TunerUI) window.TunerUI.update();
  }
  document.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'mode') { $('modeHint').textContent = currentMode().hint; if (window.TunerUI) window.TunerUI.update(); }
  });

  var simListeners = [];
  function setSim(id) {
    var next = sims.SIMS[id];
    if (!next || next.comingSoon) return;
    if (next !== state.sim) {
      state.sim = next; state.files = {}; state.caps = []; state.result = null; state.assess = null; state.rows = [];
      state.ini = null; state.iniName = null; state.iniText = null;
      $('results').hidden = true; $('lastRound').hidden = true; showError('');
      $('resultsEmptyText').textContent = EMPTY_TEXT;
      try { localStorage.setItem(SIMKEY, id); } catch (e) { /* the choice just is not remembered */ }
      renderSimUI(); refresh(); renderHistory();
      simListeners.forEach(function (fn) { fn(next); });
    } else renderSimUI();
  }
  function setLogos(map) { Object.keys(map).forEach(function (k) { if (map[k]) LOGOS[k] = map[k]; }); renderPicker(); }
  function setSimStatus(map) { Object.keys(map).forEach(function (k) { STATUS[k] = map[k]; }); renderPicker(); }

  function refresh() {
    $('capFiles').innerHTML = state.caps.map(function (c, i) {
      var s = core.summarise(c);
      return '<li>' + esc(c.name) + ' <span class="tag">' + s.avgFps.toFixed(0) + ' FPS avg, ' + s.low1.toFixed(0) + ' 1% low, ' + s.spikesPerMin.toFixed(0) + ' stutters/min</span>' +
        '<button class="x" data-i="' + i + '" title="Remove this capture" aria-label="Remove ' + esc(c.name) + '">&#10005;</button></li>';
    }).join('');
    $('iniFiles').innerHTML = state.sim.files.map(function (f) {
      return state.files[f.id] ? '<li>' + esc(state.files[f.id].name) + '</li>' : '<li class="need">' + esc(f.name) + ' (still needed)</li>';
    }).join('');
    $('run').disabled = !(state.caps.length && state.ini);
    if (window.TunerUI) window.TunerUI.update();
  }

  function wireDrop(dropId, inputId, handler) {
    var drop = $(dropId), input = $(inputId);
    input.addEventListener('change', function () { if (input.files.length) handler(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) handler(e.dataTransfer.files); });
  }
  wireDrop('capDrop', 'capInput', addCaptures);
  wireDrop('iniDrop', 'iniInput', setFiles);

  var LIMIT = {
    gpu: ['Graphics card', 'The graphics card is flat out; the processor is waiting on it.'],
    cpu: ['Processor', 'The processor is the limit; the graphics card has spare capacity.'],
    cap: ['Frame cap', 'You are holding your frame rate limit.'],
    unknown: ['Unknown', 'No graphics card timing in this capture.']
  };
  function tile(label, value, cls, detail) {
    return '<div class="tile"><span>' + label + '</span><b class="' + (cls || '') + '">' + value + '</b><small>' + (detail || '') + '</small></div>';
  }
  function fmtDelta(v, higherIsBetter, digits, unit) {
    if (v === null || !isFinite(v)) return '';
    var good = higherIsBetter ? v > 0 : v < 0;
    var cls = Math.abs(v) < (digits ? 0.05 : 0.5) ? '' : good ? 'good' : 'bad';
    return '<span class="delta ' + cls + '">' + (v > 0 ? '+' : '') + v.toFixed(digits || 0) + (unit || '') + '</span>';
  }

  // ---------- last round report ----------
  var VERDICT = {
    better: ['Better', 'good', 'Your 1% lows improved.'],
    same: ['About the same', '', 'Your 1% lows barely moved.'],
    worse: ['Worse', 'bad', 'Your 1% lows dropped.']
  };
  var STATUS_TEXT = { applied: 'In your settings', notApplied: 'Not applied', other: 'Set to something else' };

  function renderLastRound(prev, a, m) {
    var p = $('lastRound');
    if (!prev || !a) { p.hidden = true; p.innerHTML = ''; return; }
    var b = prev.baseline, h = '<h2>Last round (round ' + (prev.no || prev.id) + '): how it went</h2>';
    if (a.delta) {
      var v = VERDICT[a.verdict];
      h += '<p style="margin:0 0 12px"><b class="' + v[1] + '">' + v[0] + '.</b> ' + v[2] + '</p><div class="tiles">' +
        tile('1% low FPS', Math.round(b.low1) + ' &rarr; ' + Math.round(m.low1), '', fmtDelta(a.delta.low1, true, 0)) +
        tile('Average FPS', Math.round(b.avgFps) + ' &rarr; ' + Math.round(m.avgFps), '', fmtDelta(a.delta.avgFps, true, 0)) +
        tile('0.1% low FPS', Math.round(b.low01) + ' &rarr; ' + Math.round(m.low01), '', fmtDelta(a.delta.low01, true, 0)) +
        tile('Stutters / min', b.spikesPerMin.toFixed(1) + ' &rarr; ' + m.spikesPerMin.toFixed(1), '', fmtDelta(a.delta.spikesPerMin, false, 1)) +
        '</div>';
    }
    h += '<div class="scroll" style="margin-top:12px"><table><tr><th>Setting you changed</th><th>Change made</th><th>Now</th></tr>' +
      a.verify.map(function (v, i) {
        var c = prev.applied[i];
        return '<tr><td>' + esc(v.name) + '</td><td>' + esc(c.fromLabel) + ' &rarr; ' + esc(c.toLabel) + '</td><td>' +
          (v.status === 'applied' ? '<span class="good">' : '<span class="bad">') + STATUS_TEXT[v.status] + '</span></td></tr>';
      }).join('') + '</table></div>';
    if (a.delta && window.TunerShare) h += '<p style="margin:12px 0 0"><button class="ghost" id="shareBtn">Make a share image</button></p>';
    if (a.delta && window.TunerCommunity && window.TunerCommunity.enabled()) h += '<p style="margin:8px 0 0"><button class="ghost" id="commBtn">Share my result (optional)</button></p>';
    if (a.reverts.length) h += '<p style="margin:12px 0 0"><b>' + a.reverts.length + ' revert suggestion' + (a.reverts.length > 1 ? 's are' : ' is') + ' in the list below.</b></p>';
    if (a.notes.length) h += '<ul class="notes" style="margin-top:12px">' + a.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    p.innerHTML = h; p.hidden = false;
    if (a.delta && window.TunerBadges) window.TunerBadges.event('verdict', { verdict: a.verdict, gainPct: b.low1 > 0 ? (m.low1 - b.low1) / b.low1 * 100 : 0, spikesPerMin: m.spikesPerMin });
    var cb = $('commBtn');
    function shareData() {
      var kept = {}; a.verify.forEach(function (v, i) { if (prev.applied[i]) kept[prev.applied[i].key] = v.status; });
      return { simId: state.sim.id, simName: state.sim.name, mode: currentMode().id, appVersion: window.TunerHost && window.TunerHost.contentVersion, verdict: a.verdict, before: b, after: m, applied: prev.applied, kept: kept,
        limiter: prev.limiter || null, runs: prev.runs || null, roundKey: prev.at, hardware: window.TunerPc && window.TunerPc.hardware ? window.TunerPc.hardware() : null };
    }
    if (cb) cb.addEventListener('click', function () { window.TunerCommunity.open(shareData()); });
    if (a.delta && window.TunerCommunity && window.TunerCommunity.enabled() && window.TunerCommunity.autoOn()) window.TunerCommunity.auto(shareData());
    var sb = $('shareBtn');
    if (sb) sb.addEventListener('click', function () {
      window.TunerShare.open({ simName: state.sim.name, verdict: a.verdict, before: { low1: b.low1, avgFps: b.avgFps, spikesPerMin: b.spikesPerMin }, after: { low1: m.low1, avgFps: m.avgFps, spikesPerMin: m.spikesPerMin }, applied: prev.applied });
    });
    if (a.delta && window.TunerCelebrate) {
      var gain = Math.round(m.low1) - Math.round(b.low1);
      window.TunerCelebrate.round(prev.at, a.verdict, { line: '1% low FPS: ' + Math.round(b.low1) + ' &rarr; ' + Math.round(m.low1) + ' (' + (gain > 0 ? '+' : '') + gain + ')' });
    }
  }

  // ---------- main analysis ----------
  function run() {
    showError('');
    var sim = state.sim;
    if (!state.ini) { showError('Add every file this sim needs first: ' + sim.files.map(function (f) { return f.name; }).join(' and ') + '.'); return; }
    if (sim.files.some(function (f) { return state.files[f.id] && sim.isVrFile(state.files[f.id].name); })) { showError(vrMessage()); return; }
    var section = currentSection(), mode = currentMode();
    if (!state.ini[section]) { showError('These files have no "' + section + '" settings. Pick the files ' + sim.name + ' is using.'); return; }
    var goal = document.querySelector('input[name=goal]:checked').value;
    var names = state.caps.map(function (c) { return c.name; });
    var m = core.summarise(state.caps);
    var prefs = window.TunerPrefs ? window.TunerPrefs.forSim(sim.id) : {};   // the player's own choices: protected settings, streaming, sync, screen refresh rate
    var d = core.diagnose(m, state.ini, { goal: goal, target: parseFloat($('target').value), capInfo: sim.capInfo || undefined, screenHz: prefs.screenHz });
    var hist = Store.load(), pi = pendingIndex(hist, sim.id, section), prev = pi >= 0 ? hist[pi] : null;
    if (prev) { prev.section = sectionOf(prev); prev.no = roundNo(hist, prev); }
    var a = prev ? core.assessRound(prev, m, d, state.ini, sim.table, names) : null;
    // The round being reported on counts as evidence straight away (it is only saved as finished when the next round is applied),
    // so a change that just showed no effect is not pushed again, and one that helped is trusted more.
    var ctxHistory = historyFor(sim.id, section);
    if (prev && a && a.verdict) {
      var key = prev.at;
      ctxHistory = ctxHistory.map(function (h) { return h.at === key ? Object.assign({}, h, { result: { verdict: a.verdict } }) : h; });
    }
    var r = core.recommend(m, d, state.ini, sim.table, section, { history: ctxHistory, prefs: prefs });
    state.result = { m: m, d: d, r: r, goal: goal, names: names, section: section, sim: sim.id };
    state.assess = a;

    // Reverts first, then new recommendations (never both for the same setting).
    var rows = [], seen = {}, skippedBefore = {};
    if (prev) prev.skipped.forEach(function (k) { skippedBefore[k] = true; });
    if (a) a.reverts.forEach(function (c) { rows.push(c); seen[c.key] = true; });
    var BATCH = 3, n = 0; // the top few are ticked; the rest wait behind "show more" so rounds stay small and attributable
    r.changes.forEach(function (c) {
      if (seen[c.key]) return;
      c.skippedBefore = !!skippedBefore[c.key];
      c.defaultChecked = n < BATCH; c.extra = n >= BATCH; n++;
      rows.push(c);
    });
    state.rows = rows;
    state.showAll = false;

    var lowCls = d.deficit <= 0 ? 'good' : d.deficit < 0.15 ? 'warn' : 'bad';
    $('resultsTitle').textContent = sim.name + (mode.id === 'replay' ? ': what your PC is doing in replays' : ': what your PC is doing');
    $('tiles').innerHTML =
      tile('Average FPS', m.avgFps.toFixed(0), '', 'Target ' + Math.round(d.target) + (isFinite(d.cap) ? ', cap ' + d.cap : ', no cap')) +
      tile('1% low FPS', m.low1.toFixed(0), lowCls, d.goal.label + ' needs ' + Math.round(d.floorFps) + ' or more') +
      tile('What is limiting you', LIMIT[d.limiter][0], '', LIMIT[d.limiter][1]) +
      tile('Graphics memory', d.vram === 'unknown' ? 'n/a' : Math.round(m.vramPct * 100) + '% full',
        { ok: 'good', watch: 'warn', pressure: 'bad', unknown: '' }[d.vram], d.vram === 'unknown' ? 'Not in this capture' : Math.round(m.vramUsedMB) + ' of ' + Math.round(m.vramSizeMB) + ' MB') +
      tile('Stutters', m.spikesPerMin.toFixed(1) + ' / min', { ok: 'good', some: 'warn', bad: 'bad' }[d.stutter],
        m.spikes ? 'Mostly from the ' + (m.spikeSide === 'gpu' ? 'graphics card' : 'processor') + ' side' : 'None found');

    if (window.TunerTimeline) window.TunerTimeline.render(state.caps, d.vram === 'pressure');   // the frame-time chart under the capture table
    $('capTable').innerHTML = '<tr><th>Capture</th><th class="n">Length</th><th class="n">Avg FPS</th><th class="n">1% low</th><th class="n">0.1% low</th><th class="n">GPU busy</th><th class="n">Stutters / min</th></tr>' +
      state.caps.map(function (c) {
        var s = core.summarise(c);
        return '<tr><td>' + esc(c.name) + '</td><td class="n">' + s.seconds.toFixed(0) + ' s</td><td class="n">' + s.avgFps.toFixed(1) + '</td><td class="n">' + s.low1.toFixed(1) +
          '</td><td class="n">' + s.low01.toFixed(1) + '</td><td class="n">' + (s.hasGpu ? Math.round(s.gpuLoad * 100) + '%' : 'n/a') + '</td><td class="n">' + s.spikesPerMin.toFixed(1) + '</td></tr>';
      }).join('');

    $('scopeLine').textContent = sim.scopeLine(mode);
    renderLastRound(prev, a, m);
    renderRows();
    // sim-specific advice that is not about frame rate, for example "this game is in exclusive full screen, so it vanishes when you click another monitor"
    var tip = sim.displayTip ? sim.displayTip(state.ini) : null;
    if (tip && r.notes.indexOf(tip) < 0) r.notes.push(tip);
    $('notes').innerHTML = r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    $('notesPanel').hidden = r.notes.length === 0;
    renderHistory();
    $('applyMsg').textContent = '';
    $('results').hidden = false;
    if (window.TunerUI) window.TunerUI.show('results');
  }

  var GROUPS = {
    revert: 'Put these back',
    first: 'Do first: big gain, little to see',
    worth: 'Worth trying: a fair trade',
    last: 'Only if you need more: you will notice these',
    spare: 'Spend your spare capacity'
  };
  function dots(n) { n = Math.max(0, Math.min(3, n || 0)); return '<span class="dots" title="' + n + ' of 3">' + new Array(n + 1).join('●') + new Array(4 - n).join('○') + '</span>'; }
  function groupOf(c) { return c.dir === 'revert' ? 'revert' : c.tier; }

  function renderRows() {
    var rows = state.rows, hiddenCount = rows.filter(function (c) { return c.extra; }).length;
    var allExtra = {}; // groups whose rows are all hidden should hide their heading too
    rows.forEach(function (c) { var g = groupOf(c); allExtra[g] = (allExtra[g] === undefined ? true : allExtra[g]) && !!c.extra; });
    var last = null, html = '';
    rows.forEach(function (c, i) {
      var g = groupOf(c), hide = c.extra && !state.showAll ? ' extra' : '';
      if (g !== last) {
        html += '<tr class="group' + (allExtra[g] && !state.showAll ? ' extra' : '') + '"><td colspan="7">' + esc(GROUPS[g] || '') + '</td></tr>';
        last = g;
      }
      html += '<tr class="' + hide.trim() + '"><td class="ck"><input type="checkbox" data-i="' + i + '"' + (c.defaultChecked ? ' checked' : '') + ' aria-label="Include ' + esc(c.name) + '"></td>' +
        '<td>' + esc(c.name) + (c.dir === 'revert' ? '<span class="tag revert">Revert last round</span>' : '') +
        (c.skippedBefore ? '<span class="tag">You skipped this last round</span>' : '') +
        '<span class="tag scope">' + esc(state.sim.scopeOf(c)) + '</span><code>' + esc(c.key) + '</code></td>' +
        '<td class="chg ' + (c.dir === 'up' ? 'good' : c.dir === 'revert' ? 'revert' : 'warn') + '">' + esc(c.fromLabel) + ' &rarr; ' + esc(c.toLabel) + '</td>' +
        '<td>' + (c.dir === 'revert' ? '' : dots(c.relief)) + '</td><td>' + (c.dir === 'revert' ? '' : dots(c.visual)) + '</td>' +
        '<td>' + (c.confidence ? '<span class="conf conf-' + c.confidence + '">' + c.confidence + '</span><span class="tag">' + esc(c.confWhy) + '</span>' : '') + '</td>' +
        '<td>' + esc(c.why) + (c.dir !== 'revert' && window.TunerLooks ? '<div class="look"><b>' + (c.dir === 'up' ? 'You gain:' : 'You will see:') + '</b> ' + esc(window.TunerLooks.describe(c)) + '</div>' : '') + '</td></tr>';
    });
    $('changes').innerHTML = rows.length
      ? '<tr><th></th><th>Setting</th><th>Change</th><th title="How much load it takes off what is limiting you">Gain</th><th title="How much you will notice it on track">Look</th><th>Confidence</th><th>Why</th></tr>' + html
      : '';
    $('moreBtn').hidden = hiddenCount === 0;
    $('moreBtn').textContent = state.showAll ? 'Show fewer options' : 'Show ' + hiddenCount + ' more option' + (hiddenCount > 1 ? 's' : '');
    $('noChanges').hidden = rows.length > 0;
    $('apply').hidden = rows.length === 0;
    updateApply();
  }
  $('moreBtn').addEventListener('click', function () {
    // keep ticks the user already made while the table is redrawn
    var ticked = {};
    Array.prototype.forEach.call($('changes').querySelectorAll('input[type=checkbox]'), function (el) { ticked[el.dataset.i] = el.checked; });
    state.rows.forEach(function (c, i) { c.defaultChecked = !!ticked[i]; });
    state.showAll = !state.showAll;
    renderRows();
  });
  function selected() {
    return Array.prototype.map.call($('changes').querySelectorAll('input[type=checkbox]:checked'), function (el) { return state.rows[+el.dataset.i]; });
  }
  // In the Windows app the sim has to be closed before its settings can be changed.
  function simRunning() { return !!(window.TunerHost && window.TunerHost.running && window.TunerHost.running[state.sim.id]); }
  function updateApply() {
    var n = selected().length;
    $('apply').disabled = n === 0;
    $('apply').textContent = n ? (simRunning() ? 'Close ' + state.sim.short + ' and apply ' : 'Apply ') + n + ' selected change' + (n > 1 ? 's' : '') : 'Select at least one change';
  }
  $('changes').addEventListener('change', updateApply);

  // ---------- apply: write (or download) the files and remember the round ----------
  // files: [{ fileId, name, text }] for every file that changed
  function deliver(files, closeSim) {
    if (window.TunerHost && window.TunerHost.writeFiles) return window.TunerHost.writeFiles(state.sim.id, files, closeSim);
    files.forEach(function (f) {
      var link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([f.text], { type: 'text/plain' }));
      link.download = f.name;
      link.click();
      URL.revokeObjectURL(link.href);
    });
    return Promise.resolve({ ok: true });
  }

  function apply() {
    var sel = selected();
    if (!sel.length) return;
    var closeSim = simRunning(), n = sel.length, plural = n > 1 ? 's' : '', name = state.sim.name;
    if (closeSim && window.TunerWarn) {
      window.TunerWarn.confirm({
        title: name + ' will close',
        lead: 'Applying ' + n + ' change' + plural + ' closes ' + name + ' right now. If you are in a session, you will leave it.',
        steps: [name + ' is asked to close, the same as choosing Exit.', 'Your current settings files are backed up first.',
          'The ' + n + ' change' + plural + ' are saved.', 'Start ' + name + ' again, then capture again to see what changed.'],
        okLabel: 'Close ' + state.sim.short + ' and apply ' + n + ' change' + plural,
        cancelLabel: 'No, keep ' + state.sim.short + ' open'
      }).then(function (ok) { if (ok) commitApply(sel, true); });
      return;
    }
    commitApply(sel, closeSim);
  }

  function commitApply(sel, closeSim) {
    var res = state.result, a = state.assess, sim = state.sim;
    $('apply').disabled = true;
    if (closeSim) $('applyMsg').textContent = 'Closing ' + sim.name + '...';
    var texts = {};
    sim.files.forEach(function (f) { if (state.files[f.id]) texts[f.id] = state.files[f.id].text; });
    var changed = sims.applyChanges(sim, texts, sel);
    var payload = Object.keys(changed).map(function (id) { return { fileId: id, name: state.files[id].name, text: changed[id] }; });
    deliver(payload, closeSim).then(function (out) {
      if (!out.ok) { $('applyMsg').textContent = out.message; updateApply(); return; }

      var hist = Store.load(), pi = pendingIndex(hist, sim.id, res.section);
      if (pi >= 0) {
        if (a && !a.sameCaptures) { // close the previous round with what we measured
          hist[pi].result = { verdict: a.verdict, low1: res.m.low1, avgFps: res.m.avgFps, at: new Date().toISOString() };
        } else if (a && a.sameCaptures) { // re-analysis before any new capture: replace, don't stack
          hist.splice(pi, 1);
        }
      }
      var chosen = {};
      sel.forEach(function (c) { chosen[c.key] = true; });
      var round = {
        id: hist.filter(function (h) { return (h.sim || 'iracing') === sim.id; }).length + 1, at: new Date().toISOString(), sim: sim.id, goal: res.goal, section: res.section, iniName: state.iniName,
        baseline: core.snapshot(res.m, res.names),
        applied: sel.map(function (c) { return { key: c.key, name: c.name, section: c.section, from: c.from, to: c.to, fromLabel: c.fromLabel, toLabel: c.toLabel, visual: c.visual, dir: c.dir, confidence: c.confidence }; }),
        limiter: res.d.limiter, runs: state.caps.length,
        skipped: state.rows.filter(function (c) { return !chosen[c.key]; }).map(function (c) { return c.key; }),
        result: null
      };
      hist.push(round);
      Store.save(hist);
      if (window.TunerBadges) window.TunerBadges.event('round');
      var no = roundNo(hist, round);
      clearCaptures(); // the next round needs fresh captures
      // The results on screen describe the settings from before this round, so clear them: no stale numbers, and Apply cannot run twice.
      resetResults('Round ' + no + ' saved. Capture again, then press Analyse to see what the changes did.');
      $('applyMsg').textContent = '';
      renderHistory();
      updateApply();
      showDone(round, no, payload.length);
    });
  }

  var EMPTY_TEXT = 'Nothing to show yet. Add a capture and your settings file in Setup, then press Analyse.';
  function resetResults(msg) {
    state.result = null; state.assess = null; state.rows = [];
    $('results').hidden = true; $('lastRound').hidden = true;
    $('resultsEmptyText').textContent = msg || EMPTY_TEXT;
    if (window.TunerUI) window.TunerUI.update();
  }

  // The "round saved" splash, then straight to the capture page: capturing again is always the next step.
  function goToCapture() {
    if (window.TunerUI) window.TunerUI.show('setup');
    var target = $('appPanel').hidden ? $('capCard') : $('appPanel');
    setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }
  function showDone(round, no, fileCount) {
    var sim = state.sim, n = round.applied.length, host = !!window.TunerHost;
    var key = window.TunerHost && window.TunerHost.hotkeyText;
    var steps = host
      ? ['Start ' + sim.name + ' and get on track: same car, track and traffic as before.',
         key ? 'Press ' + key + ' three times to record 3 runs.' : 'Press Start capture three times to record 3 runs.',
         'Come back here and press Analyse to see what the changes did.']
      : ['Replace your file' + (fileCount > 1 ? 's' : '') + ' with the download' + (fileCount > 1 ? 's' : '') + ' while ' + sim.name + ' is closed.',
         'Capture again on the same track and add the new captures here.',
         'Press Analyse to see what the changes did.'];
    if (!window.TunerDone) { goToCapture(); return; }
    window.TunerDone.show({
      title: 'Round ' + no + ' saved', sub: sim.name,
      lead: n + ' change' + (n > 1 ? 's are' : ' is') + ' now in your settings' + (host ? '. Your old files are backed up.' : '.'),
      items: round.applied.map(function (c) { return c.name + ': ' + c.fromLabel + ' → ' + c.toLabel; }),
      steps: steps, goLabel: 'Go to capture'
    }).then(goToCapture);
  }
  $('apply').addEventListener('click', apply);

  // ---------- history ----------
  function renderHistory() {
    var hist = Store.load();
    $('historyPanel').hidden = hist.length === 0;
    $('history').innerHTML = hist.length ? '<tr><th class="n">Round</th><th>Sim</th><th>Date</th><th>Goal</th><th>Changes</th><th class="n">1% low</th><th>Result</th></tr>' +
      hist.slice().reverse().map(function (r) {
        var res = r.result, s = sims.SIMS[r.sim || 'iracing'] || state.sim, replay = sectionOf(r) === 'Replay Graphics';
        return '<tr><td class="n">' + roundNo(hist, r) + '</td><td>' + esc(s.short) + '</td><td>' + esc(new Date(r.at).toLocaleDateString()) + '</td><td>' + esc(core.GOALS[r.goal].label) +
          (replay ? ' <span class="tag">Replay</span>' : '') + '</td><td>' +
          r.applied.map(function (c) { return esc(c.name) + ' <span class="tag">' + esc(c.fromLabel) + ' &rarr; ' + esc(c.toLabel) + '</span>'; }).join('') + '</td><td class="n">' +
          Math.round(r.baseline.low1) + (res ? ' &rarr; ' + Math.round(res.low1) : '') + '</td><td>' +
          (res ? '<span class="' + VERDICT[res.verdict][1] + '">' + VERDICT[res.verdict][0] + '</span>' : '<span class="hint">Waiting for your next capture</span>') + '</td></tr>';
      }).join('') : '';
    if (window.TunerUI) window.TunerUI.update();
  }
  $('clearHistory').addEventListener('click', function () {
    if (confirm('Clear the record of what you changed? The next analysis will start from scratch.')) { Store.save([]); renderHistory(); }
  });

  $('run').addEventListener('click', run);

  // start on the sim the user used last
  try { var saved = localStorage.getItem(SIMKEY); if (saved && sims.SIMS[saved] && !sims.SIMS[saved].comingSoon) state.sim = sims.SIMS[saved]; } catch (e) { /* default */ }
  renderSimUI();
  refresh();
  renderHistory();

  window.TunerApp = { roundNo: roundNo, resetResults: resetResults, updateApply: updateApply, addCaptures: addCaptures, addParsedCapture: addParsedCapture, clearCaptures: clearCaptures,
    setIni: setIni, setFile: setFile, setFiles: setFiles, setFileText: setFileText, setSim: setSim, setLogos: setLogos, setSimStatus: setSimStatus,
    onSim: function (fn) { simListeners.push(fn); }, renderSimUI: renderSimUI,
    run: run, apply: apply, currentMode: currentMode, currentSection: currentSection, deliver: deliver, simRunning: simRunning, state: state, Store: Store, showError: showError, isVrFile: isVrFile };
})();
