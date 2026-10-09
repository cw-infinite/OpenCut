# Milestone status

| Milestone | Status | Acceptance evidence |
|---|---|---|
| M0: scaffold and tools | Passed | Typecheck; 6 unit/integration tests; real Electron smoke test; screenshot reviewed; `npm run dev` launched; all 4 tools ready |
| M1: projects and media | Automated acceptance passed | 12 tests; Electron import/seek/restart test with generated 1080p VFR, MP3 and PNG; screenshot reviewed. Real phone corpus is still a manual follow-up. |
| M2: timeline and preview | Automated acceptance passed | 18 tests; Electron drag three clips, split/delete/undo/redo, canvas pixels, playback and persistence checks. Linked edits and transform handles implemented. Full hardware/media corpus remains unverified. |
| M3: MP4 export | Automated acceptance passed; portable build verified | Real 720p software and 1080p NVENC exports; MP4 H.264/yuv420p + AAC; duration/A-V stream lengths within one frame; decoded animated frame at 2.5 seconds matches preview within tolerance; cancel removes partial output. VLC is not installed, so VLC/manual playback remains unverified. |
| M4: animation and motion | Automated acceptance passed | Keyframes/easing/custom Bézier, speed, 12 transitions, reverse and freeze. 34 unit/integration tests; four Electron tests. Actual 0.5×/2× MP4 duration and 440 Hz pitch checks; dissolve frame matches preview; reverse frame order across chunk boundaries and freeze/undo verified. |
| M5: text and animation | Automated acceptance passed; portable 0.5 build produced | Typecheck, 37 unit/integration tests, and all six Electron regression tests pass; title editing, char typewriter, stroke/shadow/background, saved-style restore; real 1080p NVENC and libx264 exports match preview at entrance, middle, and exit. Screenshot reviewed. The packaged app also passes launch/tool checks and the software title-export test. |
| M6: advanced audio | Automated acceptance passed; portable launch verified | Master gain/solo, fades, ducking, onset markers, export cleanup, WAV/MP3/AAC, microphone voiceover. 42 unit/integration tests and nine Electron tests pass; measured ducking gain, decoded audio durations, fake-microphone recording and persistence verified. Physical microphone/manual listening remain unverified. |
| M7: offline captions | Automated acceptance passed on base.en | 50 unit/integration tests and all 12 desktop tests pass. Animated presets match MP4 frames; two-minute synthetic speech has 25 phrase anchors with maximum 110 ms onset offset. Filler cuts, linked/reverse/speed timing and undo verified. small.en availability/download controls implemented; actual optional-model inference and real human/VLC acceptance remain unverified. |
| M8: visual effects | Automated acceptance passed | All 31 effect/filter/adjustment/blend/mask/chroma/PiP cases change preview and match exported frames. 54 unit/integration tests and all 13 desktop tests passed at the M8 gate. Hardware performance and long-project acceptance remain manual follow-ups. |
| M9: export and project polish | Automated acceptance passed | Typecheck, 57 unit/integration tests and all 16 desktop tests pass. Sequential 1080p/720p/480p export, TikTok 1080×1920/30, estimates, PNG/JPEG frames and duplicate-safe covers, batch cancel cleanup, silence removal/undo, missing-media relink, markers/groups, synthetic webcam and isolated test-window recording verified. Physical devices/system audio need manual acceptance. |
| M10 | Optional, deferred | Only after M0–M9 are solid |

## 0.9.1 editing improvements

Larger interface labels (14 px minimum), pointer-based live group dragging with one undo entry, marquee selection across tracks in all four directions, Shift-click individual toggles, bulk inspector actions, and whole-group duplication are implemented. Preview follows the canvas aspect ratio, has 25–300% display zoom/Fit and a resizable upper workspace, and fullscreen works with both the exit button and Escape.

Typecheck, 59 unit/integration tests and all 18 desktop tests pass, including bulk media volume/mute persistence, bulk text sizing, undo, and the existing export/effects regressions. Three further checks pass in the packaged app: startup/tools and both editing workflows, including zoom/fullscreen. Release output: `dist/0.9.1/`.

## 0.9.0 release verification

The packaged Windows app passes four additional desktop checks: startup and bundled tools, batch/platform/frame/cover exports with cancellation, silence removal and relink, and synthetic webcam plus isolated test-window recording. Build output is `dist/0.9.0/`; the portable executable is `OpenCut-0.9.0-x64.exe`. Physical devices, system audio, optional small.en inference and long-project/manual media acceptance remain outstanding as listed in `SKIPPED.md`.

## 0.5.1 Projects crash fix

Opening Projects could restore an audio project whose waveform cache used `{ buckets, peaks }` and crash with `peaks.slice is not a function`. The cache reader now supports that format and plain arrays, and tolerates damaged caches. Typecheck and all 39 unit/integration tests pass. Both Projects navigation regressions and the startup check pass in the packaged app. An isolated copy of the affected existing project also opens and returns to Projects without renderer errors; original project files were not changed.
