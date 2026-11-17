/* Assetto Corsa Competizione settings table. THIS IS THE FILE TO UPDATE WHEN ACC PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in Config\menuSettings.json, in the "customGraphicOptions" block.

   WHAT IS KNOWN: customGraphicOptions is the only block that has the eight quality sliders of ACC's Custom graphics page
   (resolutionQuality, viewDistanceQuality, antiAliasingQuality, shadowQuality, postProcessQuality, textureQuality, effectsQuality,
   foliageQuality). The "graphicOptions" block next to it holds the resolution, display and HDR choices plus a preset number
   (gfxPreset) and repeats some keys with different values, so this table never touches it.
   WHAT IS NOT KNOWN: Kunos publishes no list of the values. The four-step quality scale (Low, Medium, High, Epic = 0 to 3) is how the
   in-game sliders are labelled; the file values match it in the real file. Every entry is therefore `unverified` (always low
   confidence) and noRaise (the tool only ever lowers a setting, never raises it). The cpu/gpu/vram/visual numbers are estimates.
   The changes only show in the game when its Graphics preset is set to Custom. */
(function (root) {
  var S = 'customGraphicOptions';
  var QUALITY = ['Low', 'Medium', 'High', 'Epic'];

  root.SETTINGS_TABLE_ACC = {
    testedAgainst: 'Assetto Corsa Competizione, Custom graphics preset (value meanings not confirmed; every suggestion is low confidence until tested)',
    updated: '2026-11-18',
    exact: true, // a value outside the listed levels is never touched
    settings: [
      { section: S, key: 'resolutionQuality', name: 'Resolution scale (%)', cpu: 0, gpu: 3, vram: 2, visual: 3,
        levels: [50, 60, 70, 80, 90, 100, 110, 115, 120, 130, 140, 150, 175, 200], min: 70, noRaise: true, unverified: true },
      { section: S, key: 'shadowQuality', name: 'Shadows', cpu: 1, gpu: 3, vram: 1, visual: 3, levels: [0, 1, 2, 3], labels: QUALITY, noRaise: true, unverified: true },
      { section: S, key: 'viewDistanceQuality', name: 'Visible distance', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2, 3], labels: QUALITY, noRaise: true, unverified: true },
      { section: S, key: 'effectsQuality', name: 'Effects', cpu: 1, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3], labels: QUALITY, noRaise: true, unverified: true },
      { section: S, key: 'foliageQuality', name: 'Foliage', cpu: 1, gpu: 2, vram: 1, visual: 1, levels: [0, 1, 2, 3], labels: QUALITY, noRaise: true, unverified: true },
      { section: S, key: 'postProcessQuality', name: 'Post-processing', cpu: 0, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3], labels: QUALITY, noRaise: true, unverified: true },
      { section: S, key: 'antiAliasingQuality', name: 'Anti-aliasing', cpu: 0, gpu: 2, vram: 1, visual: 3, levels: [0, 1, 2, 3], labels: QUALITY, noRaise: true, unverified: true },
      { section: S, key: 'textureQuality', name: 'Textures', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: [0, 1, 2, 3], labels: QUALITY, min: 1, noRaise: true, unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_ACC;
})(typeof self !== 'undefined' ? self : this);
