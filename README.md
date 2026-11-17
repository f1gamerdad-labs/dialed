# Dialed by F1GamerDad — Sim Graphics Optimiser

Capture a few laps with PresentMon, and Dialed reads your simulator's graphics settings and tells you which ones to
change first for a smoother frame rate. It is rules-based (no AI at run time), remembers what you changed each round,
and can revert changes that did not help. Not for VR.

Supported: iRacing, Le Mans Ultimate, Automobilista 2, Assetto Corsa Competizione, Assetto Corsa EVO, BeamNG.drive, Project Motor Racing and RaceRoom. All but iRacing and Le Mans Ultimate are new and low confidence until tested on track; AC EVO covers only four proven settings so far.

## Using it
1. Open Dialed **before** you start the sim (it asks for administrator rights; a prompt during a full-screen game can freeze it).
2. Pick your sim, press the capture hotkey while driving, take three captures, then read the priority list.
3. Tick the changes you want and press Apply. Backups of your files go in a visible *Dialed Backups* folder.

## Updates
Dialed checks this repository's latest release for page and settings-table updates. You click **Update now**; it
checks a SHA-256 fingerprint, keeps the previous version so you can revert, and never installs program files that way.

## For the maintainer
Build: `dotnet build app/TunerApp.csproj -c Release` (needs the .NET 8 SDK; WebView2 runtime on the PC).
Publish an update: `tools/publish-release.ps1 -Version 0.2.0 -Notes "What changed" -Repo owner/repo` (use `-DryRun` first).

See `THIRD_PARTY_NOTICES.md` for included components.
