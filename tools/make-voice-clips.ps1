<#
.SYNOPSIS
  Cuts ONE recording of your voice into the spoken capture cues Dialed plays.

.DESCRIPTION
  Record the phrases in this order with a clear pause (about a second) between them:
      1  "Capture about to start"     -> announce.wav   (played when the countdown begins)
      2  "3"                           -> 3.wav
      3  "2"                           -> 2.wav
      4  "1"                           -> 1.wav
      5  "Start"                       -> start.wav      (played when recording begins)
  Optional, if you want them (say them after "Start", same pauses):
      6  "Capture complete"            -> done.wav
      7  "Capture cancelled"           -> cancel.wav
      8  "Capture failed"              -> error.wav
  Any clip you do not make keeps the normal beep. The input can be a WAV, MP3, M4A or even your welcome video: ffmpeg reads the audio.
  The tool normalises the loudness once across the whole recording, finds the pauses, and writes 16-bit mono WAV files into assets\sounds.

.EXAMPLE
  .\tools\make-voice-clips.ps1 -In "D:\Videos\welcome-take.mp4" -Preview     # only shows the phrases it found
  .\tools\make-voice-clips.ps1 -In "D:\Videos\voice-cues.wav"                # writes the clips
  .\tools\make-voice-clips.ps1 -In voice-cues.wav -SilenceDb -40 -MinGap 0.3  # if it finds too few or too many phrases
#>
param(
  [Parameter(Mandatory)][string]$In,
  [string]$Out = (Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\sounds'),
  [double]$SilenceDb = -35,   # quieter than this counts as a pause (use -40 or -45 for a noisy room)
  [double]$MinGap = 0.35,     # a pause must last this many seconds to separate two phrases
  [string]$Ffmpeg = '',
  [switch]$Preview
)
$ErrorActionPreference = 'Stop'
$names = 'announce', '3', '2', '1', 'start', 'done', 'cancel', 'error'
if (-not (Test-Path $In)) { throw "Cannot find $In" }
if (-not $Ffmpeg) { $c = Get-Command ffmpeg -ErrorAction SilentlyContinue; if ($c) { $Ffmpeg = $c.Source } }
if (-not $Ffmpeg -or -not (Test-Path $Ffmpeg)) { throw "ffmpeg was not found. Install it or pass -Ffmpeg <path to ffmpeg.exe>." }
$ci = [Globalization.CultureInfo]::InvariantCulture
$tmp = Join-Path $env:TEMP ("voice-" + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $tmp | Out-Null
function Run-Ffmpeg([string[]]$ffArgs, [string]$errFile) {
  $ffArgs = $ffArgs | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } } # Start-Process joins arguments with spaces, so paths such as "D:\OBS Videos\..." need quotes
  $p = Start-Process -FilePath $Ffmpeg -ArgumentList $ffArgs -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile
  if ($p.ExitCode -ne 0) { throw "ffmpeg failed (exit $($p.ExitCode)): " + ((Get-Content $errFile -Tail 6) -join ' | ') }
}
try {
  # 1. one clean copy of the whole recording: mono, 44.1 kHz, 16-bit. (Volume is evened out per clip at the end: doing it first would lift the
  #    quiet gaps between phrases and make them look like speech.)
  $norm = Join-Path $tmp 'all.wav'
  Run-Ffmpeg @('-y', '-hide_banner', '-i', $In, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', $norm) (Join-Path $tmp 'norm.log')
  # 2. find the pauses
  $detLog = Join-Path $tmp 'detect.log'
  Run-Ffmpeg @('-hide_banner', '-nostats', '-i', $norm, '-af', ("silencedetect=noise={0}dB:d={1}" -f $SilenceDb.ToString($ci), $MinGap.ToString($ci)), '-f', 'null', '-') $detLog
  $text = Get-Content $detLog -Raw
  $dur = 0.0; if ($text -match 'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)') { $dur = [int]$Matches[1] * 3600 + [int]$Matches[2] * 60 + [double]::Parse($Matches[3], $ci) }
  $starts = [regex]::Matches($text, 'silence_start:\s*(-?\d+(?:\.\d+)?)') | ForEach-Object { [double]::Parse($_.Groups[1].Value, $ci) }
  $ends = [regex]::Matches($text, 'silence_end:\s*(-?\d+(?:\.\d+)?)') | ForEach-Object { [double]::Parse($_.Groups[1].Value, $ci) }
  # 3. speech = the stretches between pauses
  $segs = @(); $cursor = 0.0
  for ($i = 0; $i -lt $starts.Count; $i++) {
    $s = [math]::Max(0.0, [double]$starts[$i])   # 0.0, not 0: with a whole number PowerShell picks the integer overload and rounds the time
    if ($s - $cursor -ge 0.12) { $segs += [pscustomobject]@{ Start = $cursor; End = $s } }
    if ($i -lt $ends.Count) { $cursor = $ends[$i] }
  }
  if ($dur - $cursor -ge 0.12 -and ($ends.Count -ge $starts.Count)) { $segs += [pscustomobject]@{ Start = $cursor; End = $dur } }
  "Found $($segs.Count) phrase(s) in $([math]::Round($dur,1)) s:"
  for ($i = 0; $i -lt $segs.Count; $i++) { $label = if ($i -lt $names.Count) { $names[$i] } else { '(extra)' }; "  {0,2}. {1,6:N2} s to {2,6:N2} s  ({3:N2} s long)  -> {4}" -f ($i + 1), $segs[$i].Start, $segs[$i].End, ($segs[$i].End - $segs[$i].Start), $label }
  if ($segs.Count -lt 5 -or $segs.Count -gt $names.Count) {
    throw "Expected 5 to $($names.Count) phrases but found $($segs.Count). Leave about a second of quiet between phrases and little noise, or adjust -SilenceDb (try -40 or -30) and -MinGap (try 0.25 to 0.6)."
  }
  if ($Preview) { "Preview only: nothing written. Check the order above, then run again without -Preview."; return }
  # 4. cut each phrase with a little room either side
  New-Item -ItemType Directory -Force $Out | Out-Null
  for ($i = 0; $i -lt $segs.Count; $i++) {
    $from = [math]::Max(0.0, [double]($segs[$i].Start - 0.06)); $to = [math]::Min([double]$dur, [double]($segs[$i].End + 0.12))
    $dest = Join-Path $Out ($names[$i] + '.wav'); $raw = Join-Path $tmp "raw$i.wav"
    Run-Ffmpeg @('-y', '-hide_banner', '-i', $norm, '-ss', $from.ToString($ci), '-to', $to.ToString($ci), '-c:a', 'pcm_s16le', $raw) (Join-Path $tmp "cut$i.log")
    # even out the volume: raise each clip so its loudest point sits just under full scale (never more than +24 dB, so a silent clip is not turned into noise)
    Run-Ffmpeg @('-hide_banner', '-nostats', '-i', $raw, '-af', 'volumedetect', '-f', 'null', '-') (Join-Path $tmp "vol$i.log")
    $gain = 0.0; if ((Get-Content (Join-Path $tmp "vol$i.log") -Raw) -match 'max_volume:\s*(-?\d+(?:\.\d+)?) dB') { $gain = [math]::Min(24.0, [math]::Max(-12.0, -1.0 - [double]::Parse($Matches[1], $ci))) }
    Run-Ffmpeg @('-y', '-hide_banner', '-i', $raw, '-af', ("volume={0}dB" -f $gain.ToString($ci)), '-c:a', 'pcm_s16le', $dest) (Join-Path $tmp "fin$i.log")
    "wrote {0}  ({1:N2} s, volume {2:+0.0;-0.0} dB)" -f $dest, ($to - $from), $gain
  }
  "Done. Dialed uses these clips the next time it starts. Missing clips keep the normal beep."
}
finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
