# Dialed by F1GamerDad — Sim Graphics Optimiser

Capture a few laps with PresentMon, and Dialed reads your simulator's graphics settings and tells you which ones to
change first for a smoother frame rate. It is rules-based (no AI at run time), remembers what you changed each round,
and can revert changes that did not help. VR is supported for iRacing only, tested on a Pimax Dream Air.

Supported: iRacing, Le Mans Ultimate, Automobilista 2, Assetto Corsa (the original, including Custom Shaders Patch settings), Assetto Corsa Competizione, Assetto Corsa EVO and RaceRoom. BeamNG.drive and Project Motor Racing are built and shown as "Coming soon"; they arrive as fast follow updates once tested on track.

## Using it
1. Open Dialed **before** you start the sim (it asks for administrator rights; a prompt during a full-screen game can freeze it).
2. Pick your sim, press the capture hotkey while driving, take three captures, then read the priority list.
3. Tick the changes you want and press Apply. Backups of your files go in a visible *Dialed Backups* folder.

## Updates
Dialed checks this repository's latest release when it opens. Page and settings-table updates are checked against a SHA-256
fingerprint, the previous version is kept so you can revert, and no program files are installed that way. Program updates
use the release's installer, which is checked (size, SHA-256, a real Windows program, the release's version) before it runs.
Unless switched off in About, both install by themselves when Dialed opens and no capture or game is running.

## For the maintainer
Build: `dotnet build app/TunerApp.csproj -c Release` (needs the .NET 8 SDK; WebView2 runtime on the PC).
Publish an update: `tools/publish-release.ps1 -Version 0.2.0 -Notes "What changed" -Repo owner/repo` (use `-DryRun` first).

See `THIRD_PARTY_NOTICES.md` for included components.

## What it does beyond the settings list

- **PC check:** memory speed against its rating (XMP/EXPO), power plan, screen refresh rates, screens on the built-in graphics, graphics card link and Resizable BAR (NVIDIA), driver age, Windows gaming settings and storage. Rules only, nothing is changed.
- **Frame times:** each capture drawn over time with the stutters marked and explained.
- **Your setup:** screen sync, streaming, and settings Dialed must never change or never turn up.
- **Saved profiles**, **three runs in a row**, a **share image** for a before/after result, **badges**, and an optional **Share my result** (anonymous, shown to you before sending, off until a form is configured in config.js).
