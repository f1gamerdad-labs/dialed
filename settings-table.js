/* Sim Racing Graphics Optimiser - iRacing settings table.
   THIS IS THE FILE TO UPDATE WHEN iRACING PATCHES.

   Each setting is a key from [Graphics Options] in rendererDX11*.ini.
     cpu / gpu / vram : how hard it loads that part, 0 (none) to 3 (heavy)
     visual           : how much you notice it on track, 0 (not at all) to 3 (a lot)
     levels           : valid values, ordered cheapest -> most expensive
     labels           : optional names for those values
     min              : never recommend going below this value (needed for racing)
     requires         : only applies when another setting has this value
     inverted         : levels are not in numeric order (e.g. 1 = cheaper than 0)
     minIndex         : like min, but as a position in levels (for inverted settings)
     noRaise          : never recommend raising it automatically

   The cpu/gpu/vram/visual numbers are DRAFT estimates and need checking against test captures. */
(function (root) {
  var OFF_ON = ['Off', 'On'];
  var LMH = ['Low', 'Medium', 'High'];
  var OLMH = ['Off', 'Low', 'Medium', 'High'];

  root.SETTINGS_TABLE = {
    testedAgainst: '2026 Season 4',
    updated: '2026-11-17',
    settings: [
      // --- Cars and mirrors (mostly processor) ---
      { key: 'MaxCarsToDraw', name: 'Max cars drawn', cpu: 3, gpu: 1, vram: 1, visual: 2, levels: [10, 12, 16, 20, 24, 30, 40, 50, 64], min: 20 },
      { key: 'MaxCarsToDrawInMirrors', name: 'Max cars drawn in mirrors', cpu: 2, gpu: 1, vram: 0, visual: 1, levels: [4, 6, 8, 12, 16, 24, 32, 64] },
      { key: 'MaxCockpitMirrors', name: 'Cockpit mirrors', cpu: 3, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3, 4], min: 1 },
      { key: 'MirrorDetail', name: 'Higher detail in mirrors', cpu: 2, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },
      { key: 'MaxPitObjsToDraw', name: 'Max pit objects drawn', cpu: 2, gpu: 1, vram: 0, visual: 1, levels: [0, 10, 20, 30, 40, 64, 96, 192] },

      // --- World detail (mostly processor) ---
      { key: 'ObjectDetail', name: 'Object detail', cpu: 2, gpu: 1, vram: 0, visual: 2, levels: [0, 1, 2], labels: LMH },
      { key: 'PitObjectDetail', name: 'Pit object detail', cpu: 2, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3], labels: OLMH },
      { key: 'GrandstandDetail', name: 'Grandstand detail', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: LMH },
      { key: 'CrowdDetail', name: 'Crowd detail', cpu: 1, gpu: 1, vram: 1, visual: 1, levels: [0, 1, 2, 3], labels: OLMH, noRaise: true },
{ key: 'WeekendDetail', name: 'Event detail', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: LMH },
      { key: 'FoliageDetail', name: 'Foliage detail', cpu: 1, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3], labels: OLMH },
      { key: 'CarDetail', name: 'Car detail', cpu: 1, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2], labels: LMH, min: 1 },
      { key: 'ParticleDetail', name: 'Particle detail', cpu: 2, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: LMH },
      { key: 'SkyRefreshRate', name: 'Sky and cloud update rate', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: LMH },

      // --- Shadows and reflections (processor and graphics card) ---
      { key: 'DynamicShadowMaps', name: 'Dynamic object shadows', cpu: 3, gpu: 2, vram: 1, visual: 3, levels: [0, 1], labels: OFF_ON },
      { key: 'DynamicShadowRes', name: 'Dynamic shadow resolution', cpu: 0, gpu: 2, vram: 2, visual: 2, levels: [0, 1, 2, 3, 4], requires: { DynamicShadowMaps: 1 } },
      { key: 'ShadowMapType', name: 'Shadow maps and cloud shadows', cpu: 1, gpu: 2, vram: 1, visual: 3, levels: [0, 1], labels: OFF_ON },
      { key: 'ShadowDetail', name: 'Maximum shadows', cpu: 2, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },
      { key: 'StaticShadowRes', name: 'Static shadow resolution', cpu: 0, gpu: 1, vram: 2, visual: 1, levels: [0, 1, 2, 3, 4] },
      { key: 'DNSMEnable', name: 'Night shadow maps', cpu: 2, gpu: 3, vram: 1, visual: 2, levels: [0, 1], labels: OFF_ON },
      { key: 'DNSMNumLights', name: 'Night shadow lights', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4, 6, 8, 16, 32, 64, 128], requires: { DNSMEnable: 1 } },
      { key: 'NumDynamicCubemaps', name: 'Dynamic cubemaps (reflections)', cpu: 3, gpu: 2, vram: 0, visual: 2, levels: [0, 1], noRaise: true },
      { key: 'NumFixedCubemaps', name: 'Fixed cubemaps (reflections)', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1], noRaise: true },
      { key: 'SSRLevel', name: 'Screen space reflections', cpu: 0, gpu: 3, vram: 0, visual: 2, levels: [0, 1, 2], labels: ['Off', 'Lower res', 'Full res'] },

      // --- Image quality (graphics card) ---
      { key: 'AntiAliasMethod', name: 'Anti-aliasing method', cpu: 0, gpu: 2, vram: 1, visual: 3, levels: [0, 2, 3, 1], labels: ['None', 'FXAA', 'SMAA', 'MSAA'], inverted: true, minIndex: 1, noRaise: true },
      { key: 'MSAASamples', name: 'MSAA samples', cpu: 0, gpu: 3, vram: 2, visual: 2, levels: [2, 4, 8], requires: { AntiAliasMethod: 1 } },
      { key: 'ShaderQuality', name: 'Shader quality', cpu: 0, gpu: 2, vram: 0, visual: 3, levels: [0, 1, 2, 3], labels: ['Low', 'Medium', 'High', 'Max'], min: 1 },
      { key: 'SSAO', name: 'Ambient occlusion (SSAO)', cpu: 0, gpu: 2, vram: 0, visual: 2, levels: [0, 1], labels: OFF_ON },
      { key: 'EnableHDR', name: 'HDR rendering', cpu: 0, gpu: 2, vram: 1, visual: 2, levels: [0, 1], labels: OFF_ON },
      { key: 'ParticlesFullRes', name: 'Full resolution particles', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },
      { key: 'TwoPassTrees', name: 'Two pass trees', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },
      { key: 'LowQualityTrees', name: 'Tree quality', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [1, 0], labels: ['Low', 'High'], inverted: true },
      { key: 'DepthOfField', name: 'Depth of field blur', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { key: 'MotionBlurStrength', name: 'Motion blur', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4], labels: ['Off', 'Low', 'Medium', 'High', 'Ultra'] },
      { key: 'HeatHaze', name: 'Heat haze', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { key: 'Distortion', name: 'Distortion effects', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true },
      { key: 'HeadlightLevel', name: 'Headlight quality', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2], labels: LMH },
      { key: 'TrackDisplacementEnable', name: 'Track displacement', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON },

      // --- Textures (graphics memory) ---
      { key: 'CarPaint2048x2048', name: 'High resolution car paint', cpu: 0, gpu: 0, vram: 2, visual: 2, levels: [0, 1], labels: OFF_ON },
      { key: 'CacheSwap3HighResCars', name: 'High res textures for nearest cars', cpu: 0, gpu: 0, vram: 2, visual: 1, levels: [0, 1], labels: OFF_ON },
      { key: 'CompressTexturesCars', name: 'Car texture compression', cpu: 0, gpu: 0, vram: 3, visual: 1, levels: [1, 0], labels: ['Compressed', 'Uncompressed'], inverted: true, noRaise: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE;
})(typeof self !== 'undefined' ? self : this);
