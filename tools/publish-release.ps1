<#
.SYNOPSIS
  Builds a Dialed page/settings update and (optionally) publishes it as a GitHub release.

.DESCRIPTION
  Dialed checks  https://github.com/<owner>/<repo>/releases/latest/download/latest.json  for a newer version.
  This script creates the two files that release needs:
    Dialed-content-<version>.zip   the page, design and settings tables (no program files)
    latest.json                    version, notes, download address, SHA-256 and the minimum program version
  then uploads them with the GitHub CLI (gh). Use -DryRun to build and inspect without publishing.

.EXAMPLE
  .\tools\publish-release.ps1 -Version 0.2.0 -Notes "LMU settings table updated","New round-saved screen" -DryRun
  .\tools\publish-release.ps1 -Version 0.2.0 -Notes "LMU settings table updated" -Repo yourname/dialed
#>
param(
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
  [string[]]$Notes = @(),
  [string]$Repo = '',
  [string]$MinHost = '0.3.0',   # the oldest Dialed.exe this page works with (0.2.0 added Report a problem and the log). Raise it only when the page needs a newer program
  [string]$Installer = '',     # optional: path to Dialed-Setup.exe (tools\make-installer.ps1). It is attached to the release too, so the website can link to latest/download/Dialed-Setup.exe
  [string]$Package = '',        # path to Dialed-win-x64.zip. ALWAYS pass it: the website's Download button points at "latest", so every release must carry the full package
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$out  = Join-Path $root 'release'

# 1. which files ship as "the page": exactly the web\ files the app project copies
$csproj = Get-Content (Join-Path $root 'app\TunerApp.csproj') -Raw
$links  = [regex]::Matches($csproj, 'Include="(?<src>[^"]+)"\s+(?:Exclude="[^"]*"\s+)?Link="web\\(?<dst>[^"]+)"') |
          Where-Object { $_.Groups['dst'].Value -notmatch 'RecursiveDir' }
$stage = Join-Path $env:TEMP "dialed-release-$Version"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($l in $links) { Copy-Item (Join-Path (Join-Path $root 'app') $l.Groups['src'].Value) (Join-Path $stage $l.Groups['dst'].Value) -Force }
# the assets folder is a wildcard in the project file
Copy-Item (Join-Path $root 'assets') (Join-Path $stage 'assets') -Recurse -Force
Remove-Item (Join-Path $stage 'assets\app.ico') -ErrorAction SilentlyContinue   # the icon belongs to the program, not the page
# Page updates never carry big media or program files, except the welcome video: once an update is installed the app uses the downloaded page
# instead of the bundled one, so a video left out here would disappear after "Update now".
Get-ChildItem $stage -Recurse -Include *.mp4,*.exe,*.dll | Where-Object { $_.Name -ne 'intro.mp4' } | Remove-Item -Force

# 2. stamp the version
$utf8 = New-Object System.Text.UTF8Encoding($false)   # UTF-8 WITHOUT a byte-order mark: Windows PowerShell's -Encoding UTF8 adds one, and it can upset JSON readers
[IO.File]::WriteAllText((Join-Path $stage 'version.json'), ((@{ version = $Version; minHost = $MinHost } | ConvertTo-Json) + "`n"), $utf8)
Copy-Item (Join-Path $stage 'version.json') (Join-Path $root 'version.json') -Force

# 3. zip and fingerprint
New-Item -ItemType Directory -Force $out | Out-Null
$zip = Join-Path $out "Dialed-content-$Version.zip"
if (Test-Path $zip) { Remove-Item $zip }
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip)
$sha  = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
$size = (Get-Item $zip).Length
if ($size -gt 35MB) { throw "The page update is $([int]($size/1MB)) MB, which is more than the app will accept (40 MB). Check for stray large files in $stage" }

# 4. the manifest the app reads
$repoName = if ($Repo) { $Repo } else { 'OWNER/REPO' }
$manifest = [ordered]@{
  version = $Version; notes = $Notes; minHost = $MinHost; size = $size; sha256 = $sha
  contentUrl = "https://github.com/$repoName/releases/download/v$Version/Dialed-content-$Version.zip"
}
# Program updates: the in-app updater downloads this release's installer (checked against this SHA-256) when the program itself is newer than the one running.
# "host" is the program version this release ships with (HostVersion in app\Update.cs); a page-only release carries the same host as before.
if ($Installer -and (Test-Path $Installer)) {
  if ((Split-Path $Installer -Leaf) -ne 'Dialed-Setup.exe') { throw "The installer must be named Dialed-Setup.exe (the website links to that exact name)." }
  $hostVer = [regex]::Match((Get-Content (Join-Path $root 'app\Update.cs') -Raw), 'HostVersion\s*=\s*"(\d+\.\d+\.\d+)"').Groups[1].Value
  if (-not $hostVer) { throw "Could not read HostVersion from app\Update.cs." }
  $manifest['host'] = $hostVer
  $manifest['installerUrl'] = "https://github.com/$repoName/releases/download/v$Version/Dialed-Setup.exe"
  $manifest['installerSha256'] = (Get-FileHash $Installer -Algorithm SHA256).Hash.ToLower()
  $manifest['installerSize'] = (Get-Item $Installer).Length
}
$manifestPath = Join-Path $out 'latest.json'
[IO.File]::WriteAllText($manifestPath, (($manifest | ConvertTo-Json) + "`n"), $utf8)

"Built $zip  ($([math]::Round($size/1KB)) KB)"
"SHA-256  $sha"
"Manifest $manifestPath"
Get-Content $manifestPath

if ($DryRun) { "`nDry run: nothing was published."; return }
if (-not $Repo) { throw "Pass -Repo owner/repo to publish." }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "The GitHub CLI (gh) is not installed or not on PATH." }
$notesFile = Join-Path $out 'notes.md'; [IO.File]::WriteAllText($notesFile, ("## Dialed $Version`n`n" + (($Notes | ForEach-Object { "- $_" }) -join "`n") + "`n"), $utf8)
if (-not $Package) { throw "Pass -Package <path to Dialed-win-x64.zip>. Without it the website's Download link breaks, because 'latest' would have no package." }
if ((Split-Path $Package -Leaf) -ne 'Dialed-win-x64.zip') { throw "The package must be named Dialed-win-x64.zip (the website links to that exact name)." }
$assets = @($zip, $manifestPath, $Package)
if ($Installer) {
  if ((Split-Path $Installer -Leaf) -ne 'Dialed-Setup.exe') { throw "The installer must be named Dialed-Setup.exe (the website links to that exact name)." }
  if (-not (Test-Path $Installer)) { throw "Cannot find $Installer" }
  $assets += $Installer
}
# Checksums: anyone (or an antivirus vendor reviewing a false alarm) can confirm a download is the exact file that was released.
$sumLines = @(foreach ($a in $assets) { if ($a -ne $manifestPath) { "{0}  {1}" -f (Get-FileHash $a -Algorithm SHA256).Hash.ToLower(), (Split-Path $a -Leaf) } })
$sumFile = Join-Path $out 'SHA256SUMS.txt'; [IO.File]::WriteAllText($sumFile, (($sumLines -join "`n") + "`n"), $utf8)
$assets += $sumFile
[IO.File]::AppendAllText($notesFile, "`nChecksums (SHA-256, also attached as SHA256SUMS.txt):`n`n" + (($sumLines | ForEach-Object { "    $_" }) -join "`n") + "`n", $utf8)
gh release create "v$Version" @assets --repo $Repo --title "Dialed $Version" --notes-file $notesFile
"`nPublished. Dialed will offer this update to everyone on an older version."
