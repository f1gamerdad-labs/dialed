Spoken capture cues for Dialed
==============================

Put short WAV files here and Dialed speaks them instead of beeping:

  announce.wav   "Capture about to start"   played when the countdown begins (needs a countdown of 6 seconds or more)
  3.wav          "3"                         played with 3 seconds to go
  2.wav          "2"
  1.wav          "1"
  start.wav      "Start"                     played the moment recording begins
  done.wav       "Capture complete"          optional
  cancel.wav     "Capture cancelled"         optional
  error.wav      "Capture failed"            optional

Any file that is missing, or is not a normal WAV, keeps the plain beep, so you can add them one at a time.

Easiest way: record all the phrases in one take, in that order, with about a second of quiet between them, then run:

  tools\make-voice-clips.ps1 -In <your recording, any audio or video file> -Preview     (shows what it found)
  tools\make-voice-clips.ps1 -In <your recording>                                       (writes the files into this folder)

The recording can be the audio of your welcome video. If it finds too few or too many phrases, try -SilenceDb -40 (quieter room) or -SilenceDb -30, and -MinGap 0.25 to 0.6.

Files are plain 16-bit WAV so Windows can play them without extra software. Keep each one short (under 3 seconds).
