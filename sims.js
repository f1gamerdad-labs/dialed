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
  var tBEAMNG = isNode ? require('./settings-table-beamng.js') : root.SETTINGS_TABLE_BEAMNG;
  var tPMR = isNode ? require('./settings-table-pmr.js') : root.SETTINGS_TABLE_PMR;
  var tRR = isNode ? require('./settings-table-raceroom.js') : root.SETTINGS_TABLE_RACEROOM;
  var tEVO = isNode ? require('./settings-table-evo.js') : root.SETTINGS_TABLE_EVO;

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
    scenarios: [
      '<b>Daytona road course</b> with a full multiclass field, at dusk or night: lots of cars, lights and long sight lines.',
      '<b>Porsche 911 GT3 Cup in the rain</b> on a track with rain enabled: spray, wet reflections and a tight pack.',
      '<b>Hockenheim</b> race start with a full grid: the stadium section with grandstands is one of the heaviest spots.',
      '<b>Long Beach</b> street circuit: walls, grandstands and crowds close to the track.',
      'Use an <b>AI race or a busy hosted session</b>, not Test Drive: an empty track hides most of the load. For Replay, capture the start of a busy race replay.'
    ],
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
    scenarios: [
      '<b>Le Mans at night in the rain</b> with a full Hypercar, LMP2 and GT3 AI grid: the heaviest test LMU has.',
      '<b>Spa-Francorchamps race start in the rain</b> with a full field.',
      '<b>Bahrain at night</b> with a full grid: floodlights and lots of cars in view.',
      'Capture the <b>first lap</b> each time, from the same grid slot.'
    ],
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
    scenarios: [
      '<b>Interlagos race start in the rain</b> with a full grid.',
      '<b>Nürburgring Nordschleife</b> with a full field: long, tree-lined and very busy.',
      '<b>Daytona at night</b> with a full multiclass grid.',
      'Capture the <b>first lap</b> each time, from the same grid slot.'
    ],
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
    scenarios: [
      '<b>Spa-Francorchamps race start in heavy rain</b> with a full AI grid: the classic ACC stress test.',
      '<b>Nürburgring at night</b> with a full grid.',
      '<b>Monza race start</b>: the whole field bunched into turn 1.',
      'Capture the <b>first lap</b> each time, from the same grid slot.'
    ],
    captureHint: 'Capture 60 seconds on track with a full grid, same track and car each time.',
    requiredFiles: ['main']
  };
  // ---------- Assetto Corsa EVO ----------
  var acevo = {
    id: 'acevo', name: 'Assetto Corsa EVO', short: 'EVO',
    process: 'AssettoCorsaEVO.exe',
    steamAppId: '3058630',
    table: tEVO,
    files: [{
      id: 'main', name: 'video.videosettings', label: 'AC EVO video settings', rel: 'video.videosettings',
      hint: 'In Saved Games\\ACE. A binary file: Dialed only changes the few settings it has checked.',
      sections: ['EVO'],
      match: function (n) { return /^video\.videosettings$/i.test(n); },
      parse: function (t) { return core.parseEvoProto(t); },
      patch: function (t, changes) { return core.patchEvoProto(t, changes); }
    }],
    modes: [{ id: 'driving', label: 'Driving', section: 'EVO', hint: 'Capture while driving on track. AC EVO uses the same graphics settings for replays.' }],
    isVrFile: function () { return false; },
    note: '<b>AC EVO support is early and small.</b> AC EVO is still early access, and it keeps its video settings in a binary file. ' +
      'Dialed has checked four settings so far: Shadows, Ambient occlusion, Max cars ahead and Max cars behind. Other settings are not changed. ' +
      'Every suggestion is low confidence, and Dialed only ever lowers a setting. After applying, open Settings, then Video, then Graphics in AC EVO and check the change. ' +
      'If AC EVO updates and its file changes, Dialed finds nothing it recognises and offers no changes.',
    scopeLine: function () { return 'AC EVO has one set of graphics settings, so every change below applies to both driving and replays.'; },
    scopeOf: function () { return 'Changes driving and replays'; },
    capInfo: function () { return { cap: NaN, refresh: NaN }; }, // the frame-rate limit is not read from this file, so the target is the user's own
    scenarios: [
      '<b>A race start with a full grid</b> on the busiest track you have, in <b>rain or at dusk</b> if you can.',
      'Capture the <b>first lap</b> each time, from the same grid slot.'
    ],
    captureHint: 'Capture 60 seconds on track with a full grid, same track and car each time.',
    requiredFiles: ['main']
  };
  // ---------- RaceRoom Racing Experience ----------
  var raceroom = {
    id: 'raceroom', name: 'RaceRoom', short: 'RaceRoom',
    process: 'RRRE64.exe',
    steamAppId: '211500',
    table: tRR,
    files: [{
      id: 'main', name: 'graphics_options.xml', label: 'RaceRoom graphics file', rel: 'UserData\\graphics_options.xml',
      hint: 'In Documents\\My Games\\SimBin\\RaceRoom Racing Experience\\UserData.',
      sections: ['RaceRoom'],
      match: function (n) { return /^graphics_options\.xml$/i.test(n); },
      parse: function (t) { return core.parseRaceRoomXml(t); },
      patch: function (t, changes) { return core.patchRaceRoomXml(t, changes); }
    }],
    modes: [{ id: 'driving', label: 'Driving', section: 'RaceRoom', hint: 'Capture while driving on track. RaceRoom uses the same graphics settings for replays.' }],
    isVrFile: function () { return false; },
    note: '<b>RaceRoom has one set of graphics settings,</b> so every change applies to both driving and replays. ' +
      'The settings it can change are the ones on the High Impact, Visual Effects, Track, Car and Cockpit pages. ' +
      'Some of the numbers (such as which value means Low) have only been checked at a few positions, so every suggestion is shown as low confidence: change a few at a time and capture again. ' +
      'If your PC has spare capacity, Dialed can suggest turning up Shadows, Car reflection quality, Track level of detail and Particle detail by one step. ' +
      'RaceRoom rewrites this file when it closes, so Dialed closes it before applying.',
    scopeLine: function () { return 'RaceRoom has one set of graphics settings, so every change below applies to both driving and replays.'; },
    scopeOf: function () { return 'Changes driving and replays'; },
    capInfo: function (ini) {
      var g = ini['RaceRoom'] || {}, refresh = parseFloat(g.screenRefreshRate);
      return { cap: parseFloat(g.enableVSync) > 0 && refresh > 0 ? refresh : NaN, refresh: refresh }; // V-sync is the only cap in this file
    },
    scenarios: [
      '<b>Nürburgring Nordschleife</b> or <b>Spa</b> race start with a full grid, in <b>rain</b> if you can.',
      '<b>Hockenheim</b> race start with a full grid: the stadium section is one of the heaviest spots.',
      'Capture the <b>first lap</b> each time, from the same grid slot.'
    ],
    captureHint: 'Capture 60 seconds on track with a full grid, same track and car each time.',
    requiredFiles: ['main']
  };
  // ---------- Project Motor Racing ----------
  var pmr = {
    id: 'pmr', name: 'Project Motor Racing', short: 'PMR',
    process: 'ProjectMotorRacingGame.exe',
    steamAppId: '299970',
    table: tPMR,
    files: [{
      id: 'main', name: 'settings.xml', label: 'PMR settings file', rel: 'savegame1\\settings.xml',
      hint: 'In Documents\\My Games\\ProjectMotorRacing\\savegame1.',
      sections: ['PMR'],
      match: function (n) { return /^settings\.xml$/i.test(n); },
      parse: function (t) { return core.parsePmrXml(t); },
      patch: function (t, changes) { return core.patchPmrXml(t, changes); }
    }],
    modes: [{ id: 'driving', label: 'Driving', section: 'PMR', hint: 'Capture while driving on track. PMR uses the same graphics settings for replays.' }],
    isVrFile: function () { return false; },
    note: '<b>PMR stores each graphics choice as its position in the menu list.</b> Dialed only ever moves a setting one step down that list, so it always lands on a real menu choice. ' +
      'The names of most positions are not known yet, so you will see "Step 2" where the menu would say something like Low, and every suggestion is low confidence. ' +
      'After applying, open Graphics, then Advanced Graphics Settings in PMR and check the change.',
    scopeLine: function () { return 'PMR has one set of graphics settings, so every change below applies to both driving and replays.'; },
    scopeOf: function () { return 'Changes driving and replays'; },
    capInfo: function () { return { cap: NaN, refresh: NaN }; }, // the frame-rate limit is stored as a menu position, so the target is the user's own
    scenarios: [
      '<b>A race start with a full grid</b> in <b>rain or at dusk</b>, on the busiest track you have.',
      'Capture the <b>first lap</b> each time, from the same grid slot.'
    ],
    captureHint: 'Capture 60 seconds on track with a full grid, same track and car each time.',
    requiredFiles: ['main']
  };
  // ---------- BeamNG.drive ----------
  function beamngCapInfo(ini) {
    var g = ini['BeamNG'] || {};
    var cap = parseFloat(g.fpsLimitEnabled) > 0 ? parseFloat(g.fpsLimit) : NaN;
    return { cap: cap > 0 ? cap : NaN, refresh: NaN }; // the refresh-rate key in this file is not reliable, so the target falls back to the user's own
  }
  var beamng = {
    id: 'beamng', name: 'BeamNG.drive', short: 'BeamNG',
    process: 'BeamNG.drive.x64.exe',
    steamAppId: '284160',
    table: tBEAMNG,
    files: [{
      id: 'main', name: 'settings.json', label: 'BeamNG settings file', rel: 'BeamNG.drive\\current\\settings\\settings.json',
      hint: 'In %LOCALAPPDATA%\\BeamNG\\BeamNG.drive\\current\\settings. (Not the one in the cloud folder.)',
      sections: ['BeamNG'],
      match: function (n) { return /^settings\.json$/i.test(n); },
      parse: function (t) { return core.parseBeamngJson(t, tBEAMNG.words); },
      patch: function (t, changes) { return core.patchBeamngJson(t, changes, tBEAMNG.words); }
    }],
    modes: [{ id: 'driving', label: 'Driving', section: 'BeamNG', hint: 'Capture while driving, ideally on a busy map with traffic. BeamNG uses the same graphics settings for replays.' }],
    isVrFile: function () { return false; },
    note: '<b>BeamNG uses one set of graphics settings.</b> The levels and the processor/graphics-card/memory cost of each setting come from BeamNG\'s own option descriptions. ' +
      'Applying a change sets BeamNG\'s overall quality preset to Custom, the same as changing a slider in the game. Dialed never raises Lighting or Shadows to Ultra, which BeamNG marks as experimental.',
    scopeLine: function () { return 'BeamNG has one set of graphics settings, so every change below applies everywhere in the game.'; },
    scopeOf: function () { return 'Changes the whole game'; },
    capInfo: beamngCapInfo,
    scenarios: [
      '<b>West Coast, USA</b> downtown with <b>traffic switched on</b>: lots of AI cars, buildings and lights.',
      '<b>Italy</b> through the towns with traffic switched on.',
      'Drive the <b>same route at the same speed</b> each capture, with the same amount of traffic.'
    ],
    captureHint: 'Capture 60 seconds driving the same route each time, on a busy map with traffic if you can.',
    requiredFiles: ['main']
  };

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
