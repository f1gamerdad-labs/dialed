/* Project Motor Racing settings table. THIS IS THE FILE TO UPDATE WHEN PMR PATCHES.

   Same fields as settings-table-lmu.js. Every setting is a <param name="SettingsVideoGraphics..." value="N"/> line in
   Documents\My Games\ProjectMotorRacing\savegame1\settings.xml (section 'PMR'). The value is the choice's position, counting from 1.

   CONFIRMED ON SEAN'S PC (2026-11-28, Steam build 26109592): every option name was read from the Advanced Graphics page, then every
   setting was saved at its lowest and at its highest and the file compared. Some lists skip choices (Texture resolution is only Low or
   Ultra, stored 1 and 2) and Atmosphere starts at 2. See notes\pmr-settings.md. cpu/gpu/vram/visual numbers are estimates.
   One round on 28 Nov 2026 (screen space shadows off, volumetric fog and atmosphere one step down) moved the frame rate by about 1 fps,
   within run to run variation, so those three are rated light.

   NOT IN THE TABLE ON PURPOSE: everything on the Graphics page (resolution, display mode, V-sync, frame limits, anti-aliasing,
   upscaling and frame generation) and file values the menu does not show. Dialed only ever lowers a setting here, one step at a time,
   and sets the hardware profile to Custom when it does (see sims.js). */
(function (root) {
  var S = 'PMR';
  function pos(from, labels) { return labels.map(function (_, i) { return from + i; }); }
  function pct(from, to, step) { var out = []; for (var v = from; v <= to; v += step) out.push(v + '%'); return out; }
  function e(key, name, cost, labels, extra) {
    var s = { section: S, key: 'SettingsVideoGraphics' + key, name: name, cpu: cost[0], gpu: cost[1], vram: cost[2], visual: cost[3],
      levels: pos(1, labels), labels: labels, noRaise: true, plainLabels: true };
    for (var k in extra || {}) s[k] = extra[k];
    return s;
  }
  var ONOFF = ['Off', 'On'], LOWULTRA = ['Low', 'Ultra'];

  root.SETTINGS_TABLE_PMR = {
    testedAgainst: 'Project Motor Racing, Steam build 26109592 (every list confirmed on 28 Nov 2026)',
    updated: '2026-11-28',
    exact: true,
    settings: [
      e('ShadowQuality', 'Shadow quality', [1, 3, 2, 3], ['Off', 'Medium', 'High', 'Ultra'], { minIndex: 1 }),
      e('ShadowDistanceQuality', 'Shadow distance quality', [1, 2, 1, 2], ['Low', 'Medium', 'Ultra']),
      e('ShadowMapFiltering', 'Shadow map filtering', [0, 1, 0, 1], LOWULTRA),
      e('ScreenSpaceShadows', 'Screen space shadows', [0, 1, 0, 1], ONOFF),
      e('ScreenSpaceReflections', 'Screen space reflections', [0, 3, 0, 2], ['Off', 'Medium', 'High', 'Ultra']),
      e('SSAOQuality', 'SSAO quality', [0, 2, 0, 2], ['Off', 'Mobile', 'Low', 'Medium', 'High', 'Very High'], { minIndex: 2 }),
      e('VolumetricFogQuality', 'Volumetric fog quality', [0, 1, 1, 1], ['Low', 'Medium', 'High', 'Very High', 'Ultra']),
      e('AtmosphereQuality', 'Atmosphere quality', [0, 1, 0, 1], ['Medium', 'High', 'Very High'], { levels: [2, 3, 4] }),
      e('CloudShadows', 'Cloud shadows', [0, 1, 0, 1], ONOFF),
      e('GrassQuality', 'Grass quality', [1, 2, 1, 1], ['Off', 'Low', 'Medium', 'High', 'Very High', 'Ultra'], { minIndex: 1 }),
      e('ObjectDrawDistance', 'Object draw distance', [2, 1, 1, 2], pct(100, 125, 5)),
      e('LODDrawDistance', 'LOD draw distance', [2, 2, 1, 2], pct(100, 125, 5)),
      e('TextureResolution', 'Texture resolution', [0, 1, 3, 3], LOWULTRA),
      e('TextureFiltering', 'Texture filtering', [0, 1, 0, 1], ['Bilinear', 'Trilinear', 'Aniso 1x', 'Aniso 2x', 'Aniso 4x', 'Aniso 8x', 'Aniso 16x'], { minIndex: 3 }),
      e('WindscreenReflections', 'Windscreen reflections', [0, 1, 0, 1], pct(0, 100, 5), { minIndex: 10 }),
      e('LensFlareQuality', 'Lens flare quality', [0, 1, 0, 1], ['Off', 'Medium', 'High']),
      e('DoF', 'Depth of field', [0, 1, 0, 1], ONOFF)
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_PMR;
})(typeof self !== 'undefined' ? self : this);
