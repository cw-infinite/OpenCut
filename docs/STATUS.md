# Milestone status

| Milestone | Status | Acceptance evidence |
|---|---|---|
| M0: scaffold and tools | Passed | Typecheck; 6 unit/integration tests; real Electron smoke test; screenshot reviewed; `npm run dev` launched; all 4 tools ready |
| M1: projects and media | Automated acceptance passed | 12 tests; Electron import/seek/restart test with generated 1080p VFR, MP3 and PNG; screenshot reviewed. Real phone corpus is still a manual follow-up. |
| M2: timeline and preview | Automated acceptance passed | 18 tests; Electron drag three clips, split/delete/undo/redo, canvas pixels, playback and persistence checks. Linked edits and transform handles implemented. Full hardware/media corpus remains unverified. |
| M3: MP4 export | Automated acceptance passed; portable build verified | Real 720p software and 1080p NVENC exports; MP4 H.264/yuv420p + AAC; duration/A-V stream lengths within one frame; decoded animated frame at 2.5 seconds matches preview within tolerance; cancel removes partial output. VLC is not installed, so VLC/manual playback remains unverified. |
| M4: animation and motion | Automated acceptance passed | Keyframes/easing/custom Bézier, speed, 12 transitions, reverse and freeze. 34 unit/integration tests; four Electron tests. Actual 0.5×/2× MP4 duration and 440 Hz pitch checks; dissolve frame matches preview; reverse frame order across chunk boundaries and freeze/undo verified. |
| M5–M9 | Not started | Awaiting the prior milestone gates |
| M10 | Optional, deferred | Only after M0–M9 are solid |
