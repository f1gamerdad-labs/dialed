/* Settings Sean can change without touching the app code. */
window.APP_CONFIG = {
  // The welcome video that plays automatically the first time the app opens.
  //   kind: 'youtube' -> source is the video ID, for example 'dQw4w9WgXcQ' (small app, update the video any time)
  //   kind: 'file'    -> source is a path inside the app, for example 'assets/intro.mp4' (works offline, makes the app bigger)
  // Leave source empty to switch the welcome video off.
  // Drop the video at  iRacingGraphicsTuner\assets\intro.mp4  (H.264 MP4). The welcome stays off until that file exists.
  intro: { kind: 'file', source: 'assets/intro.mp4', title: 'Welcome to Dialed' },

  // Where people send ideas and feedback. Opens in their normal browser. Leave empty to hide the Ideas button.
  suggestionsUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfWQH6XsDcVcv5LVPNrQJKNKbrWUwWSaYq1-rCQd3Aq7Z3zEA/viewform'
};
