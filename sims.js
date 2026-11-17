/* The sims this app supports. Each profile says where a sim keeps its settings, how to read and safely change them,
   which process to capture, and which settings table to use. Everything else (capture, diagnosis, priorities, rounds,
   history, backups) is shared. To add a sim: add a profile here and a settings table for it. */
(function (root) {
  var isNode = typeof module === 'object' && module.exports;
  var core = isNode ? require('./core.js') : root.TunerCore;
  var tIR = isNode ? require('./settings-table.js') : root.SETTINGS_TABLE;
  var tLMU = isNode ? require('./settings-table-lmu.js') : root.SETTINGS_TABLE_LMU;

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

  var SIMS = { iracing: iracing, lmu: lmu };
  var ORDER = ['iracing', 'lmu'];

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
