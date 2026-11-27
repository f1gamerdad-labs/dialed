/* Assetto Corsa Rally settings table. THIS IS THE FILE TO UPDATE WHEN AC RALLY PATCHES.

   Same fields as settings-table-lmu.js. The settings live in %LOCALAPPDATA%\acr\Saved\SaveGames\PlayerDataSaveSlot.sav (an Unreal save),
   in section 'ACR'. Keys are the names the game uses in the file. Values are the position in the menu list, 0 = the lowest.

   CONFIRMED ON SEAN'S PC (2026-11-28, Steam build 26756580): all 15 menu values matched the file, and the game showed values written
   into the file by hand. See notes\acrally-settings.md. cpu/gpu/vram/visual numbers are estimates.

   PRESETS: while the Graphics preset is a named one, the game shows the preset's values and the file keeps old ones. So a preset is only
   readable if its values are listed under `presets`. All six are listed; with a preset the game adds later, Dialed reads nothing and asks
   the player to change one setting (which makes the preset Custom).
   NOT IN THE TABLE ON PURPOSE: upscaling, resolution scale, sharpness, frame generation, V-sync, frame limiter, motion blur, display.
   Dialed only ever lowers a setting here, one step at a time. */
(function (root) {
  var S = 'ACR';
  var NONE = ['Off', 'Low', 'Medium', 'High'];
  var LMHU = ['Low', 'Medium', 'High', 'Ultra'];
  var FIVE = ['Very Low', 'Low', 'Medium', 'High', 'Ultra'];
  var LMH = ['Low', 'Medium', 'High'];
  function R(key, name, cost, labels, extra) {
    var s = { section: S, key: key, name: name, cpu: cost[0], gpu: cost[1], vram: cost[2], visual: cost[3],
      levels: labels.map(function (_, i) { return i; }), labels: labels, noRaise: true, plainLabels: true };
    for (var k in extra || {}) s[k] = extra[k];
    return s;
  }

  root.SETTINGS_TABLE_ACRALLY = {
    testedAgainst: 'Assetto Corsa Rally, Steam build 26756580 (28 Nov 2026)',
    updated: '2026-11-28',
    exact: true,
    presets: {
      // ResolutionScale is the percentage the preset sets, as shown on the menu (seen with FSR 3 selected).
      // Low and Ultra were read from the save (a setting changed under the preset); Low was then confirmed on the menu page.
      // Handheld, Very Low, Medium and High were read from screenshots of the menu page (28 Nov 2026).
      Handheld: { ResolutionScale: 80, DynamicReflectionQuality: 0, SSRQuality: 0, TextureQuality: 2, AntiAliasingQuality: 0, ShadowQuality: 0, CloudsQuality: 0,
        CharactersQuality: 0, PostProcessQuality: 0, FoliageQuality: 0, GrassDensity: 0, EffectsQuality: 0, CarDeformationsQuality: 0,
        CrowdQuality: 0, InteractiveElementsQuality: 0, LCDGaugeQuality: 0 },
      VeryLow: { ResolutionScale: 80, DynamicReflectionQuality: 0, SSRQuality: 0, TextureQuality: 0, AntiAliasingQuality: 0, ShadowQuality: 0, CloudsQuality: 0,
        CharactersQuality: 0, PostProcessQuality: 0, FoliageQuality: 0, GrassDensity: 0, EffectsQuality: 0, CarDeformationsQuality: 0,
        CrowdQuality: 0, InteractiveElementsQuality: 0, LCDGaugeQuality: 0 },
      Low: { ResolutionScale: 80, DynamicReflectionQuality: 1, SSRQuality: 2, TextureQuality: 1, AntiAliasingQuality: 0, ShadowQuality: 1, CloudsQuality: 0,
        CharactersQuality: 0, PostProcessQuality: 1, FoliageQuality: 0, GrassDensity: 1, EffectsQuality: 1, CarDeformationsQuality: 0,
        CrowdQuality: 1, InteractiveElementsQuality: 1, LCDGaugeQuality: 1 },
      Medium: { ResolutionScale: 80, DynamicReflectionQuality: 2, SSRQuality: 3, TextureQuality: 2, AntiAliasingQuality: 1, ShadowQuality: 2, CloudsQuality: 1,
        CharactersQuality: 1, PostProcessQuality: 2, FoliageQuality: 1, GrassDensity: 2, EffectsQuality: 2, CarDeformationsQuality: 0,
        CrowdQuality: 4, InteractiveElementsQuality: 4, LCDGaugeQuality: 2 },
      High: { ResolutionScale: 90, DynamicReflectionQuality: 3, SSRQuality: 3, TextureQuality: 2, AntiAliasingQuality: 2, ShadowQuality: 3, CloudsQuality: 2,
        CharactersQuality: 2, PostProcessQuality: 3, FoliageQuality: 2, GrassDensity: 2, EffectsQuality: 2, CarDeformationsQuality: 2,
        CrowdQuality: 4, InteractiveElementsQuality: 4, LCDGaugeQuality: 2 },
      // Foliage, anti-aliasing and LCD are High, not Ultra, in this preset
      Ultra: { ResolutionScale: 100, DynamicReflectionQuality: 3, SSRQuality: 3, TextureQuality: 3, AntiAliasingQuality: 2, ShadowQuality: 4, CloudsQuality: 3,
        CharactersQuality: 2, PostProcessQuality: 4, FoliageQuality: 2, GrassDensity: 2, EffectsQuality: 3, CarDeformationsQuality: 2,
        CrowdQuality: 4, InteractiveElementsQuality: 4, LCDGaugeQuality: 2 }
    },
    settings: [
      R('DynamicReflectionQuality', 'Dynamic reflections quality', [2, 2, 1, 2], NONE),
      R('SSRQuality', 'Screen space reflections quality', [0, 3, 1, 2], NONE),
      R('ShadowQuality', 'Shadows quality', [1, 3, 2, 3], FIVE, { minIndex: 1 }),
      R('FoliageQuality', 'Foliage quality', [2, 3, 2, 3], LMHU),
      R('GrassDensity', 'Grass density', [1, 2, 1, 2], LMH),
      R('EffectsQuality', 'Effects quality', [1, 2, 1, 2], LMHU),
      R('CloudsQuality', 'Clouds quality', [0, 2, 1, 1], LMHU),
      R('PostProcessQuality', 'Post-process quality', [0, 2, 0, 1], FIVE, { minIndex: 1 }),
      R('AntiAliasingQuality', 'Anti-aliasing quality', [0, 2, 1, 3], LMHU, { minIndex: 1 }),
      R('TextureQuality', 'Texture quality', [0, 1, 3, 3], LMHU, { minIndex: 1 }),
      R('CrowdQuality', 'Crowd and marshals quality', [3, 1, 1, 1], FIVE),
      R('InteractiveElementsQuality', 'Interactive elements', [2, 1, 0, 1], FIVE, { minIndex: 1 }),
      R('CharactersQuality', 'Characters quality', [1, 1, 1, 1], LMH),
      // the menu offers only Low and High, stored as 0 and 2 (there is no Medium)
      R('CarDeformationsQuality', 'Car damage quality', [2, 1, 0, 2], ['Low', 'High'], { levels: [0, 2] }),
      R('LCDGaugeQuality', 'Cars LCD display', [0, 1, 0, 1], LMHU, { minIndex: 1 })
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_ACRALLY;
})(typeof self !== 'undefined' ? self : this);
