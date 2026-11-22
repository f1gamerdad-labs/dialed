<#
  Watches RaceRoom's graphics_options.xml and prints (and logs) every setting that changes.
  Use: run this, then in RaceRoom change ONE graphics option at a time, then Apply / leave the options screen.
  Each change shows as  setting: old -> new, with a timestamp, so we can map the in-game names and list positions to numbers.
  Say out loud (or type to Claude) what you changed and to what, so each line can be matched to the menu.
  Note: RaceRoom may only write the file when you leave the options screen or close the game. If nothing shows, back out of the menu and look again.
  Log: tools\raceroom-watch-output\raceroom-changes.log
#>
$file = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'My Games\SimBin\RaceRoom Racing Experience\UserData\graphics_options.xml'
$out = Join-Path $PSScriptRoot 'raceroom-watch-output'; New-Item -ItemType Directory -Force $out | Out-Null
$log = Join-Path $out 'raceroom-changes.log'

function Read-Props($path) {
    $h = [ordered]@{}
    $x = $null
    for ($i = 0; $i -lt 6; $i++) { try { $x = [xml](Get-Content $path -Raw); break } catch { Start-Sleep -Milliseconds 300 } }
    if (-not $x) { return $h }
    foreach ($n in $x.DocumentElement.ChildNodes) { if ($n.NodeType -eq 'Element') { $h[$n.Name] = $n.InnerText } }
    $h
}

if (-not (Test-Path $file)) { throw "Cannot find $file. Start RaceRoom once so it creates the file." }
$prev = Read-Props $file
"Watching $file ($($prev.Count) settings). Change one RaceRoom option at a time. Ctrl+C to stop." | Tee-Object -FilePath $log -Append
$last = (Get-Item $file).LastWriteTimeUtc
while ($true) {
    Start-Sleep -Milliseconds 700
    $t = (Get-Item $file).LastWriteTimeUtc
    if ($t -eq $last) { continue }
    $last = $t; Start-Sleep -Milliseconds 500
    $cur = Read-Props $file
    $diffs = foreach ($k in $cur.Keys) { if ($prev[$k] -ne $cur[$k]) { "  {0}: {1} -> {2}" -f $k, $prev[$k], $cur[$k] } }
    $stamp = Get-Date -Format 'HH:mm:ss'
    if ($diffs) { "[$stamp] changed:`n" + ($diffs -join "`n") | Tee-Object -FilePath $log -Append } else { "[$stamp] file saved, no setting changed" | Tee-Object -FilePath $log -Append }
    $prev = $cur
}
