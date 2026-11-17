/* "What you will see": a plain-English line for each suggested change, saying what looks different on screen when a setting goes down
   (or what you gain when it goes up). Matched on the setting's key and name, so it works for every sim; the first rule that matches wins,
   so put the specific rules (shadow distance) before the general ones (shadows). Edit the wording here. */
(function (root) {
  var RULES = [
    [/frame.?(rate|limit|cap)|max.?framerate|fpslimit|vsync/i,
      'No change to how the game looks: this only changes the frame rate cap.', 'No change to how the game looks: this only changes the frame rate cap.'],
    [/max.?cars.?drawn$|max cars drawn(?! in)|max.?visible.?(cars|vehicles)|maxvisible/i,
      'Fewer cars are drawn at once, so cars far ahead or behind can disappear until you get closer.', 'More cars stay visible at once, further ahead and behind.'],
    [/your car/i,
      'Your own car looks a little simpler, mainly in replays and outside views.', 'More detail on your own car in replays and outside views.'],
    [/pit (object|crew)|pit.?crew|pitobj/i,
      'Fewer or simpler objects and crew in the pit lane.', 'Busier, more detailed pit lane.'],
    [/grandstand/i, 'Grandstands look simpler.', 'More detailed grandstands.'],
    [/event detail|event.?detail/i, 'Fewer trackside event objects such as banners, tents and flags.', 'More trackside event objects such as banners and tents.'],
    [/tv display|live tv/i, 'Trackside screens stop showing live pictures.', 'Trackside screens show live pictures.'],
    [/rain effect/i, 'Rain on the screen and spray from cars look simpler.', 'More detailed rain on the screen and spray.'],
    [/shader/i, 'Materials look flatter: less detailed lighting on car paint and the track surface.', 'Richer lighting on car paint and the track surface.'],
    [/\bhdr\b/i, 'Bright and dark areas lose some range, so sunsets and shade look flatter.', 'More range between bright and dark areas.'],
    [/displacement/i, 'The track surface and kerbs look flatter up close, with less 3D bump detail.', 'More 3D bump detail on the track surface and kerbs.'],
    [/car paint/i, 'Car paint looks slightly less detailed up close.', 'More detailed car paint up close.'],
    [/wind|crowd motion/i, 'Crowds, flags and trees move less.', 'Crowds, flags and trees move more naturally.'],
    [/resolution.?(scale|quality)|render.?scale|pixel.?density|supersampl|resolutionscaling/i,
      'The whole picture gets a little softer: text, kerbs and distant cars lose some sharpness.', 'A sharper, crisper picture overall.'],
    [/shadow.?(distance|range|dist)/i,
      'Shadows appear closer to the car, so shadows further down the track pop in later.', 'Shadows reach further down the track.'],
    [/shadow|contact.?shadow|screen.?space.?shadow/i,
      'Shadows look softer, blockier or slightly flickery, especially under cars and around the cockpit.', 'Cleaner, sharper shadows around the car and track.'],
    [/aniso|texture.?filter/i,
      'The track surface and kerbs look blurrier in the distance and at shallow angles.', 'Sharper track surface and kerbs in the distance.'],
    [/texture|tex(ture)?res/i,
      'Surfaces look blurrier up close: liveries, signs, decals and the cockpit lose fine detail.', 'Sharper liveries, signs and cockpit detail up close.'],
    [/anti.?alias|msaa|smaa|fxaa|taa|\baa\b|aliasing/i,
      'More jagged edges and shimmer on fences, barriers, wires and car outlines.', 'Smoother edges with less shimmer on fences and car outlines.'],
    [/mirror/i,
      'Your mirrors show less detail, update less often or show cars later.', 'More detailed, smoother mirrors.'],
    [/reflect|envmap|env.?map|cubemap|windscreen/i,
      'Car paint, windows and wet track reflect less of the world, and reflections update less often.', 'Richer reflections on paint, glass and wet track.'],
    [/particle|smoke|spray|dust|debris/i,
      'Less tyre smoke, dust and rain spray behind cars.', 'More tyre smoke, dust and spray.'],
    [/grass|foliage|tree|plant|vegetation/i,
      'Fewer, simpler trees and less grass beside the track.', 'Fuller trees and grass beside the track.'],
    [/crowd|spectator|marshal/i,
      'Fewer or simpler spectators and marshals.', 'More detailed crowds and marshals.'],
    [/opponent|visible.?(car|vehicle)|cars?visible|max.?cars|car.?lod|car.?detail|vehicle.?detail/i,
      'Other cars look simpler further away, or only appear in full detail when they get closer.', 'Other cars keep full detail further away.'],
    [/light|clustered|headlight/i,
      'Fewer lights cast light or shadows, so night running and tunnels look flatter.', 'More lights glow and cast shadows, especially at night.'],
    [/ssao|ambient.?occlusion|\bao\b/i,
      'Less soft shading in corners and under cars, so the scene looks a bit flatter.', 'More depth from soft shading in corners and under cars.'],
    [/cloud|sky|fog|volumetric|atmosphere|weather/i,
      'The sky, clouds and haze look simpler.', 'Richer sky, clouds and haze.'],
    [/bloom|glare|flare|motion.?blur|\bdof\b|depth.?of.?field|post|heat|haze|sharpen|effects?/i,
      'Fewer camera effects such as glow, glare and blur, so the image looks plainer.', 'More camera effects such as glow, glare and blur.'],
    [/view.?distance|draw.?distance|lod|level.?of.?detail|mesh|object|terrain|track.?detail|world|scenery|detail/i,
      'Distant scenery switches to simpler versions sooner, and you may notice objects popping in.', 'Scenery keeps its detail further away, with less pop-in.'],
    [/cockpit|interior|dash/i,
      'The cockpit and dashboard lose some fine detail.', 'More cockpit and dashboard detail.']
  ];
  var FALLBACK = ['A small visual change. Check it on track and put it back if you notice it.', 'A small visual improvement.'];

  // c: a recommended change { key, name, dir } where dir is 'down', 'up' or 'revert'
  function describe(c) {
    var text = (c.key || '') + ' ' + (c.name || '');
    var up = c.dir === 'up';
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(text)) return up ? RULES[i][2] : RULES[i][1];
    return up ? FALLBACK[1] : FALLBACK[0];
  }

  var api = { describe: describe };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TunerLooks = api;
})(typeof self !== 'undefined' ? self : this);
