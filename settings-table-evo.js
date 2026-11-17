/* Assetto Corsa EVO settings table. THIS IS THE FILE TO UPDATE WHEN AC EVO PATCHES.

   Same fields as settings-table-lmu.js. The settings live in Saved Games\ACE\video.videosettings, a binary (protobuf) file, in section 'EVO'.
   Keys are field paths: 'f26' = top-level field 26, 'f19.1' = field 1 inside field 19. A value of 0 is not stored, so Low can be "field absent".

   PROVEN ON SEAN'S PC (2026-11-18, one setting changed at a time, and the file compared with a saved copy):
   - f19.1 is Shadows: Low = 1, Medium = 2.
   - f26 is Ambient occlusion: Low = 0 (absent), Medium = 1.
   - f47.1 and f47.2 are Max cars ahead and Max cars behind (the numbers themselves).
   NOT PROVEN: what the higher positions are (High, Ultra), so they are named "Step n". Dialed only ever lowers a setting, one step at a time.
   Texture quality, level of detail, clouds and the rest are NOT in this table yet: texture changed two fields at once and the others were not tested.
   AC EVO is early access (v0.9.1): if the format changes, the reader finds none of these fields and the app offers nothing for it.
   Every entry is `unverified` (low confidence) because only these few positions were seen. cpu/gpu/vram/visual are estimates. */
(function (root) {
  var S = 'EVO';
  var CARS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 23, 26, 30, 35, 40, 50, 60];

  root.SETTINGS_TABLE_EVO = {
    testedAgainst: 'Assetto Corsa EVO 0.9.1 (four settings proven by comparing the file; low confidence)',
    updated: '2026-11-18',
    exact: true,
    settings: [
      { section: S, key: 'f19.1', name: 'Shadows', cpu: 1, gpu: 3, vram: 2, visual: 3, levels: [1, 2, 3, 4], labels: ['Low', 'Medium', 'Step 3', 'Step 4'], min: 1, noRaise: true, unverified: true },
      { section: S, key: 'f26', name: 'Ambient occlusion', cpu: 0, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2, 3], labels: ['Low', 'Medium', 'Step 3', 'Step 4'], noRaise: true, unverified: true },
      { section: S, key: 'f47.1', name: 'Max cars ahead', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: CARS, min: 6, noRaise: true, unverified: true },
      { section: S, key: 'f47.2', name: 'Max cars behind', cpu: 1, gpu: 1, vram: 1, visual: 1, levels: CARS, min: 4, noRaise: true, unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_EVO;
})(typeof self !== 'undefined' ? self : this);
