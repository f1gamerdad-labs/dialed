/* "Watch the video" links on each recommendation. By default each link searches YouTube for F1GamerDad's coverage of that setting.
   To point a setting at one specific video, add it to APP_CONFIG.learn in config.js, keyed by the setting's key (or "simId:key"):
     learn: { 'MaxCarsToDraw': 'https://www.youtube.com/watch?v=VIDEOID&t=95s' }                                                      */
(function (root) {
  'use strict';
  var SIM_WORD = { iracing: 'iRacing', lmu: 'Le Mans Ultimate', ams2: 'Automobilista 2', acc: 'ACC', acevo: 'AC EVO', raceroom: 'RaceRoom', pmr: 'Project Motor Racing', beamng: 'BeamNG' };

  function url(change, simId, overrides) {
    overrides = overrides || {};
    var own = overrides[simId + ':' + change.key] || overrides[change.key];
    if (own && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(own)) return own;      // only YouTube links are honoured
    var q = 'F1GamerDad ' + (SIM_WORD[simId] || '') + ' ' + (change.name || change.key) + ' graphics setting';
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q.replace(/\s+/g, ' ').trim());
  }
  var api = { url: url };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.TunerLearn = {
    url: function (change, simId) { return url(change, simId, (root.APP_CONFIG && root.APP_CONFIG.learn) || {}); },
    open: function (u) { var wv = root.chrome && root.chrome.webview; if (wv) wv.postMessage({ type: 'openUrl', url: u }); else root.open(u, '_blank', 'noopener'); }
  };
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-learn]'); if (!a) return;
    e.preventDefault(); root.TunerLearn.open(a.getAttribute('data-learn'));
  });
})(typeof self !== 'undefined' ? self : this);
