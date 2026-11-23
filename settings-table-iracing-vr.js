/* Dialed - iRacing VR settings table (beta, tester switch --enable-vr).
   Used when the OpenXR graphics file (rendererDX11OpenXR.ini) is the one being tuned.

   It starts from the flat-screen iRacing table (same keys, same file format) and then:
     - adds the VR settings that live in the file's [OpenXR] section (render resolution, foveated rendering),
     - makes motion blur and depth of field "never raise" (both are unpleasant in a headset),
     - keeps mirrors in play, because every mirror is another render of the scene.
   Never touched: VRMode, eye tracking, depth layer, UI screen size/distance, FSR/upscaling, sharpening, frame limit.
   The cpu/gpu/vram/visual numbers are DRAFT estimates until checked against real VR captures. */
(function (root) {
  var isNode = typeof module === 'object' && module.exports;
  var flat = isNode ? require('./settings-table.js') : root.SETTINGS_TABLE;

  var vrOnly = [
    // Foveated rendering only means something when VRMode is 2 (the game's own comment: 2 = NV foveated quad view).
    { key: 'ResolutionScalePct', section: 'OpenXR', name: 'VR render resolution', cpu: 0, gpu: 3, vram: 2, visual: 3,
      levels: [60, 70, 80, 90, 100, 110, 120, 130, 140, 150], min: 70, fmt: function (v) { return v + '%'; } },
    { key: 'FoveatedOuterPctRes', section: 'OpenXR', name: 'Foveated outer resolution', cpu: 0, gpu: 2, vram: 1, visual: 2,
      levels: [25, 30, 35, 40, 45, 50], requires: { 'Graphics Options|VRMode': 2 }, fmt: function (v) { return v + '%'; } },
    { key: 'FoveatedInsetWidthPct', section: 'OpenXR', name: 'Foveated sharp area size', cpu: 0, gpu: 2, vram: 1, visual: 2,
      levels: [25, 30, 35, 40, 45, 50], min: 30, requires: { 'Graphics Options|VRMode': 2 }, fmt: function (v) { return v + '%'; } }
  ];

  // Settings that cost a lot in a headset (the scene is drawn twice) and that players rarely miss there are not raised automatically.
  var noRaiseInVr = { MotionBlurStrength: true, DepthOfField: true };

  var rest = flat.settings.map(function (s) {
    var c = {}; Object.keys(s).forEach(function (k) { c[k] = s[k]; });
    if (noRaiseInVr[c.key]) c.noRaise = true;
    return c;
  });

  var table = {
    testedAgainst: '',            // empty until Sean has validated the weights in a headset
    updated: '2026-11-23',
    vr: true,
    settings: vrOnly.concat(rest)
  };
  root.SETTINGS_TABLE_IRACING_VR = table;
  if (isNode) module.exports = table;
})(typeof self !== 'undefined' ? self : this);
