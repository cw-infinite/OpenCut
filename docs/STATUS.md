# Milestone status

| Milestone | Status | Acceptance evidence |
|---|---|---|
| M0: scaffold and tools | Passed | Typecheck; 6 unit/integration tests; real Electron smoke test; screenshot reviewed; `npm run dev` launched; all 4 tools ready |
| M1: projects and media | Automated acceptance passed | 12 tests; Electron import/seek/restart test with generated 1080p VFR, MP3 and PNG; screenshot reviewed. Real phone corpus is still a manual follow-up. |
| M2: timeline and preview | Automated acceptance passed | 18 tests; Electron drag three clips, split/delete/undo/redo, canvas pixels, playback and persistence checks. Linked edits and transform handles implemented. Full hardware/media corpus remains unverified. |
| M3: MP4 export | Automated acceptance passed; portable build verified | Real 720p software and 1080p NVENC exports; MP4 H.264/yuv420p + AAC; duration/A-V stream lengths within one frame; decoded animated frame at 2.5 seconds matches preview within tolerance; cancel removes partial output. VLC is not installed, so VLC/manual playback remains unverified. |
| M4: animation and motion | In progress | Visual position/scale/rotation/opacity keyframes, easing and custom Bézier interpolation; split/trim preserve exact curves. 27 unit tests and animated export frame comparison passed. Speed, transitions, reverse/freeze and volume keyframes remain. |
| M5–M9 | Not started | Awaiting the prior milestone gates |
| M10 | Optional, deferred | Only after M0–M9 are solid |
