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
  [string]$MinHost = '0.2.0',   # the oldest Dialed.exe this page works with (0.2.0 added Report a problem and the log). Raise it only when the page needs a newer program
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
Get-ChildItem $stage -Recurse -Include *.mp4,*.exe,*.dll | Remove-Item -Force      # page updates never carry big media or program files

# 2. stamp the version
(@{ version = $Version; minHost = $MinHost } | ConvertTo-Json) | Set-Content (Join-Path $stage 'version.json') -Encoding UTF8
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
$manifestPath = Join-Path $out 'latest.json'
($manifest | ConvertTo-Json) | Set-Content $manifestPath -Encoding UTF8

"Built $zip  ($([math]::Round($size/1KB)) KB)"
"SHA-256  $sha"
"Manifest $manifestPath"
Get-Content $manifestPath

if ($DryRun) { "`nDry run: nothing was published."; return }
if (-not $Repo) { throw "Pass -Repo owner/repo to publish." }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "The GitHub CLI (gh) is not installed or not on PATH." }
$notesFile = Join-Path $out 'notes.md'; ("## Dialed $Version`n`n" + (($Notes | ForEach-Object { "- $_" }) -join "`n")) | Set-Content $notesFile -Encoding UTF8
if (-not $Package) { throw "Pass -Package <path to Dialed-win-x64.zip>. Without it the website's Download link breaks, because 'latest' would have no package." }
if ((Split-Path $Package -Leaf) -ne 'Dialed-win-x64.zip') { throw "The package must be named Dialed-win-x64.zip (the website links to that exact name)." }
gh release create "v$Version" $zip $manifestPath $Package --repo $Repo --title "Dialed $Version" --notes-file $notesFile
"`nPublished. Dialed will offer this update to everyone on an older version."
