/* Settings Sean can change without touching the app code. */
window.APP_CONFIG = {
  // The welcome video that plays automatically the first time the app opens.
  //   kind: 'youtube' -> source is the video ID, for example 'dQw4w9WgXcQ' (small app, update the video any time)
  //   kind: 'file'    -> source is a path inside the app, for example 'assets/intro.mp4' (works offline, makes the app bigger)
  // Leave source empty to switch the welcome video off.
  // Drop the video at  iRacingGraphicsTuner\assets\intro.mp4  (H.264 MP4). The welcome stays off until that file exists.
  intro: { kind: 'file', source: 'assets/intro.mp4', title: 'Welcome to Dialed' },

  // Where people send ideas and feedback. Opens in their normal browser. Leave empty to hide the Ideas button.
  // The website's update-email sign-up (a Kit form) and the Ko-fi tip jar. Leave empty to hide the matching button or prompt.
  updatesUrl: 'https://f1gamerdad-labs.github.io/dialed/#updates',
  tipUrl: 'https://ko-fi.com/f1gamerdad',
  // Optional: let players share an anonymous before/after result with you. Make a Google Form with ONE long-answer question, then paste its formResponse
  // address and that question's entry id here. While resultsUrl is empty the Share my result button stays hidden.
  resultsUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfWrwmZ3n3KqlGoRuGACsLJFmrn2-wdOaeTTr9InDtzMNQjmQ/formResponse',
  resultsField: 'entry.32374642',

  suggestionsUrl:'https://docs.google.com/forms/d/e/1FAIpQLSfWQH6XsDcVcv5LVPNrQJKNKbrWUwWSaYq1-rCQd3Aq7Z3zEA/viewform'
};
