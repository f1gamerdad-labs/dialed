/* The sims this app supports. Each profile says where a sim keeps its settings, how to read and safely change them,
   which process to capture, and which settings table to use. Everything else (capture, diagnosis, priorities, rounds,
   history, backups) is shared. To add a sim: add a profile here and a settings table for it. */
(function (root) {
  var isNode = typeof module === 'object' && module.exports;
  var core = isNode ? require('./core.js') : root.TunerCore;
  var tIR = isNode ? require('./settings-table.js') : root.SETTINGS_TABLE;
  var tLMU = isNode ? require('./settings-table-lmu.js') : root.SETTINGS_TABLE_LMU;
  var tAMS2 = isNode ? require('./settings-table-ams2.js') : root.SETTINGS_TABLE_AMS2;
  var tACC = isNode ? require('./settings-table-acc.js') : root.SETTINGS_TABLE_ACC;

  // ---------- iRacing ----------
  var iracing = {
    id: 'iracing', name: 'iRacing', short: 'iRacing',
    process: 'iRacingSim64DX11.exe',
    steamAppId: null,
    table: tIR,
    files: [{
      id: 'main', name: 'rendererDX11Monitor.ini', label: 'iRacing graphics file',
      hint: 'Found in Documents\\iRacing. Use the file that was active when you made the captures.',
      sections: ['Graphics Options', 'Replay Graphics'],
      match: function (n) { return /^renderer.*\.ini$/i.test(n) && !/OpenVR|OpenXR/i.test(n); },
      parse: function (t) { return core.parseIni(t); },
      patch: function (t, changes, section) { return core.patchIni(t, changes, section); }
    }],
    modes: [
      { id: 'driving', label: 'Driving', section: 'Graphics Options', hint: 'Capture while driving on track. Changes go to your normal driving settings.' },
      { id: 'replay', label: 'Replay', section: 'Replay Graphics', hint: 'Capture while a replay is playing. Changes go to the replay settings only, so your driving settings stay as they are.' }
    ],
    isVrFile: function (n) { return /OpenVR|OpenXR/i.test(n); },
    note: '<b>Driving and replays are separate in iRacing.</b> Pick Driving or Replay below: changes only affect the one you pick, and your other settings stay as they are.',
    scopeLine: function (mode) { return 'These changes go to your ' + (mode.id === 'replay' ? 'replay' : 'driving') + ' settings only.'; },
    scopeOf: function (c) { return c.section === 'Replay Graphics' ? 'Changes your replay settings' : 'Changes your driving settings'; },
    capInfo: null, // core's default is iRacing's
    captureHint: 'Capture 60 seconds on track with a full field, same track and car each time.',
    requiredFiles: ['main']
  };

  // ---------- Le Mans Ultimate ----------
  function lmuCapInfo(ini) {
    var g = ini['Graphic Options'] || {}, v = ini['COMPONENTS'] || {};
    var cap = parseFloat(g['Max Framerate']); cap = cap > 0 ? cap : NaN;
    var refresh = parseFloat(v['VideoRefreshRate']);
    if (parseFloat(v['VSyncMode']) > 0 && refresh > 0) cap = isFinite(cap) ? Math.min(cap, refresh) : refresh;
    return { cap: cap, refresh: refresh };
  }
  var lmu = {
    id: 'lmu', name: 'Le Mans Ultimate', short: 'LMU',
    process: 'Le Mans Ultimate.exe',
    steamAppId: '2399420',
    table: tLMU,
    files: [
      {
        id: 'video', name: 'Config_DX11.ini', label: 'LMU video settings', rel: 'UserData\\Config_DX11.ini',
        hint: 'In the LMU folder under UserData. (Not the _VR one.)',
        sections: ['COMPONENTS'],
        match: function (n) { return /^Config_DX11\.ini$/i.test(n); },
        parse: function (t) { return core.parseLmuIni(t); },
        patch: function (t, changes, section) { return core.patchLmuIni(t, changes, section); }
      },
      {
        id: 'graphics', name: 'Settings.JSON', label: 'LMU graphics options', rel: 'UserData\\player\\Settings.JSON',
        hint: 'In the LMU folder under UserData\\player.',
        sections: ['Graphic Options'],
        match: function (n) { return /^Settings\.json$/i.test(n); },
        parse: function (t) { return core.parseLmuJson(t); },
        patch: function (t, changes, section) { return core.patchLmuJson(t, changes, section); }
      }
    ],
    modes: [{ id: 'driving', label: 'Driving', section: 'Graphic Options', hint: 'Capture while driving on track. The changes also apply to replays, because LMU uses one set of graphics settings for both.' }],
    isVrFile: function (n) { return /_VR/i.test(n); },
    note: '<b>Driving and replays use the same settings in LMU.</b> Unlike iRacing, LMU has no separate replay graphics, so every change you apply affects both. ' +
      'A few settings only matter in replays or the garage (for example Replay Extra Visible Vehicles); this tool leaves those alone.',
    scopeLine: function () { return 'LMU has one set of graphics settings, so every change below applies to both driving and replays.'; },
    scopeOf: function (c) { return c.scope === 'replay' ? 'Changes replays only' : 'Changes driving and replays'; },
    capInfo: lmuCapInfo,
    captureHint: 'Capture 60 seconds on track with a full field, same track and car each time.',
    requiredFiles: ['video', 'graphics']
  };

  // ---------- Automobilista 2 ----------
  function ams2CapInfo(ini) {
    var g = ini['GraphicConfigData'] || {};
    var refresh = parseFloat(g.RefreshRate), cap = NaN;
    if (parseFloat(g.Vsync) > 0 && refresh > 0) cap = refresh; // AMS2 has no frame limiter in this file; V-sync is the only cap
    return { cap: cap, refresh: refresh };
  }
  var ams2 = {
    id: 'ams2', name: 'Automobilista 2', short: 'AMS2',
    process: 'AMS2.exe',
    steamAppId: '1066890',
    table: tAMS2,
    files: [{
      id: 'main', name: 'graphicsconfigdx11.xml', label: 'AMS2 graphics file', rel: 'graphicsconfigdx11.xml',
      hint: 'In Documents\\Automobilista 2. (Not the openvr, oculus or starvr ones.)',
      sections: ['GraphicConfigData'],
      match: function (n) { return /^graphicsconfigdx11\.xml$/i.test(n); },
      parse: function (t) { return core.parseAms2Xml(t); },
      patch: function (t, changes) { return core.patchAms2Xml(t, changes); }
    }],
    modes: [{ id: 'driving', label: 'Driving', section: 'GraphicConfigData', hint: 'Capture while driving on track. AMS2 uses the same graphics settings for replays.' }],
    isVrFile: function (n) { return /vr|oculus/i.test(n); },
    note: '<b>Driving and replays use the same settings in AMS2.</b> There is one graphics file, so every change applies to both. ' +
      'Reiza does not publish what each number in the file means, so every suggestion here is shown as low confidence: change a few at a time and capture again.',
    scopeLine: function () { return 'AMS2 has one set of graphics settings, so every change below applies to both driving and replays.'; },
    scopeOf: function () { return 'Changes driving and replays'; },
    capInfo: ams2CapInfo,
    captureHint: 'Capture 60 seconds on track with a full grid, same track and car each time.',
    requiredFiles: ['main']
  };

  // ---------- sims that are listed but not switched on yet ----------
  function soon(id, name, short, reason) { return { id: id, name: name, short: short, comingSoon: true, reason: reason }; }
  // ---------- Assetto Corsa Competizione ----------
  function accCapInfo(ini) {
    var g = ini['customGraphicOptions'] || {};
    var cap = parseFloat(g.frameLimit);
    return { cap: cap > 0 ? cap : NaN, refresh: NaN }; // the refresh rate and V-sync are not in this file
  }
  var acc = {
    id: 'acc', name: 'Assetto Corsa Competizione', short: 'ACC',
    process: 'AC2-Win64-Shipping.exe',
    steamAppId: '805550',
    table: tACC,
    files: [{
      id: 'main', name: 'menuSettings.json', label: 'ACC settings file', rel: 'Config\\menuSettings.json',
      hint: 'In Documents\\Assetto Corsa Competizione\\Config.',
      sections: ['customGraphicOptions'],
      match: function (n) { return /^menuSettings\.json$/i.test(n); },
      parse: function (t) { return core.parseAccJson(t); },
      patch: function (t, changes, section) { return core.patchAccJson(t, changes, section); }
    }],
    modes: [{ id: 'driving', label: 'Driving', section: 'customGraphicOptions', hint: 'Capture while driving on track. ACC uses the same graphics settings for replays.' }],
    isVrFile: function () { return false; },
    note: '<b>Set ACC\'s graphics preset to Custom.</b> Dialed changes the sliders on ACC\'s Custom graphics page (Video, then Graphics). ' +
      'If a preset such as High or Epic is selected, the game ignores them. Kunos does not publish what each number means, so every suggestion is shown as low confidence: ' +
      'after applying, open the Graphics page in ACC and check the sliders moved.',
    scopeLine: function () { return 'ACC has one set of graphics settings, so every change below applies to both driving and replays.'; },
    scopeOf: function () { return 'Changes driving and replays'; },
    capInfo: accCapInfo,
    captureHint: 'Capture 60 seconds on track with a full grid, same track and car each time.',
    requiredFiles: ['main']
  };
  var acevo = soon('acevo', 'Assetto Corsa EVO', 'EVO', 'No graphics settings file could be found for this early-access game.');
  var raceroom = soon('raceroom', 'RaceRoom', 'RaceRoom', 'RaceRoom\'s settings file could not be found or tested.');
  var pmr = soon('pmr', 'Project Motor Racing', 'PMR', 'Its graphics settings use numbered levels with no published meaning, so they cannot be checked yet.');
  var beamng = soon('beamng', 'BeamNG.drive', 'BeamNG', 'BeamNG stores its main quality levels as words in a versioned folder; support is not built yet.');

  var SIMS = { iracing: iracing, lmu: lmu, ams2: ams2, acc: acc, acevo: acevo, raceroom: raceroom, pmr: pmr, beamng: beamng };
  var ORDER = ['iracing', 'lmu', 'ams2', 'acc', 'acevo', 'raceroom', 'pmr', 'beamng'];

  // ---------- helpers shared by the page and the tests ----------
  // texts: { fileId: text }  ->  one settings object with every file's sections merged.
  function parseAll(sim, texts) {
    var ini = {};
    sim.files.forEach(function (f) {
      if (texts[f.id] === undefined) return;
      var parsed = f.parse(texts[f.id]);
      Object.keys(parsed).forEach(function (sec) { ini[sec] = parsed[sec]; });
    });
    return ini;
  }

  // Applies recommended changes to whichever files they belong to. Returns { fileId: newText } for files that changed.
  function applyChanges(sim, texts, changes) {
    var out = {};
    sim.files.forEach(function (f) {
      var text = texts[f.id], touched = false;
      if (text === undefined) return;
      f.sections.forEach(function (sec) {
        var mine = changes.filter(function (c) { return c.section === sec; });
        if (mine.length) { text = f.patch(text, mine, sec); touched = true; }
      });
      if (touched) out[f.id] = text;
    });
    return out;
  }

  function fileFor(sim, name) {
    for (var i = 0; i < sim.files.length; i++) if (sim.files[i].match(name)) return sim.files[i];
    return null;
  }

  var api = { SIMS: SIMS, ORDER: ORDER, parseAll: parseAll, applyChanges: applyChanges, fileFor: fileFor };
  if (isNode) module.exports = api; else root.TunerSims = api;
})(typeof self !== 'undefined' ? self : this);
