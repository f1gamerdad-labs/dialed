/* Assetto Corsa EVO settings table. THIS IS THE FILE TO UPDATE WHEN AC EVO PATCHES.

   Same fields as settings-table-lmu.js. The settings live in Saved Games\ACE\video.videosettings, a binary (protobuf) file, in section 'EVO'.
   Keys are field paths: 'f26' = field 26 of the graphics message (root field 2), 'f19.1' = field 1 inside field 19 of it,
   'd16' = field 16 of the display message (root field 1). A value of 0 is not stored by the game, so "field absent" reads as 0.

   CONFIRMED ON SEAN'S PC (2026-11-23, AC EVO 0.9.1): the five graphics presets were applied one after another with a watcher on the file, the
   game's own page was photographed at each, and the settings that moved together were then changed one at a time. Every value below is what
   the game wrote. AC EVO's numbers are often NOT in quality order (Off is frequently the highest number), so every levels list here is written
   in quality order, worst first, and the engine steps along the list, never by the number:
     Ambient occlusion Off = 4, Grass Off = 4, Motion blur Off = 3 (Ultra = 4), Multisample AA Off = 4 (2x = 0),
     Texture quality Low 4 / Medium 0 / High 2 / Ultra 1, Mirror LOD Low 1 / Medium 0, Car reflection Ultra = 4, Clouds Ultra = 5.
   NOT IN THE TABLE ON PURPOSE: upscaling (DLSS/FSR3 and their presets: not mapped yet), filmic AA and FXAA, mirrors mode and the number of dash
   displays (they change what the driver sees, not just how it looks), frame-rate limits, V-sync, window mode and resolution, exposure and
   sharpening, and everything VR. Dialed only ever lowers a setting here, one step at a time (AC EVO is early access).
   The top Multisample AA position is labelled 8x from the menu's pattern (Off, 2x, 4x, top); cpu/gpu/vram/visual numbers are estimates. */
(function (root) {
  var S = 'EVO';
  var CARS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 23, 26, 30, 35, 40, 50, 60];
  var LMHU = ['Low', 'Medium', 'High', 'Ultra'];
  function E(key, name, cost, levels, labels, extra) {
    var s = { section: S, key: key, name: name, cpu: cost[0], gpu: cost[1], vram: cost[2], visual: cost[3], levels: levels, labels: labels, noRaise: true, plainLabels: true };
    for (var k in extra || {}) s[k] = extra[k];
    return s;
  }

  root.SETTINGS_TABLE_EVO = {
    testedAgainst: 'Assetto Corsa EVO 0.9.1 (every value confirmed in game on 23 Nov 2026)',
    updated: '2026-11-23',
    exact: true,
    settings: [
      // above native resolution, so one step down is hard to see (visual 1) and it is the biggest graphics-card lever in the game
      E('d16', 'Supersampling', [0, 3, 2, 1], [0, 1, 2, 3, 4], ['Off', '125%', '150%', '175%', '200%']),
      E('f11', 'Multisample anti-aliasing', [0, 3, 2, 3], [4, 0, 1, 2], ['Off', '2x', '4x', '8x']),
      E('f12.1', 'Anisotropic filtering', [0, 1, 0, 1], [0, 1, 2, 3, 4], ['Very Low', 'Low', 'Medium', 'High', 'Ultra'], { minIndex: 1 }),
      E('f49', 'Texture quality', [0, 1, 3, 2], [4, 0, 2, 1], LMHU, { minIndex: 1 }),
      E('f14.1', 'Level of detail', [2, 2, 1, 2], [0, 1, 2, 3], LMHU, { minIndex: 1 }),
      E('f25', 'Vehicle level of detail', [2, 1, 1, 2], [0, 1, 2, 3], LMHU, { minIndex: 1 }),
      E('f47.1', 'Max cars ahead', [2, 2, 1, 2], CARS, null, { min: 6, exact: false, plainLabels: false }),
      E('f47.2', 'Max cars behind', [1, 1, 1, 1], CARS, null, { min: 4, exact: false, plainLabels: false }),
      E('f15', 'Global illumination update frequency', [1, 2, 0, 1], [0, 1, 2], ['Medium', 'High', 'Ultra']),
      E('f26', 'Ambient occlusion', [0, 2, 1, 2], [4, 0, 1, 2, 3], ['Off', 'Low', 'Medium', 'High', 'Ultra']),
      E('f41', 'Volumetrics', [0, 2, 1, 1], [0, 1, 2, 3], LMHU),
      E('f42', 'Environment reflection', [1, 2, 1, 2], [0, 1, 2], ['Low', 'Medium', 'High']),
      E('f13.1', 'Car reflection', [1, 2, 1, 2], [0, 1, 2, 4], LMHU),
      E('f19.1', 'Shadows', [1, 3, 2, 3], [0, 1, 2, 3, 4], ['Very Low', 'Low', 'Medium', 'High', 'Ultra'], { minIndex: 1 }),
      E('f19.3', 'Screen space shadows', [0, 2, 0, 1], [0, 1, 2], ['Off', 'Half resolution', 'Full resolution']),
      E('f48.1', 'Particles quality', [1, 2, 0, 1], [0, 1, 2, 3], LMHU),
      E('f22.5', 'Grass density', [1, 2, 0, 1], [4, 0, 1, 2, 3], ['Off', 'Low', 'Medium', 'High', 'Ultra'], { minIndex: 1 }),
      E('f16.1', 'Clouds quality', [0, 2, 1, 1], [0, 1, 2, 5], LMHU),
      // Off = 4, confirmed by setting it in the menu (23 Nov 2026)
      E('f27', 'Depth of field quality', [0, 1, 0, 1], [4, 0, 1, 2, 3], ['Off', 'Low', 'Medium', 'High', 'Ultra']),
      E('f24', 'Motion blur quality', [0, 1, 0, 1], [3, 0, 1, 2, 4], ['Off', 'Low', 'Medium', 'High', 'Ultra']),
      E('f23.8', 'Mirrors resolution', [1, 2, 1, 1], [0, 1, 2], ['Low', 'Medium', 'High']),
      E('f23.14', 'Mirror LOD quality', [2, 1, 0, 1], [1, 0, 2, 3], LMHU),
      E('f23.10', 'Mirrors view distance', [2, 1, 0, 1], [0, 1, 2, 3], LMHU)
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_EVO;
})(typeof self !== 'undefined' ? self : this);
