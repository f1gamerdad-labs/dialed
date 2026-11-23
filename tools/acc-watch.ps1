<#
  Watches ACC's menuSettings.json and prints (and logs) every graphics setting that changes.
  Use: run this, then in ACC (Options > Video > Graphics, preset set to Custom) change ONE slider at a time and save/leave the page.
  Each change shows as  Key: old -> new, so we can map the slider names to the numbers in the file.
  Log: tools\acc-watch-output\acc-changes.log
#>
$file = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Assetto Corsa Competizione\Config\menuSettings.json'
$out = Join-Path $PSScriptRoot 'acc-watch-output'; New-Item -ItemType Directory -Force $out | Out-Null
$log = Join-Path $out 'acc-changes.log'

function Read-Gfx($path) {
    $h = [ordered]@{}
    for ($i = 0; $i -lt 5; $i++) { try { $j = Get-Content $path -Raw | ConvertFrom-Json; break } catch { Start-Sleep -Milliseconds 300 } }
    if (-not $j) { return $h }
    # both graphics blocks, plus the texture switches that sit at the top level
    foreach ($k in 'texCap', 'texDDS', 'texMips', 'carsPreloadMode', 'carsPreloadLimitMB') { if ($null -ne $j.$k) { $h[$k] = [string]$j.$k } }
    foreach ($block in 'graphicOptions', 'customGraphicOptions') {
        if (-not $j.$block) { continue }
        foreach ($p in $j.$block.PSObject.Properties) {
            if ($p.Value -is [System.Management.Automation.PSCustomObject]) { foreach ($q in $p.Value.PSObject.Properties) { $h["$block.$($p.Name).$($q.Name)"] = [string]$q.Value } }
            else { $h["$block.$($p.Name)"] = [string]$p.Value }
        }
    }
    $h
}

$prev = Read-Gfx $file
"Watching $file ($($prev.Count) graphics values). Change one ACC slider at a time. Ctrl+C to stop." | Tee-Object -FilePath $log -Append
$last = (Get-Item $file).LastWriteTimeUtc
while ($true) {
    Start-Sleep -Milliseconds 700
    $t = (Get-Item $file).LastWriteTimeUtc
    if ($t -eq $last) { continue }
    $last = $t; Start-Sleep -Milliseconds 400
    $cur = Read-Gfx $file
    $diffs = foreach ($k in $cur.Keys) { if ($prev[$k] -ne $cur[$k]) { "  {0}: {1} -> {2}" -f $k, $prev[$k], $cur[$k] } }
    $stamp = Get-Date -Format 'HH:mm:ss'
    if ($diffs) { "[$stamp] changed:`n" + ($diffs -join "`n") | Tee-Object -FilePath $log -Append } else { "[$stamp] file saved, no graphics value changed" | Tee-Object -FilePath $log -Append }
    $prev = $cur
}
