/* Automobilista 2 settings table. THIS IS THE FILE TO UPDATE WHEN AMS2 PATCHES.

   Same fields as settings-table-lmu.js. Every setting lives in graphicsconfigdx11.xml, section 'GraphicConfigData'.

   HONESTY NOTE: Reiza publishes no list of what each number in graphicsconfigdx11.xml means. The levels below were limited to
   values that are known to exist (the lowest value, 0, plus whatever the game itself wrote into a real file), and every entry is
   marked `unverified`, so the engine always shows these as low confidence. The cpu/gpu/vram/visual numbers are estimates.
   Settings that can only be lowered are marked noRaise: the tool never pushes them above what the player already runs. */
(function (root) {
  var S = 'GraphicConfigData';
  var OFF_ON = ['Off', 'On'];

  root.SETTINGS_TABLE_AMS2 = {
    testedAgainst: 'Automobilista 2 (value meanings not confirmed; every suggestion is low confidence until tested)',
    updated: '2026-11-18',
    exact: true, // a value outside the listed levels is never touched
    settings: [
      // --- Shadows and lighting ---
      { section: S, key: 'ShadowDetailLevel', name: 'Shadow detail', cpu: 1, gpu: 3, vram: 1, visual: 3, levels: [0, 1, 2, 3, 4], min: 1, noRaise: true, unverified: true },
      { section: S, key: 'EnvmapDetailLevel', name: 'Environment map detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2, 3, 4], noRaise: true, unverified: true },
      { section: S, key: 'EnvmapReflectionDetailLevel', name: 'Reflection detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2], noRaise: true, unverified: true },

      // --- Cars and world ---
      { section: S, key: 'CarDetailLevel', name: 'Car detail', cpu: 2, gpu: 2, vram: 2, visual: 2, levels: [0, 1, 2, 3], min: 1, noRaise: true, unverified: true },
      { section: S, key: 'TrackDetailLevel', name: 'Track detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [0, 1], noRaise: true, unverified: true },
      { section: S, key: 'EffectsDetailLevel', name: 'Effects detail', cpu: 1, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2], noRaise: true, unverified: true },
      { section: S, key: 'ParticlesDetailLevel', name: 'Particles (spray, smoke)', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2], noRaise: true, unverified: true },
      { section: S, key: 'MirrorEnhanced', name: 'Enhanced mirrors', cpu: 1, gpu: 2, vram: 1, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, unverified: true },
      { section: S, key: 'MotionblurLevel', name: 'Motion blur', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3], noRaise: true, unverified: true },

      // --- Textures ---
      { section: S, key: 'TextureResolution', name: 'Texture resolution', cpu: 0, gpu: 1, vram: 3, visual: 2, levels: [0, 1, 2], min: 1, noRaise: true, unverified: true },
      { section: S, key: 'TextureFilter', name: 'Texture filtering', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4, 5], min: 3, noRaise: true, unverified: true },

      // --- Anti-aliasing ---
      { section: S, key: 'AntiAlias', name: 'Anti-aliasing (MSAA) level', cpu: 0, gpu: 3, vram: 2, visual: 3, levels: [0, 1, 2, 3], noRaise: true, unverified: true },
      { section: S, key: 'TemporalAntiAliasEnabled', name: 'Temporal anti-aliasing', cpu: 0, gpu: 1, vram: 0, visual: 2, levels: [0, 1], labels: OFF_ON, noRaise: true, unverified: true },
      { section: S, key: 'SMAAFXAA', name: 'SMAA / FXAA', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_AMS2;
})(typeof self !== 'undefined' ? self : this);
