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
| M7: offline captions | In progress; core workflow verified in packaged 0.6.1 | Real base.en generation, selected-clip speed/offset mapping, cancellation, list editing, SRT round-trip/persistence and timed caption burn-in to software MP4 pass in Electron. 45 unit/integration tests and ten desktop regressions pass. Animated caption presets, configurable line count, small.en UI, filler removal and long-speech timing/manual-player acceptance remain. |
| M8: visual effects | Not started | Filters, effects, masks, chroma key and PiP controls |
| M9: export and project polish | Not started | Batch exports, platform presets, size estimates, frame export, silence removal, relink and remaining recording tools |
| M10 | Optional, deferred | Only after M0–M9 are solid |

## 0.5.1 Projects crash fix

Opening Projects could restore an audio project whose waveform cache used `{ buckets, peaks }` and crash with `peaks.slice is not a function`. The cache reader now supports that format and plain arrays, and tolerates damaged caches. Typecheck and all 39 unit/integration tests pass. Both Projects navigation regressions and the startup check pass in the packaged app. An isolated copy of the affected existing project also opens and returns to Projects without renderer errors; original project files were not changed.
