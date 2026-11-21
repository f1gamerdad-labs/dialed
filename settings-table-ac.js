/* Assetto Corsa (the original, 2014) settings table. THIS IS THE FILE TO UPDATE IF AC'S VIDEO OPTIONS CHANGE.

   Same fields as settings-table-lmu.js. Every setting lives in Documents\Assetto Corsa\cfg\video.ini, in the section named by `section`.

   HOW THE VALUES WERE CONFIRMED (22 Nov 2026): on a real install (through Content Manager), each option on its Video settings page was
   changed one at a time and video.ini was diffed after every change, so each number below is what the game itself writes.
   Not touched on purpose: resolution, full screen, V-sync and the frame limit (they describe the display, not quality), the post-processing
   filter, and the options Content Manager and Custom Shaders Patch keep elsewhere. Two Content Manager "Off" choices are left out because they
   change several values at once (reflection resolution Off zeroes SIZE, FACES_PER_FRAME and FARPLANE).
   Settings marked noRaise can only be lowered: the tool never pushes them above what the player already runs.
   `exact: false` on a setting means a value between two listed levels (a slider) is rounded down to the nearest listed level. */
(function (root) {
  var OFF_ON = ['Off', 'On'];
  var SIX = ['Minimum', 'Low', 'Medium', 'High', 'Very high', 'Maximum'];
  var OFF_SIX = ['Off', 'Low', 'Medium', 'High', 'Very high', 'Maximum'];
  var V = 'VIDEO', E = 'EFFECTS', P = 'POST_PROCESS', C = 'CUBEMAP', M = 'MIRROR', A = 'ASSETTOCORSA';

  // ---------- Custom Shaders Patch (CSP) ----------
  // Confirmed in game on 22 Nov 2026 against CSP build 4184, by changing each option in Content Manager > Settings > Custom Shaders Patch and
  // watching which key changed in Documents\Assetto Corsa\cfg\extension. Sections are named "<page>:<SECTION>" (see sims.js). A setting only
  // exists when the game's CSP defaults file has it, so a different CSP build simply offers fewer of these. `requires` names the switches that
  // must be on for the setting to do anything ("page:SECTION|KEY" reaches into another section); everything here can only be lowered.
  // Lists run from the cheapest choice to the most expensive. `inverted` lists give exact values: a value not listed is left alone.
  var OFF_ON2 = ['Off', 'On'];
  function S(section, key, name, cost, levels, labels, extra) {   // cost: [cpu, gpu, vram, visual]
    var s = { section: section, key: key, name: name, cpu: cost[0], gpu: cost[1], vram: cost[2], visual: cost[3], levels: levels, labels: labels, noRaise: true, plainLabels: true };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    // a value between two levels (a slider) is shown the same way as the levels: 125% or 1200 m, never a bare 1.25
    var tail = labels && /^-?[\d.]+(%| [A-Za-z]+)$/.exec(labels[labels.length - 1]);
    if (tail && !s.fmt) s.fmt = tail[1] === '%' ? function (v) { return Math.round(v * 100) + '%'; } : function (v) { return v + tail[1]; };
    return s;
  }
  function pct(a) { return a.map(function (v) { return Math.round(v * 100) + '%'; }); }
  function nums(a, unit) { return a.map(function (v) { return v + unit; }); }
  var XB = 'extra_fx:BASIC|ENABLED';   // Extra FX itself must be switched on
  var CSP = [
    // Adjustments: resolution, upscaling, level-of-detail distances and a few quality extras. Switching an upscaler on or changing the
    // anti-aliasing method (those are words in the file, not numbers) is left to the player.
    S('graphics_adjustments:RENDER_SCALE', 'SCALE', 'Pixel density (render scale)', [0, 3, 1, 3], [0.6, 0.7, 0.8, 0.9, 1], pct([0.6, 0.7, 0.8, 0.9, 1]), { min: 0.7, exact: false }),
    S('graphics_adjustments:FSR', 'QUALITY2', 'Upscaling quality (render resolution)', [0, 3, 1, 2], [0.5, 0.59, 0.67, 0.77, 0.87], ['Performance (50%)', 'Balanced (59%)', 'Quality (67%)', 'Ultra quality (77%)', 'Best quality (87%)'], { min: 0.5, exact: false, requires: { ACTIVE: 1 } }),
    S('graphics_adjustments:LODS', 'CARS_DISTANCE_MULT', 'Car level-of-detail distance', [1, 2, 0, 2], [0.5, 0.7, 0.85, 1, 1.5, 2, 3.2], pct([0.5, 0.7, 0.85, 1, 1.5, 2, 3.2]), { min: 0.5, exact: false }),
    S('graphics_adjustments:LODS', 'TRACK_DISTANCE_MULT', 'Track level-of-detail distance', [2, 2, 0, 2], [0.5, 0.7, 0.85, 1, 1.5, 2, 3.2], pct([0.5, 0.7, 0.85, 1, 1.5, 2, 3.2]), { min: 0.5, exact: false }),
    S('graphics_adjustments:LODS', 'TREES_DISTANCE_MULT', 'Tree level-of-detail distance', [1, 2, 0, 2], [0.5, 0.7, 0.85, 1, 1.5, 2, 3.2], pct([0.5, 0.7, 0.85, 1, 1.5, 2, 3.2]), { min: 0.5, exact: false }),
    S('graphics_adjustments:LODS', 'HIDE_WHEELS_FOR_INTERIOR_VIEW', 'Hide car wheels in cockpit views', [0, 1, 0, 1], [1, 0], ['On', 'Off'], { inverted: true }),
    S('graphics_adjustments:LODS', 'SKIP_LOADING_FIRST_LOD_FOR_OTHER_CARS', 'Skip the most detailed model for other cars', [0, 1, 2, 1], [1, 0], ['On', 'Off'], { inverted: true }),
    S('graphics_adjustments:ANTIALIASING_MSAA', 'CUSTOM_KERNEL', 'Custom MSAA resolve kernel', [0, 1, 0, 1], [0, 1], OFF_ON2),
    S('graphics_adjustments:ANTIALIASING_MSAA', 'CUSTOM_RESOLVE', 'Custom MSAA resolve', [0, 1, 0, 2], [0, 1], OFF_ON2),

    // Lighting FX
    S('lighting_fx:PERFORMANCE', 'CARS_WITH_LIGHTS', 'Cars casting lights', [1, 2, 0, 1], [4, 6, 8, 10, 15, 20, 30, 40, 50], nums([4, 6, 8, 10, 15, 20, 30, 40, 50], ' cars'), { min: 4, exact: false }),
    S('lighting_fx:PERFORMANCE', 'ENABLE_REARVIEWMIRROR_LIGHT', 'Rear mirror lighting', [1, 2, 0, 1], [0, 1, 2], ['No dynamic lights', 'Dynamic lights', 'Dynamic lights and sun shadows (very expensive)'], { min: 1 }),
    S('lighting_fx:PERFORMANCE', 'ENABLE_REFLECTION_LIGHT', 'Lighting in reflections', [1, 2, 0, 1], [0, 1], OFF_ON2),
    S('lighting_fx:SHADOWS', 'FULL_RESOLUTION', 'Dynamic shadows at full resolution', [0, 2, 0, 2], [0, 1], OFF_ON2, { requires: { ENABLED: 1 } }),
    S('lighting_fx:SHADOWS', 'CARS_SHADOWS', 'Cars with dynamic shadows', [1, 2, 0, 2], [0, 1, 2, 3, 4, 5], nums([0, 1, 2, 3, 4, 5], ' cars'), { min: 1, requires: { ENABLED: 1 } }),
    S('lighting_fx:SHADOWS', 'HIGH_QUALITY_HEADLIGHT_SHADOWS', 'High quality headlight shadows', [0, 3, 0, 1], [0, 1], OFF_ON2, { requires: { ENABLED: 1 } }),
    S('lighting_fx:SHADOWS', 'DETAILED_SHADOWS_FROM_CARS_NEARBY', 'Detailed shadows from nearby cars', [1, 1, 0, 1], [0, 1, 2, 3, 4], nums([0, 1, 2, 3, 4], ' cars'), { requires: { ENABLED: 1 } }),

    // Extra FX (the whole extension, and then each effect, must be on)
    S('extra_fx:MOTION_BLUR', 'QUALITY_2', 'Extra FX motion blur quality', [0, 1, 0, 1], [0, 1, 2], ['Low', 'Medium', 'High'], { requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('extra_fx:SSLR', 'ENABLED', 'Local reflections (SSLR)', [0, 3, 0, 3], [0, 1], OFF_ON2, { requires: { 'extra_fx:BASIC|ENABLED': 1 } }),
    S('extra_fx:SSLR', 'TRACING_QUALITY3', 'Local reflections quality', [0, 2, 0, 2], [3, 4], ['Simple', 'High-Z'], { requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('extra_fx:SSLR', 'STEPS_SIMPLE', 'Local reflections steps', [0, 2, 0, 1], [24, 36, 48, 64, 80], nums([24, 36, 48, 64, 80], ' steps'), { min: 24, exact: false, requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1, TRACING_QUALITY3: 3 } }),
    S('extra_fx:SSLR', 'SCALE', 'Local reflections resolution', [0, 2, 0, 1], [0.5, 0.6, 0.7, 0.8, 0.9, 1], pct([0.5, 0.6, 0.7, 0.8, 0.9, 1]), { min: 0.5, exact: false, requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('extra_fx:ASSAO', 'QUALITY', 'Ambient occlusion quality (ASSAO)', [0, 2, 0, 2], [-1, 0, 1, 2, 3], ['Lowest', 'Low', 'Medium', 'High', 'Very high'], { min: 0, requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('extra_fx:SS_LIGHTING', 'SCALE', 'Extra screen-space lighting resolution', [0, 2, 0, 1], [0.5, 0.75, 1], pct([0.5, 0.75, 1]), { min: 0.5, exact: false, requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('extra_fx:LIGHT_BOUNCE', 'CARS', 'Light bounce on cars', [0, 1, 0, 1], [0, 1], OFF_ON2, { requires: { 'extra_fx:BASIC|ENABLED': 1, 'extra_fx:SS_LIGHTING|ENABLED': 1 } }),
    S('extra_fx:VOLUMETRIC_LIGHTS', 'SCALE', 'Volumetric headlights resolution', [0, 2, 0, 1], [0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32], pct([0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32]), { min: 0.08, exact: false, requires: { 'extra_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('extra_fx:FOG_BLUR', 'ENABLED', 'Fog blur', [0, 1, 0, 1], [0, 1], OFF_ON2, { requires: { 'extra_fx:BASIC|ENABLED': 1 } }),

    // Smart Shadows
    S('smart_shadows:BASIC', 'AUTOMATIC_SPLITS_DISTANCE', 'Shadow distance', [0, 2, 0, 2], [100, 150, 200, 250, 300, 400], nums([100, 150, 200, 250, 300, 400], ' m'), { min: 100, exact: false, requires: { 'smart_shadows:BASIC|ENABLED': 1, AUTOMATIC_SPLITS: 1 } }),
    S('smart_shadows:CUSTOM_SHADOW_MATRICES', 'FOURTH_CASCADE_DISTANCE', 'Distant shadow range', [0, 1, 0, 1], [1000, 1250, 1500, 1750, 2000], nums([1000, 1250, 1500, 1750, 2000], ' m'), { min: 1000, exact: false, requires: { 'smart_shadows:BASIC|ENABLED': 1, ENABLED: 1, FOURTH_CASCADE: 1 } }),
    S('smart_shadows:CUSTOM_SHADOW_MATRICES', 'FOURTH_CASCADE', 'Distant shadows (fourth cascade)', [0, 2, 0, 2], [0, 1], OFF_ON2, { requires: { 'smart_shadows:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('smart_shadows:NO_CAR_SHADOWS_IN_THIRD_CASCADE', 'INTERIOR_VIEW', 'No car shadows in the third cascade (cockpit view)', [0, 1, 0, 1], [1, 0], ['On', 'Off'], { inverted: true, requires: { 'smart_shadows:BASIC|ENABLED': 1 } }),
    S('smart_shadows:NO_CAR_SHADOWS_IN_THIRD_CASCADE', 'EXTERIOR_VIEW', 'No car shadows in the third cascade (outside views)', [0, 1, 0, 1], [1, 0], ['On', 'Off'], { inverted: true, requires: { 'smart_shadows:BASIC|ENABLED': 1 } }),

    // Particles FX
    S('particles_fx:SMOKE', 'QUANTITY_SCALE', 'Smoke quantity', [1, 2, 0, 1], [0.3, 0.5, 0.7, 0.85, 1, 1.2], pct([0.3, 0.5, 0.7, 0.85, 1, 1.2]), { min: 0.3, exact: false, requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:SMOKE', 'USE_DOWNSCALING', 'Smoke at half resolution', [0, 2, 0, 1], [1, 0], ['On', 'Off'], { inverted: true, requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:SMOKE', 'SIMPLIFIED_SHADING', 'Simplified smoke shading', [0, 1, 0, 1], [1, 0], ['On', 'Off'], { inverted: true, requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:SMOKE', 'CAST_SHADOWS', 'Smoke casts shadows', [0, 2, 0, 1], [0, 1], OFF_ON2, { requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:SMOKE', 'CAST_AMBIENT_SHADOWS', 'Smoke casts ambient shadows', [0, 1, 0, 1], [0, 1], OFF_ON2, { requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:SMOKE', 'SHOW_IN_MIRRORS', 'Smoke in mirrors', [0, 1, 0, 1], [0, 1], OFF_ON2, { requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:SPARKS', 'LIMIT', 'Spark limit', [0, 1, 0, 1], [5000, 10000, 20000, 30000, 40000], nums([5000, 10000, 20000, 30000, 40000], ' particles'), { min: 5000, exact: false, requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),
    S('particles_fx:PIECES', 'LIMIT', 'Debris particle limit', [0, 1, 0, 1], [10000, 20000, 30000, 45000, 60000, 90000, 120000], nums([10000, 20000, 30000, 45000, 60000, 90000, 120000], ' particles'), { min: 10000, exact: false, requires: { 'particles_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),

    // Reflections FX, Rain FX, Grass FX, Skidmarks
    S('reflections_fx:MAIN_CUBEMAP', 'RESOLUTION2', 'Main reflection resolution (CSP)', [0, 2, 1, 2], [512, 1024, 2048], ['512×512', '1024×1024', '2048×2048'], { min: 512 }),
    S('rain_fx:VISUAL_TWEAKS', 'RAIN_MAPS_QUALITY', 'Rain maps quality', [0, 2, 1, 2], [2, 1, 0], ['Low', 'Medium', 'High'], { inverted: true, requires: { 'rain_fx:BASIC|ENABLED': 1 } }),
    S('rain_fx:SCREEN_DROPS', 'ENABLED', 'Raindrops on the screen', [0, 1, 0, 2], [0, 1], OFF_ON2, { requires: { 'rain_fx:BASIC|ENABLED': 1 } }),
    S('grass_fx:BASIC', 'QUALITY', 'Grass quality', [1, 2, 0, 2], [0, 1, 2, 3, 4], ['Very low', 'Low', 'Medium', 'High', 'Very high'], { min: 1, requires: { ENABLED: 1 } }),
    S('grass_fx:RENDERING', 'SMOOTHER_BLENDING', 'Grass smoother blending (MSAA)', [0, 2, 0, 1], [0, 1], OFF_ON2, { requires: { 'grass_fx:BASIC|ENABLED': 1 } }),
    S('grass_fx:RENDERING', 'CAST_SHADOWS', 'Grass casts shadows', [0, 2, 0, 1], [0, 1], OFF_ON2, { requires: { 'grass_fx:BASIC|ENABLED': 1 } }),
    S('skidmarks_fx:NEW_IMPLEMENTATION', 'LIMIT', 'Skidmark limit', [1, 1, 0, 1], [100, 150, 200, 300, 400, 600, 800], ['100K', '150K', '200K', '300K', '400K', '600K', '800K'], { min: 100, exact: false, requires: { 'skidmarks_fx:BASIC|ENABLED': 1, ENABLED: 1 } }),

    // Mirrors
    S('smart_mirror:PERFORMANCE', 'SKIP_FRAMES', 'Mirror update (frames skipped)', [1, 2, 0, 1], [3, 2, 1, 0], ['Skip 3 frames', 'Skip 2 frames', 'Skip 1 frame', 'Every frame'], { inverted: true, minIndex: 1 }),
    S('smart_mirror:CUSTOM_RENDER_DISTANCE', 'DISTANCE', 'Mirror render distance', [1, 1, 0, 1], [800, 1000, 1200, 1600, 2000, 2400], nums([800, 1000, 1200, 1600, 2000, 2400], ' m'), { min: 800, exact: false, requires: { ENABLED: 1 } }),
    S('smart_mirror:REAL_MIRRORS', 'ALTER_FOV', 'Real mirrors projection', [0, 2, 0, 2], [0, 1, 2, 3], ['Basic', 'Alter FOV', 'Alter FOV and squeeze', 'Accurate'], { min: 1, requires: { ENABLED: 1 } }),
    S('smart_mirror:REAL_MIRRORS', 'RENDER_PER_FRAME', 'Real mirrors refresh', [0, 2, 0, 1], [3, 2, 1, 0], ['Update 3 reflections per frame', 'Update 2 reflections per frame', 'Update 1 reflection per frame', 'Update everything'], { inverted: true, requires: { ENABLED: 1 } }),
    S('smart_mirror:REAL_MIRRORS', 'SHOW_CAR', 'Car in real mirrors', [0, 1, 0, 1], [0, 1], OFF_ON2, { requires: { ENABLED: 1 } }),

    // Optimizations: the texture limits save graphics memory ("for desperate cases"), the audio limit saves processor time
    S('general:OPTIMIZATIONS_MEMORY', 'LIMIT_TEXTURES_MAIN_CAR', 'Limit main car textures', [0, 1, 3, 2], [2048, 4096, 0], ['2048×2048', '4096×4096', 'Unlimited'], { inverted: true }),
    S('general:OPTIMIZATIONS_MEMORY', 'LIMIT_TEXTURES_OTHER_CARS', 'Limit other cars\' textures', [0, 1, 3, 2], [1024, 2048, 4096, 0], ['1024×1024', '2048×2048', '4096×4096', 'Unlimited'], { inverted: true }),
    S('general:OPTIMIZATIONS_MEMORY', 'LIMIT_TEXTURES_TRACK', 'Limit track textures', [0, 1, 3, 2], [2048, 4096, 0], ['2048×2048', '4096×4096', 'Unlimited'], { inverted: true }),
    S('general:OPTIMIZATIONS_CPU', 'LIMIT_AUDIO_FOR_OTHER_CARS', 'Limit audio for other cars', [1, 0, 0, 0], [1, 0], ['Online only', 'Disabled'], { inverted: true })
  ];

  root.SETTINGS_TABLE_AC = {
    testedAgainst: 'Assetto Corsa (original) and Custom Shaders Patch build 4184, through Content Manager, confirmed in game on 22 Nov 2026',
    updated: '2026-11-22',
    exact: true, // a value outside the listed levels is never touched (unless the setting says exact: false)
    settings: [
      // --- Anti-aliasing and filtering ---
      { section: V, key: 'AASAMPLES', name: 'Anti-aliasing (MSAA)', cpu: 0, gpu: 3, vram: 2, visual: 3, levels: [1, 2, 4, 8], labels: ['Off', '2x', '4x', '8x (experimental)'], min: 2, noRaise: true, plainLabels: true },
      { section: V, key: 'ANISOTROPIC', name: 'Anisotropic filtering', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 2, 4, 8, 16], labels: ['Off', '2x', '4x', '8x', '16x'], min: 4, noRaise: true, plainLabels: true },
      { section: P, key: 'FXAA', name: 'FXAA', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, plainLabels: true },

      // --- Shadows and the world ---
      { section: V, key: 'SHADOW_MAP_SIZE', name: 'Shadow resolution', cpu: 1, gpu: 3, vram: 1, visual: 3, levels: [1024, 2048, 3072, 4096], labels: ['1024×1024', '2048×2048', '3072×3072', '4096×4096'], noRaise: true, plainLabels: true },
      { section: A, key: 'WORLD_DETAIL', name: 'World details', cpu: 2, gpu: 2, vram: 1, visual: 2, levels: [0, 1, 2, 3, 4, 5], labels: SIX, min: 2, noRaise: true, plainLabels: true },

      // --- Reflections and mirrors ---
      { section: C, key: 'SIZE', name: 'Reflection resolution', cpu: 0, gpu: 2, vram: 1, visual: 2, levels: [256, 512, 1024, 2048], labels: ['256×256', '512×512', '1024×1024', '2048×2048'], min: 512, noRaise: true, plainLabels: true },
      { section: C, key: 'FACES_PER_FRAME', name: 'Reflection update rate', cpu: 1, gpu: 2, vram: 0, visual: 2, levels: [1, 2, 3, 4, 5, 6], labels: ['1 face per frame', '2 faces per frame', '3 faces per frame', '4 faces per frame', '5 faces per frame', '6 faces per frame'], min: 2, noRaise: true, plainLabels: true },
      { section: C, key: 'FARPLANE', name: 'Reflection distance', cpu: 1, gpu: 2, vram: 0, visual: 1, levels: [250, 500, 750, 1000, 1500, 2000, 2400], labels: ['250 m', '500 m', '750 m', '1000 m', '1500 m', '2000 m', '2400 m'], min: 250, noRaise: true, plainLabels: true, exact: false },
      { section: M, key: 'HQ', name: 'High quality mirrors', cpu: 1, gpu: 2, vram: 1, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, plainLabels: true },
      { section: M, key: 'SIZE', name: 'Mirror resolution', cpu: 0, gpu: 2, vram: 1, visual: 1, levels: [256, 512, 1024, 2048], labels: ['256', '512', '1024', '2048'], min: 512, noRaise: true, plainLabels: true },

      // --- Smoke and effects ---
      { section: E, key: 'SMOKE', name: 'Smoke generation', cpu: 1, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4, 5], labels: ['Off', 'Minimum', 'Low', 'Medium', 'High', 'Maximum'], min: 2, noRaise: true, plainLabels: true },
      { section: E, key: 'RENDER_SMOKE_IN_MIRROR', name: 'Smoke in mirrors', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, plainLabels: true },
      { section: E, key: 'MOTION_BLUR', name: 'Motion blur', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], noRaise: true, exact: false },

      // --- Post-processing ---
      { section: P, key: 'QUALITY', name: 'Post-processing quality', cpu: 0, gpu: 2, vram: 0, visual: 2, levels: [0, 1, 2, 3, 4, 5], labels: SIX, min: 2, noRaise: true, plainLabels: true },
      { section: P, key: 'GLARE', name: 'Glare quality', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4, 5], labels: OFF_SIX, noRaise: true, plainLabels: true },
      { section: P, key: 'DOF', name: 'Depth of field', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: [0, 1, 2, 3, 4, 5], labels: OFF_SIX, noRaise: true, plainLabels: true },
      { section: P, key: 'HEAT_SHIMMER', name: 'Heat shimmering', cpu: 0, gpu: 1, vram: 0, visual: 0, levels: [0, 1], labels: OFF_ON, noRaise: true, plainLabels: true },
      { section: P, key: 'RAYS_OF_GOD', name: 'Sunrays', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: [0, 1], labels: OFF_ON, noRaise: true, plainLabels: true }
    ].concat(CSP)
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_AC;
})(typeof self !== 'undefined' ? self : this);
