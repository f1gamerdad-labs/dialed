/* BeamNG.drive settings table. THIS IS THE FILE TO UPDATE WHEN BEAMNG PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in BeamNG.drive\current\settings\settings.json (section 'BeamNG').
   BeamNG stores most quality levels as words; sims.js turns them into numbers (0 = lowest) and back, using the lists below.

   WHERE THE NUMBERS COME FROM (verified 2026-11-18 against BeamNG.drive 0.39.4 on this PC):
   - The level lists are copied from the game's own lua\ge\extensions\core\settings\graphic.lua (getModes).
   - cpu/gpu/vram come from the game's own option tooltips (locales\translations\en-US\main.translation.json), which rate each setting
     None / Minor / Moderate / Major (or High) for GPU, VRAM and CPU. They are mapped 0 / 1 / 2 / 3.
   - visual is an estimate. Ultra is marked experimental by the game, so Lighting and Shadows are noRaise (only ever lowered). */
(function (root) {
  var S = 'BeamNG';
  var WORDS = {
    GraphicMeshQuality: ['Lowest', 'Low', 'Normal', 'High', 'Ultra'],
    GraphicTerrainQuality: ['Lowest', 'Low', 'Normal', 'High'],
    GraphicTextureQuality: ['Lowest', 'Low', 'Normal'],
    GraphicLightingQuality: ['Lowest', 'Low', 'High', 'Ultra'],
    GraphicShadowsQuality: ['Disabled', 'Lowest', 'Low', 'Normal', 'High', 'Ultra'],
    GraphicClusteredQuality: ['Lowest', 'Low', 'Normal', 'High', 'Ultra']
  };
  function idx(list) { return list.map(function (_, i) { return i; }); }

  root.SETTINGS_TABLE_BEAMNG = {
    testedAgainst: 'BeamNG.drive 0.39.4 (levels and GPU/VRAM/CPU ratings from the game\'s own files)',
    updated: '2026-11-18',
    words: WORDS,
    exact: true,
    settings: [
      { section: S, key: 'GraphicMeshQuality', name: 'Mesh quality', cpu: 2, gpu: 3, vram: 0, visual: 2, levels: idx(WORDS.GraphicMeshQuality), labels: WORDS.GraphicMeshQuality, min: 1 },
      { section: S, key: 'GraphicClusteredQuality', name: 'Local lights quality', cpu: 3, gpu: 3, vram: 2, visual: 2, levels: idx(WORDS.GraphicClusteredQuality), labels: WORDS.GraphicClusteredQuality, min: 1 },
      { section: S, key: 'GraphicLightingQuality', name: 'Lighting quality', cpu: 2, gpu: 3, vram: 1, visual: 3, levels: idx(WORDS.GraphicLightingQuality), labels: WORDS.GraphicLightingQuality, min: 1, noRaise: true },
      { section: S, key: 'GraphicShadowsQuality', name: 'Shadow resolution', cpu: 1, gpu: 3, vram: 3, visual: 3, levels: idx(WORDS.GraphicShadowsQuality), labels: WORDS.GraphicShadowsQuality, min: 2, noRaise: true },
      { section: S, key: 'GraphicTerrainQuality', name: 'Terrain quality', cpu: 0, gpu: 2, vram: 1, visual: 2, levels: idx(WORDS.GraphicTerrainQuality), labels: WORDS.GraphicTerrainQuality, min: 1 },
      { section: S, key: 'GraphicTextureQuality', name: 'Texture quality', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: idx(WORDS.GraphicTextureQuality), labels: WORDS.GraphicTextureQuality, min: 1 },
      { section: S, key: 'GraphicAnisotropic', name: 'Anisotropic filtering', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 2, 4, 8, 16], labels: ['Off', 'x2', 'x4', 'x8', 'x16'], min: 4 }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_BEAMNG;
})(typeof self !== 'undefined' ? self : this);
