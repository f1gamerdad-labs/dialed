/* Le Mans Ultimate settings table. THIS IS THE FILE TO UPDATE WHEN LMU PATCHES.

   Same fields as settings-table.js, plus:
     section    : where the setting lives. 'Graphic Options' is Settings.JSON, 'COMPONENTS' is Config_DX11.ini.
     unverified : true when LMU does not document the setting's range or meaning, so the tool treats advice on it as a guess
                  (shown as low confidence) until it has been tested on real captures.

   Ranges for the Graphic Options entries come from the comments LMU writes next to each setting in its own file.
   The cpu/gpu/vram/visual numbers are DRAFT estimates and need checking against test captures. */
(function (root) {
  var G = 'Graphic Options', V = 'COMPONENTS';
  var OFF_ON = ['Off', 'On'];
  var FOUR = ['Low', 'Medium', 'High', 'Full'];
  var OFF_TO_ULTRA = ['Off', 'Low', 'Medium', 'High', 'Ultra'];

  root.SETTINGS_TABLE_LMU = {
    testedAgainst: 'Le Mans Ultimate (not yet tested on real captures)',
    updated: '2026-11-17',
    settings: [
      // --- Shadows and lighting ---
      { section: G, key: 'Shadows', name: 'Shadows', cpu: 1, gpu: 3, vram: 1, visual: 3, levels: [0, 1, 2, 3, 4], labels: OFF_TO_ULTRA, min: 1 },
      { section: G, key: 'Shadow Blur', name: 'Shadow blur', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3], labels: ['Off', 'Fast', 'Optimal', 'Quality'] },
      { section: G, key: 'Screen Space Ambient Occlusion', name: 'Ambient occlusion (SSAO)', cpu: 0, gpu: 2, vram: 0, visual: 2, levels: [0, 1], labels: OFF_ON },
      { section: G, key: 'Headlights On Cars', name: 'Headlights light up other cars', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },

      // --- Cars (mostly processor) ---
      { section: G, key: 'Max Visible Vehicles', name: 'Max visible cars', cpu: 3, gpu: 2, vram: 1, visual: 2, levels: [8, 10, 12, 14, 16, 20, 24, 30, 40, 50, 60], min: 10, unverified: true },
      { section: G, key: 'Opponent Detail', name: 'Opponent car detail', cpu: 2, gpu: 2, vram: 2, visual: 2, levels: [0, 1, 2, 3], labels: FOUR },
      { section: G, key: 'Player Detail', name: 'Your car detail', cpu: 0, gpu: 2, vram: 2, visual: 3, levels: [0, 1, 2, 3], labels: FOUR, min: 2 },
      { section: G, key: 'Pitcrew Detail Level', name: 'Pit crew detail', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: ['Off', 'Player only', 'Everybody'] },
      { section: G, key: 'Live TV Displays', name: 'Live TV displays on track', cpu: 1, gpu: 1, vram: 1, visual: 0, levels: [0, 1, 2], labels: ['Off', 'Trackside cameras only', 'On'] },

      // --- World and effects ---
      { section: G, key: 'Track Detail', name: 'Track detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2], unverified: true },
      { section: G, key: 'Special FX', name: 'Special effects', cpu: 1, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3, 4], labels: OFF_TO_ULTRA },
      { section: G, key: 'Soft Particles', name: 'Soft particles', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: ['Off', 'Cheap soft edges', 'Depth buffered'] },
      { section: G, key: 'Environment Reflections', name: 'Live environment reflections', cpu: 3, gpu: 3, vram: 1, visual: 2, levels: [0, 1, 2, 3, 4], labels: OFF_TO_ULTRA, unverified: true },
      { section: G, key: 'Road Reflections', name: 'Road reflections (wet and heat)', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4], labels: OFF_TO_ULTRA, unverified: true },
      { section: G, key: 'Rain FX Quality', name: 'Rain effects quality', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3], unverified: true },
      { section: G, key: 'Transparency AA', name: 'Transparency anti-aliasing', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },
      { section: G, key: 'Motion blur', name: 'Motion blur', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: G, key: 'Wind and Crowd Motion', name: 'Wind and crowd motion', cpu: 1, gpu: 0, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },

      // --- Textures ---
      { section: G, key: 'Texture Detail', name: 'Texture detail', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: [0, 1, 2, 3], labels: ['Low', 'Medium', 'High', 'Max'], min: 1 },
      { section: G, key: 'Texture Filter', name: 'Texture filtering', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [1, 2, 3, 4, 5], labels: ['Trilinear', '2x', '4x', '8x', '16x'], min: 3 },

      // --- Video (Config_DX11.ini) ---
      { section: V, key: 'RenderScale', name: 'Render scale (resolution)', cpu: 0, gpu: 3, vram: 1, visual: 3, levels: [0.6, 0.7, 0.75, 0.8, 0.9, 1.0], labels: ['60%', '70%', '75%', '80%', '90%', '100%'], min: 0.7, unverified: true },
      { section: V, key: 'MSAA', name: 'MSAA samples', cpu: 0, gpu: 3, vram: 2, visual: 3, levels: [0, 2, 4, 8], labels: ['Off', '2x', '4x', '8x'], unverified: true },
      { section: V, key: 'UseFXAA', name: 'FXAA', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, unverified: true },
      { section: V, key: 'EPostProcessingSettings', name: 'Post-processing', cpu: 0, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3], unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_LMU;
})(typeof self !== 'undefined' ? self : this);
