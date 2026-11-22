/* RaceRoom Racing Experience settings table. THIS IS THE FILE TO UPDATE WHEN RACEROOM PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in Documents\My Games\SimBin\RaceRoom Racing Experience\UserData\graphics_options.xml
   as <name type="...">value</name> (section 'RaceRoom'). The file also holds VR, triple-screen, camera and display values; Dialed never touches those.

   CONFIRMED IN GAME (2026-11-23): Sean stepped through every position of each setting below with a watcher on the file, so every value here is
   what the game wrote:
   multiSampleLevel (Anti-aliasing): the value is the sample count. Off = 1, 2x = 2, 4x = 4, 8x = 8. useSSAA is a separate switch (supersampling).
   shadowFilterDetail (Shadows): Off 0, Low 1, Medium 2, High 3, Ultra 4.
   reflectionType (Car reflection quality): Low 0, Medium 1, High 2, Ultra 3.
   lodTrackLevel (Track level of detail): Low 0, Medium 1, High 2.
   particleDetailLevel (Particle detail): OFF = 3 (!), Low 0, Medium 1, High 2. The order is not numeric, so the levels list below is in quality order.
   trackTextureQuality / carTextureQuality: INVERTED, High 0, Medium 1, Low 2.
   rearViewMirrorQuality: Low 0, Medium 1, High 2. The mirror's Off is its own switch, allowRearViewMirror, which Dialed never touches:
   a mirror is a driving aid, not a quality setting.
   visibleCars: a slider from 10 to 100 in steps of 1 (any whole number), so a value between two listed levels is stepped down to the level below.
   enableBloom, enableDof, enableMotionBlur, enableFXAA, allowCarShadow, useSSAA: on/off switches (written as true/false).
   Motion blur quality (allowedMotionBlurDetail 0 to 3) is only used while motion blur is on, so Dialed only offers to switch motion blur off.
   NOT TOUCHED ON PURPOSE: sharpening, auto exposure, brightness, contrast, V-sync (it decides the frame-rate target), resolution and window mode,
   the menu/HUD settings and cockpit options (stored elsewhere), and everything VR.
   Settings Dialed only ever lowers are noRaise. Those seen at both ends and safe to step either way (shadows, car reflections, track detail,
   particles) may also be raised one step when the PC has spare room. The cpu/gpu/vram/visual numbers are estimates. */
(function (root) {
  var S = 'RaceRoom';
  var LMH = ['Low', 'Medium', 'High'];
  var OFF_ON = ['Off', 'On'];
  // 10 to 100 in the game; these are the steps Dialed moves between (a value in between is stepped down to the level below)
  var CARS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35, 40, 45, 50, 60, 70, 80, 100];

  root.SETTINGS_TABLE_RACEROOM = {
    testedAgainst: 'RaceRoom Racing Experience (every value confirmed in game, 23 Nov 2026)',
    updated: '2026-11-23',
    exact: true,
    settings: [
      { section: S, key: 'visibleCars', name: 'Visible cars', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: CARS, min: 12, noRaise: true, exact: false },
      { section: S, key: 'multiSampleLevel', name: 'Anti-aliasing (MSAA)', cpu: 0, gpu: 3, vram: 2, visual: 3, levels: [1, 2, 4, 8], labels: ['Off', '2x MSAA', '4x MSAA', '8x MSAA'], noRaise: true },
      { section: S, key: 'useSSAA', name: 'Supersampling (SSAA)', cpu: 0, gpu: 3, vram: 2, visual: 2, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: S, key: 'trackTextureQuality', name: 'Track texture quality', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: [2, 1, 0], labels: LMH, inverted: true, minIndex: 1, noRaise: true },
      { section: S, key: 'carTextureQuality', name: 'Car texture quality', cpu: 0, gpu: 1, vram: 2, visual: 2, levels: [2, 1, 0], labels: LMH, inverted: true, minIndex: 1, noRaise: true },
      { section: S, key: 'shadowFilterDetail', name: 'Shadows', cpu: 1, gpu: 3, vram: 2, visual: 3, levels: [0, 1, 2, 3, 4], labels: ['Off', 'Low', 'Medium', 'High', 'Ultra'], min: 1 },
      { section: S, key: 'reflectionType', name: 'Car reflection quality', cpu: 1, gpu: 3, vram: 1, visual: 2, levels: [0, 1, 2, 3], labels: ['Low', 'Medium', 'High', 'Ultra'] },
      { section: S, key: 'lodTrackLevel', name: 'Track level of detail', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2], labels: LMH, min: 1 },
      { section: S, key: 'rearViewMirrorQuality', name: 'Rear view mirror quality', cpu: 1, gpu: 2, vram: 1, visual: 1, levels: [0, 1, 2], labels: LMH, noRaise: true },
      // Off is stored as 3, so the levels are listed in quality order: Off, Low, Medium, High. minIndex 1 stops Dialed turning particles fully off.
      { section: S, key: 'particleDetailLevel', name: 'Particle detail', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [3, 0, 1, 2], labels: ['Off', 'Low', 'Medium', 'High'], minIndex: 1 },
      { section: S, key: 'allowCarShadow', name: 'Car shadows', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: S, key: 'enableBloom', name: 'Bloom', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: S, key: 'enableDof', name: 'Depth of field', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: S, key: 'enableMotionBlur', name: 'Motion blur', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: S, key: 'enableFXAA', name: 'FXAA', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_RACEROOM;
})(typeof self !== 'undefined' ? self : this);
