# RaceRoom VR settings (for when Dialed gets VR support)

Recorded 23 Nov 2026 from Sean's in-game session, by watching `Documents\My Games\SimBin\RaceRoom Racing Experience\UserData\graphics_options.xml`
(the same file as the flat-screen settings). Not used by Dialed yet: it is not for VR today.

## Foveated rendering (VR menu)
| In-game name | Key | Type | Range seen in game | Default (Sean's file) |
|---|---|---|---|---|
| Foveated rendering | `vrFoveatedRendering` | bool | on / off | false |
| Peripheral resolution | `vrFoveatedPeripheralScale` | float | 0.20 to 0.75 (20% to 75%), steps of 0.01 | 0.40 |
| Focus area width | `vrFoveatedFocusWidth` | float | 0.20 to 0.75, steps of 0.01 | 0.40 |
| Focus area height | `vrFoveatedFocusHeight` | float | 0.20 to 0.75 (stated by Sean; the watcher did not log the changes, the key holds 0.40) | 0.40 |
| Edge blending | `vrFoveatedFeather` | float | 0.00 to 0.20 (0% to 20%), steps of 0.01 | 0.10 |
| Horizontal offset | `vrFoveatedOffsetX` | float (degrees) | -20 to 20, steps of 1 | 0 |
| Vertical offset | `vrFoveatedOffsetY` | float (degrees) | -20 to 20, steps of 1 | -10 |

Values are written as 8-decimal floats (for example 0.39999998), so compare with a tolerance, never exactly.

## Other VR-related keys in the file (not changed in the session)
`vrMenuDistance` 2.0, `vrMenuSize` 1.0, `vrHudDistance` 0.5, `vrHudSize` 1.0, `renderVirtualRealityViewToMonitor` false.

## Related settings found along the way
- `sharpeningFactor`: 0.00 to 2.00 (the menu shows 0 to 200; default 0.30). A look setting with a small cost, shared with flat screen. Also appears in the VR menu as "Sharpening effects".
- `autoExposureFactor`: menu 0 to 200 in steps of 1, written as a float (1 = 1.0 in the file); default 0.
- `webMaxScreenHeight` (Menu/HUD resolution, 720 / 1080 / 1440 / 2160): lives in the same file. A heavy HUD resolution costs frame rate, so a VR advisor should check it.
- `useSSAA` (supersampling) with `multiSampleLevel` as the sample count: very heavy in VR.

## Ideas for the VR advisor
- Foveated rendering with a lower peripheral resolution is the biggest GPU saving RaceRoom offers in VR; the focus width/height decide how much of the view stays sharp.
- Suggest turning foveated rendering on first when the GPU is the limit, then lowering the peripheral scale in steps (0.40 -> 0.30 -> 0.25), never below 0.20.
- Leave the offsets alone (they depend on the headset and eye position).
- Test on the Pimax Dream Air (Sean's headset) before shipping; see tools\vr-probe.ps1 for the feasibility probe.
