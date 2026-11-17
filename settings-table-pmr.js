/* Project Motor Racing settings table. THIS IS THE FILE TO UPDATE WHEN PMR PATCHES.

   Same fields as settings-table-lmu.js. Every setting is a <param name="SettingsVideoGraphics..." value="N"/> line in
   Documents\My Games\ProjectMotorRacing\savegame1\settings.xml (section 'PMR').

   WHAT IS KNOWN (checked 2026-11-18 against Sean's in-game Graphics and Advanced Graphics pages): each value is the position of the
   choice in that setting's own menu list, counting from 1, and a higher number is always a higher-quality choice. "Off" is always 1.
   Seen on this PC: Shadow Quality 3 = High, Shadow Distance Quality 2 = Medium, Grass Quality 3 = Medium, SSAO Quality 4 = Medium,
   Atmosphere Quality 2 = Medium, Volumetric Fog Quality 3 = High, Texture Resolution 1 = Low, Texture Filtering 4 = Aniso 2x,
   and every on/off effect 1 = Off.
   WHAT IS NOT KNOWN: the names of the other positions, and how many there are. So every entry is noRaise (only ever lowered, one
   step at a time, which always lands on a real menu choice), names of unseen positions are shown as "Step n", and every entry is
   `unverified` (low confidence). The cpu/gpu/vram/visual numbers are estimates. */
(function (root) {
  var S = 'PMR';
  function steps(known) { var out = []; for (var i = 1; i <= 8; i++) out.push(known[i] || ('Step ' + i)); return out; }
  var LV = [1, 2, 3, 4, 5, 6, 7, 8];
  var OFF = steps({ 1: 'Off' });
  function e(key, name, cpu, gpu, vram, visual, known, min) {
    return { section: S, key: 'SettingsVideoGraphics' + key, name: name, cpu: cpu, gpu: gpu, vram: vram, visual: visual,
      levels: LV, labels: steps(known), min: min || 1, noRaise: true, unverified: true };
  }

  root.SETTINGS_TABLE_PMR = {
    testedAgainst: 'Project Motor Racing (positions checked in the game menu; names of unseen positions unknown, so low confidence)',
    updated: '2026-11-18',
    exact: true,
    settings: [
      e('ShadowQuality', 'Shadow quality', 1, 3, 2, 3, { 3: 'High' }, 2),
      e('ShadowDistanceQuality', 'Shadow distance quality', 1, 2, 1, 2, { 2: 'Medium' }),
      e('SSAOQuality', 'SSAO (ambient occlusion) quality', 0, 2, 0, 2, { 1: 'Off', 4: 'Medium' }),
      e('VolumetricFogQuality', 'Volumetric fog quality', 0, 2, 1, 1, { 3: 'High' }),
      e('AtmosphereQuality', 'Atmosphere quality', 0, 2, 0, 1, { 2: 'Medium' }),
      e('GrassQuality', 'Grass quality', 1, 2, 1, 1, { 3: 'Medium' }),
      e('TextureResolution', 'Texture resolution', 0, 1, 3, 2, { 1: 'Low' }),
      e('TextureFiltering', 'Texture filtering', 0, 1, 0, 1, { 4: 'Aniso 2x' }, 3),
      { section: S, key: 'SettingsVideoGraphicsScreenSpaceReflections', name: 'Screen space reflections', cpu: 0, gpu: 2, vram: 0, visual: 2, levels: LV, labels: OFF, noRaise: true, unverified: true },
      { section: S, key: 'SettingsVideoGraphicsScreenSpaceShadows', name: 'Screen space shadows', cpu: 0, gpu: 2, vram: 0, visual: 1, levels: LV, labels: OFF, noRaise: true, unverified: true },
      { section: S, key: 'SettingsVideoGraphicsCloudShadows', name: 'Cloud shadows', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: LV, labels: OFF, noRaise: true, unverified: true },
      { section: S, key: 'SettingsVideoGraphicsLensFlareQuality', name: 'Lens flare quality', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: LV, labels: OFF, noRaise: true, unverified: true },
      { section: S, key: 'SettingsVideoGraphicsDoF', name: 'Depth of field', cpu: 0, gpu: 1, vram: 0, visual: 1, levels: LV, labels: OFF, noRaise: true, unverified: true }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SETTINGS_TABLE_PMR;
})(typeof self !== 'undefined' ? self : this);
