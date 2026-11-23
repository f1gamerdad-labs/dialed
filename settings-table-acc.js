/* Assetto Corsa Competizione settings table. THIS IS THE FILE TO UPDATE WHEN ACC PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in Config\menuSettings.json, in the "customGraphicOptions" block (the saved Custom
   preset). The "graphicOptions" block beside it is the active copy plus resolution, display and preset choices (gfxPreset: 4 = Custom, 7 = VR Epic);
   the game keeps the two in step whenever the player applies the Video page, so this table only ever writes to customGraphicOptions.

   CONFIRMED IN GAME (2026-11-23): Sean stepped through every position of each setting below with a watcher on the file, and the game wrote
   exactly these numbers. The in-game list order is NOT always the number order, so every levels list is written in quality order, worst first:
     Quality sliders (view distance, shadows, shadow distance, effects, post-processing, foliage, texture): Low 0, Mid 1, High 2, Epic 3.
     Anti-aliasing: Off 0, Mid 1, High 2, Epic 3. Contact shadows: Off 0, On 1.
     Mirror quality: Off 0, Low 1, Mid 2, High 3, Epic 4. Mirror resolution: Low 0, Mid 1, High 2. Mirror view distance: 2000 (20 m) to 25000 (250 m).
     Opponents visible (maxCarsVisible): 0 = All, otherwise 1 to 60.
     Materials quality: Mid 0, HIGH 2, EPIC 1 (the numbers are out of order). Bloom: Off 0, Very low 1, Low 2, Mid 3, High 4, Epic 5.
     Volumetric fog: Disabled 0, Low 1, Mid 2, High 3. Foliage LOD: Very low 0.3, Low 0.6, Mid 1, High 2, Epic 3. Car LOD: 25 to 100 (%).
     Resolution scale (resolutionQuality): 50 to 200 in steps of 1, and the game locks it while DLSS or FSR is on.
     Motion blur (isMBlurEnabled): Disabled 0, Enabled 1, Only external cameras 2. Advanced sharpen filter: Off/On.
   HOW A CHANGE REACHES THE GAME: ACC starts up with its engine defaults (Epic) and only loads the saved Custom values when the player selects the
   Custom preset on the Video page, so after Dialed applies, the player moves the preset slider away and back to Custom and presses Apply. See the
   ACC note in sims.js.
   NOT IN THE TABLE ON PURPOSE: DLSS and FSR (on/off, quality, sharpness), TAA Gen 5 and the anti-aliasing type, V-sync and the frame limit,
   fullscreen, resolution, HDR, HLOD (its cost direction is not known), temporal upsampling, mirror frame-rate cap, the mirror's Off (a driving aid)
   and everything VR. Dialed only ever lowers a setting, one step at a time. The cpu/gpu/vram/visual numbers are estimates. */
(function (root) {
  var S = 'customGraphicOptions';
  var LMHE = ['Low', 'Mid', 'High', 'Epic'];
  var pct = function (v) { return Math.round(v) + '%'; };
  function A(key, name, cost, levels, labels, extra) {
    var s = { section: S, key: key, name: name, cpu: cost[0], gpu: cost[1], vram: cost[2], visual: cost[3], levels: levels, labels: labels, noRaise: true, plainLabels: true };
    for (var k in extra || {}) s[k] = extra[k];
    return s;
  }
  var NO_UPSCALER = { dLSSEnable: 0, aMDFSREnable: 0 };   // resolution scale is locked while an upscaler is on

  root.SETTINGS_TABLE_ACC = {
    testedAgainst: 'Assetto Corsa Competizione (every value confirmed in game, 23 Nov 2026)',
    updated: '2026-11-23',
    exact: true, // a value outside the listed levels is never touched (sliders opt out with exact: false)
    settings: [
      A('resolutionQuality', 'Resolution scale', [0, 3, 2, 3], [50, 60, 70, 80, 90, 100, 110, 115, 120, 130, 140, 150, 175, 200], null,
        { min: 70, exact: false, plainLabels: false, fmt: pct, requires: NO_UPSCALER }),
      A('antiAliasingQuality', 'Anti-aliasing', [0, 2, 1, 3], [0, 1, 2, 3], ['Off', 'Mid', 'High', 'Epic'], { minIndex: 1, requires: { dLSSEnable: 0 } }),
      A('shadowQuality', 'Shadows', [1, 3, 1, 3], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('shadowDistanceQuality', 'Shadow distance', [1, 2, 0, 2], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('contactShadows', 'Contact shadows', [0, 1, 0, 1], [0, 1], ['Off', 'On']),
      A('viewDistanceQuality', 'View distance', [2, 2, 1, 2], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('effectsQuality', 'Effects', [1, 2, 0, 2], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('postProcessQuality', 'Post-processing', [0, 2, 0, 2], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('foliageQuality', 'Foliage', [1, 2, 1, 1], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('textureQuality', 'Textures', [0, 1, 3, 2], [0, 1, 2, 3], LMHE, { minIndex: 1 }),
      A('materialsQuality', 'Materials quality', [0, 2, 1, 1], [0, 2, 1], ['Mid', 'High', 'Epic']),
      A('bloomQuality', 'Bloom quality', [0, 1, 0, 1], [0, 1, 2, 3, 4, 5], ['Off', 'Very low', 'Low', 'Mid', 'High', 'Epic'], { minIndex: 2 }),
      A('volumetricFog', 'Volumetric fog', [0, 2, 0, 1], [0, 1, 2, 3], ['Disabled', 'Low', 'Mid', 'High'], { minIndex: 1 }),
      A('foliageLodQuality', 'Foliage level of detail', [1, 1, 0, 1], [0.30000001192092896, 0.60000002384185791, 1, 2, 3], ['Very low', 'Low', 'Mid', 'High', 'Epic'], { minIndex: 1 }),
      A('carLODSet', 'Car level of detail', [2, 1, 1, 1], [25, 40, 50, 60, 70, 80, 90, 100], null, { min: 50, exact: false, plainLabels: false, fmt: pct }),
      A('mirrorQualityLevel', 'Mirror quality', [1, 2, 1, 1], [0, 1, 2, 3, 4], ['Off', 'Low', 'Mid', 'High', 'Epic'], { minIndex: 1 }),
      A('mirrorsResolution', 'Mirror resolution', [0, 1, 1, 1], [0, 1, 2], ['Low', 'Mid', 'High']),
      A('mirrorDistance', 'Mirror view distance', [1, 1, 0, 1], [2000, 5000, 7000, 10000, 15000, 25000], null,
        { min: 5000, exact: false, plainLabels: false, fmt: function (v) { return Math.round(v / 100) + ' m'; } }),
      // 0 = All: it is the most cars, so it sits last in quality order. minIndex keeps Dialed from going below 25 cars.
      A('maxCarsVisible', 'Opponents visible', [3, 2, 1, 2], [10, 15, 20, 25, 30, 40, 50, 60, 0], ['10 cars', '15 cars', '20 cars', '25 cars', '30 cars', '40 cars', '50 cars', '60 cars', 'All'],
        { inverted: true, minIndex: 3 }),
      A('isMBlurEnabled', 'Motion blur', [0, 1, 0, 1], [0, 2, 1], ['Disabled', 'Only external cameras', 'Enabled']),
      A('advancedSharpenFilter', 'Advanced sharpen filter', [0, 1, 0, 1], [0, 1], ['Off', 'On'])
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_ACC;
})(typeof self !== 'undefined' ? self : this);
