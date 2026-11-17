/* RaceRoom Racing Experience settings table. THIS IS THE FILE TO UPDATE WHEN RACEROOM PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in Documents\My Games\SimBin\RaceRoom Racing Experience\UserData\graphics_options.xml
   as <name type="...">value</name> (section 'RaceRoom').

   CHECKED AGAINST SEAN'S IN-GAME GRAPHICS PAGES (2026-11-18), by comparing the file the game saved before and after he changed settings:
   multiSampleLevel 8 = 8x MSAA (the value is the sample count), visibleCars 28 = 28, enableBloom true = ticked,
   trackTextureQuality 0 = High and carTextureQuality 0 = High (so these are INVERTED: a bigger number is lower quality),
   rearViewMirrorQuality 2 = High.
   Both ends seen (so Dialed may also RAISE these, one step at a time):
   shadowFilterDetail (the Shadows menu): Medium = 2, Ultra = 4, and the menu lists Off, Low, Medium, High, Ultra, so 0 to 4.
   reflectionType (Car reflection quality): Low = 0, Ultra = 3.
   lodTrackLevel (Track level of detail): Medium = 1, High = 2.
   particleDetailLevel (Particle detail): Medium = 1, High = 2.
   NOT CHECKED: the middle positions (for example whether 1 = Medium for reflections) and the other list positions of the settings only seen
   at one value. They follow the same pattern, so every entry is `unverified` (always low confidence). Settings seen at one value only
   are noRaise (only ever lowered). The cpu/gpu/vram/visual numbers are estimates. */
(function (root) {
  var S = 'RaceRoom';
  var LMH = ['Low', 'Medium', 'High'];
  var CARS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35, 40, 45, 50, 60, 70, 80, 100];

  root.SETTINGS_TABLE_RACEROOM = {
    testedAgainst: 'RaceRoom Racing Experience (values checked against the in-game pages; unseen list positions assumed, so low confidence)',
    updated: '2026-11-18',
    exact: true,
    settings: [
      { section: S, key: 'visibleCars', name: 'Visible cars', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: CARS, min: 12, noRaise: true, unverified: true },
      { section: S, key: 'multiSampleLevel', name: 'Anti-aliasing (MSAA)', cpu: 0, gpu: 3, vram: 2, visual: 3, levels: [0, 2, 4, 8], labels: ['Off', '2x MSAA', '4x MSAA', '8x MSAA'], noRaise: true, unverified: true },
      { section: S, key: 'trackTextureQuality', name: 'Track texture quality', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: [2, 1, 0], labels: LMH, inverted: true, minIndex: 1, noRaise: true, unverified: true },
      { section: S, key: 'carTextureQuality', name: 'Car texture quality', cpu: 0, gpu: 1, vram: 2, visual: 2, levels: [2, 1, 0], labels: LMH, inverted: true, minIndex: 1, noRaise: true, unverified: true },
      { section: S, key: 'shadowFilterDetail', name: 'Shadows', cpu: 1, gpu: 3, vram: 2, visual: 3, levels: [0, 1, 2, 3, 4], labels: ['Off', 'Low', 'Medium', 'High', 'Ultra'], min: 1, unverified: true },
      { section: S, key: 'reflectionType', name: 'Car reflection quality', cpu: 1, gpu: 3, vram: 1, visual: 2, levels: [0, 1, 2, 3], labels: ['Low', 'Medium', 'High', 'Ultra'], unverified: true },
      { section: S, key: 'lodTrackLevel', name: 'Track level of detail', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2], labels: LMH, min: 1, unverified: true },
      { section: S, key: 'rearViewMirrorQuality', name: 'Rear view mirror quality', cpu: 1, gpu: 2, vram: 1, visual: 1, levels: [0, 1, 2], labels: LMH, noRaise: true, unverified: true },
      { section: S, key: 'particleDetailLevel', name: 'Particle detail', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2], labels: LMH, unverified: true },
      { section: S, key: 'enableBloom', name: 'Bloom', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: ['Off', 'On'], noRaise: true, unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_RACEROOM;
})(typeof self !== 'undefined' ? self : this);
