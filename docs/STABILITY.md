# Stability acceptance

## Repeatable checks

Run the normal build first. Stability tests use isolated generated projects and never modify user projects.

```powershell
npm run build
npm run test:stability
```

The one-hour export is opt-in because it renders 108,000 frames and temporarily writes a full-length PCM audio mix:

```powershell
$env:OPENCUT_LONG_EXPORT='1'
npm run test:stability -- tests/stability/export-long.spec.ts
```

To test an unpacked release, set `OPENCUT_EXECUTABLE` to its absolute `OpenCut.exe` path before running the tests.

## 2026-10-12 measurements

Hardware: Intel Core i7-8700K, 16 GiB RAM, Windows desktop. These measurements do not establish performance on all laptops.

The timeline test imports generated 1080p30 footage and builds five video tracks, each containing 180 clips. The resulting timeline spans one hour with 900 clips. It measures ten seconds of playback at half preview quality, discarding the initial one-second warm-up. Four tracks are positioned as picture-in-picture overlays. No expensive visual effects are enabled.

Before cleanup changes: 48.87 rendered frames/s, 29.6 ms p95 frame interval, 30 ms renderer selection response. After cleanup changes: 49.36 frames/s, 27.7 ms p95, 37.8 ms selection response. Both runs meet the 24 fps / 100 ms targets on this machine. The selection metric measures pointer dispatch through the selected-clip DOM update; it excludes operating-system input latency. This is a short playback sample on a long timeline, not one hour of continuous preview playback.

The export test renders an actual one-hour MP4 at 480p30 through the normal hidden renderer, IPC frame transfer and FFmpeg encoder. Matched full-frame flashes and 1 kHz beeps occur near the beginning and end. Decoded audio onset and video flash times are compared, along with stream durations. Electron working-set memory is sampled during the run; FFmpeg child-process memory is not included. This synthetic timing fixture does not replace long real-footage, variable-frame-rate or 1080p CPU-throughput acceptance.

The packaged 0.10.5 performance run passed at 50.61 rendered frames/s, 27.7 ms p95 frame interval and 25.6 ms selection response. Stopping playback with the actual button also passed, verifying its position remains stable.

The one-hour export passed in 14.4 minutes. Audio and video durations were both exactly 3,600 seconds. Flash/beep offset was 0.0417 ms at both ends, with zero measured drift. Average Electron working-set growth between the first and last active thirds was 21.76 MiB, below the 256 MiB acceptance limit. These are synthetic 480p30 export measurements under the scope described above.

Detailed reports are written to `.test-data/performance-latest.json` and `.test-data/long-export-latest.json`.

## Fixes covered

- Media load/seek waits now terminate on errors, deadlines and source cancellation, removing listeners and timers on every exit path.
- Retired Web Audio source nodes and gain nodes are disconnected; silent video avoids creating an unnecessary audio graph.
- Font-readiness promises are retained only for currently active text.
- Timecodes use tabular digits so the playback button stays in place as time advances.

Remaining manual coverage is tracked in `SKIPPED.md`.
