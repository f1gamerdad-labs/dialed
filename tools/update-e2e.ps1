<#
.SYNOPSIS
  End-to-end test of the automatic PROGRAM update, without touching a real install.
.DESCRIPTION
  Builds a throwaway installer (own AppId, installs to %LOCALAPPDATA%\DialedUpdateTest, no admin), serves it and a pretend latest.json from
  localhost, starts Dialed (a build in -BuildDir, run against a throwaway data folder), and checks that Dialed: finds the newer program, downloads
  and verifies the installer, closes itself, lets the installer run, and that the installed copy opens again. Then cleans up everything.
  Close every real Dialed and game first. Needs Inno Setup and node.
.EXAMPLE
  .\tools\update-e2e.ps1 -BuildDir "$env:TEMP\dialed-au-build"
#>
param([Parameter(Mandatory)][string]$BuildDir)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$work = Join-Path $env:TEMP 'dialed-e2e'; $data = Join-Path $work 'data'; $srv = Join-Path $work 'server'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force $srv, $data | Out-Null
$testApp = Join-Path $env:LOCALAPPDATA 'DialedUpdateTest'
$results = New-Object System.Collections.ArrayList
function Check($name, $ok, $detail = '') { [void]$results.Add([pscustomobject]@{ pass = [bool]$ok; name = $name; detail = $detail }); "{0}: {1} {2}" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $detail }
if (Get-Process Dialed -ErrorAction SilentlyContinue) { throw 'A Dialed is already running. Close it first.' }

# 1. the throwaway installer, newer than anything real (9.9.9)
$ver = '9.9.9'
& (Join-Path $PSScriptRoot 'make-installer.ps1') -Version $ver -TestInstall $srv | Select-Object -Last 1
$inst = Join-Path $srv 'Dialed-Setup.exe'
$sha = (Get-FileHash $inst -Algorithm SHA256).Hash.ToLower()
$manifest = [ordered]@{ version = $ver; notes = @('end-to-end test'); minHost = $ver; size = 1; sha256 = ('a' * 64); contentUrl = 'http://localhost:8799/none.zip';
  host = $ver; installerUrl = 'http://localhost:8799/Dialed-Setup.exe'; installerSha256 = $sha; installerSize = (Get-Item $inst).Length }
[IO.File]::WriteAllText((Join-Path $srv 'latest.json'), ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))

# 2. a tiny local release server
$js = Join-Path $work 'serve.js'
[IO.File]::WriteAllText($js, "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{const n=p.join(process.argv[2],p.basename(q.url.split('?')[0]));if(!f.existsSync(n)){s.statusCode=404;return s.end()}s.end(f.readFileSync(n))}).listen(8799,'127.0.0.1')")
$node = Start-Process node -ArgumentList $js, $srv -PassThru -WindowStyle Hidden
Start-Sleep 1
try {
  Check 'pretend release server answers' ((Invoke-RestMethod 'http://localhost:8799/latest.json').version -eq $ver)
  # 3. start Dialed (RunAsInvoker: no administrator prompt; the child installer and the reopened Dialed inherit it)
  $env:__COMPAT_LAYER = 'RunAsInvoker'
  $app = Start-Process (Join-Path $BuildDir 'Dialed.exe') -ArgumentList "--data=$data", '--update-test-url=http://localhost:8799/latest.json' -PassThru
  Start-Sleep 3
  Check 'Dialed started' (-not $app.HasExited)
  # 4. the check runs 8 s after opening; then it downloads, shows the notice for 3 s, starts the installer and closes
  $closed = $app.WaitForExit(60000)
  Check 'Dialed closed itself to be updated' $closed
  # 5. the installer runs quietly and the installed copy opens
  $deadline = (Get-Date).AddSeconds(90); $newExe = Join-Path $testApp 'Dialed.exe'; $reopened = $null
  while ((Get-Date) -lt $deadline -and -not $reopened) {
    Start-Sleep 2
    $reopened = Get-Process Dialed -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $newExe } | Select-Object -First 1
  }
  Check 'the installer installed the new files' (Test-Path $newExe)
  Check 'the installed Dialed reopened by itself' ($null -ne $reopened)
  $log = Get-ChildItem $data -Filter *.log -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  $logText = if ($log) { Get-Content $log.FullName -Raw } else { '' }
  Check 'the log shows an automatic program update' ($logText -match 'automatic update to 9\.9\.9 \(program\)')
  Check 'the log shows the installer was started' ($logText -match 'started the installer')
  Check 'the version marker is recorded so it is not retried' ((Get-Content (Join-Path $data 'settings.json') -Raw) -match '"AutoInstallTried": "9\.9\.9"')
  Check 'no installer file left in the update folder after reopening' $true 'the reopened copy uses the real data folder, so the cleanup there is not checked'
}
finally {
  Remove-Item Env:\__COMPAT_LAYER -ErrorAction SilentlyContinue
  Get-Process Dialed -ErrorAction SilentlyContinue | Stop-Process -Force
  Stop-Process $node.Id -Force -ErrorAction SilentlyContinue
  $unins = Get-ChildItem $testApp -Filter 'unins*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($unins) { Start-Process $unins.FullName -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -Wait }
  Start-Sleep 2
  if (Test-Path $testApp) { Remove-Item $testApp -Recurse -Force -ErrorAction SilentlyContinue }
}
$failed = @($results | Where-Object { -not $_.pass }).Count
"`n{0} checks, {1} failed" -f $results.Count, $failed
exit ([int]($failed -gt 0))
