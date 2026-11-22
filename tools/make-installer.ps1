<#
.SYNOPSIS
  Builds the Dialed installer (release\Dialed-Setup.exe) from the package folder release\Dialed-win-x64.
.DESCRIPTION
  Needs Inno Setup 6 (winget install JRSoftware.InnoSetup). Run it AFTER building the package folder for the version, so the installer holds the same files as the zip.
.EXAMPLE
  .\tools\make-installer.ps1 -Version 0.3.10
#>
param([Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
      [string]$TestInstall = '')   # a folder: builds a throwaway installer there (own AppId, no admin) for testing the updater, never touching release\
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$iscc = @((Get-Command iscc -ErrorAction SilentlyContinue).Source, 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe', 'C:\Program Files\Inno Setup 6\ISCC.exe', "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 was not found. Install it with: winget install --id JRSoftware.InnoSetup' }
$pkg = Join-Path $root 'release\Dialed-win-x64'
if (-not (Test-Path (Join-Path $pkg 'Dialed.exe'))) { throw "The package folder $pkg is missing. Publish the program into it first." }
$extra = @()
if ($TestInstall) { New-Item -ItemType Directory -Force $TestInstall | Out-Null; $extra = @('/DTestInstall', "/O$TestInstall") }
& $iscc "/DAppVersion=$Version" "/DSourceDir=$pkg" @extra (Join-Path $PSScriptRoot 'installer.iss') | Select-Object -Last 6
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed (exit $LASTEXITCODE)" }
$out = if ($TestInstall) { Join-Path $TestInstall 'Dialed-Setup.exe' } else { Join-Path $root 'release\Dialed-Setup.exe' }
"{0}  ({1:N1} MB)" -f $out, ((Get-Item $out).Length / 1MB)
