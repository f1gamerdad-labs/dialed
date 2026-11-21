/* Automobilista 2 settings table. THIS IS THE FILE TO UPDATE WHEN AMS2 PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in graphicsconfigdx11.xml, section 'GraphicConfigData'.

   HOW THE VALUES WERE CONFIRMED (2026-11-21): on a real AMS2 install, each option in Options > Graphics & Performance was changed in
   the game one at a time and the file was diffed after every save, so the number below each label is what the game itself writes.
   Reiza publishes no list of these numbers. Settings marked `unverified` were not matched to an in-game option yet (the engine
   shows those as low confidence). The cpu/gpu/vram/visual numbers are still estimates.
   Settings that can only be lowered are marked noRaise: the tool never pushes them above what the player already runs.
   AMS2 reads the file at start-up, so changes only take effect after the game is restarted. */
(function (root) {
  var S = 'GraphicConfigData';
  var OFF_ON = ['Off', 'On'];
  var OFF_TO_ULTRA = ['Off', 'Low', 'Medium', 'High', 'Ultra'];
  var LOW_TO_ULTRA = ['Low', 'Medium', 'High', 'Ultra'];
  var OFF_TO_HIGH = ['Off', 'Low', 'Medium', 'High'];

  root.SETTINGS_TABLE_AMS2 = {
    testedAgainst: 'Automobilista 2 (value meanings confirmed in game on 21 Nov 2026)',
    updated: '2026-11-21',
    exact: true, // a value outside the listed levels is never touched
    settings: [
      // --- Shadows and lighting ---
      { section: S, key: 'ShadowDetailLevel', name: 'Shadow detail', cpu: 1, gpu: 3, vram: 1, visual: 3, levels: [0, 1, 2, 3, 4], labels: OFF_TO_ULTRA, min: 1, noRaise: true },
      { section: S, key: 'EnvmapDetailLevel', name: 'Vehicle reflection detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [1, 2, 3, 4], labels: LOW_TO_ULTRA, noRaise: true },
      { section: S, key: 'EnvmapReflectionDetailLevel', name: 'Track reflection detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [1, 2, 3, 4], labels: LOW_TO_ULTRA, noRaise: true },

      // --- Cars and world ---
      { section: S, key: 'CarDetailLevel', name: 'Vehicle detail', cpu: 2, gpu: 2, vram: 2, visual: 2, levels: [0, 1, 2, 3], labels: LOW_TO_ULTRA, min: 1, noRaise: true },
      { section: S, key: 'TrackDetailLevel', name: 'Track detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2, 3], labels: LOW_TO_ULTRA, noRaise: true },
      // The number itself is stored (12 to 48 in steps of one); 0 is "Off" = no limit, the most expensive. Listed from cheapest to most expensive.
      { section: S, key: 'MaxVisibleVehicles', name: 'Maximum visible vehicles', cpu: 3, gpu: 1, vram: 0, visual: 1, levels: [12, 16, 20, 24, 32, 40, 48, 0], labels: ['12 cars', '16 cars', '20 cars', '24 cars', '32 cars', '40 cars', '48 cars', 'Off (no limit)'], inverted: true, minIndex: 3, noRaise: true, plainLabels: true },
      { section: S, key: 'ParticlesDetailLevel', name: 'Particle detail (spray, smoke)', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3], labels: OFF_TO_HIGH, noRaise: true },
      { section: S, key: 'MirrorEnhanced', name: 'Enhanced mirrors', cpu: 1, gpu: 2, vram: 1, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { section: S, key: 'MotionblurLevel', name: 'Motion blur', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3], labels: OFF_TO_HIGH, noRaise: true },

      // --- Textures ---
      { section: S, key: 'TextureResolution', name: 'Texture resolution', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: [0, 1, 2], labels: ['Low', 'Medium', 'High'], min: 1, noRaise: true },
      { section: S, key: 'TextureFilter', name: 'Texture filtering', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [1, 2, 3, 4, 5], labels: ['Trilinear', 'Anisotropic 2x', 'Anisotropic 4x', 'Anisotropic 8x', 'Anisotropic 16x'], min: 3, noRaise: true },

      // --- Anti-aliasing ---
      { section: S, key: 'AntiAlias', name: 'Multisample anti-aliasing (MSAA)', cpu: 0, gpu: 3, vram: 2, visual: 3, levels: [0, 1, 2, 3], labels: ['Off', 'Low', 'Medium', 'High'], noRaise: true },
      { section: S, key: 'TemporalAntiAliasEnabled', name: 'Temporal anti-aliasing (TAA)', cpu: 0, gpu: 1, vram: 0, visual: 2, levels: [0, 1], labels: OFF_ON, noRaise: true, unverified: true },
      { section: S, key: 'SMAAFXAA', name: 'Post-processing anti-aliasing', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_AMS2;
})(typeof self !== 'undefined' ? self : this);
