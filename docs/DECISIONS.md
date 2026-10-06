# OpenCut implementation decisions

- User-requested name **OpenCut** overrides LocalCut throughout the supplied spec, including `%APPDATA%/OpenCut`.
- Milestones follow the supplied order; unimplemented editing capabilities are labelled rather than simulated.
- Electron 44.5.1 was the latest stable version returned by npm at bootstrap. Vite 7 is used because electron-vite 5 declares support through Vite 7.
- Whisper CPU binary is pinned to official v1.9.2 with the published SHA-256. The latest release metadata (v1.9.4) had no binary assets. Both model downloads have pinned SHA-256 checksums from the official Hugging Face repository.
- Downloading is explicit via the setup button or command. Normal renderer requests are limited to local resources; development additionally allows its loopback Vite server.
- Downloads stream to `.part` files, verify their checksum, and then replace the target. Optional `--small` downloads the higher-accuracy model too.
- Bundled tools live in `resources/tools` in development and the portable app's resources directory after packaging.
- The scaffold uses an original restrained graphite/lime interface and bundled Inter. No CapCut assets are included.
- Tailwind 4.3.3, Vitest 4.1.11 and Electron's maintained ZIP extractor replace older bootstrap dependencies after audit findings. Final M0 dependency audit reports zero vulnerabilities.
- The spec's PRJ-2 long-edge 1080 wording conflicts with its 1920×1080/1080×1920 export presets. Canvas settings support both explicit 1080p orientations; short edge is capped at 1080 and long edge at 1920.
- Project mutations save immediately and atomically; the prior valid JSON is retained for crash recovery. Imported source files are never copied or deleted. Duplicating a project copies its proxy/cache files so either project can be deleted independently.
- Project FPS is fixed after import in M1 because CFR proxies use the project rate. Changing FPS requires a new project until proxy regeneration is implemented.
- Media protocol responses explicitly serve HTTP-style byte ranges: forwarding file responses did not produce seekable video in Electron's custom protocol handler.
- M1 automated acceptance uses generated 1080p variable-frame-rate footage with audio, an MP3, and a transparent PNG. This does not constitute testing the full real-phone/long-audio media corpus.
- Timeline history retains 200 Immer patch steps. Linked clip edits preserve audio/video timing; copied and split groups receive independent link IDs.
- Export freezes a saved project snapshot and uses a separate hidden sandboxed window calling the same compositor. One RGBA frame at a time crosses typed IPC; FFmpeg stdin backpressure gates the next frame.
- Export renders to a uniquely named sibling `.partial.mp4`, then renames only on success. Cancellation cleans the partial file and temporary audio mix. Existing chosen output is preserved on failure/cancellation.
- Audio delays are expressed in 48 kHz samples to avoid millisecond rounding drift. Silent edits receive a duration-matched silent mix. In/out ranges trim the mixed content without changing source files.
- Encoder selection tests each GPU encoder with the actual output dimensions/settings before selection. Runtime GPU failure retries with libx264. NVENC and software output have both passed on this machine.
- Preview/export frame comparison allows small RGB errors from H.264's lossy encode and YUV420 color conversion; it does not claim byte-identical compressed output.

- Visual keyframe easing belongs to the outgoing key. Curves clamp to their first/last value outside the keyed interval. Trimming/splitting retains keys outside the visible clip range (including negative clip-relative times) so nonlinear curves remain exact rather than being approximated.
- Custom Bézier controls are constrained to the unit square to avoid transform/opacity overshoot.

References: [electron-vite requirements](https://electron-vite.org/guide/), [official Whisper releases](https://github.com/ggml-org/whisper.cpp/releases), [official model repository](https://huggingface.co/ggerganov/whisper.cpp).
